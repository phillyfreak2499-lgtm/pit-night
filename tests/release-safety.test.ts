import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import * as vanilla from "zustand/vanilla";
import * as storeModule from "../src/lib/pit/store.ts";
import { makeData } from "../src/lib/pit/seed.ts";
import {
  buildConferenceTiebreakers, championshipFinalists, conferenceTopTie,
  lastPlaceId, ROYAL_RUMBLE_TITLE,
} from "../src/lib/pit/engine.ts";
import {
  grantNov13Repairs, nov13RepairDue, nov13RepairDeploymentAllowed, NOV13_REPAIR_GIFT,
} from "../src/lib/pit/owner-repair-gift.ts";
import type { Phase, PitData } from "../src/lib/pit/types.ts";

const giftTime = new Date("2026-11-13T20:00:00Z");

test("five-week release flow preserves vouchers, applies pending repair safely, and seals championship honors", () => {
  const store = vanilla.createStore(storeModule.pitCreator);
  store.setState({ ...makeData(), week: 1, phase: "open", session: { role: "commissioner", storeId: null, crewId: null } });
  for (let week = 1; week <= 5; week++) {
    store.setState({ storeCards: store.getState().storeCards.map((card) => ({ ...card, nsnuOfficial: true })) });
    store.getState().runSaturday();
    const fought = store.getState();
    assert.equal(fought.phase, "fought", `Week ${week} runs`);
    const bouts = fought.bouts.filter((bout) => bout.week === week);
    if (week === 3) assert.strictEqual(grantNov13Repairs(fought, giftTime), fought);
    if (week === 4) {
      assert.equal(championshipFinalists(fought).length, 2);
      assert.deepEqual(buildConferenceTiebreakers(fought), []);
      for (const conference of ["metro", "frontier"] as const) {
        const tied = conferenceTopTie(fought, conference);
        if (tied.length < 2) continue;
        const tie = bouts.find((bout) => bout.title === `${conference === "metro" ? "Metro" : "Frontier"} Conference Tiebreaker`)!;
        assert.ok(tie?.result, "Each tied berth receives an automatically posted fight");
        assert.deepEqual(new Set(tie.storeIds), new Set(tied.map((s) => s.id)));
        assert.equal(Object.values(tie.result.hp).filter((hp) => hp > 0).length, 1);
      }
    }
    if (week === 5) {
      assert.equal(bouts.length, 2);
      const [rumble, final] = bouts;
      assert.equal(rumble!.title, ROYAL_RUMBLE_TITLE);
      assert.equal(rumble!.storeIds.length, 12);
      assert.ok(rumble!.storeIds.every((id) => !final!.storeIds.includes(id)));
      assert.equal(Object.values(rumble!.result!.hp).filter((hp) => hp > 0).length, 1);
      assert.equal(rumble!.result!.exchanges.filter((e) => e.tags.includes("pit-elimination")).length, 11);
      assert.equal(final!.result!.method, "dump");
      assert.ok(final!.result!.exchanges.at(-1)!.tags.includes("pit-elimination"));
      assert.equal(fought.honors.thirdPlace, rumble!.result!.winnerIds[0]);
      assert.equal(fought.honors.pitBelt, final!.result!.winnerIds[0]);
      assert.equal(fought.honors.plate, final!.result!.loserIds[0]);
      const posted = JSON.stringify({ bouts: fought.bouts, honors: fought.honors, replays: fought.replays });
      store.getState().runSaturday();
      const repeated = store.getState();
      assert.equal(JSON.stringify({ bouts: repeated.bouts, honors: repeated.honors, replays: repeated.replays }), posted);
    }
    store.getState().dropDamage();
    assert.equal(store.getState().phase, "inspected");
    if (week === 3) {
      const before = store.getState();
      const repaired = grantNov13Repairs(before, giftTime);
      assert.ok(repaired.ownerEvents!.includes(NOV13_REPAIR_GIFT));
      for (const bot of repaired.bots) {
        const original = before.bots.find((b) => b.storeId === bot.storeId)!;
        assert.equal(bot.voucher, original.voucher);
        assert.equal(bot.repairSpent, original.repairSpent);
        assert.deepEqual(bot.coins, original.coins);
        assert.ok(Object.values(bot.wear).every((w) => w === "clean"));
      }
      assert.strictEqual(grantNov13Repairs(repaired, giftTime), repaired);
      store.setState(repaired);
    }
    const last = lastPlaceId(store.getState());
    const vouchers = Object.fromEntries(store.getState().bots.map((bot) => [bot.storeId, bot.voucher]));
    store.getState().advanceWeek();
    const next = store.getState();
    for (const bot of next.bots) {
      assert.equal(bot.voucher, vouchers[bot.storeId]! + (week < 5 && bot.storeId === last ? 3 : 0));
    }
    if (week < 5) assert.equal(next.week, week + 1);
    else assert.equal(next.phase, "complete");
    const saved = JSON.parse(JSON.stringify(storeModule.sharedDoc(next)));
    assert.deepEqual(saved.honors, next.honors);
    assert.deepEqual(saved.ownerEvents, next.ownerEvents);
    assert.equal(JSON.stringify(saved.replays), JSON.stringify(next.replays));
  }
});

// Execute the current load body, replacing only services, clock, and environment.
// The SQL adapter is entirely in memory: this test never imports the real database.
const source = readFileSync(new URL("../src/lib/pit/authoritative.ts", import.meta.url), "utf8");
const schemaLiteral = source.match(/const SCHEMA_TAG = ("[^"]+");/)![1]!;
const loadBody = stripTypeScriptTypes(source.slice(source.indexOf("async function load("), source.indexOf("/** Server-only:")));
const loadFactory = new Function("services", "grantNov13Repairs", "nov13RepairDue", "nov13RepairDeploymentAllowed", "NOV13_REPAIR_GIFT", "Date", "process", "console",
  `const SCHEMA_TAG = ${schemaLiteral}; ${loadBody}; return load;`);

class GiftDate extends Date {
  constructor(value: string | number = giftTime.getTime()) { super(value); }
  static now() { return giftTime.getTime(); }
}

type Scenario = { phase?: Phase; environment?: string; loseCas?: boolean; brokenBackup?: boolean };
async function checkLoad({ phase = "inspected", environment = "production", loseCas = false, brokenBackup = false }: Scenario = {}) {
  const seed = makeData();
  seed.week = 3;
  seed.phase = phase;
  seed.ownerEvents = [storeModule.WEEK2_REPAIR_GIFT, storeModule.TYLER_ROSES_GIFT, storeModule.ALLIANCE_GOLD_GIFT, storeModule.COLLEGE_CHASE_GIFT];
  seed.bots = seed.bots.map((b) => ({ ...b, voucher: 9, repairSpent: 7, wear: { ...b.wear, weapon: "disabled" }, partWear: { [b.equipped.weapon]: "disabled" } }));
  let row = { rev: 51, doc: JSON.stringify(storeModule.sharedDoc(seed)), schema_tag: JSON.parse(schemaLiteral) as string };
  const initial = row.doc;
  const backups = new Map<string, { rev: number; doc: string }>();
  let updates = 0, raced = false;
  const sql = async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const query = parts.join("?").replace(/\s+/g, " ").trim();
    if (query.startsWith("insert into pit_season") && query.includes("'main'")) return [];
    if (query.startsWith("insert into pit_season")) {
      const [id, rev, doc] = values as [string, number, string];
      if (!backups.has(id)) backups.set(id, { rev, doc });
      return [];
    }
    if (query === "select doc from pit_season where id = ?") return [{ doc: brokenBackup ? "mismatched-backup" : backups.get(values[0] as string)?.doc }];
    if (query.startsWith("select rev, doc, schema_tag")) return [{ ...row }];
    if (query === "select doc from pit_season where id = 'main'") return [{ doc: row.doc }];
    if (query.startsWith("update pit_season")) {
      if (loseCas && !raced) {
        raced = true;
        const concurrent = JSON.parse(row.doc) as PitData;
        concurrent.bots[0]!.voucher = 17;
        row = { ...row, rev: row.rev + 1, doc: JSON.stringify(concurrent) };
        return [];
      }
      const [doc, schema_tag, rev] = values as [string, string, number];
      assert.equal(rev, row.rev);
      row = { ...row, rev: row.rev + 1, doc, schema_tag };
      updates++;
      return [{ rev: row.rev }];
    }
    throw new Error(`Unexpected in-memory SQL: ${query}`);
  };
  const services = async () => ({ sql, store: storeModule, vanilla, auth: { publicSession: { role: "public", storeId: null, crewId: null } }, mode: "preview" });
  const load = loadFactory(services, grantNov13Repairs, nov13RepairDue, nov13RepairDeploymentAllowed, NOV13_REPAIR_GIFT, GiftDate,
    { env: { VERCEL_ENV: environment || undefined } }, { info() {} });
  if (brokenBackup) {
    await assert.rejects(() => load({ deadlines: false }), /backup verification failed/);
    assert.equal(row.doc, initial);
    assert.equal(updates, 0);
    return;
  }
  await load({ deadlines: false });
  const after = JSON.parse(row.doc) as PitData;
  if (phase === "fought" || environment !== "production") {
    assert.equal(updates, 0);
    assert.equal(row.doc, initial);
    assert.equal(backups.size, 0);
    assert.ok(!after.ownerEvents!.includes(NOV13_REPAIR_GIFT));
    return;
  }
  assert.equal(updates, 1);
  assert.ok(after.ownerEvents!.includes(NOV13_REPAIR_GIFT));
  assert.ok(after.bots.every((b) => Object.values(b.wear).every((w) => w === "clean")));
  assert.ok(after.bots.every((b) => b.repairSpent === 7));
  assert.equal(after.bots[0]!.voucher, loseCas ? 17 : 9);
  assert.equal(backups.size, loseCas ? 2 : 1);
  assert.equal(backups.get("backup-owner-gifts-2026-11-13-rev-51")!.doc, initial);
  await load({ deadlines: false });
  assert.equal(updates, 1, "A second load cannot grant again");
}

test("authoritative repair grants once after a verified backup", async () => { await checkLoad(); });
test("authoritative repair retries lost CAS without overwriting concurrent voucher changes", async () => { await checkLoad({ loseCas: true }); });
test("authoritative repair refuses a mismatched backup before changing main", async () => { await checkLoad({ brokenBackup: true }); });
test("authoritative repair does not consume pending battle damage", async () => { await checkLoad({ phase: "fought" }); });
test("authoritative repair cannot activate from preview, development, or absent deployment context", async () => {
  for (const environment of ["preview", "development", ""]) await checkLoad({ environment });
});
