import test from "node:test";
import assert from "node:assert/strict";
import { fightDuel, fightGroup } from "../src/lib/pit/combat.ts";
import { simulateDuel } from "../src/lib/pit/engine.ts";
import { makeData } from "../src/lib/pit/seed.ts";
import type { ClassId, Exchange, FighterSnap } from "../src/lib/pit/types.ts";

const template = simulateDuel(makeData(), "waco", "arlington", "elimination-fixtures").fighters[0]!;
function bot(id: string, patch: Partial<FighterSnap> = {}): FighterSnap {
  return { ...structuredClone(template), id, botName: id, ...patch };
}
function checkTape(fighters: FighterSnap[], exchanges: Exchange[], finalHp: Record<string, number>) {
  const hp = Object.fromEntries(fighters.map((fighter) => [fighter.id, 100]));
  const previous: Record<string, NonNullable<Exchange["combat"]>[string]["after"]> = {};
  const positions: Record<string, number> = {};
  const eliminations: string[] = [];
  exchanges.forEach((exchange, index) => {
    assert.equal(exchange.index, index + 1);
    assert.ok(hp[exchange.attackerId]! > 0, "eliminated fighters never attack again");
    assert.ok(hp[exchange.defenderId]! > 0, "eliminated fighters never re-enter");
    for (const id of [exchange.attackerId, exchange.defenderId]) {
      const trace = exchange.combat![id]!;
      assert.equal(trace.before.hp, hp[id]);
      if (previous[id]) assert.deepEqual(trace.before, previous[id], "each bot keeps its own memory");
      previous[id] = trace.after;
      hp[id] = trace.after.hp;
      assert.ok(Number.isFinite(exchange.vitals![id]!.battery));
      assert.ok(Number.isFinite(exchange.vitals![id]!.stamina));
    }
    assert.equal(exchange.attackerHp, hp[exchange.attackerId]);
    assert.equal(exchange.defenderHp, hp[exchange.defenderId]);
    for (const tag of exchange.tags) {
      if (!tag.startsWith("pit-position:")) continue;
      const [, id, value] = tag.split(":");
      const position = Number(value);
      assert.ok(position > (positions[id!] ?? 0));
      assert.ok(position <= 100);
      positions[id!] = position;
    }
    if (exchange.tags.includes("pit-elimination")) {
      assert.ok(exchange.tags.includes("dump"));
      assert.equal(exchange.defenderHp, 0);
      assert.ok(exchange.attackerHp > 0);
      assert.equal(positions[exchange.defenderId], 100);
      eliminations.push(exchange.defenderId);
    }
    assert.ok(!exchange.tags.includes("sudden-death"));
  });
  assert.deepEqual(hp, finalHp);
  assert.equal(Object.values(hp).filter((value) => value > 0).length, 1);
  assert.equal(new Set(eliminations).size, fighters.length - 1);
  return eliminations;
}

test("pit championship has no round cutoff even at zero pace against healing anchors", () => {
  const a = bot("a", { utilityFamily: "medbay", driveFamily: "anchor", batteryMax: 1 });
  const b = bot("b", { utilityFamily: "weld", driveFamily: "anchor", batteryMax: 1 });
  for (const pace of [0, 1e-12]) {
    const result = fightDuel(a, b, { pitOnly: true, pace, rounds: 1 });
    assert.equal(result.exchanges.length, 100);
    assert.equal(result.method, "dump");
    assert.equal(result.finisher, null, "pit exit is not repeated as an extra finisher");
    assert.equal(result.koAt, 99);
    checkTape([a, b], result.exchanges, result.hp);
    assert.deepEqual(fightDuel(a, b, { pitOnly: true, pace, rounds: 1 }), result);
  }
});

test("simultaneous lethal weapon damage cannot double-eliminate a pit championship", () => {
  const stats = { ...template.stats, power: 10000, armor: 0, speed: 0 };
  const a = bot("a", { stats, brainFamily: "logic", utilityFamily: null });
  const b = bot("b", { stats, brainFamily: "logic", utilityFamily: null });
  const regular = fightDuel(a, b);
  assert.equal(regular.hp.a, 0);
  assert.equal(regular.hp.b, 0);
  const result = fightDuel(a, b, { pitOnly: true });
  assert.equal(result.method, "dump");
  checkTape([a, b], result.exchanges, result.hp);
});

test("every class matchup can finish by pit elimination with a balanced build", () => {
  const classes: ClassId[] = ["striker", "tank", "specialist"];
  for (const classA of classes) for (const classB of classes) {
    const a = bot("a", { classId: classA });
    const b = bot("b", { classId: classB });
    const result = fightDuel(a, b, { pitOnly: true });
    assert.equal(result.method, "dump");
    checkTape([a, b], result.exchanges, result.hp);
  }
});

test("twelve-bot Royale preserves individual memory and exact elimination order", () => {
  const classes: ClassId[] = ["striker", "tank", "specialist"];
  const fighters = Array.from({ length: 12 }, (_, index) => bot(`bot-${index.toString().padStart(2, "0")}`, {
    classId: classes[index % 3]!,
    utilityFamily: ["burn", "medbay", "weld", "tremor"][index % 4],
    brainFamily: index % 3 === 0 ? "phoenix" : "logic",
    weaponFamily: ["flame", "tesla", "claw", "saw"][index % 4]!,
    driveFamily: ["anchor", "air", "flip"][index % 3],
    batteryMax: index + 1,
  }));
  const input = structuredClone(fighters);
  const result = fightGroup(fighters, null, { lastBotStanding: true, pace: 1e-12 });
  assert.ok(result.exchanges.length > 12 * 6);
  const eliminated = checkTape(fighters, result.exchanges, result.hp);
  assert.deepEqual(result.order.slice(1), eliminated.reverse());
  assert.ok(result.hp[result.order[0]!]! > 0);
  assert.equal(result.bell["bot-00"]!.batteryMax, 1);
  assert.equal(result.bell["bot-11"]!.batteryMax, 12);
  assert.deepEqual(fightGroup([...fighters].reverse(), null, { lastBotStanding: true, pace: 1e-12 }), result);
  assert.deepEqual(fighters, input, "simulation must not modify fighter snapshots");
});

test("pit control respects loadout differences and leaves normal modes opt-in", () => {
  const a = bot("a");
  const b = bot("b");
  const control = bot("a", { weaponFamily: "claw", driveFamily: "flip" });
  assert.notDeepEqual(fightDuel(a, b, { pitOnly: true }).exchanges, fightDuel(control, b, { pitOnly: true }).exchanges);
  const regular = fightDuel(a, b, { pace: 0 });
  assert.equal(regular.exchanges.length, 3);
  assert.ok(regular.exchanges.every((exchange) => !exchange.tags.includes("pit-elimination")));
  const group = fightGroup([a, b], null, { pace: 0 });
  assert.equal(group.exchanges.length, 12);
  assert.ok(Object.values(group.hp).every((hp) => hp > 0));
  assert.throws(() => fightGroup([a, b], [[a.id], [b.id]], { lastBotStanding: true }), /free-for-all/);
  assert.throws(() => fightGroup([a, a], null, { lastBotStanding: true }), /distinct/);
});
