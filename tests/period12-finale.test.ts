import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "zustand/vanilla";
import { makeData } from "../src/lib/pit/seed.ts";
import { pitCreator, sharedDoc, applyDueLock } from "../src/lib/pit/store.ts";
import { reconcilePeriod12Finale, FINALE_EVENT } from "../src/lib/pit/period12-finale.ts";
import { approvedCard, expectedHistory } from "../src/lib/pit/period12-approved-card.ts";
import { championshipFinalists, regularSeasonRecordOf } from "../src/lib/pit/engine.ts";
import { allJobs, dayDate, programWeek } from "../src/lib/pit/training.ts";
import { weekProgress } from "../src/lib/pit/week.ts";
import type { Bout, PitData } from "../src/lib/pit/types.ts";
import { backfillReplays } from "../src/lib/pit/replay.ts";
import { nudgeFor } from "../src/lib/pit/nudge.ts";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import * as storeModule from "../src/lib/pit/store.ts";
import * as vanilla from "zustand/vanilla";
import {
  grantNov13Repairs,
  nov13RepairDue,
  nov13RepairDeploymentAllowed,
  NOV13_REPAIR_GIFT,
} from "../src/lib/pit/owner-repair-gift.ts";

function beforeFinale(): PitData {
  const data = makeData();
  data.week = 4;
  data.phase = "open";
  data.bouts = expectedHistory.map((b, i) => ({
    id: b.id,
    week: Number(b.id[1]),
    slot: (i % 7) + 1,
    kind: "bout",
    title: "Conference",
    storeIds: [...b.winners, ...b.losers],
    teamA: [b.winners[0]!],
    teamB: [b.losers[0]!],
    result: {
      ...structuredClone(approvedCard[0]!.result!),
      winnerIds: [...b.winners],
      loserIds: [...b.losers],
    },
  })) as Bout[];
  data.replays = backfillReplays([], data.bouts);
  return data;
}

test("conference records stay byte-for-byte unchanged through Tuesday at 10 AM Central", () => {
  const data = beforeFinale();
  const original = JSON.stringify(data);
  for (const date of [
    "2026-11-16T23:00:00Z",
    "2026-11-17T15:59:59.999Z",
    "2026-11-17T16:00:00.000Z",
  ]) {
    assert.strictEqual(reconcilePeriod12Finale(data, new Date(date)), data);
    assert.equal(JSON.stringify(data), original);
  }
});

test("after Tuesday 10 AM the approved seven fights count exactly once and preserve Rockwall-Abilene", () => {
  const data = beforeFinale();
  const original = JSON.stringify(data);
  const next = reconcilePeriod12Finale(data, new Date("2026-11-17T16:00:00.001Z"));
  assert.equal(next.week, 5);
  assert.equal(next.phase, "open");
  assert.deepEqual(championshipFinalists(next), ["rockwall", "abilene"]);
  for (const store of next.stores) {
    const rec = regularSeasonRecordOf(next, store.id);
    assert.equal(rec.w + rec.l, 4);
  }
  assert.deepEqual(regularSeasonRecordOf(next, "rockwall"), { w: 4, l: 0 });
  assert.deepEqual(regularSeasonRecordOf(next, "abilene"), { w: 4, l: 0 });
  assert.deepEqual(regularSeasonRecordOf(next, "college"), { w: 4, l: 0 });
  assert.equal(next.bouts.filter((b) => b.week === 4 && b.kind === "bout").length, 7);
  assert.equal(next.craft.filter((c) => c.week === 4).length, 14);
  assert.ok(next.honors.bestBuild);
  const tie = next.bouts.find((b) => b.week === 4 && b.title === "Frontier Conference Tiebreaker")!;
  assert.deepEqual(tie.result!.winnerIds, ["abilene"]);
  assert.equal(tie.result!.method, "ko");
  assert.ok(tie.result!.exchanges.length <= 7);
  assert(next.ownerEvents!.includes(FINALE_EVENT));
  assert.strictEqual(reconcilePeriod12Finale(next, new Date("2026-11-18T18:00:00Z")), next);
  assert.equal(JSON.stringify(data), original, "input season stays untouched");
  assert.deepEqual(
    next.bouts.filter((b) => b.week < 4),
    data.bouts,
  );
});

test("production settlement verifies its backup, retries concurrent writes and never pays twice", async () => {
  const source = readFileSync(new URL("../src/lib/pit/authoritative.ts", import.meta.url), "utf8");
  const schema = JSON.parse(source.match(/const SCHEMA_TAG = ("[^"]+");/)![1]!);
  const body = stripTypeScriptTypes(
    source.slice(source.indexOf("async function load("), source.indexOf("/** Server-only:")),
  );
  const factory = new Function(
    "services",
    "reconcilePeriod12Finale",
    "FINALE_EVENT",
    "grantNov13Repairs",
    "nov13RepairDue",
    "nov13RepairDeploymentAllowed",
    "NOV13_REPAIR_GIFT",
    "Date",
    "process",
    "console",
    `const SCHEMA_TAG=${JSON.stringify(schema)};${body};return load;`,
  );
  for (const scenario of [
    "early",
    "exact",
    "preview",
    "development",
    "broken-backup",
    "production",
    "race",
  ]) {
    const seed = beforeFinale();
    seed.ownerEvents = [
      storeModule.WEEK2_REPAIR_GIFT,
      storeModule.TYLER_ROSES_GIFT,
      storeModule.ALLIANCE_GOLD_GIFT,
      storeModule.COLLEGE_MAW_GIFT,
      NOV13_REPAIR_GIFT,
    ];
    const initial = JSON.stringify(sharedDoc(seed));
    let row = { rev: 500, doc: initial, schema_tag: schema },
      updates = 0,
      raced = false;
    const backups = new Map<string, string>();
    const sql = async (parts: TemplateStringsArray, ...values: unknown[]) => {
      const query = parts.join("?").replace(/\s+/g, " ").trim();
      if (query.startsWith("insert into pit_season") && query.includes("'main'")) return [];
      if (query.startsWith("insert into pit_season")) {
        const [id, , doc] = values as [string, number, string];
        if (!backups.has(id)) backups.set(id, doc);
        return [];
      }
      if (query === "select doc from pit_season where id = ?")
        return [
          { doc: scenario === "broken-backup" ? "invalid" : backups.get(values[0] as string) },
        ];
      if (query.startsWith("select rev, doc, schema_tag")) return [{ ...row }];
      if (query === "select doc from pit_season where id = 'main'") return [{ doc: row.doc }];
      if (query.startsWith("update pit_season")) {
        if (scenario === "race" && !raced) {
          raced = true;
          const concurrent = JSON.parse(row.doc);
          concurrent.bots[0].voucher = 777;
          row = { ...row, rev: row.rev + 1, doc: JSON.stringify(concurrent) };
          return [];
        }
        const [doc, schema_tag, rev] = values as [string, string, number];
        assert.equal(rev, row.rev);
        row = { rev: row.rev + 1, doc, schema_tag };
        updates++;
        return [{ rev: row.rev }];
      }
      throw new Error(query);
    };
    const time =
      scenario === "early"
        ? "2026-11-17T15:59:59.999Z"
        : scenario === "exact"
          ? "2026-11-17T16:00:00.000Z"
          : "2026-11-17T16:00:00.001Z";
    class Clock extends Date {
      constructor(value: string | number = Date.parse(time)) {
        super(value);
      }
      static now() {
        return Date.parse(time);
      }
    }
    const services = async () => ({
      sql,
      store: storeModule,
      vanilla,
      auth: { publicSession: { role: "public", storeId: null, crewId: null } },
      mode: "live",
    });
    const env = ["preview", "development"].includes(scenario) ? scenario : "production";
    const load = factory(
      services,
      reconcilePeriod12Finale,
      FINALE_EVENT,
      grantNov13Repairs,
      nov13RepairDue,
      nov13RepairDeploymentAllowed,
      NOV13_REPAIR_GIFT,
      Clock,
      { env: { VERCEL_ENV: env } },
      { info() {} },
    );
    if (scenario === "broken-backup") {
      await assert.rejects(() => load(), /exact backup verification failed/);
      assert.equal(row.doc, initial);
      assert.equal(updates, 0);
      continue;
    }
    await load();
    if (["early", "exact", "preview", "development"].includes(scenario)) {
      assert.equal(updates, 0);
      assert.equal(row.doc, initial);
      assert.equal(backups.size, 0);
      continue;
    }
    const next = JSON.parse(row.doc) as PitData;
    assert.equal(updates, 1);
    assert.equal(next.week, 5);
    assert.deepEqual(championshipFinalists(next), ["rockwall", "abilene"]);
    assert.equal(backups.get("backup-period12-approved-finale-2026-11-17-rev-500"), initial);
    if (scenario === "race") assert.equal(next.bots[0]!.voucher, 777);
    const paid = row.doc;
    await load();
    assert.equal(updates, 1);
    assert.equal(row.doc, paid);
  }
});

test("finale reconciliation refuses a different season or changed official history", () => {
  const data = beforeFinale();
  for (const changed of [
    { ...data, seasonName: "Period 13" },
    { ...data, bouts: data.bouts.slice(1) },
    { ...data, bouts: [...data.bouts, ...approvedCard] },
  ]) {
    assert.strictEqual(reconcilePeriod12Finale(changed, new Date("2026-11-18T18:00:00Z")), changed);
  }
});

test("all fourteen stores have preparation on both weeks and lock for November 28", () => {
  const data = makeData();
  data.week = 5;
  const plan = programWeek(5)!;
  assert.equal(dayDate(plan, plan.days[0]!.day).toISOString(), "2026-11-17T06:00:00.000Z");
  assert.equal(dayDate(plan, plan.days.at(-1)!.day).toISOString(), "2026-11-27T06:00:00.000Z");
  assert.equal(allJobs(plan).length, 18);
  assert.equal(plan.days.length, 9);
  for (const store of data.stores) {
    const progress = weekProgress(data, store.id, 5);
    assert.ok(progress.crew.length > 0);
    assert.equal(progress.crew[0]!.jobsTotal, 18);
    assert.equal(progress.crew[0]!.sparksTotal, 9);
  }
  const locked = applyDueLock(data, new Date("2026-11-28T00:00:00Z"))!;
  assert.ok(locked.bots.every((b) => b.locked));
});

test("Rumble captains can prepare their own build before the common Friday lock", () => {
  const store = createStore(pitCreator);
  const data = makeData();
  data.week = 5;
  store.setState({
    ...sharedDoc(data),
    session: { role: "captain", storeId: "waco", crewId: null },
  });
  store.getState().lockStore("waco");
  assert.ok(store.getState().bots.find((b) => b.storeId === "waco")!.locked);
});

test("preparation reminders announce the actual November 27 lock, never November 21", () => {
  const data = makeData();
  data.week = 5;
  data.phase = "open";
  const firstSaturday = nudgeFor(data, "waco", new Date("2026-11-21T14:00:00Z"))!;
  const lastFriday = nudgeFor(data, "waco", new Date("2026-11-27T14:00:00Z"))!;
  assert.doesNotMatch(firstSaturday.text, /Builds lock today|Builds lock tonight/);
  assert.match(lastFriday.text, /Builds lock today: Friday, Nov 27/);
});
