/**
 * Championship Saturday stays dark until the Desk plays it live.
 *
 * The Royal Rumble and the Waterman Championship are deterministic, so the
 * Desk can run the card early. The saved season keeps the real tape. Every
 * browser, Gazette brief, booth line, and Claude prompt receives this
 * projection instead: no winner, no third place, no damage, no rounds.
 *
 * Results publish one fight at a time, after 9:30 AM CT on Saturday Nov 28,
 * when the Desk finishes that fight or posts it on purpose. A Desk-only peek
 * is a separate response and never written onto the season.
 */
import { central } from "./time";
import type {
  Bout,
  FightResult,
  GazetteEntry,
  PitData,
  SaturdayBaseline,
  SaturdayBotFace,
  SaturdayFightName,
  SaturdayWatch,
  Session,
} from "./types";

export const SATURDAY_BELL_LABEL = "Saturday, Nov 28, 9:30 AM CT";
/** 9:30 AM America/Chicago on Championship Saturday. */
export const SATURDAY_BELL = central(2026, 11, 28, 9, 30);

const RUMBLE_TITLE = "Third Place Royal Rumble";
const TITLE_FIGHT = "Waterman Championship";
const TITLE_PARTS = new Set([
  "chassis-shrike-championship",
  "chassis-keystone-championship",
  "chassis-windlass-championship",
]);

export function saturdayBellReached(now: Date): boolean {
  return now.getTime() >= SATURDAY_BELL.getTime();
}

export function initialSaturdayWatch(): SaturdayWatch {
  return {
    rumbleStartedAt: null,
    rumbleRevealedAt: null,
    championshipStartedAt: null,
    championshipRevealedAt: null,
  };
}

export function captureSaturdayBaseline(data: PitData): SaturdayBaseline {
  return {
    bots: data.bots.map((bot) => ({
      storeId: bot.storeId,
      wear: { ...bot.wear },
      partWear: { ...(bot.partWear ?? {}) },
      owned: [...bot.owned],
      style: bot.style ? { ...bot.style } : undefined,
    })),
    quotes: Object.fromEntries(
      Object.entries(data.quotes ?? {}).map(([id, rows]) => [id, rows.map((row) => ({ ...row }))]),
    ),
  };
}

export function saturdayFightKind(bout: Pick<Bout, "week" | "title"> | null | undefined): SaturdayFightName | null {
  if (!bout || bout.week !== 5) return null;
  if (bout.title === RUMBLE_TITLE) return "rumble";
  if (bout.title === TITLE_FIGHT) return "championship";
  return null;
}

export function saturdayFightId(id: string): SaturdayFightName | null {
  if (id.startsWith("w5-melee-")) return "rumble";
  if (id.startsWith("w5-final-")) return "championship";
  return null;
}

export function saturdayBout(data: PitData, fight: SaturdayFightName): Bout | undefined {
  return data.bouts.find((bout) => saturdayFightKind(bout) === fight);
}

/** True when this browser must not be handed a computed Saturday tape. */
export function browserBlocksSaturdaySeed(seed: string): boolean {
  return typeof window !== "undefined" && /\|w5\|/.test(seed) && /w5-(?:final|melee)-/.test(seed);
}

/** A result-shaped placeholder with no winner, no blows, and no damage. */
export function sealedFightResult(): FightResult {
  return {
    winnerIds: [],
    loserIds: [],
    method: "decision",
    blowout: false,
    exchanges: [],
    finisher: null,
    hp: {},
    fighters: [],
    wear: {},
    seed: "sealed",
  };
}

/** What the locked watch screen is allowed to show. Scrub stays off until a fight is posted. */
export function saturdayLockControls(role: Session["role"]) {
  const desk = role === "commissioner";
  return { showPin: !desk, showStart: desk, showPeek: desk, showReveal: desk, showScrub: false as const };
}

export function saturdayPlayDecision(input: {
  role: Session["role"];
  fight: SaturdayFightName;
  now: Date;
  data: PitData;
}): { ok: true } | { ok: false; error: string } {
  if (input.role !== "commissioner")
    return { ok: false, error: "The Desk PIN starts this fight." };
  if (!saturdayBellReached(input.now))
    return { ok: false, error: `The live watch opens ${SATURDAY_BELL_LABEL}.` };
  const bout = saturdayBout(input.data, input.fight);
  if (!bout?.result)
    return { ok: false, error: "Run Championship Saturday from the Desk first. The result stays sealed." };
  if (input.fight === "championship" && !input.data.saturdayWatch?.rumbleRevealedAt)
    return { ok: false, error: "The Royal Rumble posts first. Finish that fight, then start the title." };
  return { ok: true };
}

type Openness = { rumble: boolean; championship: boolean };

function openness(data: PitData): Openness {
  const watch = data.saturdayWatch;
  const rumble = data.bouts.find((bout) => saturdayFightKind(bout) === "rumble");
  const championship = data.bouts.find((bout) => saturdayFightKind(bout) === "championship");
  return {
    rumble: !watch?.rumbleRevealedAt && Boolean(rumble?.result?.winnerIds.length),
    championship: !watch?.championshipRevealedAt && Boolean(championship?.result?.winnerIds.length),
  };
}

function redactBout(bout: Bout, open: Openness): Bout {
  const kind = saturdayFightKind(bout);
  if (kind === "rumble" && open.rumble) return { ...bout, result: null };
  if (kind === "championship" && open.championship) return { ...bout, result: null };
  return bout;
}

function storeName(data: PitData, id: string): string | null {
  return data.stores.find((store) => store.id === id)?.name ?? data.bots.find((bot) => bot.storeId === id)?.name ?? null;
}

function botName(data: PitData, id: string): string | null {
  const bout = data.bouts.find((row) => row.result?.fighters.some((fighter) => fighter.id === id));
  return bout?.result?.fighters.find((fighter) => fighter.id === id)?.botName ?? data.bots.find((bot) => bot.storeId === id)?.name ?? null;
}

/** Names that would tell a sealed fight's finish. Matchups themselves are not in here. */
function sealedNames(data: PitData, open: Openness): string[] {
  const names = new Set<string>();
  const add = (id: string | null | undefined) => {
    if (!id) return;
    const store = storeName(data, id);
    const bot = botName(data, id);
    if (store && store.length > 2) names.add(store);
    if (bot && bot.length > 2 && bot !== store) names.add(bot);
  };
  if (open.rumble) add(data.bouts.find((bout) => saturdayFightKind(bout) === "rumble")?.result?.winnerIds[0]);
  if (open.championship) {
    const title = data.bouts.find((bout) => saturdayFightKind(bout) === "championship");
    add(title?.result?.winnerIds[0]);
    add(title?.result?.loserIds[0]);
  }
  return [...names];
}

function mentionsSealed(text: string, names: string[]): boolean {
  return names.some((name) => text.includes(name));
}

function hideGazette(entry: GazetteEntry, data: PitData, open: Openness, names: string[]): boolean {
  if (!open.rumble && !open.championship) return false;
  const rumble = data.bouts.find((bout) => saturdayFightKind(bout) === "rumble");
  const title = data.bouts.find((bout) => saturdayFightKind(bout) === "championship");
  if (open.rumble && rumble && (entry.boutId === rumble.id || entry.id === `g-${rumble.id}`)) return true;
  if (open.championship && title && (entry.boutId === title.id || entry.id === `g-${title.id}`)) return true;
  if (entry.week === 5 && entry.id === "g-5-open") return true;
  if (entry.week === 5 && mentionsSealed(`${entry.headline}\n${entry.body}`, names)) return true;
  return false;
}

function hideLog(line: string, names: string[]): boolean {
  if (!mentionsSealed(line, names)) return false;
  return /win|champion|title|third|rumble|belt|dump|eliminat|last bot|walks out|plate|beats|knock/i.test(line);
}

function championDecal(value: string | undefined): boolean {
  return value === "champion" || value === "champion-foil";
}

function restoreBot(bot: PitData["bots"][number], face: SaturdayBotFace | undefined, dropTitle: boolean): PitData["bots"][number] {
  if (!face && !dropTitle) return bot;
  let next = bot;
  if (face) {
    next = { ...next, wear: { ...face.wear }, partWear: { ...face.partWear } };
    if (dropTitle) {
      const ownedBefore = new Set(face.owned);
      const owned = bot.owned.filter((id) => !TITLE_PARTS.has(id) || ownedBefore.has(id));
      const style = next.style ? { ...next.style } : undefined;
      if (style) {
        if (style.topper === "crown" && face.style?.topper !== "crown") style.topper = face.style?.topper ?? "none";
        if (style.finish === "gold" && face.style?.finish !== "gold") style.finish = face.style?.finish ?? "factory";
        if (championDecal(style.decal) && !championDecal(face.style?.decal)) style.decal = face.style?.decal ?? "none";
      }
      next = { ...next, owned, style };
    }
  } else if (dropTitle) {
    next = { ...next, owned: bot.owned.filter((id) => !TITLE_PARTS.has(id)) };
  }
  return next;
}

/**
 * Copy of the season with Championship Saturday outcomes removed
 * until each fight's reveal time is set. Does not mutate `data`.
 */
export function sealSaturday(data: PitData): PitData {
  const open = openness(data);
  if (!open.rumble && !open.championship) {
    if (!data.saturdayBaseline) return data;
    const { saturdayBaseline: _baseline, ...rest } = data;
    return rest;
  }
  const names = sealedNames(data, open);
  const faces = new Map((data.saturdayBaseline?.bots ?? []).map((face) => [face.storeId, face]));
  const sealedStores = new Set<string>();
  for (const bout of data.bouts) {
    const kind = saturdayFightKind(bout);
    if (kind === "rumble" && open.rumble) bout.storeIds.forEach((id) => sealedStores.add(id));
    if (kind === "championship" && open.championship) bout.storeIds.forEach((id) => sealedStores.add(id));
  }
  const quotes: PitData["quotes"] = {};
  for (const [id, rows] of Object.entries(data.quotes ?? {})) {
    quotes[id] = sealedStores.has(id) ? (data.saturdayBaseline?.quotes[id] ?? []) : rows;
  }
  const { saturdayBaseline: _baseline, ...withoutBaseline } = data;
  return {
    ...withoutBaseline,
    bouts: data.bouts.map((bout) => redactBout(bout, open)),
    replays: data.replays?.map((row) => ({ ...row, bouts: row.bouts.map((bout) => redactBout(bout, open)) })),
    honors: {
      ...data.honors,
      thirdPlace: open.rumble ? null : (data.honors.thirdPlace ?? null),
      pitBelt: open.championship ? null : data.honors.pitBelt,
      plate: open.championship ? null : data.honors.plate,
      titleDrop: open.championship ? null : data.honors.titleDrop,
    },
    gazette: (data.gazette ?? []).filter((entry) => !hideGazette(entry, data, open, names)),
    log: (data.log ?? []).filter((line) => !hideLog(line, names)),
    bots: data.bots.map((bot) => restoreBot(bot, sealedStores.has(bot.storeId) ? faces.get(bot.storeId) : undefined, open.championship)),
    quotes,
    craft: (data.craft ?? []).filter((row) => row.week !== 5 || !sealedStores.has(row.storeId)),
  };
}

export function markSaturdayStarted(watch: SaturdayWatch | undefined, fight: SaturdayFightName, at: number): SaturdayWatch {
  const next = { ...(watch ?? initialSaturdayWatch()) };
  if (fight === "rumble") next.rumbleStartedAt ??= at;
  else next.championshipStartedAt ??= at;
  return next;
}

export function markSaturdayRevealed(watch: SaturdayWatch | undefined, fight: SaturdayFightName, at: number): SaturdayWatch {
  const next = markSaturdayStarted(watch, fight, at);
  if (fight === "rumble") next.rumbleRevealedAt ??= at;
  else next.championshipRevealedAt ??= at;
  return next;
}
