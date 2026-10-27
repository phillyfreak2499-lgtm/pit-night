/** Veterans Day (Week 3, The Warehouse) and America Recycles Day (Week 4, The Junkyard): windows, parts and looks. */
import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "zustand/vanilla";
import { pitCreator } from "../src/lib/pit/store.ts";
import { VETERANS_PART_IDS, veteransVisuals } from "../src/lib/pit/veterans.ts";
import { RECYCLES_PART_IDS, recyclesVisuals } from "../src/lib/pit/recycles.ts";
import { RECYCLES_REWARD_IDS, VETERANS_REWARD_IDS, cosmeticUnlocked, earnedRewardIds } from "../src/lib/pit/cosmetics.ts";
import { DECALS, PARTS, TOPPERS, partById } from "../src/lib/pit/catalog.ts";
import { partInWindow } from "../src/lib/pit/engine.ts";
import { arenaForWeek, arenaTheme } from "../src/components/pit/arena-scenes.ts";
import type { PitData } from "../src/lib/pit/types.ts";

test("each week's arena wears that week's theme", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((w) => arenaTheme(arenaForWeek(w))),
    ["halloween", "election", "veterans", "recycles", "thanksgiving"],
  );
});

test("banners run Sunday to Saturday, Central", () => {
  assert.equal(veteransVisuals(new Date("2026-11-07T23:30:00-06:00")), false);
  assert.equal(veteransVisuals(new Date("2026-11-11T12:00:00-06:00")), true, "Veterans Day");
  assert.equal(veteransVisuals(new Date("2026-11-15T00:30:00-06:00")), false);
  assert.equal(recyclesVisuals(new Date("2026-11-15T00:30:00-06:00")), true, "America Recycles Day");
  assert.equal(recyclesVisuals(new Date("2026-11-21T23:30:00-06:00")), true);
  assert.equal(recyclesVisuals(new Date("2026-11-22T00:30:00-06:00")), false);
});

test("the Rivet Gun and Can Crusher are 8-coin Super weapons on the peg only in their week", (t) => {
  const gun = partById("weapon-rivetgun-super")!;
  const crusher = partById("weapon-crusher-super")!;
  for (const part of [gun, crusher]) {
    assert.equal(part.slot, "weapon");
    assert.equal(part.tier, "super");
    assert.equal(part.price, 8);
  }
  assert.deepEqual(gun.window, { start: [11, 8], end: [11, 14] });
  assert.deepEqual(crusher.window, { start: [11, 15], end: [11, 21] });
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-11T15:00:00Z") });
  assert.deepEqual([partInWindow(gun), partInWindow(crusher)], [true, false]);
  t.mock.timers.setTime(new Date("2026-11-17T15:00:00Z").getTime());
  assert.deepEqual([partInWindow(gun), partInWindow(crusher)], [false, true]);
  t.mock.timers.setTime(new Date("2026-11-24T15:00:00Z").getTime());
  assert.deepEqual([partInWindow(gun), partInWindow(crusher)], [false, false]);
});

test("neither weapon strictly beats another Super weapon", () => {
  const keys = ["power", "speed", "armor", "heat"] as const;
  const dominates = (a: Record<(typeof keys)[number], number>, b: typeof a) => {
    let better = false;
    for (const k of keys) {
      if (a[k] < b[k]) return false;
      if (a[k] > b[k]) better = true;
    }
    return better;
  };
  for (const id of [...VETERANS_PART_IDS, ...RECYCLES_PART_IDS]) {
    const part = partById(id)!;
    for (const other of PARTS.filter((p) => p.slot === part.slot && p.tier === "super" && p.id !== part.id))
      assert.equal(dominates(part.nudge, other.nudge), false, `${part.name} vs ${other.name}`);
  }
});

test("the week's looks come from that week's activity only, and show up in the Garage lists", () => {
  const base: PitData = createStore(pitCreator).getState();
  const crew = base.crew.find((c) => c.storeId === "plano" && c.role === "specialist")!;
  const job = (week: number, n: number) => ({ id: `${week}:job${n}:${crew.id}`, week, jobId: `job${n}`, storeId: "plano", crewId: crew.id, crewName: crew.name, note: "done", status: "approved" as const, at: 1 });
  const activity = (week: number): PitData => ({
    ...base,
    jobLog: [1, 2, 3, 4].map((n) => job(week, n)),
    picks: [{ id: `w${week}-bout-1-x:${crew.id}`, week, boutId: `w${week}-bout-1-x`, storeId: "plano", crewId: crew.id, pick: "plano", at: 1 }],
    sparkLog: [{ id: `${week}:tue:${crew.id}`, week, day: "tue", storeId: "plano", crewId: crew.id, correct: 3, total: 3, at: 1 }],
  });
  const w2 = earnedRewardIds(activity(2), "plano");
  for (const id of [...VETERANS_REWARD_IDS, ...RECYCLES_REWARD_IDS]) assert.ok(!w2.has(id), `${id} not from Week 2`);
  const w3 = earnedRewardIds(activity(3), "plano");
  for (const id of VETERANS_REWARD_IDS) assert.ok(w3.has(id), `${id} earned in Week 3`);
  for (const id of RECYCLES_REWARD_IDS) assert.ok(!w3.has(id), `${id} not from Week 3`);
  const w4 = earnedRewardIds(activity(4), "plano");
  for (const id of RECYCLES_REWARD_IDS) assert.ok(w4.has(id), `${id} earned in Week 4`);
  assert.ok(cosmeticUnlocked(activity(3), "plano", "topper", "bugle"));
  assert.ok(cosmeticUnlocked(activity(4), "plano", "decal", "recycle"));
  assert.ok(!cosmeticUnlocked(base, "plano", "topper", "tincan"));

  const decals = new Set(DECALS.map((d) => String(d.id)));
  for (const id of ["dogtags", "yellowribbon", "medal", "recycle", "bottlecap", "sprout"]) assert.ok(decals.has(id), `${id} sticker listed`);
  const toppers = new Set(TOPPERS.map((t) => t.id));
  for (const id of ["bugle", "tincan", "tophat", "pilgrimhat", "wreath"]) assert.ok(toppers.has(id), `${id} topper listed`);
});
