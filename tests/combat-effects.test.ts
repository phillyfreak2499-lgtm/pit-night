import test from "node:test";
import assert from "node:assert/strict";
import { fightDuel } from "../src/lib/pit/combat.ts";
import type { FighterSnap, Tier } from "../src/lib/pit/types.ts";

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
    weaponFamily: "saw",
    weaponName: "Saw",
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

function healthAfter(result: ReturnType<typeof fightDuel>, index: number, id: string) {
  const exchange = result.exchanges[index]!;
  return exchange.attackerId === id ? exchange.attackerHp : exchange.defenderHp;
}

test("Turkey Carver hits harder on the opening swing and loses effectiveness against speed", () => {
  const carver = fighter("a", { weaponFamily: "carver" });
  const normal = fightDuel(fighter("a", { weaponFamily: "none" }), fighter("b"));
  const carving = fightDuel(carver, fighter("b"));
  assert.ok(healthAfter(carving, 0, "b") < healthAfter(normal, 0, "b"));
  // Equal printed damage stats isolate the seasonal weapon's speed counter.
  const faster = fighter("b", { stats: { power: 30, speed: 40, armor: 20, heat: 15 } });
  const escaping = fightDuel(carver, faster);
  assert.ok(healthAfter(escaping, 0, "b") > healthAfter(carving, 0, "b"));
});

test("Sweet Potato Cannon trades its loading exchange for a heavier second impact", () => {
  const normal = fightDuel(fighter("a", { weaponFamily: "none" }), fighter("b"));
  const cannon = fightDuel(fighter("a", { weaponFamily: "yamcannon" }), fighter("b"));
  assert.ok(healthAfter(cannon, 0, "b") > healthAfter(normal, 0, "b"));
  const damage = (result: ReturnType<typeof fightDuel>) =>
    healthAfter(result, 0, "b") - healthAfter(result, 1, "b");
  assert.ok(damage(cannon) > damage(normal));
});

test("Cherry Tree Axe alternates its overhead chop with a slower recovery exchange", () => {
  const normal = fightDuel(fighter("a", { weaponFamily: "none" }), fighter("b"));
  const axe = fightDuel(fighter("a", { weaponFamily: "axe" }), fighter("b"));
  assert.ok(healthAfter(axe, 0, "b") < healthAfter(normal, 0, "b"));
  const damage = (result: ReturnType<typeof fightDuel>) =>
    healthAfter(result, 0, "b") - healthAfter(result, 1, "b");
  assert.ok(damage(axe) < damage(normal));
});

test("Serving Platter spreads the opening hit beyond its printed armor", () => {
  const normal = fightDuel(fighter("a"), fighter("b", { armorFamily: "none" }));
  const platter = fightDuel(fighter("a"), fighter("b", { armorFamily: "platter" }));
  assert.ok(healthAfter(platter, 0, "b") > healthAfter(normal, 0, "b"));
});

test("repairing worn armor improves survival instead of increasing damage taken", () => {
  const attacker = fighter("attacker");
  const remaining = [1, 0.96, 0.5].map(
    (wear) => fightDuel(attacker, fighter("defender", { wearMult: { armor: wear } })).hp.defender!,
  );
  assert.ok(remaining[0]! >= remaining[1]!, `clean/scratched health: ${remaining}`);
  assert.ok(remaining[1]! > remaining[2]!, `scratched/bent health: ${remaining}`);
});

for (const armor of ["spike", "reactive"]) {
  test(`damaged ${armor} armor reflects less damage than repaired armor`, () => {
    const attacker = fighter("a", {
      brainFamily: "hunter",
      stats: { power: 38, speed: 30, armor: 20, heat: 15 },
    });
    const clean = fightDuel(attacker, fighter("b", { armorFamily: armor }));
    const bent = fightDuel(
      attacker,
      fighter("b", { armorFamily: armor, wearMult: { armor: 0.5 } }),
    );
    assert.ok(healthAfter(clean, 0, "a") < healthAfter(bent, 0, "a"));
  });
}

for (const utility of ["veil", "decoy", "mirror"]) {
  test(`repairing ${utility} restores its defensive effect`, () => {
    const clean = fightDuel(fighter("a"), fighter("b", { utilityFamily: utility }));
    const bent = fightDuel(
      fighter("a"),
      fighter("b", { utilityFamily: utility, wearMult: { utility: 0.5 } }),
    );
    assert.ok(healthAfter(clean, 0, "b") > healthAfter(bent, 0, "b"));
  });
}

for (const family of ["burn", "peace", "crowd", "weld", "scry"]) {
  test(`${family} utility upgrades change combat even after build fit is capped`, () => {
    const tiers: Tier[] = ["stock", "sport", "pro", "super", "championship"];
    const scores = tiers.map((tier) => {
      let score = 0;
      for (let power = 20; power <= 40; power++) {
        for (let foePower = 18; foePower <= 34; foePower++) {
          const a = fighter("a", {
            utilityFamily: family,
            weekQ: 0.6,
            brainFamily: family === "peace" ? "berserker" : "logic",
            stats: { power, speed: 30, armor: 20, heat: 15 },
            tiers: { ...fighter("a").tiers, utility: tier },
          });
          const b = fighter("b", { stats: { power: foePower, speed: 30, armor: 20, heat: 15 } });
          const result = fightDuel(a, b, { hot: true });
          score += result.hp.a! - result.hp.b!;
        }
      }
      return score;
    });
    for (let i = 1; i < scores.length; i++) {
      assert.ok(
        scores[i]! > scores[i - 1]!,
        `${tiers[i]} should improve the ${family} effect: ${scores}`,
      );
    }
  });
}
