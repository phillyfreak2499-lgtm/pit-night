/** Claude copy on disposable data: what Claude may see, the number guard, and write-once storage. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createStore } from "zustand/vanilla";
import { PGlite } from "@electric-sql/pglite";
import { pitCreator } from "../src/lib/pit/store.ts";
import { boutSubject, hypeSubject, recapSubject, unsupportedNumbers, upcomingMatchups } from "../src/lib/pit/claude-copy.ts";
import { claimCopy, finishCopy, readCopy } from "../src/lib/pit/claude-store.ts";
import type { Sql } from "../src/lib/db.ts";

/** A week-1 league run by the Desk: kickoff paid, Sunday NSNU recorded, card run. */
function league(run: boolean) {
  const store = createStore(pitCreator);
  store.setState({ session: { role: "commissioner", storeId: null, crewId: null } });
  const s = store.getState();
  for (const st of s.stores) for (const m of ["nsnu", "conv", "demoRate", "demoClose", "arch", "ticket"] as const) s.setKickoffGrade(st.id, m, "blue");
  store.getState().applyKickoff();
  if (run) {
    for (const st of store.getState().stores) store.getState().setOfficialNsnu(st.id, 950);
    store.getState().lockFriday();
    store.getState().runSaturday();
  }
  return store.getState();
}

test("commentary and recap come only from posted results, without codes or crew names", () => {
  const d = league(true);
  assert.equal(d.phase, "fought");
  const bout = d.bouts.find((b) => b.week === 1 && b.kind === "bout")!;
  const subject = boutSubject(d, bout.id)!;
  assert.ok(subject.key.startsWith(bout.id));
  assert.equal(boutSubject(d, "w1-bout-99-nobody"), null);
  assert.equal(boutSubject(league(false), bout.id), null, "no commentary before the card runs");
  const recap = recapSubject(d, 1)!;
  assert.equal((recap.facts.results as unknown[]).length, 7);
  assert.equal(recapSubject(d, 2), null);
  const facts = JSON.stringify([subject.facts, recap.facts]);
  assert.doesNotMatch(facts, /passcode|"pin"|code/i);
  for (const c of d.crew) assert.ok(!facts.includes(`"${c.name}"`), "no crew names reach Claude");
  assert.match(facts, /"officialNsnuDollars":950/);
});

test("the number guard rejects stats the facts do not contain", () => {
  const facts = { damage: 12, record: "2-1", nsnu: 1032.05 };
  assert.deepEqual(unsupportedNumbers("Hit for 12 to go 2-1 on $1,032.05", facts), []);
  assert.deepEqual(unsupportedNumbers("Hit for 999", facts), ["999"]);
});

test("hype covers the upcoming card before it runs, hides builds, and stops after", () => {
  const d = league(false);
  const matchups = upcomingMatchups(d);
  assert.equal(matchups.length, 7);
  const h = hypeSubject(d, matchups[0]!.id)!;
  assert.doesNotMatch(JSON.stringify(h.facts), /weapon"|chassis"|armor"/);
  assert.equal(upcomingMatchups(league(true)).length, 0);
});

test("copy is claimed once, written once, and a ready row is never rewritten", async () => {
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

  assert.equal(await claimCopy(sql, "bout", "b1", "claude-haiku-5-5"), true);
  assert.equal(await claimCopy(sql, "bout", "b1", "claude-haiku-5-5"), false, "a second viewer waits");
  await finishCopy(sql, "bout", "b1", { body: "Steel on steel." });
  await pg.query("update pit_claude_text set claimed_at = now() - interval '1 day'");
  assert.equal(await claimCopy(sql, "bout", "b1", "claude-haiku-5-5"), false);
  assert.deepEqual(await readCopy(sql, "bout", "b1"), { status: "ready", body: "Steel on steel." });
  assert.equal(await claimCopy(sql, "hype", "m1", "claude-haiku-5-5"), true);
  await finishCopy(sql, "hype", "m1", { error: "API down" });
  assert.equal(await claimCopy(sql, "hype", "m1", "claude-haiku-5-5"), false, "a failure waits before retrying");
  await pg.query("update pit_claude_text set claimed_at = now() - interval '11 minutes' where kind = 'hype'");
  assert.equal(await claimCopy(sql, "hype", "m1", "claude-haiku-5-5"), true);
});
