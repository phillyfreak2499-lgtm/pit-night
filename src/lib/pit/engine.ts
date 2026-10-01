import {
  CLASS_META,
  partById,
  partsFor,
  stockPart,
  KEY_SOURCE,
  GRADE_COINS,
  METRICS,
  REPAIR_PRICE,
  metricFor,
  type Part,
} from "./catalog";
import { TUNE_UP_BONUS } from "./training";
import { tunedUp } from "./week";
import type {
  Bot,
  Bout,
  ClassId,
  Condition,
  Exchange,
  FightResult,
  FighterSnap,
  GazetteEntry,
  Grade,
  KeyName,
  Loadout,
  Method,
  PitData,
  Quote,
  Slot,
  StatBlock,
  StatKey,
  Tier,
  Store,
  StoreCard,
} from "./types";

export const SLOTS: Slot[] = ["chassis", "drive", "weapon", "armor", "utility", "brain"];

const GRADE_Q: Record<Grade, number> = {
  green: 1,
  blue: 0.72,
  orange: 0.44,
  red: 0.16,
};

const TIER_FIT: Record<string, number> = {
  stock: 0,
  sport: 0.055,
  pro: 0.1,
  super: 0.15,
  championship: 0.19,
};

/** Grade one number against its bands from the scorecard chart. */
export function gradeMetric(stat: StatKey, value: number): Grade {
  const [g, b, o] = metricFor(stat).bands;
  const v = Math.round(value * 100) / 100;
  if (v >= g) return "green";
  if (v >= b) return "blue";
  if (v >= o) return "orange";
  return "red";
}

export type GradeSet = Record<StatKey, Grade>;

export function gradesOf(card: StoreCard): GradeSet {
  const o = card.grades ?? {};
  return {
    nsnu: o.nsnu ?? gradeMetric("nsnu", card.nsnu),
    conv: o.conv ?? gradeMetric("conv", card.conv),
    demoRate: o.demoRate ?? gradeMetric("demoRate", card.demoRate),
    demoClose: o.demoClose ?? gradeMetric("demoClose", card.demoClose),
    arch: o.arch ?? gradeMetric("arch", card.arch),
    ticket: o.ticket ?? gradeMetric("ticket", card.demoTicket),
  };
}

/** Kickoff ranking from Period 11 colors: coins, then greens, then NSNU, then the old seed. */
export function kickoffRank(data: Pick<PitData, "stores" | "kickoff">) {
  const ORDER = { green: 3, blue: 2, orange: 1, red: 0 } as const;
  const rows = data.stores.map((store) => {
    const g = data.kickoff?.grades?.[store.id] ?? {};
    const filled = METRICS.filter((m) => g[m.stat]).length;
    const full = Object.fromEntries(METRICS.map((m) => [m.stat, g[m.stat] ?? "red"])) as GradeSet;
    const math = coinMath(full);
    return { store, filled, coins: math.total, bySlot: math.bySlot, greens: math.greens, nsnu: ORDER[full.nsnu] };
  });
  rows.sort((a, b) => b.coins - a.coins || b.greens - a.greens || b.nsnu - a.nsnu || a.store.seed - b.store.seed);
  return rows.map((row, i) => ({ ...row, seed: i + 1 }));
}

/** Stable text for a card, for seeding the fight dice. */
export function cardKey(card: StoreCard | undefined) {
  if (!card) return "none";
  const g = card.grades ? Object.entries(card.grades).sort().map(([k, v]) => `${k}=${v}`).join(",") : "";
  return `${card.nsnu}:${card.conv}:${card.demoRate}:${card.demoClose}:${card.arch}:${card.demoTicket}${g ? `:${g}` : ""}`;
}

export function cardValue(card: StoreCard, stat: StatKey): number {
  if (stat === "ticket") return card.demoTicket;
  return card[stat];
}

/** What a card pays: coins per part, by grade. */
export function coinMath(grades: GradeSet): { bySlot: Record<KeyName, number>; total: number; greens: number } {
  const bySlot = { chassis: 0, drive: 0, weapon: 0, armor: 0, utility: 0, brain: 0 } as Record<KeyName, number>;
  let total = 0;
  let greens = 0;
  for (const m of METRICS) {
    const g = grades[m.stat];
    bySlot[m.slot] += GRADE_COINS[g];
    total += GRADE_COINS[g];
    if (g === "green") greens += 1;
  }
  return { bySlot, total, greens };
}

export function weekQuality(grades: GradeSet): number {
  const list = METRICS.map((m) => grades[m.stat]);
  return list.reduce((sum, g) => sum + GRADE_Q[g], 0) / list.length;
}

export function cardFor(data: PitData, storeId: string, week = data.week): StoreCard | undefined {
  return data.storeCards.find((c) => c.storeId === storeId && c.week === week);
}

export function botFor(data: PitData, storeId: string): Bot {
  const bot = data.bots.find((b) => b.storeId === storeId);
  if (!bot) throw new Error(`No bot for ${storeId}`);
  return bot;
}

export function storeFor(data: PitData, storeId: string) {
  const store = data.stores.find((s) => s.id === storeId);
  if (!store) throw new Error(`No store ${storeId}`);
  return store;
}

export function recordOf(data: PitData, storeId: string): { w: number; l: number } {
  let w = 0;
  let l = 0;
  for (const bout of data.bouts) {
    if (!bout.result) continue;
    if (bout.kind === "bye" || bout.result.method === "bye") {
      if (bout.result.winnerIds.includes(storeId)) w += 1;
      continue;
    }
    if (bout.result.method === "scrimmage") continue;
    if (bout.kind === "melee") {
      if (bout.result.winnerIds.includes(storeId)) w += 1;
      continue;
    }
    if (bout.result.winnerIds.includes(storeId)) w += 1;
    if (bout.result.loserIds.includes(storeId)) l += 1;
  }
  return { w, l };
}

/** Tie-break weight: clicked colors first, then NSNU dollars. */
export function nsnuOf(data: PitData, storeId: string, week: number): number {
  const card = data.storeCards.find((c) => c.storeId === storeId && c.week === week);
  if (!card) return 0;
  // Clicked colors outrank a leftover projection number.
  return weekQuality(gradesOf(card)) * 100000 + card.nsnu;
}

export function rankedStores(data: PitData) {
  const weekForTie = data.week > 1 ? data.week - 1 : 1;
  return [...data.stores].sort((a, b) => {
    if (data.week === 1 && data.phase === "open") return a.seed - b.seed;
    const ra = recordOf(data, a.id);
    const rb = recordOf(data, b.id);
    if (rb.w !== ra.w) return rb.w - ra.w;
    if (ra.l !== rb.l) return ra.l - rb.l;
    const na = nsnuOf(data, a.id, data.bouts.length ? weekForTie : data.week);
    const nb = nsnuOf(data, b.id, data.bouts.length ? weekForTie : data.week);
    if (nb !== na) return nb - na;
    return a.seed - b.seed;
  });
}

/** Best record is wins, then losses. The same W-L is a tie, and those stores fight. */
export function titleField(data: PitData) {
  const ranked = [...data.stores].sort((a, b) => {
    const ra = recordOf(data, a.id);
    const rb = recordOf(data, b.id);
    if (rb.w !== ra.w) return rb.w - ra.w;
    if (ra.l !== rb.l) return ra.l - rb.l;
    return a.seed - b.seed;
  });
  const top = ranked[0];
  if (!top) return { leaders: [] as string[], ranked };
  const mark = recordOf(data, top.id);
  const leaders = ranked
    .filter((store) => {
      const rec = recordOf(data, store.id);
      return rec.w === mark.w && rec.l === mark.l;
    })
    .map((store) => store.id);
  return { leaders, ranked };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function activeLoadout(bot: Bot, phase: PitData["phase"]): Loadout {
  if ((phase === "locked" || phase === "fought" || phase === "inspected" || phase === "complete") && bot.locked) {
    return bot.locked;
  }
  return bot.draft;
}

function wearMult(cond: Condition): number {
  if (cond === "bent") return 0.5;
  if (cond === "scratched") return 0.96;
  return 1;
}

export function resolvePart(bot: Bot, slot: Slot, loadout: Loadout): { part: Part | null; mult: number; broken: boolean } {
  if (slot === "utility" && !loadout.utility) return { part: null, mult: 1, broken: false };
  const id = loadout[slot];
  const part = id ? partById(id) : undefined;
  const cond = bot.wear[slot];
  if (!part) return { part: null, mult: 1, broken: false };
  if (cond === "disabled") {
    if (slot === "utility") return { part: null, mult: 1, broken: true };
    const loaner = stockPart(slot, bot.classId);
    return { part: loaner, mult: 1, broken: true };
  }
  return { part, mult: wearMult(cond), broken: false };
}

function synergy(classId: ClassId, weapon: Part | null, drive: Part | null, utility: Part | null): number {
  let s = 0;
  const fam = weapon?.family;
  const speedWep = fam === "saw" || fam === "drum" || fam === "disc";
  const smash = fam === "hammer" || fam === "wedge";
  if (classId === "striker" && speedWep) s += fam === "disc" ? 0.16 : 0.14;
  if (classId === "striker" && smash) s -= 0.16;
  if (classId === "striker" && fam === "claw") s -= 0.06;
  if (classId === "tank" && speedWep) s -= fam === "disc" ? 0.4 : 0.28;
  if (classId === "tank" && smash) s += 0.14;
  if (classId === "tank" && fam === "claw") s -= 0.08;
  if (classId === "specialist" && fam === "claw") s += 0.18;
  if (classId === "specialist" && speedWep) s -= 0.14;
  if (classId === "specialist" && fam === "wedge") s -= 0.06;
  if (classId === "tank" && drive?.family === "treads") s += 0.05;
  if (classId === "striker" && (drive?.family === "mag" || drive?.family === "flip")) s += 0.04;
  if (classId === "specialist" && drive?.family === "omni") s += 0.05;
  if (utility?.family === "burn" && classId === "striker") s += 0.04;
  if (utility?.family === "weld") s += 0.03;
  if (utility?.family === "crowd") s += 0.02;
  if (utility?.family === "peace") s += 0.02;
  return s;
}

export function buildFit(bot: Bot, loadout: Loadout): number {
  const slots: Slot[] = ["chassis", "drive", "weapon", "armor", "brain"];
  let fit = 0.46;
  const resolved = slots.map((slot) => resolvePart(bot, slot, loadout));
  for (const r of resolved) {
    if (!r.part) continue;
    fit += TIER_FIT[r.part.tier] * r.mult;
    if (r.broken) fit -= 0.04;
  }
  const utility = resolvePart(bot, "utility", loadout);
  if (utility.part) fit += TIER_FIT[utility.part.tier] * 0.85 * utility.mult;
  const weapon = resolved[2]?.part ?? null;
  const drive = resolved[1]?.part ?? null;
  fit += synergy(bot.classId, weapon, drive, utility.part);
  const conds = SLOTS.map((slot) => (slot === "utility" && !loadout.utility ? "clean" : bot.wear[slot]));
  const scar = conds.filter((c) => c === "scratched").length;
  const bent = conds.filter((c) => c === "bent").length;
  fit -= scar * 0.015 + bent * 0.06;
  return clamp(fit, 0.08, 0.98);
}

export function ratingOf(weekQ: number, fit: number): number {
  const floor = 24 + weekQ * 34;
  const ceil = 56 + weekQ * 42;
  return floor + (ceil - floor) * fit;
}

function share(classId: ClassId): StatBlock {
  if (classId === "striker") return { power: 0.3, speed: 0.4, armor: 0.15, heat: 0.15 };
  if (classId === "tank") return { power: 0.28, speed: 0.14, armor: 0.44, heat: 0.14 };
  return { power: 0.22, speed: 0.22, armor: 0.18, heat: 0.38 };
}

export function printedStats(bot: Bot, loadout: Loadout, weekQ: number): { stats: StatBlock; rating: number; fit: number } {
  const fit = buildFit(bot, loadout);
  const rating = ratingOf(weekQ, fit);
  const base = share(bot.classId);
  const stats: StatBlock = {
    power: rating * base.power,
    speed: rating * base.speed,
    armor: rating * base.armor,
    heat: rating * base.heat,
  };
  for (const slot of SLOTS) {
    const resolved = resolvePart(bot, slot, loadout);
    if (!resolved.part) continue;
    const n = resolved.part.nudge;
    const m = resolved.mult * (slot === "chassis" ? 0.45 : 1);
    stats.power += n.power * m;
    stats.speed += n.speed * m;
    stats.armor += n.armor * m;
    stats.heat += n.heat * m;
  }
  const scry = resolvePart(bot, "utility", loadout).part?.family === "scry";
  if (scry && weekQ < 0.82) stats.heat += 2;
  (Object.keys(stats) as (keyof StatBlock)[]).forEach((k) => {
    stats[k] = Math.round(clamp(stats[k], 1, 99));
  });
  return { stats, rating: Math.round(rating), fit };
}

function cageParts(bot: Bot, slot: Slot): Part[] {
  const list = partsFor(slot, bot.classId).filter((part) => part.tier === "stock" || bot.owned.includes(part.id));
  if (slot !== "utility" && list.length === 0) return [stockPart(slot, bot.classId)];
  return list;
}

function wearFor(bot: Bot, loadout: Loadout): Bot {
  const wear = { ...bot.wear };
  for (const slot of SLOTS) {
    const id = loadout[slot];
    wear[slot] = id ? (bot.partWear[id] ?? "clean") : "clean";
  }
  return { ...bot, wear };
}

function lockScore(printed: { rating: number; fit: number; stats: StatBlock }) {
  return printed.rating * 100 + printed.fit * 40 + printed.stats.power + printed.stats.speed + printed.stats.armor + printed.stats.heat;
}

export type LockAdvice = {
  loadout: Loadout;
  current: { stats: StatBlock; rating: number; fit: number };
  best: { stats: StatBlock; rating: number; fit: number };
  changes: { slot: Slot; from: string; to: string }[];
  summary: string;
  already: boolean;
};

/** Best legal lock for this week. Stock or owned only. Does not spend coins or change class. */
export function bestLock(bot: Bot, weekQ: number): LockAdvice {
  const currentLoad: Loadout = { ...(bot.locked ?? bot.draft) };
  const current = printedStats(wearFor(bot, currentLoad), currentLoad, weekQ);
  const chassis = cageParts(bot, "chassis");
  const drives = cageParts(bot, "drive");
  const weapons = cageParts(bot, "weapon");
  const armors = cageParts(bot, "armor");
  const utilities: (Part | null)[] = [null, ...cageParts(bot, "utility")];
  const brains = cageParts(bot, "brain");

  let bestLoad = currentLoad;
  let bestPrinted = current;
  let bestScore = lockScore(current);

  for (const body of chassis) {
    for (const drive of drives) {
      for (const weapon of weapons) {
        for (const armor of armors) {
          for (const utility of utilities) {
            for (const brain of brains) {
            const loadout: Loadout = {
              chassis: body.id,
              drive: drive.id,
              weapon: weapon.id,
              armor: armor.id,
              utility: utility?.id ?? null,
              brain: brain.id,
            };
            const printed = printedStats(wearFor(bot, loadout), loadout, weekQ);
            const score = lockScore(printed);
            if (score > bestScore) {
              bestScore = score;
              bestLoad = loadout;
              bestPrinted = printed;
            }
            }
          }
        }
      }
    }
  }

  const changes = SLOTS.flatMap((slot) => {
    const from = currentLoad[slot];
    const to = bestLoad[slot];
    if (from === to) return [];
    const fromName = from ? (partById(from)?.name ?? from) : "Empty";
    const toName = to ? (partById(to)?.name ?? to) : "Empty";
    return [{ slot, from: fromName, to: toName }];
  });
  const already = changes.length === 0;
  const weaponSwap = changes.find((change) => change.slot === "weapon");
  const summary = already
    ? `${bot.name} is already on the best iron in the bay for this week.`
    : weaponSwap
      ? `Swap ${weaponSwap.from} for ${weaponSwap.to}. That is the rating move. The week still sets the ceiling.`
      : `Keep the weapon. Step up the metal already in the cage.`;

  return { loadout: bestLoad, current, best: bestPrinted, changes, summary, already };
}

const SPY_DEPTH: Record<Tier, number> = { stock: 0, sport: 1, pro: 2, super: 3, championship: 4 };

const FAMILY_WORD: Record<string, string> = {
  saw: "a saw",
  drum: "a drum",
  wedge: "a wedge",
  hammer: "a hammer",
  claw: "a claw",
  disc: "a disc",
  mag: "mag drive",
  treads: "treads",
  omni: "omni wheels",
  flip: "a flip drive",
  plate: "plate",
  skirt: "a skirt",
  angle: "an angle kit",
  cage: "a cage",
  burn: "an afterburner",
  peace: "a peace lock",
  crowd: "a crowd kit",
  weld: "a pit weld",
  scry: "a scry",
};

function familyWord(family: string) {
  return FAMILY_WORD[family] ?? family;
}

function weaponTell(classId: ClassId, family: string): string | null {
  const speed = family === "saw" || family === "drum" || family === "disc";
  const smash = family === "hammer" || family === "wedge";
  if (classId === "tank" && family === "disc") return "A disc on a tank is a ceiling fan.";
  if (classId === "tank" && speed) return "A speed weapon on a tank. They are fighting the chassis.";
  if (classId === "tank" && family === "claw") return "A claw on a tank. That is not the late fight.";
  if (classId === "striker" && smash) return "A smash weapon on a striker. They gave up the first hit.";
  if (classId === "striker" && family === "claw") return "A claw on a striker. Heat is not their week.";
  if (classId === "specialist" && speed) return "A speed weapon on a specialist. The claw is the point.";
  if (classId === "specialist" && family === "wedge") return "A wedge on a specialist. They are not a tank.";
  return null;
}

export const WEAPON_FAMILIES = ["saw", "drum", "wedge", "hammer", "claw", "disc"] as const;

export function weaponFamilyOf(bot: Bot): string {
  const load = bot.locked ?? bot.draft;
  return partById(load.weapon)?.family ?? "";
}

export function loadSignature(load: Loadout) {
  return `${load.chassis}|${load.drive}|${load.weapon}|${load.armor}|${load.utility ?? ""}`;
}

/** Stores booked against this bay on the current week's card. */
export function foesThisWeek(data: PitData, storeId: string): string[] {
  const bout = buildCard(data).find((row) => row.kind !== "bye" && row.storeIds.includes(storeId));
  if (!bout) return [];
  return bout.storeIds.filter((id) => id !== storeId);
}

export function equippedScry(bot: Bot): { tier: Tier; name: string } | null {
  const load = bot.locked ?? bot.draft;
  const part = load.utility ? partById(load.utility) : undefined;
  if (!part || part.family !== "scry") return null;
  return { tier: part.tier, name: part.name };
}

export type SpyRead = {
  targetId: string;
  storeName: string;
  botName: string;
  signature: string;
  locked: boolean;
  lines: string[];
};

/** What a Scry is allowed to say. Stock never names the part. */
export function spyRead(data: PitData, targetId: string, tier: Tier): SpyRead | null {
  const store = data.stores.find((row) => row.id === targetId);
  const bot = data.bots.find((row) => row.storeId === targetId);
  if (!store || !bot) return null;
  const load = bot.locked ?? bot.draft;
  const weapon = partById(load.weapon);
  const drive = partById(load.drive);
  const armor = partById(load.armor);
  const utility = load.utility ? partById(load.utility) : undefined;
  const depth = SPY_DEPTH[tier];
  const lines = [`${bot.name} is a ${CLASS_META[bot.classId].label}.`];
  if (weapon) {
    lines.push(`Weapon family: ${familyWord(weapon.family)}.`);
    lines.push(weaponTell(bot.classId, weapon.family) ?? "The weapon belongs on that class.");
  }
  if (depth >= 1 && drive) lines.push(`Drive: ${familyWord(drive.family)}.`);
  if (depth >= 2 && armor) lines.push(`Armor: ${familyWord(armor.family)}.`);
  if (depth >= 3) lines.push(`Named iron: ${weapon?.name ?? "—"}, ${drive?.name ?? "—"}, ${armor?.name ?? "—"}.`);
  if (depth >= 4) lines.push(utility ? `Utility: ${utility.name}.` : "Utility slot is empty.");
  return {
    targetId,
    storeName: store.name,
    botName: bot.name,
    signature: loadSignature(load),
    locked: Boolean(bot.locked),
    lines,
  };
}

function snapshot(data: PitData, storeId: string): FighterSnap {
  const store = storeFor(data, storeId);
  const bot = botFor(data, storeId);
  const card = cardFor(data, storeId);
  const grades: GradeSet = card
    ? gradesOf(card)
    : { nsnu: "red", conv: "red", demoRate: "red", demoClose: "red", arch: "red", ticket: "red" };
  const weekQ = weekQuality(grades);
  const loadout = activeLoadout(bot, data.phase === "open" ? "locked" : data.phase);
  const locked = bot.locked ?? bot.draft;
  const printed = printedStats(bot, data.phase === "open" ? locked : loadout, weekQ);
  // Full Tune-Up: every job and Spark done this week. A small, earned edge.
  const tuned = Boolean(data.jobLog && tunedUp(data, storeId, data.week));
  if (tuned) {
    for (const k of ["power", "speed", "armor", "heat"] as const) printed.stats[k] = Math.min(99, printed.stats[k] + TUNE_UP_BONUS);
  }
  const weapon = resolvePart(bot, "weapon", locked);
  const drive = resolvePart(bot, "drive", locked);
  const armor = resolvePart(bot, "armor", locked);
  const chassis = resolvePart(bot, "chassis", locked);
  const utility = resolvePart(bot, "utility", locked);
  return {
    id: storeId,
    name: store.name,
    storeName: store.name,
    classId: bot.classId,
    paint: store.paint,
    botName: bot.name,
    stats: printed.stats,
    rating: printed.rating,
    fit: printed.fit,
    weekQ,
    weaponFamily: weapon.part?.family ?? "none",
    weaponName: partById(locked.weapon)?.name ?? "Bare shaft",
    driveName: partById(locked.drive)?.name ?? "—",
    armorName: partById(locked.armor)?.name ?? "—",
    utilityName: locked.utility ? (partById(locked.utility)?.name ?? null) : null,
    chassisName: partById(locked.chassis)?.name ?? CLASS_META[bot.classId].chassis,
    look: bot.look ?? "plain",
    number: bot.number ?? "",
    style: bot.style,
    brainTier: resolvePart(bot, "brain", locked).part?.tier ?? "stock",
    brainName: resolvePart(bot, "brain", locked).part?.name ?? "Logic Board",
    tuned,
  };
}

function betterWeekEdge(a: FighterSnap, b: FighterSnap): number {
  return (a.weekQ - b.weekQ) * 6;
}

function strikeDamage(attacker: FighterSnap, defender: FighterSnap, index: number, rng: () => number): { damage: number; tags: string[]; call: string } {
  const tags: string[] = [];
  let dmg =
    attacker.stats.power * 1.22 +
    attacker.stats.speed * 0.2 -
    defender.stats.armor * 0.38 +
    betterWeekEdge(attacker, defender);

  if (index === 0 && attacker.stats.speed > defender.stats.speed + 4) {
    const bonus = (attacker.stats.speed - defender.stats.speed) * 0.42;
    dmg += bonus;
    tags.push("first");
  }

  if (
    attacker.classId === "striker" &&
    defender.classId === "tank" &&
    attacker.stats.speed > defender.stats.speed + 6
  ) {
    dmg += index === 0 ? 16 : index === 1 ? 12 : 4;
    tags.push("pressure");
  }

  if (attacker.classId === "tank" && index === 2) {
    dmg += 10 + attacker.stats.armor * 0.12;
    tags.push("late");
  }

  if (
    attacker.classId === "tank" &&
    defender.classId === "specialist" &&
    index > 0 &&
    defender.stats.heat < 22
  ) {
    dmg += 9;
    tags.push("smother");
  }

  if (
    attacker.classId === "specialist" &&
    defender.classId === "striker" &&
    attacker.stats.heat >= defender.stats.heat + 2
  ) {
    dmg += 8 + Math.max(0, attacker.stats.heat - defender.stats.heat) * 0.35;
    tags.push("heat");
  }

  if (attacker.classId === "striker" && defender.classId === "specialist" && defender.stats.heat >= attacker.stats.heat + 4) {
    dmg *= 0.62;
    tags.push("shutdown");
  }

  if (attacker.weaponFamily === "disc" && attacker.classId === "tank") {
    dmg *= 0.55;
    tags.push("ceiling-fan");
  }

  if (attacker.weaponFamily === "wedge" && attacker.classId === "striker") {
    dmg *= 0.78;
    tags.push("wrong-iron");
  }

  const variance = 0.92 + rng() * 0.16;
  dmg = clamp(dmg * variance, 8, 58);

  const call = callLine(attacker, defender, tags, index);
  return { damage: Math.round(dmg), tags, call };
}

function callLine(attacker: FighterSnap, defender: FighterSnap, tags: string[], index: number): string {
  if (tags.includes("ceiling-fan")) {
    return `${attacker.botName} spins the disc. On that chassis it is a ceiling fan. ${defender.botName} walks through it.`;
  }
  if (tags.includes("pressure") && index === 0) {
    return `${attacker.botName} is in the pocket before ${defender.storeName} finishes the handshake.`;
  }
  if (tags.includes("shutdown")) {
    return `${defender.botName} cooks the exchange. ${attacker.botName} swings at air that is already hot.`;
  }
  if (tags.includes("heat")) {
    return `Heat is real. ${attacker.botName} holds ${defender.botName} and does not give the saw back.`;
  }
  if (tags.includes("smother")) {
    return `${attacker.botName} lays on the grapple and waits. The claw never finds a second bite.`;
  }
  if (tags.includes("late")) {
    return `Late fight. ${attacker.botName} finally spends the armor it drove in with.`;
  }
  if (tags.includes("wrong-iron")) {
    return `${attacker.botName} brought the wrong iron. ${defender.botName} treats it like a suggestion.`;
  }
  if (tags.includes("first")) {
    return `First steel belongs to ${attacker.storeName}.`;
  }
  return `${attacker.botName} and ${defender.botName} trade the middle of the cage.`;
}

function exchangeOrder(a: FighterSnap, b: FighterSnap): [FighterSnap, FighterSnap, FighterSnap] {
  const first = a.stats.speed >= b.stats.speed ? a : b;
  const slower = first.id === a.id ? b : a;
  let second = slower;
  if (
    first.classId === "striker" &&
    slower.classId === "tank" &&
    first.stats.speed > slower.stats.speed + 6
  ) {
    second = first;
  }
  if (
    first.classId === "specialist" &&
    slower.classId === "striker" &&
    first.stats.heat >= slower.stats.heat + 2
  ) {
    second = first;
  }
  let third = a.stats.power >= b.stats.power ? a : b;
  if (a.classId === "tank" && b.classId !== "tank") third = a;
  if (b.classId === "tank" && a.classId !== "tank") third = b;
  if (a.classId === "tank" && b.classId === "tank") {
    third = a.stats.armor >= b.stats.armor ? a : b;
  }
  return [first, second, third];
}

function emptyWear(): Record<Slot, Condition> {
  return { chassis: "clean", drive: "clean", weapon: "clean", armor: "clean", utility: "clean", brain: "clean" };
}

function planDuelWear(
  winner: string,
  loser: string,
  method: Method,
  blowout: boolean,
  rng: () => number,
): Record<string, Record<Slot, Condition>> {
  const w = emptyWear();
  const l = emptyWear();
  const scratchPool: Slot[] = ["armor", "drive", "chassis", "weapon"];
  w[scratchPool[Math.floor(rng() * scratchPool.length)]!] = "scratched";
  if (rng() < 0.55) w[scratchPool[Math.floor(rng() * 3)]!] = "scratched";
  if (blowout || method === "ko") {
    l.weapon = "disabled";
    l.drive = "disabled";
    l.armor = "bent";
    l.chassis = "scratched";
  } else if (method === "dump") {
    l.weapon = "bent";
    l.drive = "disabled";
    l.armor = "bent";
    l.chassis = "scratched";
  } else {
    l.weapon = "bent";
    l.armor = "scratched";
    l.drive = "scratched";
    l.chassis = "clean";
  }
  return { [winner]: w, [loser]: l };
}

function combineSnaps(snaps: FighterSnap[], ids: string[]): FighterSnap {
  const team = ids.map((id) => snaps.find((s) => s.id === id)!);
  const avg = (k: keyof StatBlock) => Math.round(team.reduce((s, f) => s + f.stats[k], 0) / team.length);
  const lead = team[0]!;
  return {
    ...lead,
    id: ids.join("+"),
    name: team.map((t) => t.storeName).join(" / "),
    storeName: team.map((t) => t.storeName).join(" / "),
    botName: team.map((t) => t.botName).join(" + "),
    stats: { power: avg("power"), speed: avg("speed"), armor: avg("armor"), heat: avg("heat") },
    rating: Math.round(team.reduce((s, f) => s + f.rating, 0) / team.length),
    fit: team.reduce((s, f) => s + f.fit, 0) / team.length,
    weekQ: team.reduce((s, f) => s + f.weekQ, 0) / team.length,
  };
}

export function simulateDuel(data: PitData, idA: string, idB: string, seed: string): FightResult {
  const a = snapshot(data, idA);
  const b = snapshot(data, idB);
  const rng = mulberry32(hashString(seed));
  const order = exchangeOrder(a, b);
  const hp: Record<string, number> = { [a.id]: 100, [b.id]: 100 };
  const exchanges: Exchange[] = [];
  let koAt = -1;
  for (let i = 0; i < 3; i++) {
    const attacker = order[i]!;
    const defender = attacker.id === a.id ? b : a;
    if (hp[defender.id]! <= 0 || hp[attacker.id]! <= 0) break;
    const hit = strikeDamage(attacker, defender, i, rng);
    hp[defender.id] = Math.max(0, hp[defender.id]! - hit.damage);
    exchanges.push({
      index: i + 1,
      attackerId: attacker.id,
      defenderId: defender.id,
      damage: hit.damage,
      attackerHp: hp[attacker.id]!,
      defenderHp: hp[defender.id]!,
      call: hit.call,
      tags: hit.tags,
    });
    if (hp[defender.id] === 0) {
      koAt = i;
      break;
    }
  }

  let method: Method = "decision";
  let finisher: FightResult["finisher"] = null;
  const ahead = hp[a.id]! === hp[b.id]! ? (a.rating >= b.rating ? a : b) : hp[a.id]! > hp[b.id]! ? a : b;
  const behind = ahead.id === a.id ? b : a;

  if (hp[a.id] === 0 || hp[b.id] === 0) {
    method = "ko";
  } else {
    const winnerSnap = ahead;
    const loserSnap = behind;
    const heatGap = winnerSnap.stats.heat - loserSnap.stats.heat;
    if (heatGap >= 6 && hp[loserSnap.id]! < 48) {
      const burn = Math.round(12 + heatGap * 0.8);
      hp[loserSnap.id] = Math.max(0, hp[loserSnap.id]! - burn);
      finisher = {
        by: winnerSnap.id,
        against: loserSnap.id,
        damage: burn,
        call: `${winnerSnap.botName} spends the Heat. ${loserSnap.botName} does not get a fourth exchange.`,
      };
      if (hp[loserSnap.id] === 0) method = "ko";
    }
    if (method === "decision") {
      const control = winnerSnap.weaponFamily === "wedge" || winnerSnap.weaponFamily === "claw";
      if (control && hp[loserSnap.id]! < 36 && winnerSnap.stats.power > loserSnap.stats.armor * 0.7) {
        method = "dump";
        hp[loserSnap.id] = Math.max(0, hp[loserSnap.id]! - 8);
      }
    }
  }

  const winner = hp[a.id]! === hp[b.id]! ? (a.rating >= b.rating ? a : b) : hp[a.id]! > hp[b.id]! ? a : b;
  const loser = winner.id === a.id ? b : a;
  const gap = hp[winner.id]! - hp[loser.id]!;
  const blowout =
    (method === "ko" && koAt >= 0 && koAt < 2) ||
    gap >= 48 ||
    (hp[loser.id]! <= 15 && hp[winner.id]! >= 55);
  const wear = planDuelWear(winner.id, loser.id, method, blowout, rng);

  return {
    winnerIds: [winner.id],
    loserIds: [loser.id],
    method: hp[loser.id] === 0 && method === "decision" ? "ko" : method,
    blowout,
    exchanges,
    finisher,
    hp,
    fighters: [a, b],
    wear,
    seed,
  };
}

export function simulateBye(data: PitData, storeId: string, seed: string): FightResult {
  const snap = snapshot(data, storeId);
  const house: FighterSnap = {
    ...snap,
    id: "house",
    name: "The House",
    storeName: "The House",
    botName: "DRILL",
    classId: "tank",
    paint: "bone",
    stats: { power: 18, speed: 12, armor: 20, heat: 8 },
    rating: 58,
    fit: 0.4,
    weekQ: 0.5,
    weaponFamily: "wedge",
    weaponName: "House Wedge",
    driveName: "House Treads",
    armorName: "House Plate",
    utilityName: null,
    chassisName: "Keystone",
    look: "plain",
    number: "",
  };
  const rng = mulberry32(hashString(seed));
  const hp: Record<string, number> = { [storeId]: 100, house: 100 };
  const exchanges: Exchange[] = [];
  const order = [snap, house, snap];
  for (let i = 0; i < 3; i++) {
    const attacker = order[i]!;
    const defender = attacker.id === storeId ? house : snap;
    const damage = Math.round(14 + rng() * 10);
    hp[defender.id] = Math.max(8, hp[defender.id]! - damage);
    exchanges.push({
      index: i + 1,
      attackerId: attacker.id,
      defenderId: defender.id,
      damage,
      attackerHp: hp[attacker.id]!,
      defenderHp: hp[defender.id]!,
      call:
        i === 1
          ? `${snap.botName} draws the bye. It counts as a win. The bot does not take a quote.`
          : `${attacker.botName} works the empty cage. The win is already on the card.`,
      tags: ["scrimmage"],
    });
  }
  return {
    winnerIds: [storeId],
    loserIds: [],
    method: "bye",
    blowout: false,
    exchanges,
    finisher: null,
    hp,
    fighters: [snap, house],
    wear: {},
    seed,
  };
}

export function simulateTag(data: PitData, teamA: string[], teamB: string[], seed: string): FightResult {
  const snaps = [...teamA, ...teamB].map((id) => snapshot(data, id));
  const a = combineSnaps(snaps, teamA);
  const b = combineSnaps(snaps, teamB);
  const fake: PitData = data;
  void fake;
  const rng = mulberry32(hashString(seed));
  const order = exchangeOrder(a, b);
  const hp: Record<string, number> = { [a.id]: 100, [b.id]: 100 };
  const exchanges: Exchange[] = [];
  for (let i = 0; i < 3; i++) {
    const attacker = order[i]!;
    const defender = attacker.id === a.id ? b : a;
    const hit = strikeDamage(attacker, defender, i, rng);
    const damage = Math.round(hit.damage * 0.92);
    hp[defender.id] = Math.max(0, hp[defender.id]! - damage);
    exchanges.push({
      index: i + 1,
      attackerId: attacker.id,
      defenderId: defender.id,
      damage,
      attackerHp: hp[attacker.id]!,
      defenderHp: hp[defender.id]!,
      call: hit.call,
      tags: [...hit.tags, "tag"],
    });
    if (hp[defender.id] === 0) break;
  }
  const winner = hp[a.id]! >= hp[b.id]! ? a : b;
  const loser = winner.id === a.id ? b : a;
  const method: Method = hp[loser.id] === 0 ? "ko" : "decision";
  const winIds = winner.id === a.id ? teamA : teamB;
  const loseIds = winner.id === a.id ? teamB : teamA;
  const wear: FightResult["wear"] = {};
  const rng2 = mulberry32(hashString(seed + ":wear"));
  for (const id of winIds) {
    const w = emptyWear();
    w.armor = "scratched";
    if (rng2() < 0.4) w.drive = "scratched";
    wear[id] = w;
  }
  for (const id of loseIds) {
    const l = emptyWear();
    l.weapon = method === "ko" ? "disabled" : "bent";
    l.drive = "scratched";
    l.armor = "bent";
    wear[id] = l;
  }
  return {
    winnerIds: winIds,
    loserIds: loseIds,
    method,
    blowout: method === "ko" && hp[winner.id]! > 50,
    exchanges,
    finisher: null,
    hp,
    fighters: [a, b],
    wear,
    seed,
  };
}

export function simulateMelee(data: PitData, ids: string[], seed: string): FightResult {
  const snaps = ids.map((id) => snapshot(data, id));
  const rng = mulberry32(hashString(seed));
  const hp: Record<string, number> = {};
  ids.forEach((id) => (hp[id] = 100));
  const exchanges: Exchange[] = [];
  const alive = () => ids.filter((id) => hp[id]! > 0);
  for (let i = 0; i < 8 && alive().length > 1; i++) {
    const pool = alive();
    const attacker = pool[Math.floor(rng() * pool.length)]!;
    let defender = pool[Math.floor(rng() * pool.length)]!;
    if (defender === attacker) defender = pool[(pool.indexOf(attacker) + 1) % pool.length]!;
    const a = snaps.find((s) => s.id === attacker)!;
    const d = snaps.find((s) => s.id === defender)!;
    const damage = Math.round(clamp(a.stats.power * 0.55 + rng() * 14, 10, 28));
    hp[defender] = Math.max(0, hp[defender]! - damage);
    exchanges.push({
      index: i + 1,
      attackerId: attacker,
      defenderId: defender,
      damage,
      attackerHp: hp[attacker]!,
      defenderHp: hp[defender]!,
      call: `${a.botName} finds ${d.botName} in the scrum.`,
      tags: ["melee"],
    });
  }
  const order = [...ids].sort((a, b) => hp[b]! - hp[a]! || snaps.find((s) => s.id === b)!.rating - snaps.find((s) => s.id === a)!.rating);
  const winner = order[0]!;
  const wear: FightResult["wear"] = {};
  ids.forEach((id) => {
    const w = emptyWear();
    if (id === winner) w.armor = "scratched";
    else {
      w.weapon = hp[id] === 0 ? "bent" : "scratched";
      w.drive = "scratched";
    }
    wear[id] = w;
  });
  return {
    winnerIds: [winner],
    loserIds: [],
    method: "melee",
    blowout: false,
    exchanges,
    finisher: null,
    hp,
    fighters: snaps,
    wear,
    seed,
    meleeOrder: order,
  };
}

function priorPairs(data: PitData): Set<string> {
  const set = new Set<string>();
  for (const bout of data.bouts) {
    if (bout.kind === "bye" || bout.kind === "melee") continue;
    const ids = [...bout.teamA, ...bout.teamB];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [a, b] = [ids[i]!, ids[j]!].sort();
        if (bout.teamA.includes(a!) && bout.teamA.includes(b!)) continue;
        if (bout.teamB.includes(a!) && bout.teamB.includes(b!)) continue;
        set.add(`${a}|${b}`);
      }
    }
  }
  return set;
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join("|");
}

function seededWheel(stores: { id: string; seed: number }[], week: number): { bye: string | null; pairs: [string, string][] } {
  const ring = [...stores].sort((a, b) => a.seed - b.seed).map((store) => store.id);
  const n = ring.length;
  if (n < 2) return { bye: ring[0] ?? null, pairs: [] };
  const turns = ((week - 1) % n + n) % n;
  for (let i = 0; i < turns; i++) ring.push(ring.shift()!);
  if (n % 2 === 1) {
    const bye = ring[0]!;
    const pairs: [string, string][] = [];
    for (let i = 1; i <= (n - 1) / 2; i++) pairs.push([ring[i]!, ring[n - i]!]);
    return { bye, pairs };
  }
  const pairs: [string, string][] = [];
  for (let i = 0; i < n / 2; i++) pairs.push([ring[i]!, ring[n - 1 - i]!]);
  return { bye: null, pairs };
}

export function buildCard(data: PitData): Bout[] {
  const week = data.week;
  const { bye, pairs } = seededWheel(data.stores, week);
  const seedOf = new Map(data.stores.map((store) => [store.id, store.seed]));
  const ordered = [...pairs].sort((a, b) => {
    const best = (pair: [string, string]) => Math.min(seedOf.get(pair[0]) ?? 99, seedOf.get(pair[1]) ?? 99);
    return best(b) - best(a);
  });
  const bouts: Bout[] = [];
  if (bye) bouts.push(makeBout(week, 1, "bye", "Bye", [bye], []));
  ordered.forEach((pair, index) => {
    const main = index === ordered.length - 1;
    bouts.push(makeBout(week, bouts.length + 1, "bout", main ? "Main event" : "Card", [pair[0]], [pair[1]]));
  });
  return bouts.map((bout, index) => ({ ...bout, slot: index + 1 }));
}

function makeBout(
  week: number,
  slot: number,
  kind: Bout["kind"],
  title: string,
  teamA: string[],
  teamB: string[],
): Bout {
  return {
    id: `w${week}-${kind}-${slot}-${teamA[0] ?? "x"}`,
    week,
    slot,
    kind,
    title,
    storeIds: [...teamA, ...teamB],
    teamA,
    teamB,
    result: null,
  };
}

export function simulateBout(data: PitData, bout: Bout): FightResult {
  const seed = `${data.seasonName}|w${data.week}|${bout.id}|${bout.storeIds.join(",")}|${loadoutSeed(data, bout.storeIds)}`;
  if (bout.kind === "bye") return simulateBye(data, bout.teamA[0]!, seed);
  if (bout.kind === "tag") return simulateTag(data, bout.teamA, bout.teamB, seed);
  if (bout.kind === "melee") return simulateMelee(data, bout.teamA, seed);
  return simulateDuel(data, bout.teamA[0]!, bout.teamB[0]!, seed);
}

function loadoutSeed(data: PitData, ids: string[]): string {
  return ids
    .map((id) => {
      const bot = botFor(data, id);
      const l = bot.locked ?? bot.draft;
      const card = cardFor(data, id);
      return `${id}:${l.chassis}:${l.drive}:${l.weapon}:${l.armor}:${l.utility}:${l.brain}:${cardKey(card)}`;
    })
    .join("/");
}

const DRILL_ROWS: {
  id: string;
  classId: ClassId;
  name: string;
  bot: string;
  paint: string;
  drive: string;
  weapon: string;
  armor: string;
}[] = [
  { id: "ai-striker", classId: "striker", name: "Striker drill", bot: "SHRIKE", paint: "steel", drive: "mag", weapon: "saw", armor: "angle" },
  { id: "ai-tank", classId: "tank", name: "Tank drill", bot: "ANVIL", paint: "mud", drive: "treads", weapon: "wedge", armor: "plate" },
  { id: "ai-specialist", classId: "specialist", name: "Specialist drill", bot: "VICE", paint: "teal", drive: "omni", weapon: "claw", armor: "cage" },
];

export type ScrimmageHit = {
  id: string;
  label: string;
  bout: Bout;
  note: string;
};

function drillStore(row: (typeof DRILL_ROWS)[number]): Store {
  return {
    id: row.id,
    name: row.name,
    region: "House",
    captain: "The drill",
    passcode: row.id,
    paint: row.paint,
    garage: "night",
    seed: 0,
  };
}

function drillBot(row: (typeof DRILL_ROWS)[number]): Bot {
  const gear: Loadout = {
    chassis: stockPart("chassis", row.classId).id,
    drive: stockPart("drive", row.classId, row.drive).id,
    weapon: stockPart("weapon", row.classId, row.weapon).id,
    armor: stockPart("armor", row.classId, row.armor).id,
    utility: null,
    brain: stockPart("brain", row.classId).id,
  };
  return {
    id: `bot-${row.id}`,
    storeId: row.id,
    name: row.bot,
    classId: row.classId,
    voucher: 0,
    repairSpent: 0,
    owned: [],
    coins: { chassis: 0, drive: 0, weapon: 0, armor: 0, utility: 0, brain: 0 },
    wear: emptyWear(),
    partWear: {},
    equipped: { ...gear },
    draft: { ...gear },
    locked: { ...gear },
    weldForWeek: {},
    look: "plain",
    number: "0",
  };
}

function drillCard(row: (typeof DRILL_ROWS)[number], week: number): StoreCard {
  return {
    id: `${row.id}-w${week}`,
    storeId: row.id,
    week,
    nsnu: 950,
    conv: 60,
    demoRate: 84,
    demoClose: 71,
    arch: 3.3,
    demoTicket: 1700,
    projected: false,
  };
}

function scrimmageNote(player: FighterSnap, drill: FighterSnap, won: boolean): string {
  const wrong =
    (player.classId === "tank" && (player.weaponFamily === "disc" || player.weaponFamily === "saw" || player.weaponFamily === "drum")) ||
    (player.classId === "striker" && (player.weaponFamily === "wedge" || player.weaponFamily === "hammer")) ||
    (player.classId === "specialist" && player.weaponFamily !== "claw");
  if (!won && wrong) {
    return `${player.botName} is on the wrong weapon for a ${player.classId}. The drill is stock, on a blue week, and still won. No damage was written.`;
  }
  if (!won && player.weekQ + 0.05 < drill.weekQ) {
    return `The drill is only a blue week. ${player.botName} lost the range. Fix the card or the lock before Saturday close. Nothing was posted.`;
  }
  if (!won) return `${drill.botName} kept the cage. ${player.botName} walks out clean. Change one part and run it again.`;
  if (wrong) return `The drill fell, but the lock is still wrong for a ${player.classId}. Do not trust a scrimmage win. No damage.`;
  return `${player.botName} beats a correct stock ${drill.classId}. Scrimmage only. The trophy does not move.`;
}

function stageScrimmage(data: PitData, storeId: string): PitData {
  return {
    ...data,
    phase: "locked",
    stores: [...data.stores, ...DRILL_ROWS.map(drillStore)],
    bots: [
      ...data.bots.map((bot) => {
        if (bot.storeId !== storeId) return bot;
        const locked = { ...(bot.locked ?? bot.draft) };
        return { ...bot, locked, equipped: { ...locked } };
      }),
      ...DRILL_ROWS.map(drillBot),
    ],
    storeCards: [...data.storeCards, ...DRILL_ROWS.map((row) => drillCard(row, data.week))],
  };
}

/** House drills only. Same fight math. Does not post a bout, wear, or coins. */
export function scrimmageDrills(data: PitData, storeId: string, which: ClassId | "all" = "all"): ScrimmageHit[] {
  const staged = stageScrimmage(data, storeId);
  const bot = botFor(staged, storeId);
  const load = bot.locked ?? bot.draft;
  const card = cardFor(staged, storeId);
  const wear = SLOTS.map((slot) => bot.wear[slot]).join(",");
  const buildKey = `${load.chassis}:${load.drive}:${load.weapon}:${load.armor}:${load.utility}:${load.brain}:${wear}:${cardKey(card)}`;
  return DRILL_ROWS.filter((row) => which === "all" || row.classId === which).map((row) => {
    const seed = `scrim|${data.seasonName}|w${data.week}|${storeId}|${row.id}|${buildKey}`;
    const bout = makeBout(data.week, 1, "bout", "Bay scrimmage", [storeId], [row.id]);
    const result = simulateDuel(staged, storeId, row.id, seed);
    result.wear = {};
    bout.result = result;
    const player = result.fighters.find((fighter) => fighter.id === storeId)!;
    const foe = result.fighters.find((fighter) => fighter.id === row.id)!;
    return {
      id: row.id,
      label: row.name,
      bout,
      note: scrimmageNote(player, foe, result.winnerIds.includes(storeId)),
    };
  });
}

const CEILING_FAN: (typeof DRILL_ROWS)[number] = {
  id: "ai-ceiling",
  classId: "tank",
  name: "Wrong lock",
  bot: "CEILING FAN",
  paint: "rust",
  drive: "treads",
  weapon: "disc",
  armor: "plate",
};

export const HOUSE_CARDS = [
  {
    id: "saw-wedge",
    title: "Striker vs tank",
    line: "SHRIKE has a saw. ANVIL has a wedge. Both are the right weapon. The saw wants the fight short.",
    a: "ai-striker",
    b: "ai-tank",
  },
  {
    id: "wedge-claw",
    title: "Tank vs specialist",
    line: "ANVIL wants it long. VICE wants the grab. Heat is the specialist's whole point.",
    a: "ai-tank",
    b: "ai-specialist",
  },
  {
    id: "claw-saw",
    title: "Specialist vs striker",
    line: "If VICE gets the claw in, SHRIKE does not get a clean second hit.",
    a: "ai-specialist",
    b: "ai-striker",
  },
  {
    id: "ceiling",
    title: "Disc on a tank",
    line: "Same blue week. CEILING FAN is a tank with a disc. That weapon does not belong.",
    a: "ai-ceiling",
    b: "ai-striker",
  },
] as const;

function houseWorld(): PitData {
  const rows = [...DRILL_ROWS, CEILING_FAN];
  return {
    version: 1,
    seasonName: "House preview",
    tagline: "",
    pin: "",
    week: 1,
    phase: "locked",
    stores: rows.map(drillStore),
    crew: [],
    bots: rows.map(drillBot),
    weeks: [],
    storeCards: rows.map((row) => drillCard(row, 1)),
    bouts: [],
    gazette: [],
    quotes: {},
    proposals: [],
    mvps: [],
    honors: { pitBelt: null, plate: null, bestBuild: null, bestBuildWhy: "", titleDrop: null },
    craft: [],
    session: { role: "public", storeId: null, crewId: null },
    log: [],
    tutorialSeen: true,
    intel: [],
    jobLog: [],
    sparkLog: [],
    shouts: [],
    picks: [],
    trainingOpenAll: false,
    kickoff: { grades: {}, paid: {}, appliedAt: null },
  };
}

/** Two house bots. Stock iron, a blue week. Does not touch a store. */
export function houseTape(cardId: string): Bout | null {
  const card = HOUSE_CARDS.find((row) => row.id === cardId);
  if (!card) return null;
  const world = houseWorld();
  const bout = makeBout(1, 1, "bout", card.title, [card.a], [card.b]);
  const result = simulateDuel(world, card.a, card.b, `house|${card.id}`);
  result.wear = {};
  bout.result = result;
  return bout;
}

/** Same math as Run Saturday, on copied locks. Does not post the card. */
export function previewSaturday(data: PitData): Bout[] {
  const bots = data.bots.map((b) => ({
    ...b,
    locked: { ...(b.locked ?? b.draft) },
    equipped: { ...(b.locked ?? b.draft) },
  }));
  return runSaturday({ ...data, phase: "locked", bots });
}

export function runSaturday(data: PitData): Bout[] {
  const card = buildCard(data);
  const played = card.map((bout) => ({ ...bout, result: simulateBout(data, bout) }));
  if (data.week !== 4) return played;
  const staged: PitData = {
    ...data,
    phase: "locked",
    bouts: [...data.bouts.filter((bout) => bout.week !== data.week), ...played],
  };
  const { leaders } = titleField(staged);
  if (leaders.length < 2) return played;
  const kind = leaders.length === 2 ? "final" : "melee";
  const tie = makeBout(
    4,
    played.length + 1,
    kind,
    "Tiebreaker",
    leaders.length === 2 ? [leaders[0]!] : leaders,
    leaders.length === 2 ? [leaders[1]!] : [],
  );
  tie.result = simulateBout(staged, tie);
  return [...played, tie];
}

export function methodLabel(method: Method): string {
  if (method === "ko") return "KO";
  if (method === "dump") return "Dump";
  if (method === "decision") return "Decision";
  if (method === "melee") return "Last bot";
  if (method === "bye") return "Bye";
  return "Scrimmage";
}

export function writeGazette(data: PitData, bouts: Bout[]): GazetteEntry[] {
  const entries: GazetteEntry[] = [];
  const weekName = data.weeks.find((w) => w.number === data.week)?.name ?? `Week ${data.week}`;
  entries.push({
    id: `g-${data.week}-open`,
    week: data.week,
    boutId: null,
    kicker: weekName,
    headline: `${weekName} is in the books.`,
    body: `${data.stores.length} stores. One card. Wins go to the store, not to a person.`,
  });
  for (const bout of bouts) {
    if (!bout.result) continue;
    const r = bout.result;
    if (bout.kind === "bye") {
      const id = bout.teamA[0]!;
      const bot = botFor(data, id);
      const store = storeFor(data, id);
      entries.push({
        id: `g-${bout.id}`,
        week: data.week,
        boutId: bout.id,
        kicker: "Bye",
        headline: `${store.name} draws the bye. It counts.`,
        body: `${bot.name} does not take a hit. The win goes on the store, not on a person. ${r.exchanges[1]?.call ?? ""}`.trim(),
      });
      continue;
    }
    if (bout.kind === "melee") {
      const winner = r.winnerIds[0];
      const wBot = winner ? botFor(data, winner) : null;
      const wStore = winner ? storeFor(data, winner) : null;
      entries.push({
        id: `g-${bout.id}`,
        week: data.week,
        boutId: bout.id,
        kicker: "Melee",
        headline: wStore
          ? bout.title === "Tiebreaker"
            ? `${wStore.name} wins the tie and takes the trophy.`
            : `${wStore.name} is the last bot moving.`
          : "The consolation cage goes quiet.",
        body: wBot
          ? bout.title === "Tiebreaker"
            ? `${wBot.name} walks out of a ${bout.teamA.length}-store tie. Same record going in. One store coming out.`
            : `${wBot.name} walks out of a ${bout.teamA.length}-store scrum. No trophy. The plate on the wall still has to mention it.`
          : "The melee did not crown a store.",
      });
      continue;
    }
    const winnerId = r.winnerIds[0]!;
    const loserId = r.loserIds[0]!;
    const w = storeFor(data, winnerId);
    const l = storeFor(data, loserId);
    const wBot = botFor(data, winnerId);
    const lBot = botFor(data, loserId);
    const tag = r.winnerIds.length > 1;
    const headline =
      bout.title === "Tiebreaker"
        ? `${w.name} wins the tie and takes the trophy.`
        : tag
          ? `${r.winnerIds.map((id) => storeFor(data, id).name).join(" & ")} take the tag.`
          : `${w.name} beats ${l.name} by ${methodLabel(r.method).toLowerCase()}.`;
    const disc = lBot.draft.weapon.includes("disc") || (lBot.locked?.weapon ?? "").includes("disc");
    const counter =
      r.fighters.find((f) => f.id === loserId)?.fit !== undefined &&
      (r.fighters.find((f) => f.id === loserId)!.fit < 0.35 || disc);
    const body = [
      r.exchanges.map((e) => e.call).join(" "),
      r.finisher?.call ?? "",
      counter
        ? `${l.name} had the louder week on paper. ${wBot.name} had the lock. A busy garage with the wrong weapon does not get a parade.`
        : `${wBot.name} leaves the win on ${w.name}'s wall. ${lBot.name} leaves with a quote.`,
      tag ? "Both stores on the winning side take the W. Both on the losing side take the L. Crews do not get a personal record." : "",
    ]
      .filter(Boolean)
      .join(" ");
    entries.push({
      id: `g-${bout.id}`,
      week: data.week,
      boutId: bout.id,
      kicker: bout.title,
      headline,
      body,
    });
  }
  return entries;
}

const WORSE: Record<Condition, number> = { clean: 0, scratched: 1, bent: 2, disabled: 3 };

export function mergeWear(current: Condition, next: Condition | undefined): Condition {
  if (!next) return current;
  return WORSE[next] > WORSE[current] ? next : current;
}

export function quoteFor(bot: Bot, slot: Slot): Quote | null {
  const cond = bot.wear[slot];
  if (cond === "clean") return null;
  const partId = bot.equipped[slot];
  if (!partId) return null;
  const part = partById(partId);
  if (!part) return null;
  const repairCost = cond === "scratched" ? REPAIR_PRICE.scratched : cond === "bent" ? REPAIR_PRICE.bent : REPAIR_PRICE.disabled;
  const weldCost = cond === "disabled" ? REPAIR_PRICE.weld : null;
  const salvageScrap = part.tier === "pro" ? 2 : part.tier === "super" ? 4 : part.tier === "championship" ? 3 : null;
  const won = false;
  const crown = part.tier === "super" && cond === "disabled" && won;
  const loaner =
    slot === "utility"
      ? "the slot goes empty"
      : `fight day loans a stock ${stockPart(slot, bot.classId).name}`;
  const line =
    cond === "disabled"
      ? `${part.name} is dead. ${repairCost} ${slot} coins put it back. Or ${weldCost} ${slot} coin emergency-welds it to Bent for one week. Until then, ${loaner}.`
      : cond === "bent"
        ? `${part.name} is bent. Half effect until you spend ${repairCost} ${slot} coins.`
        : `${part.name} is scratched. It still fights. ${repairCost} ${slot} coin makes the cage forget.`;
  return {
    slot,
    partId,
    partName: part.name,
    condition: cond,
    repairCost,
    weldCost,
    salvageScrap,
    crown,
    line,
  };
}

export function quotesForBot(bot: Bot, wonThisWeek: boolean): Quote[] {
  return SLOTS.map((slot) => {
    const q = quoteFor(bot, slot);
    if (!q) return null;
    const part = partById(q.partId);
    const crown = Boolean(part && part.tier === "super" && q.condition === "disabled" && wonThisWeek);
    return { ...q, crown };
  }).filter((q): q is Quote => Boolean(q));
}

export function wonThisWeek(data: PitData, storeId: string): boolean {
  return data.bouts.some(
    (b) => b.week === data.week && b.result?.winnerIds.includes(storeId),
  );
}

export function lastPlaceId(data: PitData): string | null {
  const fighters = new Set<string>();
  for (const b of data.bouts.filter((x) => x.week === data.week && x.kind !== "bye")) {
    b.storeIds.forEach((id) => fighters.add(id));
  }
  const ids = [...fighters];
  if (!ids.length) return null;
  return ids.sort((a, b) => {
    const ra = recordOf(data, a);
    const rb = recordOf(data, b);
    if (ra.l !== rb.l) return rb.l - ra.l;
    if (ra.w !== rb.w) return ra.w - rb.w;
    return nsnuOf(data, a, data.week) - nsnuOf(data, b, data.week);
  })[0]!;
}

export function craftScore(data: PitData, storeId: string): number {
  const bot = botFor(data, storeId);
  const loadout = bot.locked ?? bot.draft;
  const card = cardFor(data, storeId);
  const q = card ? weekQuality(gradesOf(card)) : 0.4;
  const fit = buildFit(bot, loadout);
  const fights = data.bouts.filter((b) => b.week === data.week && b.result && b.storeIds.includes(storeId) && b.kind !== "bye");
  const upset = fights.some((b) => {
    if (!b.result?.winnerIds.includes(storeId)) return false;
    const foe = b.result.fighters.find((f) => f.id !== storeId && !b.teamA.includes(storeId) ? false : f.id !== storeId);
    void foe;
    const opp = b.storeIds.find((id) => id !== storeId && !(b.teamA.includes(storeId) && b.teamA.includes(id)) && !(b.teamB.includes(storeId) && b.teamB.includes(id)));
    if (!opp) return false;
    const oq = b.result.fighters.find((f) => f.id === opp)?.weekQ ?? 0;
    return q + 0.05 < oq;
  });
  return Math.round(fit * 100 + (upset ? 28 : 0) + q * 10);
}

export function bestBuildId(data: PitData): { id: string; why: string } | null {
  let best: { id: string; score: number } | null = null;
  for (const store of data.stores) {
    const score = craftScore(data, store.id);
    if (!best || score > best.score) best = { id: store.id, score };
  }
  if (!best) return null;
  const bot = botFor(data, best.id);
  const store = storeFor(data, best.id);
  return {
    id: best.id,
    why: `${store.name}'s ${bot.name} posted the cleanest lock against the week it actually had. The trophy can hang somewhere else. This one is for the garage.`,
  };
}

export function keyForStat(stat: StatKey): KeyName {
  return metricFor(stat).slot;
}

export function canSeeLoadout(data: PitData, storeId: string): boolean {
  if (data.phase === "fought" || data.phase === "inspected" || data.phase === "complete") return true;
  if (data.session.role === "commissioner") return true;
  if (
    (data.session.role === "captain" || data.session.role === "crew") &&
    data.session.storeId === storeId
  ) {
    return true;
  }
  return false;
}

export function shopOpen(data: PitData): boolean {
  if (data.phase === "complete" || data.phase === "locked" || data.phase === "fought") return false;
  if (data.week > 1) return true;
  // Week 1 opens once the desk pays the Period 11 kickoff coins.
  return data.phase === "inspected" || (data.phase === "open" && Boolean(data.kickoff?.appliedAt));
}

export function ownsPart(bot: Bot, part: Part): boolean {
  if (part.tier === "stock") return true;
  return bot.owned.includes(part.id);
}

export const RECLASS_FEE = 3;

export function buyCheck(
  data: PitData,
  storeId: string,
  part: Part,
): { ok: boolean; reason: string; cost: number } {
  const bot = botFor(data, storeId);
  if (!shopOpen(data)) return { ok: false, reason: data.week === 1 && !data.kickoff?.appliedAt ? "The shop opens when the desk pays the Period 11 kickoff coins." : "The shop shuts when the bots lock Saturday and reopens after the damage report.", cost: 0 };
  if (part.tier === "championship") return { ok: false, reason: "Championship parts are never sold.", cost: 0 };
  if (part.tier === "stock") return { ok: false, reason: "Stock is already on the peg.", cost: 0 };
  if (part.classLock && part.slot !== "chassis") return { ok: false, reason: "Wrong class.", cost: 0 };
  if (ownsPart(bot, part)) return { ok: false, reason: "Already in the cage.", cost: part.price };
  let cost = part.price;
  if (part.slot === "chassis" && part.classLock && part.classLock !== bot.classId && data.week > 1) {
    cost += RECLASS_FEE;
  }
  const have = bot.coins[part.key] ?? 0;
  if (have < cost) {
    const src = KEY_SOURCE[part.key];
    return {
      ok: false,
      reason: `Needs ${cost} ${part.key} coins. You have ${have}. ${src.label} pays them: green 3, blue 2, orange 1, red 0.`,
      cost,
    };
  }
  return { ok: true, reason: "On the peg.", cost };
}

export function statLabel(stat: StatKey): string {
  return metricFor(stat).label;
}

export function defaultWeaponFamily(classId: ClassId): string {
  if (classId === "striker") return "saw";
  if (classId === "tank") return "wedge";
  return "claw";
}

export function fighterById(result: FightResult, id: string): FighterSnap | undefined {
  return result.fighters.find((f) => f.id === id);
}
