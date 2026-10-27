import { central } from "./time";
import type { PartWindow } from "./catalog";

/**
 * Veterans Day set for Week 3 in The Warehouse (Sunday Nov 8 – Saturday Nov 14, 2026;
 * Veterans Day is Wednesday Nov 11). A thank-you, not a war theme: flags, dog tags, a
 * bugle and a home-front rivet gun. Nothing in the set shows combat or weapons of war.
 *
 * The Rivet Gun is on the peg only during the week; owned guns stay owned after.
 * The four looks are earned from Week 3 activity and stay unlocked after it.
 */

/** Calendar peg window for the Rivet Gun. */
export const VETERANS_WINDOW: PartWindow = { start: [11, 8], end: [11, 14] };

/** Sunday Nov 8, 00:00 CT. */
export const VETERANS_START = central(2026, 11, 8);
/** Sunday Nov 15, 00:00 CT. */
export const VETERANS_CLOSE = central(2026, 11, 15);

/** True while the site wears the Veterans Day banner. */
export function veteransVisuals(now = new Date()): boolean {
  return now >= VETERANS_START && now < VETERANS_CLOSE;
}

export const VETERANS_COLORS = {
  red: "#b22234",
  white: "#f4f1ea",
  navy: "#24325c",
  gold: "#e3b341",
  olive: "#4b5320",
  tag: "#c9cdd2",
} as const;

export const VETERANS_PART_IDS = ["weapon-rivetgun-super"] as const;

export function isVeteransPart(partId: string): boolean {
  return (VETERANS_PART_IDS as readonly string[]).includes(partId);
}
