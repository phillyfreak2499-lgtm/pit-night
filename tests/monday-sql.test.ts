/** The Monday job's and Claude copy's SQL, run against a throwaway embedded Postgres with the real migrations. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../src/lib/db.ts";
import { claimJob, readJob, saveJob, writeSeasonDoc } from "../src/lib/pit/monday-job.server.ts";
import { claimCopy, finishCopy, readCopy } from "../src/lib/pit/claude-store.ts";

async function disposableDb(): Promise<{ sql: Sql; pg: PGlite }> {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const run = async <T>(text: string, params: unknown[]) => (await pg.query<T>(text, params)).rows;
  const sql = (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0]!;
    values.forEach((_, i) => (text += `$${i + 1}${strings[i + 1]}`));
    return run<T>(text, values);
  }) as unknown as Sql;
  sql.query = (text: string, params: unknown[] = []) => run(text, params);
  await pg.query("insert into pit_season (id, rev, doc) values ('main', 1, $1)", ['{"week":1}']);
  return { sql, pg };
}

test("scorecard write: snapshot and update land together, and a stale rev changes nothing", async () => {
  const { sql, pg } = await disposableDb();
  const rev = await writeSeasonDoc(sql, 1, '{"week":1,"scored":true}', { jobKey: "p12-w1-2026-10-31", step: "scorecard" });
  assert.equal(rev, 2);
  const snap = (await pg.query<{ rev: number; doc: string }>("select rev, doc from pit_season_snapshots")).rows;
  assert.deepEqual(snap, [{ rev: 1, doc: '{"week":1}' }], "the pre-update season is recoverable");
  assert.equal(await writeSeasonDoc(sql, 1, '{"lost":true}', { jobKey: "p12-w1-2026-10-31", step: "card" }), null);
  const season = (await pg.query<{ rev: number; doc: string }>("select rev, doc from pit_season")).rows[0]!;
  assert.deepEqual(season, { rev: 2, doc: '{"week":1,"scored":true}' });
  assert.equal((await pg.query("select 1 from pit_season_snapshots")).rows.length, 1, "no orphan snapshot from the refused write");
});

test("job claim: one holder at a time, blocked jobs retry, finished jobs stay finished", async () => {
  const { sql, pg } = await disposableDb();
  const key = "p12-w1-2026-10-31";
  assert.ok(await claimJob(sql, key));
  assert.equal(await claimJob(sql, key), null, "a second run is excluded while the lease holds");
  await saveJob(sql, key, { status: "blocked", report: "missing store" });
  const retry = await claimJob(sql, key);
  assert.equal(retry?.status, "running");
  await saveJob(sql, key, { stage: "staged", staged: [{ storeId: "waco", storeName: "Waco", values: {} as never, grades: {} as never }], queryIds: ["q1"] });
  await pg.query("update pit_monday_jobs set lease_until = now() - interval '1 minute' where job_key = $1", [key]);
  const resumed = await claimJob(sql, key);
  assert.equal(resumed?.stage, "staged", "an abandoned run resumes from its saved stage");
  assert.deepEqual(resumed?.queryIds, ["q1"]);
  await saveJob(sql, key, { status: "success", report: "done" });
  assert.equal(await claimJob(sql, key), null);
  assert.equal((await readJob(sql, key))?.report, "done");
});

test("Claude copy is written once and a ready row is never rewritten", async () => {
  const { sql, pg } = await disposableDb();
  assert.equal(await claimCopy(sql, "bout", "w1-bout-1:abc", "claude-haiku-5-5"), true);
  assert.equal(await claimCopy(sql, "bout", "w1-bout-1:abc", "claude-haiku-5-5"), false, "a second viewer waits for the first");
  await finishCopy(sql, "bout", "w1-bout-1:abc", { body: "Steel on steel." });
  await pg.query("update pit_claude_text set claimed_at = now() - interval '1 day'");
  assert.equal(await claimCopy(sql, "bout", "w1-bout-1:abc", "claude-haiku-5-5"), false);
  assert.deepEqual(await readCopy(sql, "bout", "w1-bout-1:abc"), { status: "ready", body: "Steel on steel." });
  assert.equal(await claimCopy(sql, "hype", "m1", "claude-haiku-5-5"), true);
  await finishCopy(sql, "hype", "m1", { error: "API down" });
  assert.equal(await claimCopy(sql, "hype", "m1", "claude-haiku-5-5"), false, "a failure waits before retrying");
  await pg.query("update pit_claude_text set claimed_at = now() - interval '11 minutes' where kind = 'hype'");
  assert.equal(await claimCopy(sql, "hype", "m1", "claude-haiku-5-5"), true);
});
