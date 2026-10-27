import { central } from "./time";
import type { PartWindow } from "./catalog";

/**
 * Election Week set for Week 2 (Sunday Nov 1 – Saturday Nov 7, 2026; Election Day is
 * Tuesday Nov 3). Strictly nonpartisan: voting, ballots and civic history only. No party
 * names, party animals, or red-versus-blue palette anywhere in the set: gold, parchment,
 * laurel green and bronze.
 *
 * The Cherry Tree Axe is on the peg only during the week; owned axes stay owned after.
 * The four looks are earned from Week 2 activity and stay unlocked after it.
 */

/** Calendar peg window for the Cherry Tree Axe. */
export const ELECTION_WINDOW: PartWindow = { start: [11, 1], end: [11, 7] };

/** Sunday Nov 1, 00:00 CT. */
export const ELECTION_START = central(2026, 11, 1);
/** Sunday Nov 8, 00:00 CT. */
export const ELECTION_CLOSE = central(2026, 11, 8);

/** True while the site and arena wear Election Week dressing. */
export function electionVisuals(now = new Date()): boolean {
  return now >= ELECTION_START && now < ELECTION_CLOSE;
}

/** Nonpartisan civic palette. Deliberately no red and no blue. */
export const ELECTION_COLORS = {
  gold: "#e3b341",
  parchment: "#efe3c2",
  laurel: "#5f8a4f",
  bronze: "#a8783a",
  ink: "#2b2620",
} as const;

export const ELECTION_PART_IDS = ["weapon-axe-super"] as const;

export function isElectionPart(partId: string): boolean {
  return (ELECTION_PART_IDS as readonly string[]).includes(partId);
}
