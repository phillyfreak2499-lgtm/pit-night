import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeData } from "../src/lib/pit/seed.ts";
import { sharedDoc, WEEK2_REPAIR_GIFT } from "../src/lib/pit/store.ts";
import { grantNov13Repairs as grant, nov13RepairDue as isDue, nov13RepairDeploymentAllowed, NOV13_REPAIR_GIFT, NOV13_REPAIR_START, NOV13_REPAIR_END } from "../src/lib/pit/owner-repair-gift.ts";
import type { PitData } from "../src/lib/pit/types.ts";
const now = new Date("2026-11-13T20:00:00Z");
function damaged(): PitData {
  const seed = makeData();
  return {
    ...seed, week: 3, phase: "open", ownerEvents: [WEEK2_REPAIR_GIFT],
    bots: seed.bots.map((bot) => ({
      ...bot, owned: [...bot.owned, "owned-spare"],
      wear: { ...bot.wear, weapon: "disabled", armor: "bent" },
      partWear: { [bot.equipped.weapon]: "disabled", "owned-spare": "bent" },
      weldForWeek: { weapon: 3 }, weldedParts: { [bot.equipped.weapon]: 3 },
      repairSpent: 19, voucher: 5,
    })),
    quotes: Object.fromEntries(seed.bots.map((bot) => [bot.storeId, [
      { slot: "weapon", condition: "disabled", repairCost: 4 },
    ]])) as PitData["quotes"],
  };
}

test("gift repairs every equipped and owned part while preserving all other bot and season fields", () => {
  const before = damaged();
  const snapshot = structuredClone(before);
  const after = grant(before, now);
  assert.deepEqual(before, snapshot);
  assert.equal(after.bots.length, before.bots.length);
  after.bots.forEach((bot, i) => {
    assert.ok(Object.values(bot.wear).every((condition) => condition === "clean"));
    assert.deepEqual(bot.partWear, {});
    assert.deepEqual(bot.weldForWeek, {});
    assert.deepEqual(bot.weldedParts, {});
    const { wear, partWear, weldForWeek, weldedParts, ...preserved } = bot;
    const { wear: oldWear, partWear: oldParts, weldForWeek: oldWeld, weldedParts: oldWelds, ...original } = before.bots[i]!;
    assert.deepEqual(preserved, original, "loadouts, currency, repair spending and cosmetics unchanged");
  });
  for (const key of Object.keys(before) as (keyof PitData)[]) {
    if (!["bots", "quotes", "ownerEvents", "log"].includes(key)) {
      assert.strictEqual(after[key], before[key], `${key} must be preserved, including history and Bolts`);
    }
  }
  assert.ok(Object.values(after.quotes).every((quotes) => quotes.length === 0));
  assert.deepEqual(after.ownerEvents, [WEEK2_REPAIR_GIFT, NOV13_REPAIR_GIFT]);
  assert.deepEqual(sharedDoc(after).ownerEvents, after.ownerEvents);
});

test("persisted marker prevents repeat repairs even after new damage", () => {
  const after = JSON.parse(JSON.stringify(grant(damaged(), now))) as PitData;
  after.bots[0]!.wear.weapon = "disabled";
  after.bots[0]!.partWear[after.bots[0]!.equipped.weapon] = "disabled";
  assert.equal(isDue(after, now), false);
  assert.strictEqual(grant(after, now), after);
});

test("gift requires exact authorized season week and date window", () => {
  const data = damaged();
  for (const date of [new Date(NOV13_REPAIR_START - 1), new Date(NOV13_REPAIR_END), new Date("2027-11-13"), new Date(NaN)]) {
    assert.strictEqual(grant(data, date), data);
  }
  for (const week of [1, 2, 4, 5]) {
    const other = { ...data, week };
    assert.strictEqual(grant(other, now), other);
  }
  const otherSeason = { ...data, seasonName: "Period 13" };
  assert.strictEqual(grant(otherSeason, now), otherSeason);
  assert.ok(isDue(data, new Date(NOV13_REPAIR_START)));
  assert.ok(isDue(data, new Date(NOV13_REPAIR_END - 1)));
});

test("pending battle damage defers gift until inspected; completed seasons never consume it", () => {
  const fought: PitData = { ...damaged(), phase: "fought" };
  assert.strictEqual(grant(fought, now), fought);
  assert.ok(!fought.ownerEvents?.includes(NOV13_REPAIR_GIFT));
  for (const phase of ["open", "locked", "inspected"] as const) assert.ok(isDue({ ...fought, phase }, now));
  assert.ok(!isDue({ ...fought, phase: "complete" }, now));
});

test("owner confirmed Week 3 target enables only Week 3", () => {
  const data = damaged();
  assert.equal(isDue(data, now), true);
  assert.ok(grant(data, now).ownerEvents?.includes(NOV13_REPAIR_GIFT));
  for (const target of [null, 1, 2, 4, 5]) assert.strictEqual(grant(data, now, target), data);
});

test("unchanged closed-week poll finds pending gift and restores fast path after grant", () => {
  for (const phase of ["locked", "inspected"] as const) {
    const data = { ...damaged(), phase };
    const meta = { seasonName: data.seasonName, week: data.week, phase, ownerEvents: data.ownerEvents };
    assert.equal(isDue(meta, now), true);
    const repaired = grant(data, now);
    assert.equal(isDue({ ...meta, ownerEvents: repaired.ownerEvents }, now), false);
    assert.equal(isDue(meta, new Date(NOV13_REPAIR_END)), false);
  }
  const source = readFileSync(new URL("../src/lib/pit/authoritative.ts", import.meta.url), "utf8");
  assert.match(source, /if \(unchanged && !repairPending &&/);
  assert.match(source, /doc::json->>'ownerEvents' as owner_events/);
  assert.match(source, /!nov13Repairs \|\| verified.ownerEvents\?\.includes\(NOV13_REPAIR_GIFT\)/);
  assert.match(source, /nov13Repairs \? "2026-11-13"/);
  assert.match(source, /where id = 'main' and rev = \$\{row.rev\}/);
  assert.match(source, /backup.doc !== row.doc/);
});


test("deployment gate permits production only and fails closed in previews and absent context", () => {
  for (const environment of [undefined, "", "preview", "development", "test", "Production"]) {
    assert.equal(nov13RepairDeploymentAllowed(environment), false);
  }
  assert.equal(nov13RepairDeploymentAllowed("production"), true);
  const source = readFileSync(new URL("../src/lib/pit/authoritative.ts", import.meta.url), "utf8");
  assert.match(source, /const nov13Repairs = nov13RepairDeploymentAllowed\(process.env.VERCEL_ENV\) &&/);
  assert.match(source, /const gifted = nov13Repairs \? grantNov13Repairs\(oldGifts, repairNow\) : oldGifts/);
  assert.match(source, /const repairPending = nov13RepairDeploymentAllowed\(process.env.VERCEL_ENV\) &&/);
});
