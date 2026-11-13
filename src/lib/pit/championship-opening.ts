import { programSegments, type ProgramSegment } from "./fight-card";
export const CHAMPIONSHIP_OPENING_MS = 30_000;
export function hasChampionshipOpening(week: number, boutCount: number) { return week === 5 && boutCount > 0; }
export type ChampionshipSegment<T extends { id: string }> = ProgramSegment<T> | { id: "team-janelle-opening"; kind: "opening" };
export function championshipProgramSegments<T extends { id: string }>(bouts: T[], week: number): ChampionshipSegment<T>[] {
  const segments: ChampionshipSegment<T>[] = programSegments(bouts);
  if (hasChampionshipOpening(week, bouts.length)) segments.splice(1, 0, { id: "team-janelle-opening", kind: "opening" });
  return segments;
}
export function firstPlaybackIndex<T extends { id: string }>(segments: ChampionshipSegment<T>[]) {
  return segments.findIndex((s) => s.kind === "opening" || s.kind === "card" || s.kind === "fight");
}
/** Uncapped presentation clock. Suspend before hiding or pausing, then establish a fresh anchor. */
export function createCelebrationClock() {
  let elapsed = 0;
  let last: number | null = null;
  return {
    suspend() { last = null; },
    tick(now: number) {
      if (last !== null) elapsed = Math.min(CHAMPIONSHIP_OPENING_MS, elapsed + Math.max(0, now - last));
      last = now;
      return elapsed;
    },
    get elapsed() { return elapsed; },
  };
}
