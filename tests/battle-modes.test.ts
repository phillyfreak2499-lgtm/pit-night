import test from "node:test";
import assert from "node:assert/strict";
import { makeData } from "../src/lib/pit/seed.ts";
import {
  printedStats,
  resolvePart,
  simulateDuel,
  simulateMelee,
  simulateTag,
} from "../src/lib/pit/engine.ts";
import { fightDuel } from "../src/lib/pit/combat.ts";
import type { Loadout, PitData } from "../src/lib/pit/types.ts";

const IDS = ["waco", "arlington", "plano", "allen"];
const STOCK: Loadout = {
  chassis: "chassis-shrike-stock",
  drive: "drive-mag-stock",
  weapon: "weapon-saw-stock",
  armor: "armor-plate-stock",
  utility: null,
  brain: "brain-logic-stock",
};

function world() {
  const data = makeData();
  data.phase = "locked";
  for (const id of IDS) {
    const bot = data.bots.find((row) => row.storeId === id)!;
    bot.classId = "striker";
    bot.equipped = { ...STOCK };
    bot.draft = { ...STOCK };
    bot.locked = { ...STOCK };
    bot.partWear = {};
    bot.wear = {
      chassis: "clean",
      drive: "clean",
      weapon: "clean",
      armor: "clean",
      utility: "clean",
      brain: "clean",
    };
    const card = data.storeCards.find((row) => row.storeId === id && row.week === data.week)!;
    card.grades = {
      nsnu: "green",
      conv: "green",
      demoRate: "green",
      demoClose: "green",
      arch: "green",
      ticket: "green",
    };
  }
  return data;
}

function equip(data: PitData, id: string, patch: Partial<Loadout>) {
  const bot = data.bots.find((row) => row.storeId === id)!;
  bot.equipped = { ...bot.equipped, ...patch };
  bot.draft = { ...bot.equipped };
  bot.locked = { ...bot.equipped };
}

test("a non-leading tag teammate's brain changes the actual battle and is saved individually", () => {
  const data = world();
  const base = simulateTag(data, IDS.slice(0, 2), IDS.slice(2), "tag");
  equip(data, IDS[1]!, { brain: "brain-logic-super" });
  const upgraded = simulateTag(data, IDS.slice(0, 2), IDS.slice(2), "tag");
  assert.notDeepEqual(upgraded.hp, base.hp);
  assert.equal(upgraded.fighters.length, 4);
  assert.equal(upgraded.fighters.find((row) => row.id === IDS[1])?.brainTier, "super");
  assert.ok(
    upgraded.exchanges.some((row) => row.attackerId === IDS[1] || row.defenderId === IDS[1]),
  );
});

test("brains affect the multiway conference tiebreaker and every fighter participates", () => {
  const data = world();
  const ids = IDS.slice(0, 3);
  const base = simulateMelee(data, ids, "tie");
  equip(data, IDS[1]!, { brain: "brain-logic-super" });
  const upgraded = simulateMelee(data, ids, "tie");
  assert.notDeepEqual(upgraded.exchanges, base.exchanges);
  for (const id of ids)
    assert.ok(
      upgraded.exchanges.some((row) => row.attackerId === id || row.defenderId === id),
      id,
    );
  assert.ok(upgraded.exchanges.length > 0);
  assert.equal(upgraded.meleeOrder?.[0], upgraded.winnerIds[0]);
});

test("part damage follows the selected part rather than the currently equipped slot", () => {
  const data = world();
  const bot = data.bots.find((row) => row.storeId === IDS[0])!;
  bot.wear.weapon = "disabled";
  bot.partWear[STOCK.weapon] = "disabled";
  const replacement = { ...STOCK, weapon: "weapon-saw-super" };
  const resolved = resolvePart(bot, "weapon", replacement);
  assert.equal(resolved.part?.id, replacement.weapon);
  assert.equal(resolved.broken, false);
  const clean = world().bots.find((row) => row.storeId === IDS[0])!;
  assert.deepEqual(printedStats(bot, replacement, 1), printedStats(clean, replacement, 1));
});

test("persisted part damage wins over stale slot wear in battle snapshots", () => {
  const data = world();
  equip(data, IDS[0]!, { weapon: "weapon-saw-super" });
  const bot = data.bots.find((row) => row.storeId === IDS[0])!;
  bot.partWear[bot.equipped.weapon] = "disabled";
  const result = simulateDuel(data, IDS[0]!, IDS[1]!, "wear");
  assert.equal(result.fighters[0]!.tiers?.weapon, "stock");
  assert.equal(result.fighters[0]!.parts?.weapon, STOCK.weapon);
});

test("battle telemetry persists both fighters' actual state across every exchange", () => {
  const data = world();
  equip(data, IDS[0]!, { weapon: "weapon-flame-super", utility: "utility-weld-super" });
  const result = simulateDuel(data, IDS[0]!, IDS[1]!, "trace");
  const last = new Map<string, unknown>();
  for (const exchange of result.exchanges) {
    assert.ok(exchange.combat);
    for (const [id, trace] of Object.entries(exchange.combat)) {
      if (last.has(id)) assert.deepEqual(trace.before, last.get(id));
      assert.ok(trace.after.battery <= trace.before.battery);
      assert.ok(trace.damageDealt >= 0);
      assert.ok(trace.reflectedDamageTaken >= 0);
      assert.equal(
        trace.after.hp,
        id === exchange.attackerId ? exchange.attackerHp : exchange.defenderHp,
      );
      last.set(id, trace.after);
    }
  }
  assert.ok(result.exchanges.some((exchange) => exchange.combat?.[IDS[0]!]?.healing! > 0));
  assert.ok(result.exchanges.some((exchange) => exchange.combat?.[IDS[1]!]?.burnDamage! > 0));
});

test("melee opponents retain battery and status memory when pairings change", () => {
  const data = world();
  equip(data, IDS[0]!, { weapon: "weapon-flame-super" });
  const result = simulateMelee(data, IDS.slice(0, 3), "trace");
  const last = new Map<string, unknown>();
  for (const exchange of result.exchanges) {
    assert.ok(exchange.combat);
    for (const [id, trace] of Object.entries(exchange.combat)) {
      if (last.has(id)) assert.deepEqual(trace.before, last.get(id));
      last.set(id, trace.after);
    }
  }
  assert.equal(last.size, 3);
});

test("a melee fighter with the opening bye still gets its first-exchange chassis effect", () => {
  const data = world();
  equip(data, "waco", { chassis: "chassis-spring-super" });
  const result = simulateMelee(data, IDS.slice(0, 3), "opening");
  const first = result.exchanges.find(
    (row) => row.attackerId === "waco" || row.defenderId === "waco",
  )!;
  assert.ok(first.index > 1);
  assert.ok(first.tags.includes("spring"));
});

test("a flip drive can finish a vulnerable bot by dumping it, while Anchor prevents the dump", () => {
  const source = simulateDuel(world(), IDS[0]!, IDS[1]!, "source").fighters;
  const a = {
    ...source[0]!,
    driveFamily: "flip",
    stats: { power: 35, speed: 18, armor: 28, heat: 12 },
  };
  const b = { ...source[1]!, stats: { power: 20, speed: 16, armor: 12, heat: 12 } };
  const result = fightDuel(a, b);
  assert.equal(result.method, "dump");
  assert.ok(result.finisher?.combat);
  assert.equal(fightDuel(a, { ...b, driveFamily: "anchor" }).method, "decision");
});

test("championship sudden death and finishers retain the final state and damage", () => {
  const [a, b] = simulateDuel(world(), IDS[0]!, IDS[1]!, "source").fighters;
  const result = fightDuel(a!, b!, { overtime: true, pace: 0.01 });
  const last = result.exchanges.at(-1)!;
  assert.ok(last.tags.includes("sudden-death"));
  assert.ok(last.combat);
  assert.ok(result.finisher?.combat);
  assert.equal(last.combat[last.defenderId]!.before.hp, last.damage);
  assert.equal(last.combat[last.defenderId]!.after.hp, 0);
  assert.equal(last.combat[last.attackerId]!.damageDealt, last.damage);
  assert.equal(result.hp[last.defenderId], 0);
});
