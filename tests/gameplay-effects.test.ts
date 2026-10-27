import test from "node:test";
import assert from "node:assert/strict";
import { PARTS, batteryOf, partById, stockPart, type Part } from "../src/lib/pit/catalog.ts";
import { simulateDuel } from "../src/lib/pit/engine.ts";
import { makeData } from "../src/lib/pit/seed.ts";
import type {
  ClassId,
  FighterSnap,
  FightResult,
  Loadout,
  PitData,
  Slot,
  Tier,
} from "../src/lib/pit/types.ts";

const SLOTS: Slot[] = ["chassis", "drive", "weapon", "armor", "utility", "brain"];
const CLASSES: ClassId[] = ["striker", "tank", "specialist"];
const TIERS: Tier[] = ["stock", "sport", "pro", "super", "championship"];
const A = "waco";
const B = "arlington";

function loadout(classId: ClassId, upgraded = false): Loadout {
  const load = Object.fromEntries(
    SLOTS.map((slot) => {
      if (slot === "utility") return [slot, null];
      const part = stockPart(slot, classId);
      const upgrade = partById(`${slot}-${part.family}-super`);
      return [slot, upgraded && upgrade ? upgrade.id : part.id];
    }),
  ) as Loadout;
  return load;
}

function fixture(): PitData {
  const data = makeData();
  data.phase = "locked";
  data.week = 1;
  for (const id of [A, B]) {
    const card = data.storeCards.find((row) => row.storeId === id && row.week === 1)!;
    card.grades = {
      nsnu: "green",
      conv: "green",
      demoRate: "green",
      demoClose: "green",
      arch: "green",
      ticket: "green",
    };
    card.projected = false;
  }
  return data;
}

function equip(data: PitData, id: string, classId: ClassId, load: Loadout) {
  for (const partId of Object.values(load)) {
    if (!partId) continue;
    const part = partById(partId);
    assert.ok(part, `fixture part must exist: ${partId}`);
    assert.ok(!part.classLock || part.classLock === classId, `fixture class must fit: ${partId}`);
  }
  const bot = data.bots.find((row) => row.storeId === id)!;
  bot.classId = classId;
  bot.wear = {
    chassis: "clean",
    drive: "clean",
    weapon: "clean",
    armor: "clean",
    utility: "clean",
    brain: "clean",
  };
  bot.partWear = {};
  bot.owned = Object.values(load).filter((value): value is string => Boolean(value));
  bot.locked = { ...load };
  bot.draft = { ...load };
  bot.equipped = { ...load };
}

/** Compare health/damage, not commentary, tags, item names or the tier tiebreak. */
function numbers(result: FightResult) {
  return JSON.stringify({
    hp: result.hp,
    exchanges: result.exchanges.map((row) => [
      row.attackerId,
      row.damage,
      row.attackerHp,
      row.defenderHp,
    ]),
    finisher: result.finisher ? [result.finisher.by, result.finisher.damage] : null,
  });
}

const THREATS: Array<{ classId: ClassId; patch: Partial<Loadout> }> = [
  { classId: "striker", patch: {} },
  { classId: "tank", patch: {} },
  { classId: "specialist", patch: {} },
  { classId: "striker", patch: { brain: "brain-berserker-sport", drive: "drive-rocket-super" } },
  { classId: "striker", patch: { brain: "brain-sniper-pro", drive: "drive-air-super" } },
  { classId: "tank", patch: { brain: "brain-turtle-pro", armor: "armor-reactive-super" } },
  {
    classId: "specialist",
    patch: {
      weapon: "weapon-tesla-super",
      brain: "brain-jammer-super",
      utility: "utility-smoke-super",
    },
  },
  {
    classId: "specialist",
    patch: { weapon: "weapon-flame-super", utility: "utility-blackout-pro" },
  },
];

function changedCombat(part: Part, prior: Part, saturated: boolean): boolean {
  const data = fixture();
  // Scry is explicitly an underdog tool; an equal-week matchup cannot exercise its read.
  if (part.family === "scry") {
    data.storeCards.find((row) => row.storeId === A && row.week === 1)!.grades = {
      nsnu: "blue",
      conv: "blue",
      demoRate: "blue",
      demoClose: "blue",
      arch: "blue",
      ticket: "blue",
    };
  }
  const compatibleClasses = CLASSES.filter(
    (classId) =>
      (!part.classLock || part.classLock === classId) &&
      (!prior.classLock || prior.classLock === classId),
  );
  for (const classId of compatibleClasses) {
    const base = loadout(classId, saturated);
    for (const threat of THREATS) {
      equip(data, B, threat.classId, { ...loadout(threat.classId, true), ...threat.patch });
      equip(data, A, classId, { ...base, [part.slot]: prior.id });
      const before = simulateDuel(data, A, B, "catalog-effect");
      equip(data, A, classId, { ...base, [part.slot]: part.id });
      const after = simulateDuel(data, A, B, "catalog-effect");
      if (numbers(before) !== numbers(after)) return true;
    }
  }
  return false;
}

test("every catalog part survives the backend battle snapshot with real numeric stats", () => {
  assert.equal(
    new Set(PARTS.map((part) => part.id)).size,
    PARTS.length,
    "catalog IDs must be unique",
  );
  const data = fixture();
  for (const part of PARTS) {
    const classId = part.classLock ?? "striker";
    const load = { ...loadout(classId), [part.slot]: part.id };
    equip(data, A, classId, load);
    equip(data, B, "tank", loadout("tank"));
    const result = simulateDuel(data, A, B, "catalog-snapshot");
    const snap = result.fighters.find((row) => row.id === A)!;
    assert.equal(snap[`${part.slot}Family` as keyof FighterSnap], part.family, part.id);
    assert.equal(snap.tiers?.[part.slot], part.tier, part.id);
    assert.equal(snap.wearMult?.[part.slot], 1, part.id);
    assert.equal(snap.batteryMax, batteryOf(partById(load.chassis)), part.id);
    for (const value of Object.values(snap.stats))
      assert.ok(Number.isFinite(value) && value > 0, part.id);
    for (const value of Object.values(result.hp))
      assert.ok(Number.isFinite(value) && value >= 0 && value <= 100, part.id);
  }
});

test("every purchasable or title part changes numeric battle results in a relevant matchup", () => {
  const inert: string[] = [];
  for (const part of PARTS.filter((row) => row.tier !== "stock")) {
    const sameFamily = PARTS.filter(
      (row) =>
        row.slot === part.slot &&
        row.family === part.family &&
        TIERS.indexOf(row.tier) < TIERS.indexOf(part.tier),
    );
    const prior =
      sameFamily.sort((a, b) => TIERS.indexOf(b.tier) - TIERS.indexOf(a.tier))[0] ??
      stockPart(part.slot, part.classLock ?? "striker");
    if (!changedCombat(part, prior, false) && !changedCombat(part, prior, true))
      inert.push(`${part.id} vs ${prior.id}`);
  }
  assert.deepEqual(
    inert,
    [],
    "parts must affect damage or health, not just names or the judges' tier tiebreak",
  );
});

test("every stock part retains numeric effects on an otherwise upgraded build", () => {
  const inert: string[] = [];
  for (const part of PARTS.filter((row) => row.tier === "stock")) {
    const classId = part.classLock ?? "striker";
    const alternatives = PARTS.filter(
      (row) =>
        row.slot === part.slot &&
        row.tier === "stock" &&
        row.id !== part.id &&
        (!row.classLock || row.classLock === classId),
    );
    assert.ok(alternatives.length, `a comparison stock part exists for ${part.id}`);
    if (!alternatives.some((prior) => changedCombat(part, prior, true))) inert.push(part.id);
  }
  assert.deepEqual(
    inert,
    [],
    "stock parts must contribute to numeric fights, even when the rest of the build is upgraded",
  );
});

test("tier upgrades retain numeric battle effects on fully upgraded builds", () => {
  const inert: string[] = [];
  for (const part of PARTS.filter((row) => row.tier !== "stock")) {
    const prior = PARTS.find(
      (row) =>
        row.slot === part.slot &&
        row.family === part.family &&
        TIERS.indexOf(row.tier) === TIERS.indexOf(part.tier) - 1,
    );
    if (prior && !changedCombat(part, prior, true)) inert.push(`${part.id} vs ${prior.id}`);
  }
  assert.deepEqual(inert, [], "reaching the build-fit cap must not make an earned tier inert");
});
