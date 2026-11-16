import test from "node:test";
import assert from "node:assert/strict";
import { fightDuel, fightGroup } from "../src/lib/pit/combat.ts";
import { frontierFighters } from "./fixtures/week4-frontier-fighters.ts";
import { buildBeats, fightDrive } from "../src/components/pit/cage-motion.ts";
import { approvedFinaleTape } from "../src/lib/pit/period12-tape.ts";

test("a killed return attacker cannot burn, drain or stun the survivor", () => {
  const a = {
    ...structuredClone(frontierFighters[1]!),
    id: "a",
    stats: { power: 10000, speed: 0, armor: 0, heat: 0 },
  };
  for (const weaponFamily of ["flame", "tesla"]) {
    const b = {
      ...structuredClone(frontierFighters[0]!),
      id: "b",
      weaponFamily,
      utilityFamily: "leech",
      stats: { power: 0, speed: 0, armor: 0, heat: 0 },
    };
    const ex = fightDuel(a, b, { pitOnly: true, pace: 10 }).exchanges[0]!;
    assert.equal(ex.combat!.b!.hitCount, 0);
    assert.equal(ex.combat!.b!.damageDealt, 0);
    assert.equal(ex.combat!.a!.after.burn, 0);
    assert.equal(ex.combat!.a!.after.stun, 1);
    assert.equal(ex.combat!.b!.after.heat, ex.combat!.b!.before.heat);
    assert.equal(ex.combat!.b!.after.stamina, ex.combat!.b!.before.stamina);
  }
});

test("the corrected finale replay keeps the knocked-out bot motionless at zero", () => {
  const result = approvedFinaleTape().at(-1)!.result!;
  const beat = buildBeats(result).at(-1)!;
  const loser = fightDrive(result, beat, 1, beat.t + beat.dur).bots.find(
    (b) => b.bot.id === "college",
  )!;
  assert.equal(loser.hp, 0);
  assert.equal(loser.dead, true);
  assert.equal(loser.rev, 0);
});

test("College Station is eliminated on the first lethal hit instead of returning to one HP", () => {
  const [college, abilene] = frontierFighters;
  const result = fightDuel(college!, abilene!, { pitOnly: true, hot: true });
  assert.equal(result.hp.college, 0);
  assert.ok(result.hp.abilene! > 0);
  assert.ok(
    result.exchanges.length <= 7,
    "the captured fight reaches lethal damage by exchange seven",
  );
  assert.equal(result.method, "ko");
  assert.equal(result.exchanges.at(-1)!.combat!.college!.after.hp, 0);
  assert.ok(result.exchanges.every((e) => !Object.values(e.combat!).some((t) => t.revived)));
});

test("an eliminated finalist cannot return a lethal attack or revive with Phoenix", () => {
  const a = {
    ...structuredClone(frontierFighters[0]!),
    id: "a",
    brainFamily: "phoenix",
    stats: { power: 10000, speed: 0, armor: 0, heat: 0 },
  };
  const b = {
    ...structuredClone(frontierFighters[1]!),
    id: "b",
    brainFamily: "phoenix",
    stats: { power: 10000, speed: 0, armor: 0, heat: 0 },
  };
  const result = fightDuel(a, b, { pitOnly: true, pace: 10 });
  assert.equal(result.method, "ko");
  assert.equal(result.exchanges.length, 1);
  assert.equal(Object.values(result.hp).filter((hp) => hp > 0).length, 1);
  assert.equal(Object.values(result.hp).filter((hp) => hp === 0).length, 1);
  assert.ok(result.exchanges.every((e) => !Object.values(e.combat!).some((t) => t.revived)));
});

test("Rumble knockout is final and the eliminated bot never appears in a later exchange", () => {
  const bots = Array.from({ length: 12 }, (_, i) => ({
    ...structuredClone(frontierFighters[i % 2]!),
    id: `bot-${i}`,
    brainFamily: "phoenix",
    stats: { power: 10000, speed: 0, armor: 0, heat: 0 },
  }));
  const result = fightGroup(bots, null, { lastBotStanding: true, pace: 10 });
  const dead = new Set<string>();
  for (const exchange of result.exchanges) {
    assert(!dead.has(exchange.attackerId));
    assert(!dead.has(exchange.defenderId));
    for (const [id, trace] of Object.entries(exchange.combat!))
      if (trace.after.hp === 0) dead.add(id);
  }
  assert.equal(dead.size, 11);
  assert.equal(Object.values(result.hp).filter((hp) => hp > 0).length, 1);
  assert.ok(result.exchanges.length <= 11);
  assert.ok(
    result.exchanges.every(
      (e) => e.tags.includes("knockout") && !e.tags.includes("pit-elimination"),
    ),
  );
});
