/** The finish panel and closing commentary share this exact frame boundary. */
export function showcaseFinishVisible(time: number, duration: number): boolean {
  return time >= duration;
}

/** A direct route retains its own started player until the viewer leaves it. */
export function keepDirectSaturdayGate(boutId: string, heldCount: number, activeBoutId: string | null): boolean {
  return heldCount > 0 || activeBoutId === boutId;
}
