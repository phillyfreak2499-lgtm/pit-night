import test from "node:test";
import assert from "node:assert/strict";
import { arenaBotScale, largeFieldSlot } from "../src/components/pit/arena-layout.ts";
import { buildBeats, fightDrive, PIT } from "../src/components/pit/cage-motion.ts";
import { simulateMelee, simulateChampionshipDuel } from "../src/lib/pit/engine.ts";
import { makeData } from "../src/lib/pit/seed.ts";

test("expanded arena spaces all twelve entrants without changing duel or tag scale", () => {
  assert.equal(arenaBotScale(2), 1);
  assert.equal(arenaBotScale(4), 1);
  assert.equal(arenaBotScale(12), 0.5);
  const slots = Array.from({ length: 12 }, (_, i) => largeFieldSlot(i, 12));
  assert.equal(new Set(slots.map((p) => JSON.stringify(p))).size, 12);
  for (const a of slots) {
    assert.ok(a.x >= 0.1 && a.x <= 0.9 && a.y >= 0.2 && a.y <= 0.9);
    for (const b of slots) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 0.23);
  }
});

test("twelve-bot replay preserves entrants, wide framing, short beats and eleven eliminations", () => {
  const data = makeData();
  const result = simulateMelee(data, data.stores.slice(0, 12).map((s) => s.id), "arena-12", true);
  const beats = buildBeats(result);
  for (const beat of beats) {
    if (beat.kind !== "exchange") continue;
    assert.equal(beat.dur, result.exchanges[beat.index]!.defenderHp <= 0 ? 4 : 1);
    const drive = fightDrive(result, beat, 1, beat.t + beat.dur);
    assert.equal(drive.bots.length, 12);
    assert.equal(drive.tight, 0);
    assert.deepEqual(drive.focus, { x: 0.5, y: 0.56 });
  }
  const decision = beats.at(-1)!;
  const end = fightDrive(result, decision, 1, decision.t + decision.dur);
  assert.equal(end.bots.filter((b) => b.celebrate).length, 1);
  assert.equal(end.bots.filter((b) => b.hp > 0).length, 1);
  assert.equal(end.bots.filter((b) => b.gone === 1).length, 11);
  assert.ok(beats.reduce((sum, b) => sum + b.dur, 0) < 900);
});

test("championship exchange, replay and decision keep the loser in the Grand pit", () => {
  const data = makeData();
  data.week = 5;
  const result = simulateChampionshipDuel(data, data.stores[0]!.id, data.stores[1]!.id, "arena-final");
  assert.deepEqual(result.pitTarget, { x: 0.5, y: 0.64 });
  const beats = buildBeats(result);
  assert.equal(beats.find((b) => b.kind === "replay")?.dur, 7.5);
  const last = beats.filter((b) => b.kind === "exchange").at(-1)!;
  for (const beat of [last, beats.find((b) => b.kind === "replay")!, beats.at(-1)!]) {
    const drive = fightDrive(result, beat, 1, beat.t + beat.dur);
    const loser = drive.bots.find((b) => result.loserIds.includes(b.bot.id))!;
    assert.equal(loser.gone, 1);
    assert.equal(loser.hp, 0);
    assert.ok(Math.abs(loser.spot.x - 0.5) < 1e-9 && Math.abs(loser.spot.y - 0.64) < 1e-9);
  }
});

test("legacy tapes without recorded targets retain the original pit", () => {
  const data = makeData();
  const result = simulateChampionshipDuel(data, data.stores[0]!.id, data.stores[1]!.id, "legacy-pit");
  delete result.pitTarget;
  const beat = buildBeats(result).at(-1)!;
  const loser = fightDrive(result, beat, 1, beat.t + beat.dur).bots.find((b) => result.loserIds.includes(b.bot.id))!;
  assert.ok(Math.abs(loser.spot.x - PIT.x) < 1e-9 && Math.abs(loser.spot.y - PIT.y) < 1e-9);
  assert.equal(loser.gone, 1);
});
