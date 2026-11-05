import { previewSaturday } from "./engine";
import type { Bout, PitData, WeekReplay } from "./types";

/** Posted bouts for one week, in card order. Empty when that week never ran. */
export function postedCard(bouts: readonly Bout[], week: number): Bout[] {
  return bouts.filter((bout) => bout.week === week && bout.result).sort((a, b) => a.slot - b.slot);
}

/**
 * Freeze one posted card into the archive.
 * Other weeks are left as they were. A week with no result is not sealed.
 */
export function sealReplay(data: Pick<PitData, "replays" | "bouts" | "week">, week = data.week): WeekReplay[] {
  const card = postedCard(data.bouts, week);
  const prior = data.replays ?? [];
  if (!card.length) return prior;
  const frozen = structuredClone(card);
  return [...prior.filter((row) => row.week !== week), { week, bouts: frozen }].sort((a, b) => a.week - b.week);
}

/**
 * Seasons saved before the archive still have their cards on `bouts`.
 * Copy any missing week once. A week that is already sealed stays sealed,
 * so a later edit to the live bots cannot rewrite that tape.
 */
export function backfillReplays(replays: readonly WeekReplay[] | undefined, bouts: readonly Bout[]): WeekReplay[] {
  const sealed = new Map<number, WeekReplay>();
  for (const row of replays ?? []) {
    if (row.bouts.some((bout) => bout.result)) sealed.set(row.week, row);
  }
  const weeks = new Set<number>(sealed.keys());
  for (const bout of bouts) if (bout.result) weeks.add(bout.week);
  return [...weeks]
    .sort((a, b) => a - b)
    .map((week) => sealed.get(week) ?? { week, bouts: structuredClone(postedCard(bouts, week)) });
}

/** Weeks that have a posted card, whether it lives in the archive or on `bouts`. */
export function replayWeeks(data: Pick<PitData, "bouts" | "replays">): number[] {
  const weeks = new Set<number>();
  for (const row of data.replays ?? []) {
    if (row.bouts.some((bout) => bout.result)) weeks.add(row.week);
  }
  for (const bout of data.bouts) if (bout.result) weeks.add(bout.week);
  return [...weeks].sort((a, b) => a - b);
}

/** The card the desk just ran, still sitting on the current week before advance. */
export function isLiveCard(data: Pick<PitData, "week" | "phase">, week: number): boolean {
  return week === data.week && (data.phase === "fought" || data.phase === "inspected");
}

/**
 * Read-only playback of a posted card.
 * Prefers the frozen archive. Falls back to `bouts` for a card sealed only there.
 * Returns a deep copy and does not simulate from live coins, wear, or loadouts.
 */
export function replayWeek(data: Pick<PitData, "bouts" | "replays">, week: number): Bout[] {
  const sealed = data.replays?.find((row) => row.week === week);
  const source = sealed && sealed.bouts.some((bout) => bout.result) ? sealed.bouts : postedCard(data.bouts, week);
  return structuredClone(source).sort((a, b) => a.slot - b.slot);
}

/**
 * The tape Fight Day and the watch party play.
 * A posted week comes from the archive. The open week, before the desk runs it,
 * is a house preview and is not stored.
 */
export function buildTape(data: PitData, week: number): { live: boolean; replay: boolean; bouts: Bout[] } {
  const posted = replayWeek(data, week);
  if (posted.length) return { live: true, replay: !isLiveCard(data, week), bouts: posted };
  if (week !== data.week) return { live: false, replay: false, bouts: [] };
  return { live: false, replay: false, bouts: previewSaturday(data) };
}

/** Stable identity of a card: seed, winner, method, and every exchange. */
export function replayFingerprint(bouts: readonly Bout[]): string {
  return bouts
    .map((bout) => {
      const result = bout.result;
      if (!result) return `${bout.id}:none`;
      const exchanges = result.exchanges
        .map((ex) => `${ex.index}:${ex.attackerId}:${ex.defenderId}:${ex.damage}:${ex.attackerHp}:${ex.defenderHp}:${ex.call}`)
        .join(",");
      return [
        bout.id,
        bout.slot,
        result.seed,
        result.method,
        result.winnerIds.join("+"),
        result.loserIds.join("+"),
        exchanges,
        result.fighters.map((fighter) => `${fighter.id}:${fighter.botName}:${fighter.weaponName}:${fighter.rating}:${fighter.paint}`).join("/"),
      ].join("|");
    })
    .join("||");
}
