import test from "node:test";
import assert from "node:assert/strict";
import { fightDuel } from "../src/lib/pit/combat.ts";
import type { FighterSnap } from "../src/lib/pit/types.ts";

function fighter(id: string, patch: Partial<FighterSnap> = {}): FighterSnap {
  return {
    id,
    name: id,
    storeName: id,
    botName: id,
    classId: "striker",
    paint: "red",
    stats: { power: 30, speed: 30, armor: 20, heat: 15 },
    rating: 90,
    fit: 0.98,
    weekQ: 1,
    weaponFamily: "none",
    weaponName: "Test weapon",
    driveName: "Wheels",
    armorName: "Plate",
    utilityName: null,
    chassisName: "Shrike",
    look: "plain",
    number: "1",
    chassisFamily: "shrike",
    driveFamily: "mag",
    armorFamily: "plate",
    brainFamily: "logic",
    brainTier: "super",
    batteryMax: 100,
    tiers: { chassis: "super", drive: "super", weapon: "super", armor: "super", brain: "super" },
    ...patch,
  };
}

test("Rivet Gun fires three real projectiles and reaches a ranged opponent", () => {
  const defender = fighter("b", { brainFamily: "sniper" });
  const neutral = fightDuel(fighter("a"), defender);
  const burst = fightDuel(fighter("a", { weaponFamily: "rivetgun" }), defender);
  const shot = burst.exchanges[0]!.combat!.a!;
  assert.equal(shot.hitCount, 3);
  assert.ok(shot.damageDealt > neutral.exchanges[0]!.combat!.a!.damageDealt);
  assert.ok(burst.exchanges[0]!.tags.includes("rivet-burst"));
});

test("magnetic armor deflects the Rivet Gun's metal projectiles", () => {
  const attacker = fighter("a", { weaponFamily: "rivetgun" });
  const unprotected = fightDuel(attacker, fighter("b", { armorFamily: "none" }));
  const magnetic = fightDuel(attacker, fighter("b", { armorFamily: "magnet" }));
  assert.ok(
    magnetic.exchanges[0]!.combat!.a!.damageDealt <
      unprotected.exchanges[0]!.combat!.a!.damageDealt,
  );
});

test("three light rivets do not trigger reactive armor as one heavy blow", () => {
  const defender = fighter("b", { armorFamily: "reactive" });
  const heavy = fightDuel(fighter("a"), defender);
  const burst = fightDuel(fighter("a", { weaponFamily: "rivetgun" }), defender);
  assert.ok(heavy.exchanges[0]!.combat!.a!.reflectedDamageTaken > 0);
  assert.equal(burst.exchanges[0]!.combat!.a!.reflectedDamageTaken, 0);
});

test("Can Crusher alternates a heavy press and a slower recovery", () => {
  const neutral = fightDuel(fighter("a"), fighter("b"));
  const crusher = fightDuel(fighter("a", { weaponFamily: "crusher" }), fighter("b"));
  assert.ok(
    crusher.exchanges[0]!.combat!.a!.damageDealt > neutral.exchanges[0]!.combat!.a!.damageDealt,
  );
  assert.ok(
    crusher.exchanges[1]!.combat!.a!.damageDealt < neutral.exchanges[1]!.combat!.a!.damageDealt,
  );
});

test("Gel Pads absorb the Can Crusher's impact", () => {
  const attacker = fighter("a", { weaponFamily: "crusher" });
  const unprotected = fightDuel(attacker, fighter("b", { armorFamily: "none" }));
  const padded = fightDuel(attacker, fighter("b", { armorFamily: "gel" }));
  assert.ok(
    padded.exchanges[0]!.combat!.a!.damageDealt < unprotected.exchanges[0]!.combat!.a!.damageDealt,
  );
});
