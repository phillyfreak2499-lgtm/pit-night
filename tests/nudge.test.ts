import { gameReminders } from "../src/lib/pit/game-reminders.ts";
/** Daily 8 a.m. store reminders: what they say, when they go, and never twice a day. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createStore } from "zustand/vanilla";
import { PGlite } from "@electric-sql/pglite";
import { pitCreator } from "../src/lib/pit/store.ts";
import { nudgeFor } from "../src/lib/pit/nudge.ts";
import { centralHour, sendDailyNudges, validEmail } from "../src/lib/pit/nudge.server.ts";
import type { Sql } from "../src/lib/db.ts";
import type { PitData } from "../src/lib/pit/types.ts";

/** Week 1 with opening coins paid, the way the league stands during Pit Week. */
function league(): PitData {
  const store = createStore(pitCreator);
  store.setState({ session: { role: "commissioner", storeId: null, crewId: null } });
  const s = store.getState();
  for (const st of s.stores) for (const m of ["nsnu", "conv", "demoRate", "demoClose", "arch", "ticket"] as const) s.setKickoffGrade(st.id, m, "blue");
  store.getState().applyKickoff();
  return { ...store.getState(), session: { role: "public", storeId: null, crewId: null } };
}

const WED_8AM = new Date("2026-10-28T13:00:00Z"); // 8:00 a.m. CDT, Pit Week 1 Wednesday

test("a Pit Week morning lists jobs, the Spark and coins, with no names or codes", () => {
  const data = league();
  const n = nudgeFor(data, "plano", WED_8AM)!;
  assert.ok(n, "Plano has things to do");
  assert.match(n.subject, /^Plano: \d+ jobs \+ Daily Spark open today$/);
  assert.ok(n.lines.some((l) => /Pit Week jobs? left today \(Wednesday\)/.test(l)));
  assert.ok(n.lines.some((l) => /Daily Spark is open/.test(l)));
  assert.ok(n.lines.some((l) => /coins waiting in your Shop/.test(l)));
  assert.match(n.html, /thewatermangames\.live\/shop\/plano/);
  for (const c of data.crew) assert.ok(!n.text.includes(c.name), "no crew names in the email");
  assert.doesNotMatch(n.text, /code|PIN|passcode/i);
});

test("no reminder on non-Pit-Week days or after the lock", () => {
  const data = league();
  assert.equal(nudgeFor(data, "plano", new Date("2026-10-26T13:00:00Z")), null, "Monday");
  assert.equal(nudgeFor(data, "plano", new Date("2026-11-01T14:00:00Z")), null, "Sunday");
  assert.equal(nudgeFor(data, "plano", new Date("2026-11-01T00:30:00Z")), null, "after the Saturday 6 p.m. lock");
  assert.equal(nudgeFor({ ...data, phase: "locked" }, "plano", WED_8AM), null, "bots locked");
  const sat = nudgeFor(data, "plano", new Date("2026-10-31T13:00:00Z"))!;
  assert.ok(sat.lines.some((l) => /Builds lock today: Saturday, Oct 31, 6:00 PM CT/.test(l)));
});

test("8 a.m. Central is 13:00 UTC in daylight time and 14:00 UTC in standard time", () => {
  assert.equal(centralHour(new Date("2026-10-28T13:00:00Z")), 8);
  assert.equal(centralHour(new Date("2026-10-28T14:00:00Z")), 9);
  assert.equal(centralHour(new Date("2026-11-04T13:00:00Z")), 7);
  assert.equal(centralHour(new Date("2026-11-04T14:00:00Z")), 8);
  assert.equal(validEmail("plano@goodfeet.example"), true);
  assert.equal(validEmail("not an email"), false);
});

async function disposableDb(): Promise<Sql> {
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
  return sql;
}

test("each store is emailed at most once a day; a failed send retries on the next run", async (t) => {
  const sql = await disposableDb();
  await sql`insert into pit_store_contacts (store_id, email) values ('plano', 'plano@example.com'), ('waco', 'waco@example.com')`;
  process.env.RESEND_API_KEY = "test-key";
  process.env.NUDGE_FROM = "League <league@example.com>";
  const sent: string[] = [];
  let failWaco = true;
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    const to = (JSON.parse(String(init.body)) as { to: string[] }).to[0]!;
    if (to.startsWith("waco") && failWaco) return new Response(JSON.stringify({ message: "rate limited" }), { status: 429 });
    sent.push(to);
    return new Response("{}", { status: 200 });
  });
  const data = league();
  const first = await sendDailyNudges(sql, data, WED_8AM);
  assert.deepEqual([first.sent, first.failed], [1, 1]);
  const again = await sendDailyNudges(sql, data, WED_8AM);
  assert.equal(again.sent, 0, "Plano is not emailed twice while Waco still fails");
  failWaco = false;
  const retry = await sendDailyNudges(sql, data, WED_8AM);
  assert.equal(retry.sent, 1, "Waco's failed send goes through on the next run");
  assert.deepEqual(sent.sort(), ["plano@example.com", "waco@example.com"]);
  await sql`insert into pit_nudge_settings (id, paused) values ('main', true)`;
  const paused = await sendDailyNudges(sql, data, new Date("2026-10-29T13:00:00Z"));
  assert.equal(paused.sent, 0);
  delete process.env.RESEND_API_KEY;
  delete process.env.NUDGE_FROM;
});

test('in-game reminders start at 5pm and yesterday follow-ups at 9am Central',()=>{
 const data=league();
 assert.equal(gameReminders(data,'plano',new Date('2026-10-28T13:59:00Z')).length,0);
 assert.ok(gameReminders(data,'plano',new Date('2026-10-28T14:00:00Z')).every(r=>r.title.startsWith('Follow up')));
 assert.equal(gameReminders(data,'plano',new Date('2026-10-28T21:59:00Z')).some(r=>r.title.startsWith('Before')),false);
 assert.equal(gameReminders(data,'plano',new Date('2026-10-28T22:00:00Z')).some(r=>r.title.startsWith('Before')),true);
 assert.equal(gameReminders(data,'missing',new Date('2026-10-28T22:00:00Z')).length,0);
});
