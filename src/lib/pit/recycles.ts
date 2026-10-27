import { central } from "./time";
import type { PartWindow } from "./catalog";

/**
 * America Recycles Day set for Week 4 in The Junkyard (Sunday Nov 15 – Saturday Nov 21,
 * 2026; America Recycles Day is Sunday Nov 15). Reuse, rebuild, battle: chasing arrows,
 * bottle caps, a sprout and a tin-can hat, plus the Can Crusher.
 *
 * The Can Crusher is on the peg only during the week; owned crushers stay owned after.
 * The four looks are earned from Week 4 activity and stay unlocked after it.
 */

/** Calendar peg window for the Can Crusher. */
export const RECYCLES_WINDOW: PartWindow = { start: [11, 15], end: [11, 21] };

/** Sunday Nov 15, 00:00 CT. */
export const RECYCLES_START = central(2026, 11, 15);
/** Sunday Nov 22, 00:00 CT. */
export const RECYCLES_CLOSE = central(2026, 11, 22);

/** True while the site wears the America Recycles Day banner. */
export function recyclesVisuals(now = new Date()): boolean {
  return now >= RECYCLES_START && now < RECYCLES_CLOSE;
}

export const RECYCLES_COLORS = {
  green: "#2f9e57",
  leaf: "#7ccf6a",
  bin: "#2c6db5",
  yellow: "#e9c43a",
  kraft: "#a8875a",
  can: "#c4c9cf",
} as const;

export const RECYCLES_PART_IDS = ["weapon-crusher-super"] as const;

export function isRecyclesPart(partId: string): boolean {
  return (RECYCLES_PART_IDS as readonly string[]).includes(partId);
}
