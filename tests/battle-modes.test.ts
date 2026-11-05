import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "zustand/vanilla";
import { makeData } from "../src/lib/pit/seed.ts";
import { pitCreator } from "../src/lib/pit/store.ts";
import {
  buildFit,
  foesThisWeek,
  printedStats,
  resolvePart,
  simulateDuel,
  simulateMelee,
  simulateTag,
} from "../src/lib/pit/engine.ts";
import { PARTS } from "../src/lib/pit/catalog.ts";
import { fightDuel } from "../src/lib/pit/combat.ts";
import { readMeters } from "../src/lib/pit/vitals.ts";
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
  assert.equal(last.combat[last.attackerId]!.hitCount, 1);
  assert.equal(result.hp[last.defenderId], 0);
});

test("duel, tag and melee hazards identify the affected bot and survive a replay save", () => {
  const data = world();
  data.week = 3;
  data.storeCards = data.storeCards.map((card) => ({ ...card, week: 3 }));
  for (const id of IDS) equip(data, id, { brain: "brain-berserker-sport", drive: "drive-rocket-super" });
  const results = [
    simulateDuel(data, IDS[0]!, IDS[1]!, "hazards"),
    simulateTag(data, IDS.slice(0, 2), IDS.slice(2), "hazards"),
    simulateMelee(data, IDS.slice(0, 3), "hazards"),
  ];
  for (const result of results) {
    const replay: typeof result = JSON.parse(JSON.stringify(result));
    const marks = replay.exchanges.flatMap((exchange) =>
      exchange.tags.filter((tag) => tag.startsWith("haz:")).map((tag) => ({ tag, exchange })),
    );
    assert.ok(marks.length > 0);
    assert.ok(marks.some(({ tag }) => tag.includes(":pit:")));
    for (const { tag, exchange } of marks) {
      const [, id, , rawDamage] = tag.split(":");
      assert.ok(replay.fighters.some((fighter) => fighter.id === id));
      assert.ok(exchange.combat?.[id!]);
      if (Number(rawDamage) > 0) assert.ok(exchange.combat[id!]!.hazardDamage > 0);
    }
    for (const exchange of replay.exchanges) {
      assert.ok(exchange.combat);
      const left = exchange.combat[exchange.attackerId]!;
      const right = exchange.combat[exchange.defenderId]!;
      assert.equal(left.after.hp, Math.max(0, left.before.hp - left.hazardDamage - right.damageDealt));
      assert.equal(right.after.hp, Math.max(0, right.before.hp - right.hazardDamage - left.damageDealt));
    }
  }
});

test("terrain speed changes are recorded for each fighter in duels and group battles", () => {
  const data = world();
  equip(data, IDS[0]!, { drive: "drive-air-super", brain: "brain-sniper-pro" });
  for (const result of [
    simulateDuel(data, IDS[0]!, IDS[1]!, "terrain"),
    simulateTag(data, IDS.slice(0, 2), IDS.slice(2), "terrain"),
    simulateMelee(data, IDS.slice(0, 3), "terrain"),
  ]) {
    const trace = result.exchanges.find((exchange) => exchange.combat?.[IDS[0]!])!.combat![IDS[0]!]!;
    assert.equal(trace.before.slow, 1);
    assert.ok(trace.after.slow > 1, "Air Cushion gets its actual water-lane speed boost");
    assert.ok(result.exchanges.some((exchange) => exchange.tags.some((tag) => tag.startsWith(`haz:${IDS[0]}:air:`))));
  }
});

test("new speed and smash weapons obey the same class-fit rules as their established peers", () => {
  const data = world();
  const bot = data.bots.find((row) => row.storeId === IDS[0])!;
  for (const classId of ["striker", "tank", "specialist"] as const) {
    bot.classId = classId;
    for (const [weapon, peer] of [
      ["weapon-rivetgun-super", "weapon-saw-super"],
      ["weapon-crusher-super", "weapon-hammer-super"],
    ]) {
      assert.equal(
        buildFit(bot, { ...STOCK, weapon }),
        buildFit(bot, { ...STOCK, weapon: peer }),
        `${weapon} follows ${peer}'s ${classId} class fit`,
      );
    }
  }
});

test("scouting accepts every weapon family in the current catalog", () => {
  const weapons = [...new Map(PARTS.filter((part) => part.slot === "weapon").map((part) => [part.family, part])).values()];
  for (const weapon of weapons) {
    const data = world();
    const targetId = foesThisWeek(data, IDS[0]!)[0]!;
    assert.ok(targetId);
    equip(data, IDS[0]!, { utility: "utility-scry-super" });
    equip(data, targetId, { weapon: weapon.id });
    const store = createStore(pitCreator);
    store.setState({ ...data, session: { role: "captain", storeId: IDS[0]!, crewId: null } });
    store.getState().callSpy(IDS[0]!, targetId, weapon.family);
    assert.equal(store.getState().intel[0]?.guess, weapon.family);
    store.getState().pullSpy(IDS[0]!, targetId);
    assert.ok(store.getState().intel[0]!.lines.some((line) => line.includes(weapon.name)), weapon.name);
  }
});

test("battery and stamina are recorded, recover between exchanges, and tire glass cannons first", () => {
  const [baseA, baseB] = simulateDuel(world(), IDS[0]!, IDS[1]!, "vitals").fighters;
  const glass = {
    ...baseA!,
    stats: { power: 42, speed: 22, armor: 8, heat: 10 },
    chassisFamily: "shrike",
    weaponFamily: "disc",
    driveFamily: "rocket",
    batteryMax: 58,
  };
  const brick = {
    ...baseB!,
    stats: { power: 18, speed: 10, armor: 44, heat: 10 },
    chassisFamily: "keystone",
    weaponFamily: "hammer",
    driveFamily: "anchor",
    batteryMax: 110,
  };
  const fought = fightDuel(glass, brick, { overtime: true, pace: 0.4, rounds: 6 });
  assert.equal(fought.bell[glass.id]!.battery, 58);
  assert.equal(fought.bell[glass.id]!.stamina, 100);
  assert.equal(fought.bell[glass.id]!.power, 42);
  assert.equal(fought.bell[brick.id]!.batteryMax, 110);
  const first = fought.exchanges[0]!;
  assert.ok(first.vitals);
  assert.ok(first.vitals![glass.id]!.staminaLow <= first.vitals![glass.id]!.stamina);
  assert.ok(first.vitals![glass.id]!.stamina < first.vitals![brick.id]!.stamina);
  assert.ok(first.vitals![glass.id]!.battery < fought.bell[glass.id]!.battery);
  for (let i = 1; i < fought.exchanges.length; i++) {
    const exchange = fought.exchanges[i]!;
    if (exchange.tags.includes("sudden-death") || exchange.tags.includes("burn")) continue;
    assert.equal(exchange.combat![glass.id]!.before.stamina, fought.exchanges[i - 1]!.combat![glass.id]!.after.stamina);
    assert.equal(exchange.combat![brick.id]!.before.battery, fought.exchanges[i - 1]!.combat![brick.id]!.after.battery);
  }
  const again = fightDuel(glass, brick, { overtime: true, pace: 0.4, rounds: 6 });
  assert.deepEqual(again.exchanges, fought.exchanges);
  assert.deepEqual(again.bell, fought.bell);
});

test("watch meters read recorded vitals and stay blank when a tape predates them", () => {
  const result = simulateDuel(world(), IDS[0]!, IDS[1]!, "meters");
  const id = result.fighters[0]!.id;
  const bell = readMeters(result, id, { kind: "bell" });
  assert.ok(bell);
  assert.equal(bell!.battery, result.bell![id]!.battery);
  assert.equal(bell!.stamina, 100);
  assert.equal(bell!.power, result.fighters[0]!.stats.power);
  const mid = readMeters(result, id, { kind: "exchange", index: 0, local: 0.8 });
  assert.ok(mid);
  assert.ok(mid!.battery <= bell!.battery);
  const legacy = { ...result, bell: undefined, exchanges: result.exchanges.map((exchange) => ({ ...exchange, vitals: undefined })) };
  assert.equal(readMeters(legacy, id, { kind: "bell" }), null);
  assert.equal(readMeters(legacy, id, { kind: "exchange", index: 0, local: 0.5 }), null);
  assert.equal(readMeters(legacy, id, { kind: "final" }), null);
});
