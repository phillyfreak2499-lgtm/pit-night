/**
 * Monday job and Claude copy on disposable data: an in-memory season and
 * synthetic Snowflake rows (no real store numbers live in this public repo).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "zustand/vanilla";
import { pitCreator, sharedDoc } from "../src/lib/pit/store.ts";
import { makeData } from "../src/lib/pit/seed.ts";
import {
  STORE_MAP,
  applyScorecard,
  eligibility,
  runMondayJob,
  stage,
  type JobIO,
  type JobRow,
  type RawRow,
  type SnowflakeRead,
} from "../src/lib/pit/monday-import.ts";
import { boutSubject, hypeSubject, recapSubject, unsupportedNumbers, upcomingMatchups } from "../src/lib/pit/claude-copy.ts";
import { sqlDate } from "../src/lib/pit/snowflake.server.ts";
import type { PitData } from "../src/lib/pit/types.ts";

const WEEK1 = { start: "2026-10-25", end: "2026-10-31" };
const MONDAY_530_CST = new Date("2026-11-02T11:30:00Z");

function row(m: (typeof STORE_MAP)[number], i: number, patch: Partial<RawRow> = {}): RawRow {
  return {
    store: m.name,
    store_number: m.number,
    franchise: m.franchise,
    net_sales: String(15000 + i * 1111.11),
    new_ups: String(20 + i),
    walkouts: String(i % 2),
    demos_seen: String(16 + i),
    demos_sold: String(10 + (i % 5)),
    demo_sales: String(16000 + i * 333),
    arch_supports_sold: String(30 + i * 2),
    arch_supports_returned: i % 3 ? String(i) : null,
    ...patch,
  };
}
const goodRead = (latest = "2026-11-01", rows = STORE_MAP.map((m, i) => row(m, i))): SnowflakeRead => ({
  rows,
  latestDate: latest,
  queryIds: [`q-${Math.random().toString(36).slice(2, 8)}`],
});

/** A week-1 league the way the Desk leaves it Saturday night: kickoff applied, one bay locked early. */
function league(): PitData {
  const store = createStore(pitCreator);
  store.setState({ session: { role: "commissioner", storeId: null, crewId: null } });
  const s = store.getState();
  for (const st of s.stores) for (const m of ["nsnu", "conv", "demoRate", "demoClose", "arch", "ticket"] as const) s.setKickoffGrade(st.id, m, "blue");
  store.getState().applyKickoff();
  const data = store.getState();
  const plano = data.bots.find((b) => b.storeId === "plano")!;
  return { ...data, bots: data.bots.map((b) => (b.storeId === "plano" ? { ...b, locked: { ...plano.draft } } : b)) };
}

type Mem = { io: JobIO; rev: () => number; data: () => PitData; snapshots: string[]; jobs: Map<string, JobRow & { lease: number }> };

function memory(start: PitData, opts: { now?: Date; reads?: SnowflakeRead[]; failCardWriteOnce?: boolean; corruptScorecard?: boolean } = {}): Mem {
  let rev = 1;
  let doc = JSON.stringify(sharedDoc(start));
  const snapshots: string[] = [];
  const jobs = new Map<string, JobRow & { lease: number }>();
  let reads = opts.reads ?? [goodRead(), goodRead()];
  let failCard = opts.failCardWriteOnce ?? false;
  const clock = opts.now ?? MONDAY_530_CST;
  const parse = (): PitData => ({ ...start, ...JSON.parse(doc), session: { role: "public", storeId: null, crewId: null } });
  const io: JobIO = {
    now: () => clock,
    readSeason: async () => ({ rev, data: parse() }),
    async writeSeason(expected, next, snap) {
      if (expected !== rev) return null;
      if (snap.step === "card" && failCard) {
        failCard = false;
        throw new Error("Network dropped while posting the card.");
      }
      snapshots.push(`${snap.jobKey}:${snap.step}:${rev}`);
      let out = next;
      if (opts.corruptScorecard && snap.step === "scorecard")
        out = { ...next, storeCards: next.storeCards.map((c, i) => (i === 0 ? { ...c, conv: c.conv + 1 } : c)) };
      doc = JSON.stringify(sharedDoc(out));
      return ++rev;
    },
    async claim(key) {
      const cur = jobs.get(key);
      if (cur && !(["blocked", "failed"].includes(cur.status) || (cur.status === "running" && cur.lease < Date.now()))) return null;
      const next = { jobKey: key, status: "running" as const, stage: cur?.stage ?? ("claimed" as const), staged: cur?.staged ?? null, queryIds: cur?.queryIds ?? [], report: null, lease: Date.now() + 600_000 };
      jobs.set(key, next);
      return { ...next };
    },
    existing: async (key) => (jobs.get(key) ? { ...jobs.get(key)! } : null),
    async save(key, patch) {
      const cur = jobs.get(key);
      if (cur) jobs.set(key, { ...cur, ...patch });
    },
    async fetchWeek() {
      const next = reads[0] ?? goodRead();
      reads = reads.slice(1);
      return structuredClone(next);
    },
    sleep: async () => {},
    runCard(data) {
      const s = createStore(pitCreator);
      s.setState({ ...sharedDoc(data), session: { role: "commissioner", storeId: null, crewId: null }, flash: "" });
      if (s.getState().phase === "open") s.getState().lockFriday();
      s.getState().runSaturday();
      return s.getState();
    },
  };
  return { io, rev: () => rev, data: parse, snapshots, jobs };
}

test("Monday job imports all 84 values, locks, runs the card once and verifies", async () => {
  const start = league();
  const planoLock = start.bots.find((b) => b.storeId === "plano")!.locked;
  const m = memory(start);
  const res = await runMondayJob(m.io);
  assert.equal(res.outcome, "success", res.report);
  assert.equal(res.jobKey, "p12-w1-2026-10-31");
  const d = m.data();
  assert.equal(d.phase, "fought");
  assert.equal(d.week, 1);
  const bouts = d.bouts.filter((b) => b.week === 1 && b.kind === "bout");
  assert.equal(bouts.length, 7);
  assert.equal(new Set(bouts.flatMap((b) => b.storeIds)).size, 14);
  assert.ok(d.bots.every((b) => b.locked));
  assert.deepEqual(d.bots.find((b) => b.storeId === "plano")!.locked, planoLock, "an existing Saturday lock is preserved");
  assert.deepEqual(d.kickoff, start.kickoff, "Period 11 kickoff data is untouched");
  assert.deepEqual(d.bots.map((b) => b.coins), start.bots.map((b) => b.coins), "no coins are paid by the job");
  for (const c of d.storeCards.filter((c) => c.week === 1)) {
    assert.equal(c.nsnuOfficial, true);
    assert.equal(Object.keys(c.grades ?? {}).length, 6);
  }
  assert.deepEqual(m.snapshots.map((s) => s.split(":")[1]), ["scorecard", "card"]);
  assert.match(res.report, /SUCCESS[\s\S]*2026-10-25 to 2026-10-31[\s\S]*Read-back: all 84/);
  assert.doesNotMatch(res.report, /code|PIN|passcode/i);

  // Re-running the same Monday never rerolls or re-posts.
  const firstBouts = JSON.stringify(d.bouts);
  const again = await runMondayJob(m.io);
  assert.equal(again.outcome, "noop");
  assert.match(again.report, /Already completed/);
  assert.equal(JSON.stringify(m.data().bouts), firstBouts);
  assert.equal(m.snapshots.length, 2);
});

test("a run that loses the card write resumes the same job and posts exactly once", async () => {
  const m = memory(league(), { failCardWriteOnce: true, reads: [goodRead(), goodRead()] });
  const first = await runMondayJob(m.io);
  assert.equal(first.outcome, "failed");
  assert.equal(m.data().phase, "open", "nothing posted");
  assert.equal(m.data().storeCards.find((c) => c.week === 1)!.nsnuOfficial, true, "scorecard was saved atomically");
  const retry = await runMondayJob(m.io);
  assert.equal(retry.outcome, "success", retry.report);
  assert.match(retry.report, /Resumed job at stage "verified"/);
  assert.deepEqual(m.snapshots.map((s) => s.split(":")[1]), ["scorecard", "card"]);
});

test("a concurrent run holding the job is excluded", async () => {
  const m = memory(league());
  m.jobs.set("p12-w1-2026-10-31", { jobKey: "p12-w1-2026-10-31", status: "running", stage: "claimed", staged: null, queryIds: [], report: null, lease: Date.now() + 60_000 });
  const res = await runMondayJob(m.io);
  assert.equal(res.outcome, "noop");
  assert.equal(m.rev(), 1);
});

test("read-back mismatch fails the job and never runs the card", async () => {
  const m = memory(league(), { corruptScorecard: true });
  const res = await runMondayJob(m.io);
  assert.equal(res.outcome, "failed");
  assert.match(res.report, /Read-back did not match/);
  assert.equal(m.data().phase, "open");
  assert.equal(m.data().bouts.filter((b) => b.week === 1).length, 0);
});

for (const [name, reads, why] of [
  ["a missing store", [goodRead("2026-11-01", STORE_MAP.slice(1).map((m, i) => row(m, i + 1))), goodRead("2026-11-01", STORE_MAP.slice(1).map((m, i) => row(m, i + 1)))], /no Snowflake row/],
  ["a duplicate store", [goodRead("2026-11-01", [...STORE_MAP.map((m, i) => row(m, i)), row(STORE_MAP[3]!, 3)]), goodRead("2026-11-01", [...STORE_MAP.map((m, i) => row(m, i)), row(STORE_MAP[3]!, 3)])], /duplicate/],
  ["zero traffic", [goodRead("2026-11-01", STORE_MAP.map((m, i) => row(m, i, i === 2 ? { new_ups: "0", walkouts: "0" } : {}))), goodRead("2026-11-01", STORE_MAP.map((m, i) => row(m, i, i === 2 ? { new_ups: "0", walkouts: "0" } : {})))], /no new ups or walkouts/],
  ["a null metric", [goodRead("2026-11-01", STORE_MAP.map((m, i) => row(m, i, i === 5 ? { demo_sales: null } : {}))), goodRead("2026-11-01", STORE_MAP.map((m, i) => row(m, i, i === 5 ? { demo_sales: null } : {})))], /missing demoSales/],
  ["a stale source", [goodRead("2026-10-31"), goodRead("2026-10-31")], /may not be final/],
  ["a source still changing", [goodRead(), goodRead("2026-11-01", STORE_MAP.map((m, i) => row(m, i, i === 0 ? { net_sales: "1" } : {})))], /disagreed/],
  ["a renamed store number", [goodRead("2026-11-01", STORE_MAP.map((m, i) => row(m, i, i === 13 ? { store: "SHREVEPORT, LA (OLD)" } : {}))), goodRead("2026-11-01", STORE_MAP.map((m, i) => row(m, i, i === 13 ? { store: "SHREVEPORT, LA (OLD)" } : {})))], /expected "SHREVEPORT, LA"/],
] as const) {
  test(`Monday job blocks on ${name} and leaves the card unchanged`, async () => {
    const m = memory(league(), { reads: [...reads] });
    const res = await runMondayJob(m.io);
    assert.equal(res.outcome, "blocked", res.report);
    assert.match(res.report, why);
    assert.equal(m.rev(), 1, "nothing written");
    assert.equal(m.snapshots.length, 0);
  });
}

test("schedule: no card on other days, before 5 a.m. Central, for the championship, or when the site week does not match", () => {
  const d = league();
  assert.equal(eligibility(new Date("2026-11-03T12:00:00Z"), d).ok, false);
  const early = eligibility(new Date("2026-11-02T10:30:00Z"), d); // 4:30 a.m. CST
  assert.ok(!early.ok && /Before 5:00/.test(early.why));
  assert.ok(eligibility(new Date("2026-11-02T11:00:00Z"), d).ok); // 5:00 a.m. CST
  assert.equal(eligibility(new Date("2026-11-28T16:00:00Z"), { ...d, week: 5 }).ok, false);
  const behind = eligibility(new Date("2026-11-09T11:30:00Z"), d);
  assert.ok(!behind.ok && behind.outcome === "blocked" && /does not advance/.test(behind.why));
  const posted = eligibility(MONDAY_530_CST, { ...d, phase: "fought" });
  assert.ok(!posted.ok && posted.outcome === "noop");
});

test("grading reuses the site's thresholds with >= boundaries and keeps actual NSNU dollars", () => {
  const exact = STORE_MAP.map((m, i) =>
    row(m, i, i === 0 ? { net_sales: "20000", new_ups: "20", walkouts: "0", demos_seen: "16", demos_sold: "10", demo_sales: "14000", arch_supports_sold: "25", arch_supports_returned: "0" } : {}),
  );
  const res = stage(goodRead("2026-11-01", exact), goodRead("2026-11-01", exact), WEEK1, league());
  assert.ok(res.ok);
  const waco = res.staged.find((s) => s.storeId === "waco")!;
  assert.deepEqual(waco.values, { nsnu: 1000, conv: 50, demoRate: 80, demoClose: 62.5, arch: 2.5, ticket: 1400 });
  assert.deepEqual(waco.grades, { nsnu: "green", conv: "orange", demoRate: "blue", demoClose: "red", arch: "orange", ticket: "orange" });
  const card = applyScorecard(league(), res.staged).storeCards.find((c) => c.storeId === "waco" && c.week === 1)!;
  assert.equal(card.nsnu, 1000);
  assert.equal(card.nsnuOfficial, true);
  assert.equal(card.grades?.nsnu, "green");
});

test("SQL API dates decode from days since epoch", () => {
  assert.equal(sqlDate(String(Date.UTC(2026, 10, 1) / 86_400_000)), "2026-11-01");
  assert.equal(sqlDate("2026-11-01"), "2026-11-01");
  assert.equal(sqlDate(null), null);
});

test("Claude copy facts come only from saved data and the number guard catches invented stats", async () => {
  const m = memory(league());
  assert.equal((await runMondayJob(m.io)).outcome, "success");
  const d = m.data();
  const bout = d.bouts.find((b) => b.week === 1 && b.kind === "bout")!;
  const subject = boutSubject(d, bout.id)!;
  assert.ok(subject.key.startsWith(bout.id));
  assert.equal(boutSubject(d, "w1-bout-99-nobody"), null);
  const recap = recapSubject(d, 1)!;
  assert.equal((recap.facts.results as unknown[]).length, 7);
  assert.equal(recapSubject(d, 2), null, "no recap before week 2 runs");
  const facts = JSON.stringify([subject.facts, recap.facts]);
  assert.doesNotMatch(facts, /passcode|"pin"|code/i);
  for (const c of d.crew) assert.ok(!facts.includes(`"${c.name}"`), "no crew names reach Claude");
  assert.deepEqual(unsupportedNumbers("Won in exchange 2 with 999 damage", subject.facts).includes("999"), true);
  assert.deepEqual(unsupportedNumbers("Steel wins.", subject.facts), []);
});

test("hype covers the upcoming card before it runs and stops once it has run", () => {
  const d = league();
  const matchups = upcomingMatchups(d);
  assert.equal(matchups.length, 7);
  const h = hypeSubject(d, matchups[0]!.id)!;
  assert.ok(h);
  assert.doesNotMatch(JSON.stringify(h.facts), /weapon"|chassis"|armor"/, "builds stay hidden before the fight");
  assert.equal(upcomingMatchups({ ...d, phase: "fought" }).length, 0);
});
