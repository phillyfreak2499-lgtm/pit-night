/** Election Week (Week 2): nonpartisan civic looks, the Cherry Tree Axe, and its window. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createStore } from "zustand/vanilla";
import { pitCreator } from "../src/lib/pit/store.ts";
import { ELECTION_COLORS, ELECTION_PART_IDS, electionVisuals, isElectionPart } from "../src/lib/pit/election.ts";
import { ELECTION_REWARD_IDS, cosmeticUnlocked, earnedRewardIds } from "../src/lib/pit/cosmetics.ts";
import { DECALS, PARTS, partById } from "../src/lib/pit/catalog.ts";
import { partInWindow } from "../src/lib/pit/engine.ts";
import type { PitData } from "../src/lib/pit/types.ts";

test("decorations run Sunday Nov 1 through Saturday Nov 7, Central", () => {
  assert.equal(electionVisuals(new Date("2026-10-31T23:00:00-05:00")), false);
  assert.equal(electionVisuals(new Date("2026-11-01T00:30:00-06:00")), true);
  assert.equal(electionVisuals(new Date("2026-11-03T12:00:00-06:00")), true, "Election Day");
  assert.equal(electionVisuals(new Date("2026-11-07T23:30:00-06:00")), true);
  assert.equal(electionVisuals(new Date("2026-11-08T00:30:00-06:00")), false);
});

test("the Cherry Tree Axe is an 8-coin Super weapon on the peg only during Election Week", (t) => {
  const axe = partById("weapon-axe-super")!;
  assert.equal(axe.name, "Cherry Tree Axe");
  assert.equal(axe.slot, "weapon");
  assert.equal(axe.tier, "super");
  assert.equal(axe.price, 8);
  assert.deepEqual(axe.window, { start: [11, 1], end: [11, 7] });
  assert.ok(isElectionPart(axe.id));
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-04T15:00:00Z") });
  assert.equal(partInWindow(axe), true);
  t.mock.timers.setTime(new Date("2026-11-09T15:00:00Z").getTime());
  assert.equal(partInWindow(axe), false);
});

test("the axe does not strictly beat any other Super weapon", () => {
  const keys = ["power", "speed", "armor", "heat"] as const;
  const dominates = (a: Record<(typeof keys)[number], number>, b: typeof a) => {
    let better = false;
    for (const k of keys) {
      if (a[k] < b[k]) return false;
      if (a[k] > b[k]) better = true;
    }
    return better;
  };
  for (const id of ELECTION_PART_IDS) {
    const part = partById(id)!;
    for (const other of PARTS.filter((p) => p.slot === part.slot && p.tier === "super" && p.id !== part.id))
      assert.equal(dominates(part.nudge, other.nudge), false, `${part.name} vs ${other.name}`);
  }
});

function league(): PitData {
  return createStore(pitCreator).getState();
}

test("the four looks come from Week 2 activity only, and stay earned", () => {
  const base = league();
  const crew = base.crew.find((c) => c.storeId === "plano" && c.role === "specialist")!;
  const job = (week: number, n: number) => ({ id: `${week}:job${n}:${crew.id}`, week, jobId: `job${n}`, storeId: "plano", crewId: crew.id, crewName: crew.name, note: "done", status: "approved" as const, at: 1 });
  const week1: PitData = { ...base, jobLog: [1, 2, 3, 4].map((n) => job(1, n)) };
  for (const id of ELECTION_REWARD_IDS) assert.ok(!earnedRewardIds(week1, "plano").has(id), `${id} not from Week 1`);

  const week2: PitData = {
    ...base,
    jobLog: [1, 2, 3, 4].map((n) => job(2, n)),
    picks: [{ id: "w2-bout-1-x:" + crew.id, week: 2, boutId: "w2-bout-1-x", storeId: "plano", crewId: crew.id, pick: "plano", at: 1 }],
    sparkLog: [{ id: `2:tue:${crew.id}`, week: 2, day: "tue", storeId: "plano", crewId: crew.id, correct: 3, total: 3, at: 1 }],
  };
  const earned = earnedRewardIds(week2, "plano");
  for (const id of ELECTION_REWARD_IDS) assert.ok(earned.has(id), `${id} earned in Week 2`);
  assert.ok(cosmeticUnlocked(week2, "plano", "decal", "ivoted"));
  assert.ok(cosmeticUnlocked(week2, "plano", "topper", "tophat"));
  // Two approved jobs earn the Ballot Box, not yet the Top Hat.
  const two = earnedRewardIds({ ...base, jobLog: [1, 2].map((n) => job(2, n)) }, "plano");
  assert.ok(two.has("reward-ballot") && !two.has("reward-tophat"));
});

test("strictly nonpartisan: no party names or symbols, and no red or blue in the palette", () => {
  const banned = /democrat|republican|gop|\bdnc\b|\brnc\b|donkey|elephant|liberal|conservative|maga|blue state|red state|left wing|right wing/i;
  const text = [
    ...DECALS.filter((d) => ["ivoted", "ballot", "capitol"].includes(String(d.id))).map((d) => d.label),
    partById("weapon-axe-super")!.name,
    partById("weapon-axe-super")!.job,
    readFileSync(new URL("../src/components/pit/shell.tsx", import.meta.url), "utf8").match(/function ElectionBanner[\s\S]*?\r?\n}\r?\n/)![0],
    readFileSync(new URL("../src/lib/pit/cosmetics.ts", import.meta.url), "utf8")
      .split(/\r?\n/)
      .filter((l) => /reward-(ivoted|ballot|capitol|tophat)/.test(l))
      .join("\n"),
  ].join("\n");
  assert.doesNotMatch(text, banned);

  const hue = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    if (d < 0.08) return null; // near-gray carries no party color
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };
  for (const [name, hex] of Object.entries(ELECTION_COLORS)) {
    const h = hue(hex);
    if (h === null) continue;
    assert.ok(!(h < 20 || h > 340), `${name} ${hex} reads red`);
    assert.ok(!(h > 190 && h < 260), `${name} ${hex} reads blue`);
  }
});
