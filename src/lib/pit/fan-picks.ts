import type { Bout, Pick as FanPick } from "./types";

/** One current choice per person, matching Monday Pick'em's head-to-head ballot. */
export function fanSplit(bout: Bout, picks: readonly FanPick[]) {
  const [a] = bout.teamA, [b] = bout.teamB;
  if (bout.kind === "bye" || bout.teamA.length !== 1 || bout.teamB.length !== 1 || !a || !b || a === b) return null;
  const latest = new Map<string, FanPick>();
  for (const p of picks) {
    if (p.boutId !== bout.id || p.week !== bout.week || (p.pick !== a && p.pick !== b)) continue;
    const previous = latest.get(p.crewId);
    if (!previous || previous.at <= p.at) latest.set(p.crewId, p);
  }
  const total = latest.size;
  const left = [...latest.values()].filter(p => p.pick === a).length;
  const leftPct = total ? Math.round(100 * left / total) : 0;
  return { total, sides: [
    { id: a, count: left, percent: leftPct },
    { id: b, count: total - left, percent: total ? 100 - leftPct : 0 },
  ] };
}
