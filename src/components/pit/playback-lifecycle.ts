/** The finish panel and closing commentary share this exact frame boundary. */
export function showcaseFinishVisible(time: number, duration: number): boolean {
  return time >= duration;
}

/** A direct route retains its own started player until the viewer leaves it. */
export function keepDirectSaturdayGate(boutId: string, heldCount: number, activeBoutId: string | null): boolean {
  return heldCount > 0 || activeBoutId === boutId;
}

/** Accept only the latest load and start its player at the beginning. */
export function acceptShowcaseTape<T>(currentRequest: number, responseRequest: number, tape: T) {
  return currentRequest === responseRequest ? { tape, time: 0, generation: responseRequest } : null;
}

/** Ignore delayed clock updates from a player belonging to an older tape. */
export function updateShowcaseClock(current: number, generation: number, activeGeneration: number, update: number | ((time: number) => number)): number {
  if (generation !== activeGeneration) return current;
  return typeof update === "function" ? update(current) : update;
}
