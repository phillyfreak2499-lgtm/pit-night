import {
  BODY_STYLES,
  CLASS_META,
  DECALS,
  EYES,
  FINISHES,
  PAINT,
  TOPPERS,
  TRIM,
  batteryOf,
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
import { showEffect } from "./halloween";
import {
  isThanksgivingPart,
  thanksgivingOpen,
  thanksgivingShowEffect,
  THANKSGIVING_CLOSED_REASON,
  THANKSGIVING_FINALIST_REASON,
  THANKSGIVING_SHOW_CLOSED_REASON,
} from "./thanksgiving";
import { duelWear, fightDuel, preferFighter } from "./combat";
import { centralDay } from "./time";
export { halloweenStrikeAdjust } from "./combat";
import { BOLTS, TUNE_UP_BONUS } from "./training";
import { tunedUp } from "./week";
import type {
  Bot,
  BotStyle,
  Bout,
  ClassId,
  Condition,
  Conference,
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
  sport: 0.07,
  pro: 0.13,
  super: 0.2,
  championship: 0.24,
};

/** Chassis nudges used to count at 0.45, so a bought chassis barely moved the bot. */
export const CHASSIS_WEIGHT = 0.7;
/** An equipped utility's tier now counts in full. An empty slot still adds nothing. */
export const UTILITY_FIT = 1;

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
    // bySlot here is the jar deposit, pair bonus included, so kickoff can
    // pay and re-pay the difference from one number per part.
    return { store, filled, coins: math.total, bySlot: coinsByJar(full), greens: math.greens, nsnu: ORDER[full.nsnu] };
  });
  rows.sort(
    (a, b) =>
      b.coins - a.coins || b.greens - a.greens || b.nsnu - a.nsnu || a.store.seed - b.store.seed,
  );
  return rows.map((row, i) => ({ ...row, seed: i + 1 }));
}

/** Stable text for a card, for seeding the fight dice. */
export function cardKey(card: StoreCard | undefined) {
  if (!card) return "none";
  const g = card.grades
    ? Object.entries(card.grades)
        .sort()
        .map(([k, v]) => `${k}=${v}`)
        .join(",")
    : "";
  return `${card.nsnu}:${card.conv}:${card.demoRate}:${card.demoClose}:${card.arch}:${card.demoTicket}${g ? `:${g}` : ""}`;
}

export function cardValue(card: StoreCard, stat: StatKey): number {
  if (stat === "ticket") return card.demoTicket;
  return card[stat];
}

/**
 * What a card pays. `bySlot` is only the per-metric grade coins (green 3,
 * blue 2, orange 1, red 0). `bonus` is one extra coin for every green after
 * the first, and `total` includes it. Six greens pay 23.
 */
export function coinMath(grades: GradeSet): { bySlot: Record<KeyName, number>; total: number; greens: number; bonus: number } {
  const bySlot = { chassis: 0, drive: 0, weapon: 0, armor: 0, utility: 0, brain: 0 } as Record<KeyName, number>;
  let total = 0;
  let greens = 0;
  for (const m of METRICS) {
    const g = grades[m.stat];
    bySlot[m.slot] += GRADE_COINS[g];
    total += GRADE_COINS[g];
    if (g === "green") greens += 1;
  }
  const bonus = Math.max(0, greens - 1);
  return { bySlot, total: total + bonus, greens, bonus };
}

/**
 * Coins that actually land in the jars. Per-metric amounts stay as graded.
 * The pair bonus has no metric of its own, so each green after the first
 * (scorecard order) carries one extra coin in that part's jar. The sum
 * equals `coinMath(grades).total`.
 */
export function coinsByJar(grades: GradeSet): Record<KeyName, number> {
  const math = coinMath(grades);
  const jars = { ...math.bySlot };
  let firstGreen = true;
  for (const m of METRICS) {
    if (grades[m.stat] !== "green") continue;
    if (firstGreen) {
      firstGreen = false;
      continue;
    }
    jars[m.slot] += 1;
  }
  return jars;
}

export function weekQuality(grades: GradeSet): number {
  const list = METRICS.map((m) => grades[m.stat]);
  return list.reduce((sum, g) => sum + GRADE_Q[g], 0) / list.length;
}

export function cardFor(data: PitData, storeId: string, week = data.week): StoreCard | undefined {
  // Championship Week carries the finalist's Week 4 sales card forward. There is no
  // fifth Sunday scorecard and no free performance reset before the title fight.
  const cardWeek = week === 5 ? 4 : week;
  return data.storeCards.find((c) => c.storeId === storeId && c.week === cardWeek);
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

/**
 * The run a store is on: consecutive regular-season wins or losses, newest first.
 * `null` before its first posted fight.
 */
export function fightStreak(data: PitData, storeId: string): { kind: "W" | "L"; n: number } | null {
  const fights = data.bouts
    .filter((b) => b.result && b.kind === "bout" && b.storeIds.includes(storeId))
    .sort((a, b) => b.week - a.week || b.slot - a.slot);
  let kind: "W" | "L" | null = null;
  let n = 0;
  for (const bout of fights) {
    const won = bout.result!.winnerIds.includes(storeId);
    const k = won ? "W" : "L";
    if (kind && k !== kind) break;
    kind = k;
    n += 1;
  }
  return kind ? { kind, n } : null;
}

/** Standings tiebreak: actual NSNU dollars only. */
export function nsnuOf(data: PitData, storeId: string, week: number): number {
  const card = data.storeCards.find((c) => c.storeId === storeId && c.week === week);
  if (!card?.nsnuOfficial) return 0;
  return Number.isFinite(card.nsnu) ? card.nsnu : 0;
}

export function regularSeasonRecordOf(data: PitData, storeId: string): { w: number; l: number } {
  let w = 0;
  let l = 0;
  for (const bout of data.bouts) {
    if (!bout.result || bout.week > 4 || bout.kind !== "bout") continue;
    if (bout.result.winnerIds.includes(storeId)) w += 1;
    if (bout.result.loserIds.includes(storeId)) l += 1;
  }
  return { w, l };
}

export function conferenceRecordOf(data: PitData, storeId: string): { w: number; l: number } {
  const store = storeFor(data, storeId);
  let w = 0;
  let l = 0;
  for (const bout of data.bouts) {
    if (!bout.result || bout.week > 4 || bout.kind !== "bout" || !bout.storeIds.includes(storeId))
      continue;
    const opponentId = bout.storeIds.find((id) => id !== storeId);
    if (!opponentId || storeFor(data, opponentId).conference !== store.conference) continue;
    if (bout.result.winnerIds.includes(storeId)) w += 1;
    if (bout.result.loserIds.includes(storeId)) l += 1;
  }
  return { w, l };
}

export function cumulativeNsnu(data: PitData, storeId: string): number {
  return data.storeCards
    .filter((card) => card.storeId === storeId && card.week <= 4 && card.nsnuOfficial)
    .reduce((sum, card) => sum + (Number.isFinite(card.nsnu) ? card.nsnu : 0), 0);
}

export function greenCount(data: PitData, storeId: string): number {
  return data.storeCards
    .filter((card) => card.storeId === storeId && card.week <= 4)
    .reduce(
      (sum, card) => sum + METRICS.filter((m) => card.grades?.[m.stat] === "green").length,
      0,
    );
}

/** Earned effort through the four-week regular season. Spending cosmetics never reduces this tiebreak. */
export function regularSeasonBolts(data: PitData, storeId: string): number {
  const approved = data.jobLog.filter(
    (e) => e.storeId === storeId && e.week <= 4 && e.status === "approved",
  );
  const jobs = approved.reduce(
    (n, e) => n + (e.jobId.endsWith("-crate") ? BOLTS.crate : BOLTS.job),
    0,
  );
  const sparks = data.sparkLog
    .filter((e) => e.storeId === storeId && e.week <= 4)
    .reduce((n, e) => n + e.correct * BOLTS.sparkCorrect, 0);
  const picks =
    data.picks.filter((p) => {
      if (p.storeId !== storeId || p.week > 4) return false;
      const lockedAt = data.weeks.find((w) => w.number === p.week)?.lockedAt;
      if (lockedAt && p.at > lockedAt) return false;
      return Boolean(
        data.bouts.find((b) => b.id === p.boutId && b.result?.winnerIds.includes(p.pick)),
      );
    }).length * BOLTS.pickCorrect;
  return jobs + sparks + picks;
}

function headToHeadWinner(data: PitData, a: string, b: string): string | null {
  const bout = data.bouts.find(
    (row) =>
      row.week <= 4 &&
      row.kind === "bout" &&
      row.result &&
      row.storeIds.includes(a) &&
      row.storeIds.includes(b),
  );
  return bout?.result?.winnerIds.find((id) => id === a || id === b) ?? null;
}

function topRecordGroup(data: PitData, conference: Conference) {
  const stores = data.stores.filter((store) => store.conference === conference);
  if (!stores.length) return [];
  const records = stores.map((store) => ({ store, rec: regularSeasonRecordOf(data, store.id) }));
  records.sort((a, b) => b.rec.w - a.rec.w || a.rec.l - b.rec.l || a.store.seed - b.store.seed);
  const top = records[0]!.rec;
  return records
    .filter((row) => row.rec.w === top.w && row.rec.l === top.l)
    .map((row) => row.store);
}

/** Stores still exactly tied for a conference berth after every published non-cage tiebreak. */
export function conferenceTopTie(data: PitData, conference: Conference): Store[] {
  let tied = topRecordGroup(data, conference);
  if (tied.length <= 1) return tied;
  const tryHeadToHead = () => {
    if (tied.length !== 2) return false;
    const winner = headToHeadWinner(data, tied[0]!.id, tied[1]!.id);
    if (!winner) return false;
    tied = tied.filter((store) => store.id === winner);
    return true;
  };
  if (tryHeadToHead()) return tied;
  const narrow = (score: (store: Store) => number, high = true) => {
    if (tied.length <= 1) return;
    const values = tied.map(score);
    const target = high ? Math.max(...values) : Math.min(...values);
    tied = tied.filter((store) => score(store) === target);
    tryHeadToHead();
  };
  narrow((store) => conferenceRecordOf(data, store.id).w);
  if (tied.length > 1) narrow((store) => conferenceRecordOf(data, store.id).l, false);
  if (tied.length > 1) narrow((store) => cumulativeNsnu(data, store.id));
  if (tied.length > 1) narrow((store) => greenCount(data, store.id));
  if (tied.length > 1) narrow((store) => regularSeasonBolts(data, store.id));
  return tied;
}

export function conferenceStandings(data: PitData, conference: Conference): Store[] {
  const rows = data.stores.filter((store) => store.conference === conference);
  const byRecord = new Map<string, Store[]>();
  for (const store of rows) {
    const r = regularSeasonRecordOf(data, store.id);
    const key = String(r.w) + "-" + String(r.l);
    byRecord.set(key, [...(byRecord.get(key) ?? []), store]);
  }
  const keys = [...byRecord.keys()].sort((a, b) => {
    const [aw, al] = a.split("-").map(Number);
    const [bw, bl] = b.split("-").map(Number);
    return bw! - aw! || al! - bl!;
  });
  const out: Store[] = [];
  for (const key of keys) {
    const group = byRecord.get(key)!;
    group.sort((a, b) => {
      if (group.length === 2) {
        const h = headToHeadWinner(data, a.id, b.id);
        if (h) return h === a.id ? -1 : 1;
      }
      const ac = conferenceRecordOf(data, a.id),
        bc = conferenceRecordOf(data, b.id);
      if (bc.w !== ac.w) return bc.w - ac.w;
      if (ac.l !== bc.l) return ac.l - bc.l;
      const nsnu = cumulativeNsnu(data, b.id) - cumulativeNsnu(data, a.id);
      if (nsnu) return nsnu;
      const greens = greenCount(data, b.id) - greenCount(data, a.id);
      if (greens) return greens;
      const bolts = regularSeasonBolts(data, b.id) - regularSeasonBolts(data, a.id);
      if (bolts) return bolts;
      return a.seed - b.seed || a.name.localeCompare(b.name);
    });
    out.push(...group);
  }
  return out;
}

function regularSeasonComplete(data: PitData) {
  const played = data.bouts.filter((b) => b.week <= 4 && b.kind === "bout" && b.result).length;
  return played >= (data.stores.length * 4) / 2;
}

export function conferenceChampion(data: PitData, conference: Conference): string | null {
  if (!regularSeasonComplete(data)) return null;
  const title =
    conference === "metro" ? "Metro Conference Tiebreaker" : "Frontier Conference Tiebreaker";
  const cage = data.bouts.find((b) => b.week === 4 && b.title === title && b.result);
  if (cage?.result?.winnerIds[0]) return cage.result.winnerIds[0];
  const tied = conferenceTopTie(data, conference);
  return tied.length === 1 ? tied[0]!.id : null;
}

export function championshipFinalists(data: PitData): string[] {
  const metro = conferenceChampion(data, "metro");
  const frontier = conferenceChampion(data, "frontier");
  return metro && frontier ? [metro, frontier] : [];
}

export function rankedStores(data: PitData) {
  return [...conferenceStandings(data, "metro"), ...conferenceStandings(data, "frontier")].sort(
    (a, b) => {
      const ra = regularSeasonRecordOf(data, a.id),
        rb = regularSeasonRecordOf(data, b.id);
      return (
        rb.w - ra.w ||
        ra.l - rb.l ||
        cumulativeNsnu(data, b.id) - cumulativeNsnu(data, a.id) ||
        a.name.localeCompare(b.name)
      );
    },
  );
}

/** Compatibility helper: the title field is now the two conference champions. */
export function titleField(data: PitData) {
  const leaders = championshipFinalists(data);
  return { leaders, ranked: rankedStores(data) };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function activeLoadout(bot: Bot, phase: PitData["phase"]): Loadout {
  if (
    (phase === "locked" || phase === "fought" || phase === "inspected" || phase === "complete") &&
    bot.locked
  ) {
    return bot.locked;
  }
  return bot.draft;
}

function wearMult(cond: Condition): number {
  if (cond === "bent") return 0.5;
  if (cond === "scratched") return 0.96;
  return 1;
}

export function resolvePart(
  bot: Bot,
  slot: Slot,
  loadout: Loadout,
): { part: Part | null; mult: number; broken: boolean } {
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

function synergy(
  classId: ClassId,
  weapon: Part | null,
  drive: Part | null,
  utility: Part | null,
  chassis: Part | null,
  armor: Part | null,
): number {
  let s = 0;
  const fam = weapon?.family;
  const claw = fam === "claw" || fam === "bones";
  const speedWep =
    fam === "saw" || fam === "drum" || fam === "disc" || fam === "flail" || fam === "chainsaw" || fam === "slasher";
  const smash = fam === "hammer" || fam === "wedge" || fam === "piston";
  if (classId === "striker" && speedWep)
    s += fam === "disc" ? 0.16 : fam === "flail" || fam === "chainsaw" ? 0.1 : 0.14;
  if (classId === "striker" && smash) s -= 0.16;
  if (classId === "striker" && claw) s -= 0.06;
  if (classId === "tank" && speedWep) s -= fam === "disc" ? 0.4 : 0.28;
  if (classId === "tank" && smash) s += fam === "piston" ? 0.08 : 0.14;
  if (classId === "tank" && claw) s -= 0.08;
  if (classId === "specialist" && claw) s += 0.18;
  if (classId === "specialist" && (fam === "flame" || fam === "tesla")) s += 0.08;
  if (classId === "specialist" && speedWep) s -= 0.14;
  if (classId === "specialist" && fam === "wedge") s -= 0.06;
  if (classId === "tank" && drive?.family === "treads") s += 0.05;
  if (classId === "tank" && drive?.family === "anchor") s += 0.04;
  if (
    classId === "striker" &&
    (drive?.family === "mag" || drive?.family === "flip" || drive?.family === "swerve")
  )
    s += 0.04;
  if (classId === "striker" && drive?.family === "rocket") s += 0.03;
  if (classId === "striker" && drive?.family === "ghostchaser") s += 0.03;
  if (classId === "tank" && drive?.family === "ghostchaser") s -= 0.04;
  if (classId === "specialist" && drive?.family === "omni") s += 0.05;
  if (classId === "specialist" && drive?.family === "air") s += 0.05;
  if (utility?.family === "burn" && classId === "striker") s += 0.04;
  if (utility?.family === "weld" || utility?.family === "medbay") s += 0.03;
  if (utility?.family === "crowd") s += 0.02;
  if (utility?.family === "peace") s += 0.02;
  if (utility?.family === "leech" && classId === "specialist") s += 0.03;
  if (utility?.family === "grapple" && classId === "specialist") s += 0.04;
  const aff = chassis?.affinity;
  if (aff?.classId === classId) s += 0.04;
  const slotPart =
    aff?.slot === "weapon"
      ? weapon
      : aff?.slot === "drive"
        ? drive
        : aff?.slot === "armor"
          ? armor
          : aff?.slot === "utility"
            ? utility
            : null;
  if (aff?.families && slotPart && aff.families.includes(slotPart.family)) s += 0.03;
  return s;
}

export function buildFit(bot: Bot, loadout: Loadout): number {
  const slots: Slot[] = ["chassis", "drive", "weapon", "armor", "brain"];
  let fit = 0.46;
  const resolved = slots.map((slot) => resolvePart(bot, slot, loadout));
  for (const [index, r] of resolved.entries()) {
    if (!r.part) continue;
    if (slots[index] === "brain") continue;
    fit += (r.part.fit ?? TIER_FIT[r.part.tier] ?? 0) * r.mult;
    if (r.broken) fit -= 0.04;
  }
  const utility = resolvePart(bot, "utility", loadout);
  if (utility.part)
    fit += (utility.part.fit ?? TIER_FIT[utility.part.tier] ?? 0) * UTILITY_FIT * utility.mult;
  const weapon = resolved[2]?.part ?? null;
  const drive = resolved[1]?.part ?? null;
  const chassis = resolved[0]?.part ?? null;
  const armor = resolved[3]?.part ?? null;
  fit += synergy(bot.classId, weapon, drive, utility.part, chassis, armor);
  const conds = SLOTS.map((slot) =>
    slot === "utility" && !loadout.utility ? "clean" : bot.wear[slot],
  );
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

export function printedStats(
  bot: Bot,
  loadout: Loadout,
  weekQ: number,
): { stats: StatBlock; rating: number; fit: number } {
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
    const m = resolved.mult * (slot === "chassis" ? CHASSIS_WEIGHT : slot === "brain" ? 0 : 1);
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
  const list = partsFor(slot, bot.classId).filter(
    (part) => part.tier === "stock" || bot.owned.includes(part.id),
  );
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
  return (
    printed.rating * 100 +
    printed.fit * 40 +
    printed.stats.power +
    printed.stats.speed +
    printed.stats.armor +
    printed.stats.heat
  );
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
  const brainAdvice: Record<string, number> = {
    skynet: 9,
    phoenix: 8,
    logic: 7,
    hunter: 6,
    sniper: 5,
    brawler: 4,
    jammer: 4,
    turtle: 3,
    berserker: 2,
  };
  const tierRank: Record<string, number> = {
    stock: 0,
    sport: 1,
    pro: 2,
    super: 3,
    championship: 4,
  };
  const shortlist = <T extends Part | null>(slot: Slot, parts: T[]): T[] => {
    if (parts.length <= 6) return parts;
    const scored = parts.map((part) => {
      const load: Loadout = { ...currentLoad, [slot]: part ? part.id : null };
      const printed = printedStats(wearFor(bot, load), load, weekQ);
      const brainBias =
        part && slot === "brain"
          ? (tierRank[part.tier] ?? 0) * 0.001 + (brainAdvice[part.family] ?? 0) * 0.0001
          : 0;
      return { part, score: lockScore(printed) + brainBias };
    });
    scored.sort((a, b) => b.score - a.score);
    const seen = new Set<string>();
    const out: T[] = [];
    const current = parts.find((part) => (part?.id ?? null) === (currentLoad[slot] ?? null));
    for (const part of [current, ...scored.map((row) => row.part)]) {
      if (!part && slot !== "utility") continue;
      const id = part?.id ?? "empty";
      if (seen.has(id)) continue;
      seen.add(id);
      if (part === undefined) continue;
      out.push(part);
      if (out.length >= 6) break;
    }
    if (slot === "utility" && !out.some((part) => part == null)) out[out.length - 1] = null as T;
    return out;
  };
  const chassis = shortlist("chassis", cageParts(bot, "chassis"));
  const drives = shortlist("drive", cageParts(bot, "drive"));
  const weapons = shortlist("weapon", cageParts(bot, "weapon"));
  const armors = shortlist("armor", cageParts(bot, "armor"));
  const utilities = shortlist("utility", [null, ...cageParts(bot, "utility")]);
  const brains = shortlist("brain", cageParts(bot, "brain"));

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
              const brainPart = partById(brain.id);
              const score =
                lockScore(printed) +
                (tierRank[brainPart?.tier ?? "stock"] ?? 0) * 0.001 +
                (brainAdvice[brainPart?.family ?? ""] ?? 0) * 0.0001;
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
  chainsaw: "a Texas chainsaw",
  slasher: "a slasher blade",
  ghost: "a ghost blade",
  launcher: "a pumpkin launcher",
  bones: "skeleton claws",
  broom: "a witch's broom",
  pumpkin: "a pumpkin chassis",
  ghostchaser: "a ghost chaser",
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
  swerve: "swerve",
  rocket: "a rocket boost",
  anchor: "an anchor",
  air: "an air cushion",
  chaser: "Ghost Chaser",
  flail: "a flail",
  piston: "a piston lance",
  flame: "a flamethrower",
  tesla: "a tesla coil",
  ablative: "ablative armor",
  gel: "gel pads",
  chain: "chainmail",
  spike: "a spike shell",
  ceramic: "ceramic",
  magnet: "a magnetic field",
  reactive: "reactive armor",
  spotlight: "a spotlight",
  decoy: "a decoy",
  oil: "an oil slick",
  medbay: "a med bay",
  leech: "a leech",
  tremor: "a tremor",
  blackout: "a blackout",
  grapple: "a grapple",
  siren: "a siren",
  mirror: "a mirror",
  veil: "Ghost Veil",
  smoke: "a smoke screen",
  uv: "a UV lamp",
  hover: "a hover chassis",
  spring: "a spring chassis",
  skeleton: "Skeleton",
  sprinter: "Sprinter",
  hornet: "Hornet",
  hybrid: "Hybrid",
  dynamo: "Dynamo",
  reactor: "Reactor",
  berserker: "a berserker brain",
  turtle: "a turtle brain",
  sniper: "a sniper brain",
  brawler: "a brawler brain",
  jammer: "a jammer",
  phoenix: "Phoenix",
  skynet: "Skynet",
};

function familyWord(family: string) {
  return FAMILY_WORD[family] ?? family;
}

function weaponTell(classId: ClassId, family: string): string | null {
  const speed =
    family === "saw" ||
    family === "drum" ||
    family === "disc" ||
    family === "flail" ||
    family === "chainsaw";
  const smash = family === "hammer" || family === "wedge" || family === "piston";
  if (classId === "tank" && family === "disc") return "A disc on a tank is a ceiling fan.";
  if (classId === "tank" && speed) return "A speed weapon on a tank. They are fighting the chassis.";
  if (classId === "tank" && (family === "claw" || family === "bones")) return "A claw on a tank. That is not the late fight.";
  if (classId === "striker" && smash) return "A smash weapon on a striker. They gave up the first hit.";
  if (classId === "striker" && (family === "claw" || family === "bones")) return "A claw on a striker. Heat is not their week.";
  if (classId === "specialist" && speed) return "A speed weapon on a specialist. The claw is the point.";
  if (classId === "specialist" && family === "wedge") return "A wedge on a specialist. They are not a tank.";
  if (family === "chainsaw") return "A Texas chainsaw. Loud first bite, and it bogs in thick plate.";
  if (family === "slasher") return "Slasher Blade. It loves a bot that is already faster.";
  if (family === "ghost") return "Ghost Blade. It slips through plate when Heat is real, and it leaves a trail.";
  if (family === "launcher") return "Pumpkin Launcher. The middle exchange is the one that lands.";
  if (family === "bones") return "Skeleton Claws. A cheerful grapple, happier against a striker than a tank.";
  if (family === "broom") return "Witch's Broom. A staff when Heat is up, a broom until then.";
  if (family === "ghostchaser") return "Ghost Chaser. It closes on a slower bot and gives up plate.";
  if (family === "pumpkin") return "Pumpkin Chassis. A round shell that shrugs the first bite and swings softer.";
  return null;
}

export const WEAPON_FAMILIES = [
  "saw",
  "drum",
  "wedge",
  "hammer",
  "claw",
  "disc",
  "flail",
  "piston",
  "flame",
  "tesla",
  "chainsaw",
  "slasher",
  "ghost",
  "launcher",
  "bones",
  "broom",
] as const;

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
  if (depth >= 3)
    lines.push(`Named iron: ${weapon?.name ?? "—"}, ${drive?.name ?? "—"}, ${armor?.name ?? "—"}.`);
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
    for (const k of ["power", "speed", "armor", "heat"] as const)
      printed.stats[k] = Math.min(99, printed.stats[k] + TUNE_UP_BONUS);
  }
  const weapon = resolvePart(bot, "weapon", locked);
  const drive = resolvePart(bot, "drive", locked);
  const armor = resolvePart(bot, "armor", locked);
  const chassis = resolvePart(bot, "chassis", locked);
  const utility = resolvePart(bot, "utility", locked);
  const brain = resolvePart(bot, "brain", locked);
  return {
    id: storeId,
    name: store.name,
    storeName: store.name,
    teamName: store.teamName,
    classId: bot.classId,
    paint: store.paint,
    botName: bot.name,
    stats: printed.stats,
    rating: printed.rating,
    fit: printed.fit,
    weekQ,
    weaponFamily: weapon.part?.family ?? "none",
    armorFamily: armor.part?.family,
    driveFamily: drive.part?.family,
    chassisFamily: chassis.part?.family,
    shows: bot.shows,
    utilityFamily: utility.part?.family ?? null,
    brainFamily: brain.part?.family ?? "logic",
    batteryMax: batteryOf(chassis.part),
    tiers: {
      chassis: chassis.part?.tier,
      drive: drive.part?.tier,
      weapon: weapon.part?.tier,
      armor: armor.part?.tier,
      utility: utility.part?.tier,
      brain: brain.part?.tier,
    },
    wearMult: {
      chassis: chassis.mult,
      drive: drive.mult,
      weapon: weapon.mult,
      armor: armor.mult,
      utility: utility.mult,
      brain: brain.mult,
    },
    affinity: chassis.part?.affinity,
    weaponName: partById(locked.weapon)?.name ?? "Bare shaft",
    driveName: partById(locked.drive)?.name ?? "—",
    armorName: partById(locked.armor)?.name ?? "—",
    utilityName: locked.utility ? (partById(locked.utility)?.name ?? null) : null,
    chassisName: partById(locked.chassis)?.name ?? CLASS_META[bot.classId].chassis,
    look: bot.look ?? "plain",
    number: bot.number ?? "",
    style: bot.style,
    brainTier: brain.part?.tier ?? "stock",
    brainName: brain.part?.name ?? "Logic Board",
    tuned,
    // Unrepaired damage from earlier weeks shows on the paint.
    scars: Object.values(bot.wear ?? {}).filter((w) => w && w !== "clean").length,
  };
}

function emptyWear(): Record<Slot, Condition> {
  return {
    chassis: "clean",
    drive: "clean",
    weapon: "clean",
    armor: "clean",
    utility: "clean",
    brain: "clean",
  };
}

function combineSnaps(snaps: FighterSnap[], ids: string[]): FighterSnap {
  const team = ids.map((id) => snaps.find((s) => s.id === id)!);
  const avg = (k: keyof StatBlock) =>
    Math.round(team.reduce((s, f) => s + f.stats[k], 0) / team.length);
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
  const fought = fightDuel(a, b, { hot: data.week === 3 });
  const hp = fought.hp;
  const exchanges = fought.exchanges;
  const method = fought.method;
  const finisher = fought.finisher;
  const koAt = fought.koAt;

  const winner = preferFighter(a, b, hp[a.id]!, hp[b.id]!);
  const loser = winner.id === a.id ? b : a;
  const gap = hp[winner.id]! - hp[loser.id]!;
  const blowout =
    (method === "ko" && koAt >= 0 && koAt < 2) ||
    gap >= 48 ||
    (hp[loser.id]! <= 15 && hp[winner.id]! >= 55);
  const wear = duelWear(
    winner.id,
    loser.id,
    hp[loser.id] === 0 && method === "decision" ? "ko" : method,
    blowout,
  );

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

/** Championship Saturday has no judges and no decision. Damage escalates until one bot is out. */
export function simulateChampionshipDuel(
  data: PitData,
  idA: string,
  idB: string,
  seed: string,
): FightResult {
  const a = snapshot(data, idA);
  const b = snapshot(data, idB);
  const fought = fightDuel(a, b, { hot: true, overtime: true });
  const hp = fought.hp;
  const exchanges = fought.exchanges;
  const winner = hp[a.id]! > 0 ? a : b;
  const loser = winner.id === a.id ? b : a;
  const last = exchanges.at(-1)!;
  return {
    winnerIds: [winner.id],
    loserIds: [loser.id],
    method: "ko",
    blowout: exchanges.length <= 3 || hp[winner.id]! >= 60,
    exchanges,
    finisher: fought.finisher ?? {
      by: winner.id,
      against: loser.id,
      damage: last.damage,
      call: last.call,
    },
    hp,
    fighters: [a, b],
    wear: duelWear(winner.id, loser.id, "ko", exchanges.length <= 3),
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
  const hp: Record<string, number> = { [storeId]: 100, house: 100 };
  const exchanges: Exchange[] = [];
  const order = [snap, house, snap];
  const scripted = [18, 22, 16];
  for (let i = 0; i < 3; i++) {
    const attacker = order[i]!;
    const defender = attacker.id === storeId ? house : snap;
    const damage = scripted[i]!;
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

export function simulateTag(
  data: PitData,
  teamA: string[],
  teamB: string[],
  seed: string,
): FightResult {
  const snaps = [...teamA, ...teamB].map((id) => snapshot(data, id));
  const a = combineSnaps(snaps, teamA);
  const b = combineSnaps(snaps, teamB);
  const fought = fightDuel(a, b, { hot: data.week === 3, pace: 0.64 });
  const hp = fought.hp;
  const exchanges = fought.exchanges.map((ex) => ({ ...ex, tags: [...ex.tags, "tag"] }));
  const winner = hp[a.id]! >= hp[b.id]! ? a : b;
  const loser = winner.id === a.id ? b : a;
  const method: Method = hp[loser.id] === 0 ? "ko" : "decision";
  const winIds = winner.id === a.id ? teamA : teamB;
  const loseIds = winner.id === a.id ? teamB : teamA;
  const wear: FightResult["wear"] = {};
  for (const id of winIds) {
    const w = emptyWear();
    w.armor = "scratched";
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
  const hp: Record<string, number> = {};
  ids.forEach((id) => (hp[id] = 100));
  const exchanges: Exchange[] = [];
  const alive = () => ids.filter((id) => hp[id]! > 0);
  for (let i = 0; i < 8 && alive().length > 1; i++) {
    const pool = alive()
      .slice()
      .sort((x, y) => {
        const sx = snaps.find((s) => s.id === x)!;
        const sy = snaps.find((s) => s.id === y)!;
        return sy.rating - sx.rating || sy.stats.power - sx.stats.power || (x < y ? -1 : 1);
      });
    const attacker = pool[0]!;
    const defender = pool.slice(1).sort((x, y) => hp[x]! - hp[y]! || (x < y ? -1 : 1))[0]!;
    const a = snaps.find((s) => s.id === attacker)!;
    const d = snaps.find((s) => s.id === defender)!;
    const damage = Math.round(
      clamp(a.stats.power * 0.62 + a.stats.speed * 0.08 - d.stats.armor * 0.2, 10, 36),
    );
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
  const order = [...ids].sort(
    (a, b) =>
      hp[b]! - hp[a]! ||
      snaps.find((s) => s.id === b)!.rating - snaps.find((s) => s.id === a)!.rating,
  );
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

function seededWheel(stores: { id: string; seed: number }[], week: number): { bye: string | null; pairs: [string, string][] } {
  const ring = [...stores].sort((a, b) => a.seed - b.seed).map((store) => store.id);
  const n = ring.length;
  if (n < 2) return { bye: ring[0] ?? null, pairs: [] };
  const turns = (((week - 1) % n) + n) % n;
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

type SeedToken = `M${number}` | `F${number}`;
const REGULAR_SCHEDULE: SeedToken[][][] = [
  [
    ["F0", "F6"],
    ["F1", "F5"],
    ["F2", "F3"],
    ["F4", "M3"],
    ["M0", "M6"],
    ["M1", "M4"],
    ["M2", "M5"],
  ],
  [
    ["F0", "F4"],
    ["F1", "M6"],
    ["F2", "F5"],
    ["F3", "F6"],
    ["M0", "M4"],
    ["M1", "M5"],
    ["M2", "M3"],
  ],
  [
    ["F0", "F1"],
    ["F2", "M6"],
    ["F3", "M2"],
    ["F4", "F5"],
    ["F6", "M4"],
    ["M0", "M1"],
    ["M3", "M5"],
  ],
  [
    ["F0", "M0"],
    ["F1", "F2"],
    ["F3", "F4"],
    ["F5", "M1"],
    ["F6", "M5"],
    ["M2", "M4"],
    ["M3", "M6"],
  ],
];

function conferenceSchedule(data: PitData, week: number): [string, string][] | null {
  const metro = data.stores
    .filter((store) => store.conference === "metro")
    .sort((a, b) => a.seed - b.seed || a.name.localeCompare(b.name));
  const frontier = data.stores
    .filter((store) => store.conference === "frontier")
    .sort((a, b) => a.seed - b.seed || a.name.localeCompare(b.name));
  if (metro.length !== 7 || frontier.length !== 7 || week < 1 || week > 4) return null;
  const resolve = (token: SeedToken) =>
    token[0] === "M" ? metro[Number(token.slice(1))]!.id : frontier[Number(token.slice(1))]!.id;
  return REGULAR_SCHEDULE[week - 1]!.map(
    ([a, b]) => [resolve(a!), resolve(b!)] as [string, string],
  );
}

export function buildCard(data: PitData): Bout[] {
  const week = data.week;
  if (week === 5) {
    const finalists = championshipFinalists(data);
    return finalists.length === 2
      ? [makeBout(5, 1, "final", "Waterman Championship", [finalists[0]!], [finalists[1]!])]
      : [];
  }
  const scheduled = conferenceSchedule(data, week);
  if (scheduled) {
    return scheduled.map(([a, b], index) => {
      const cross = storeFor(data, a).conference !== storeFor(data, b).conference;
      const title =
        index === scheduled.length - 1 ? "Main event" : cross ? "Crossover" : "Conference";
      return makeBout(week, index + 1, "bout", title, [a], [b]);
    });
  }
  const { bye, pairs } = seededWheel(data.stores, week);
  const bouts: Bout[] = [];
  if (bye) bouts.push(makeBout(week, 1, "bye", "Bye", [bye], []));
  pairs.forEach((pair, index) =>
    bouts.push(
      makeBout(
        week,
        bouts.length + 1,
        "bout",
        index === pairs.length - 1 ? "Main event" : "Card",
        [pair[0]],
        [pair[1]],
      ),
    ),
  );
  return bouts;
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
  if (data.week === 5 && bout.kind === "final" && bout.title === "Waterman Championship")
    return simulateChampionshipDuel(data, bout.teamA[0]!, bout.teamB[0]!, seed);
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
  {
    id: "ai-striker",
    classId: "striker",
    name: "Striker drill",
    bot: "SHRIKE",
    paint: "steel",
    drive: "mag",
    weapon: "saw",
    armor: "angle",
  },
  {
    id: "ai-tank",
    classId: "tank",
    name: "Tank drill",
    bot: "ANVIL",
    paint: "mud",
    drive: "treads",
    weapon: "wedge",
    armor: "plate",
  },
  {
    id: "ai-specialist",
    classId: "specialist",
    name: "Specialist drill",
    bot: "VICE",
    paint: "teal",
    drive: "omni",
    weapon: "claw",
    armor: "cage",
  },
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
    conference: "metro",
    captain: "The drill",
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
    (player.classId === "tank" &&
      (player.weaponFamily === "disc" ||
        player.weaponFamily === "saw" ||
        player.weaponFamily === "drum" ||
        player.weaponFamily === "chainsaw" ||
        player.weaponFamily === "slasher" ||
        player.weaponFamily === "flail")) ||
    (player.classId === "striker" &&
      (player.weaponFamily === "wedge" ||
        player.weaponFamily === "hammer" ||
        player.weaponFamily === "piston")) ||
    (player.classId === "specialist" && player.weaponFamily !== "claw" && player.weaponFamily !== "bones");
  if (!won && wrong) {
    return `${player.botName} is on the wrong weapon for a ${player.classId}. The drill is stock, on a blue week, and still won. No damage was written.`;
  }
  if (!won && player.weekQ + 0.05 < drill.weekQ) {
    return `The drill is only a blue week. ${player.botName} lost the range. Fix the card or the lock before Saturday close. Nothing was posted.`;
  }
  if (!won)
    return `${drill.botName} kept the cage. ${player.botName} walks out clean. Change one part and run it again.`;
  if (wrong)
    return `The drill fell, but the lock is still wrong for a ${player.classId}. Do not trust a scrimmage win. No damage.`;
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
export function scrimmageDrills(
  data: PitData,
  storeId: string,
  which: ClassId | "all" = "all",
): ScrimmageHit[] {
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
    cosmeticProposals: [],
    mvps: [],
    honors: { pitBelt: null, plate: null, bestBuild: null, bestBuildWhy: "", titleDrop: null },
    craft: [],
    session: { role: "public", storeId: null, crewId: null },
    log: [],
    tutorialSeen: true,
    intel: [],
    jobLog: [],
    rallies: [],
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

const HOUSE_NAMES = [
  "RIVET", "SPARKPLUG", "GRINDSTONE", "TORQUE", "BULLDOZER", "HAYMAKER", "VOLTAGE", "LUGNUT",
  "SCRAPPER", "IRONSIDE", "WRECKSAW", "TURBINE", "CLAMPDOWN", "DYNAMO", "BACKFIRE", "PISTON",
];
const HOUSE_GRADES: Grade[] = ["green", "blue", "blue", "orange", "red"];

/** Small seeded generator so a given seed always draws the same random house fight. */
function seededRandom(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A house fight between two randomly built bots: random class, buyable parts in every
 * slot, paint, finish, stickers, trim, eyes and topper, and a random week of colors.
 * It never touches a store. The home screen cycles through these between real cards.
 */
export function randomHouseTape(seed: number): Bout {
  const rand = seededRandom(seed);
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;
  const world = houseWorld();
  const ids = ["ai-striker", "ai-tank"] as const;
  const names = [...HOUSE_NAMES].sort(() => rand() - 0.5);
  const colors = Object.keys(PAINT);
  const decals = DECALS.map((d) => d.id).filter((id) => !String(id).startsWith("champion"));
  ids.forEach((id, i) => {
    const classId = pick<ClassId>(["striker", "tank", "specialist"]);
    const gear = (slot: Slot) => {
      const options = partsFor(slot, classId).filter((p) => p.tier !== "championship" && (slot !== "chassis" || !p.classLock || p.classLock === classId));
      return pick(options).id;
    };
    const loadout: Loadout = {
      chassis: gear("chassis"),
      drive: gear("drive"),
      weapon: gear("weapon"),
      armor: gear("armor"),
      utility: rand() < 0.25 ? null : gear("utility"),
      brain: gear("brain"),
    };
    const bodies = BODY_STYLES.filter((b) => b.classId === classId);
    const sticker = () => pick(decals);
    const style: BotStyle = {
      body: pick(bodies).id,
      finish: pick(FINISHES.filter((f) => f.id !== "gold")).id,
      decal: sticker(),
      stickers: { left: sticker(), right: sticker(), hood: sticker(), rear: sticker() },
      trim: pick(Object.keys(TRIM)),
      eye: pick(Object.keys(EYES)),
      flag: rand() < 0.5,
      topper: pick(TOPPERS).id,
    };
    world.stores = world.stores.map((s) => (s.id === id ? { ...s, paint: pick(colors), name: `House ${i + 1}` } : s));
    world.bots = world.bots.map((b) =>
      b.storeId === id
        ? { ...b, name: names[i]!, classId, equipped: { ...loadout }, draft: { ...loadout }, locked: { ...loadout }, style, look: pick(["plain", "stripe", "chevron", "rivets"] as const), number: String(1 + Math.floor(rand() * 99)) }
        : b,
    );
    world.storeCards = world.storeCards.map((c) =>
      c.storeId === id ? { ...c, grades: Object.fromEntries(METRICS.map((m) => [m.stat, pick(HOUSE_GRADES)])) } : c,
    );
  });
  const bout = makeBout(1, 1, "bout", "House drill", [ids[0]], [ids[1]]);
  const result = simulateDuel(world, ids[0], ids[1], `house|random|${seed}`);
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

  let staged: PitData = {
    ...data,
    phase: "locked",
    bouts: [...data.bouts.filter((bout) => bout.week !== 4), ...played],
  };
  const extras: Bout[] = [];
  for (const conference of ["metro", "frontier"] as const) {
    const tied = conferenceTopTie(staged, conference);
    if (tied.length < 2) continue;
    const kind: Bout["kind"] = tied.length === 2 ? "final" : "melee";
    const title =
      conference === "metro" ? "Metro Conference Tiebreaker" : "Frontier Conference Tiebreaker";
    const tie = makeBout(
      4,
      played.length + extras.length + 1,
      kind,
      title,
      tied.length === 2 ? [tied[0]!.id] : tied.map((store) => store.id),
      tied.length === 2 ? [tied[1]!.id] : [],
    );
    tie.result = simulateBout(staged, tie);
    extras.push(tie);
    staged = { ...staged, bouts: [...staged.bouts, tie] };
  }
  return [...played, ...extras];
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
            ? `${wStore.name} wins the cage tiebreak.`
            : `${wStore.name} is the last bot moving.`
          : "The consolation cage goes quiet.",
        body: wBot
          ? bout.title === "Tiebreaker"
            ? `${wBot.name} walks out of a ${bout.teamA.length}-store tie. Same record going in. One conference berth coming out.`
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
        ? `${w.name} wins the cage tiebreak.`
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
      tag
        ? "Both stores on the winning side take the W. Both on the losing side take the L. Crews do not get a personal record."
        : "",
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
  const repairCost =
    cond === "scratched"
      ? REPAIR_PRICE.scratched
      : cond === "bent"
        ? REPAIR_PRICE.bent
        : REPAIR_PRICE.disabled;
  const weldCost = cond === "disabled" ? REPAIR_PRICE.weld : null;
  const salvageScrap =
    part.tier === "pro" ? 2 : part.tier === "super" ? 4 : part.tier === "championship" ? 3 : null;
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
    const crown = Boolean(
      part && part.tier === "super" && q.condition === "disabled" && wonThisWeek,
    );
    return { ...q, crown };
  }).filter((q): q is Quote => Boolean(q));
}

export function wonThisWeek(data: PitData, storeId: string): boolean {
  return data.bouts.some((b) => b.week === data.week && b.result?.winnerIds.includes(storeId));
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
  const fights = data.bouts.filter(
    (b) => b.week === data.week && b.result && b.storeIds.includes(storeId) && b.kind !== "bye",
  );
  const upset = fights.some((b) => {
    if (!b.result?.winnerIds.includes(storeId)) return false;
    const foe = b.result.fighters.find((f) =>
      f.id !== storeId && !b.teamA.includes(storeId) ? false : f.id !== storeId,
    );
    void foe;
    const opp = b.storeIds.find(
      (id) =>
        id !== storeId &&
        !(b.teamA.includes(storeId) && b.teamA.includes(id)) &&
        !(b.teamB.includes(storeId) && b.teamB.includes(id)),
    );
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
  if (data.phase === "fought" || data.phase === "inspected" || data.phase === "complete")
    return true;
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

/** Generic purchase-window check. Thanksgiving parts carry one; their dedicated gate in buyCheck speaks first. */
export function partInWindow(part: Part, now = new Date()) {
  if (!part.window) return true;
  const day = centralDay(now);
  if (day.y !== 2026) return false;
  const key = day.m * 100 + day.d;
  const start = part.window.start[0] * 100 + part.window.start[1];
  const end = part.window.end[0] * 100 + part.window.end[1];
  return key >= start && key <= end;
}

/** Kickoff color, then each completed week, oldest first. The live week has not paid yet. */
export function gradeHistory(data: PitData, storeId: string, stat: StatKey): Grade[] {
  const seq: Grade[] = [];
  const kick = data.kickoff?.grades?.[storeId]?.[stat];
  if (kick) seq.push(kick);
  const past = data.storeCards
    .filter((card) => card.storeId === storeId && card.week < data.week)
    .sort((a, b) => a.week - b.week);
  for (const card of past) seq.push(gradesOf(card)[stat]);
  return seq;
}

export function greenRecord(grades: Grade[]) {
  let straight = 0;
  for (let i = grades.length - 1; i >= 0; i--) {
    if (grades[i] === "green") straight += 1;
    else break;
  }
  return { count: grades.filter((grade) => grade === "green").length, straight };
}

export function buyCheck(
  data: PitData,
  storeId: string,
  part: Part,
): { ok: boolean; reason: string; cost: number } {
  const bot = botFor(data, storeId);
  if (data.phase === "open" && bot.locked)
    return {
      ok: false,
      reason: "This build is locked. Ask the Desk for a lock override.",
      cost: 0,
    };
  if (!shopOpen(data))
    return {
      ok: false,
      reason:
        data.week === 1 && !data.kickoff?.appliedAt
          ? "The shop opens when the desk pays the Period 11 kickoff coins."
          : "The shop shuts when the bots lock Saturday and reopens after the damage report.",
      cost: 0,
    };
  if (part.tier === "championship")
    return { ok: false, reason: "Championship parts are never sold.", cost: 0 };
  if (part.tier === "stock") return { ok: false, reason: "Stock is already on the peg.", cost: 0 };
  if (part.classLock && part.slot !== "chassis")
    return { ok: false, reason: "Wrong class.", cost: 0 };
  if (ownsPart(bot, part)) return { ok: false, reason: "Already in the cage.", cost: part.price };
  let cost = part.price;
  if (
    part.slot === "chassis" &&
    part.classLock &&
    part.classLock !== bot.classId &&
    data.week > 1
  ) {
    cost += RECLASS_FEE;
  }
  if (isThanksgivingPart(part.id)) {
    // Thanksgiving has its own gate and its own reasons. It never inherits
    // the Halloween all-season availability: window first, then finalists.
    if (!thanksgivingOpen()) return { ok: false, reason: THANKSGIVING_CLOSED_REASON, cost };
    if (data.week === 5 && !championshipFinalists(data).includes(storeId)) {
      return { ok: false, reason: THANKSGIVING_FINALIST_REASON, cost };
    }
  }
  if (part.window && !partInWindow(part)) {
    return {
      ok: false,
      reason: `${part.name} is not on the peg right now.`,
      cost,
    };
  }
  if (part.greenWeeks) {
    const record = greenRecord(gradeHistory(data, storeId, part.stat));
    const earned = part.straight ? record.straight : record.count;
    if (earned < part.greenWeeks) {
      const src = KEY_SOURCE[part.key];
      const need = part.straight
        ? `${part.greenWeeks} straight green ${src.label} weeks`
        : `${part.greenWeeks} green ${src.label} week${part.greenWeeks === 1 ? "" : "s"}`;
      return { ok: false, reason: `Needs ${need}. You have ${earned}.`, cost };
    }
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

/** Coins back for selling a part the store bought, whatever it cost. Paid into that part's jar. */
export const SELL_BACK = 2;

/** Whether a store may sell a bought part back right now. Same windows as buying. */
export function sellCheck(data: PitData, storeId: string, part: Part): { ok: boolean; reason: string } {
  const bot = botFor(data, storeId);
  if (part.tier === "stock") return { ok: false, reason: "Stock parts are not for sale." };
  if (part.tier === "championship") return { ok: false, reason: "Championship iron is earned, not sold." };
  if (!bot.owned.includes(part.id)) return { ok: false, reason: "Only parts this store bought can be sold." };
  if (data.phase === "open" && bot.locked)
    return { ok: false, reason: "This build is locked. Ask the Desk for a lock override." };
  if (!shopOpen(data))
    return { ok: false, reason: "The shop shuts when the bots lock Saturday and reopens after the damage report." };
  return { ok: true, reason: `Sell for ${SELL_BACK} ${part.key} coins.` };
}

/** Visual show effects. Same shop clock as parts. They never enter the loadout. */
export function showCheck(data: PitData, storeId: string, effectId: string): { ok: boolean; reason: string; cost: number } {
  const effect = showEffect(effectId) ?? thanksgivingShowEffect(effectId);
  if (!effect) return { ok: false, reason: "That show effect is not on the peg.", cost: 0 };
  const bot = botFor(data, storeId);
  if (data.phase === "open" && bot.locked) return { ok: false, reason: "This build is locked. Ask the Desk for a lock override.", cost: 0 };
  if (!shopOpen(data)) return { ok: false, reason: data.week === 1 && !data.kickoff?.appliedAt ? "The shop opens when the desk pays the Period 11 kickoff coins." : "The shop shuts when the bots lock Saturday and reopens after the damage report.", cost: 0 };
  // Falling Leaves keeps the Thanksgiving window; the Halloween effects stay on their own (all-season) terms.
  if (thanksgivingShowEffect(effectId) && !thanksgivingOpen()) return { ok: false, reason: THANKSGIVING_SHOW_CLOSED_REASON, cost: effect.price };
  if (bot.shows?.includes(effect.id)) return { ok: false, reason: "Already in the rafters.", cost: effect.price };
  const have = bot.coins[effect.key] ?? 0;
  if (have < effect.price) {
    return { ok: false, reason: `Needs ${effect.price} utility coins. You have ${have}. Arch Supports pays them: green 3, blue 2, orange 1, red 0.`, cost: effect.price };
  }
  return { ok: true, reason: "On the peg.", cost: effect.price };
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
