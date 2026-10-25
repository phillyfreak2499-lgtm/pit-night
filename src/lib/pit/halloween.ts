import { central, centralDay } from "./time";
import { dayDate, programWeek } from "./training";

/**
 * Halloween week is Pit Week 1. Training Tuesday is the source of truth
 * (`programWeek(1).start`, 2026-10-27). Saturday is the fifth training day.
 * Staff can see decorations from the Monday before. Premium iron opens the
 * next midnight (Sunday Nov 1, 00:00 Central) and stays buyable through
 * Championship Saturday, the fourth day after Championship Week's Tuesday.
 */

const pitWeek = programWeek(1)!;
const titleWeek = programWeek(5)!;

export const HALLOWEEN_PIT_START = dayDate(pitWeek, "tue");
export const HALLOWEEN_PIT_SATURDAY = dayDate(pitWeek, "sat");

const pitTuesday = centralDay(HALLOWEEN_PIT_START);
const pitSaturday = centralDay(HALLOWEEN_PIT_SATURDAY);
const titleTuesday = centralDay(dayDate(titleWeek, "tue"));

/** Monday Oct 26, 00:00 CT. Decorations may show while the floor is setting up. */
export const HALLOWEEN_VISUAL_START = central(pitTuesday.y, pitTuesday.m, pitTuesday.d - 1);
/** Sunday Nov 1, 00:00 CT. End of Saturday Oct 31, and the premium open. */
export const HALLOWEEN_VISUAL_END = central(pitSaturday.y, pitSaturday.m, pitSaturday.d + 1);
/** Saturday Nov 28, 00:00 CT. Championship Saturday. */
export const CHAMPIONSHIP_SATURDAY = central(titleTuesday.y, titleTuesday.m, titleTuesday.d + 4);
/** Sunday Nov 29, 00:00 CT. Premium sales close after Championship Saturday. */
export const PREMIUM_CLOSE = central(titleTuesday.y, titleTuesday.m, titleTuesday.d + 5);

export const PREMIUM_OPEN = HALLOWEEN_VISUAL_END;

export function halloweenVisuals(now = new Date()) {
  const t = now.getTime();
  return t >= HALLOWEEN_VISUAL_START.getTime() && t < HALLOWEEN_VISUAL_END.getTime();
}

/** Server and client share this clock. Mocked `Date` in tests moves the gate. */
export function premiumHalloweenOpen(now = new Date()) {
  const t = now.getTime();
  return t >= PREMIUM_OPEN.getTime() && t < PREMIUM_CLOSE.getTime();
}

export const PREMIUM_PART_IDS = [
  "weapon-chainsaw-super",
  "weapon-slasher-super",
  "weapon-ghost-super",
  "weapon-launcher-super",
  "weapon-bones-super",
  "weapon-broom-super",
  "chassis-pumpkin-super",
  "drive-ghostchaser-super",
] as const;

export type PremiumPartId = (typeof PREMIUM_PART_IDS)[number];

export function isPremiumHalloweenPart(id: string) {
  return (PREMIUM_PART_IDS as readonly string[]).includes(id);
}

export const SHOW_PRICE = 8;

export const SHOW_EFFECTS = [
  {
    id: "fog" as const,
    name: "Fog Machine",
    price: SHOW_PRICE,
    key: "utility" as const,
    blurb: "Soft fog rolls across the ring during your bouts. Lights and atmosphere only. It does not change damage, coins, or the card.",
  },
  {
    id: "blacklight" as const,
    name: "Blacklight Mode",
    price: SHOW_PRICE,
    key: "utility" as const,
    blurb: "Makes the green celebration ooze glow. Paint and light only. It does not change damage, coins, or the card.",
  },
];

export type ShowEffectId = (typeof SHOW_EFFECTS)[number]["id"];

export function showEffect(id: string) {
  return SHOW_EFFECTS.find((row) => row.id === id);
}

export const PREMIUM_CLOSED_REASON =
  "Halloween iron and show effects go on the peg Sunday, November 1 at midnight Central, and stay through Championship Saturday, November 28.";
