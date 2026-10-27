import test from "node:test";
import assert from "node:assert/strict";
import { makeData } from "../src/lib/pit/seed.ts";
import { simulateTag } from "../src/lib/pit/engine.ts";
import { buildBeats, fightDrive } from "../src/components/pit/cage-motion.ts";
import type { FightResult, Loadout } from "../src/lib/pit/types.ts";

function tagResult(): FightResult {
  const data = makeData();
  data.phase = "locked";
  const ids = ["waco", "arlington", "plano", "allen"];
  const stock: Loadout = {
    chassis: "chassis-shrike-stock",
    drive: "drive-mag-stock",
    weapon: "weapon-saw-stock",
    armor: "armor-plate-stock",
    utility: null,
    brain: "brain-logic-stock",
  };
  for (const id of ids) {
    const bot = data.bots.find((row) => row.storeId === id)!;
    const load: Loadout =
      id === "arlington"
        ? {
            chassis: "chassis-reactor-super",
            drive: "drive-swerve-super",
            weapon: "weapon-saw-super",
            armor: "armor-plate-super",
            utility: "utility-medbay-pro",
            brain: "brain-logic-championship",
          }
        : stock;
    bot.classId = "striker";
    bot.equipped = { ...load };
    bot.draft = { ...load };
    bot.locked = { ...load };
    bot.partWear = {};
    bot.wear = {
      chassis: "clean",
      drive: "clean",
      weapon: "clean",
      armor: "clean",
      utility: "clean",
      brain: "clean",
    };
    const grade = id === "waco" ? "red" : "green";
    data.storeCards.find((row) => row.storeId === id && row.week === 1)!.grades = {
      nsnu: grade,
      conv: grade,
      demoRate: grade,
      demoClose: grade,
      arch: grade,
      ticket: grade,
    };
  }
  return simulateTag(data, ids.slice(0, 2), ids.slice(2), "group-replay");
}

test("tag replay uses every fighter's backend HP and celebrates the surviving teammate", () => {
  const result = tagResult();
  assert.deepEqual(result.winnerIds, ["waco", "arlington"]);
  assert.equal(result.hp.waco, 0);
  assert.ok(result.hp.arlington! > 0);
  const decision = buildBeats(result).find((beat) => beat.kind === "decision")!;
  const drive = fightDrive(result, decision, 0.8, decision.t + decision.dur * 0.8);
  assert.deepEqual(Object.fromEntries(drive.bots.map((bot) => [bot.bot.id, bot.hp])), result.hp);
  assert.deepEqual(
    drive.bots.filter((bot) => bot.celebrate).map((bot) => bot.bot.id),
    ["arlington"],
  );
  assert.ok(drive.bots.every((bot) => !bot.celebrate || (!bot.dead && bot.hp > 0)));
});

test("group replay preserves both participants' HP after each exchange", () => {
  const result = tagResult();
  const expected = Object.fromEntries(result.fighters.map((fighter) => [fighter.id, 100]));
  for (const beat of buildBeats(result).filter((row) => row.kind === "exchange")) {
    if (beat.kind !== "exchange") continue;
    const exchange = result.exchanges[beat.index]!;
    expected[exchange.attackerId] = exchange.attackerHp;
    expected[exchange.defenderId] = exchange.defenderHp;
    const drive = fightDrive(result, beat, 1, beat.t + beat.dur);
    assert.deepEqual(Object.fromEntries(drive.bots.map((bot) => [bot.bot.id, bot.hp])), expected);
  }
});
