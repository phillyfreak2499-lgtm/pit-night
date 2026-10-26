import { central, centralDay } from "./time";
import { dayDate, programWeek } from "./training";

/**
 * Halloween week is Pit Week 1. Training Tuesday is the source of truth
 * (`programWeek(1).start`, 2026-10-27). Saturday is the fifth training day.
 * Staff can see decorations from the Monday before (visuals only, Oct 26
 * through Nov 1).
 *
 * Purchase availability (owner directive 2026-10-25): Halloween stock —
 * the premium parts below, the Skeleton chassis, the Ghost Veil utility,
 * and the Fog Machine / Blacklight Mode show effects — is on the peg all
 * season, in every week. There is no November-only sales window anymore,
 * so `premiumHalloweenOpen` returns true for every date. Decorations
 * timing (`halloweenVisuals`) is unchanged.
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
/** Sunday Nov 1, 00:00 CT. End of Saturday Oct 31. Kept as a season marker; no longer a sales gate. */
export const HALLOWEEN_VISUAL_END = central(pitSaturday.y, pitSaturday.m, pitSaturday.d + 1);
/** Saturday Nov 28, 00:00 CT. Championship Saturday. */
export const CHAMPIONSHIP_SATURDAY = central(titleTuesday.y, titleTuesday.m, titleTuesday.d + 4);
/** Sunday Nov 29, 00:00 CT. Kept as a season marker; no longer a sales gate. */
export const PREMIUM_CLOSE = central(titleTuesday.y, titleTuesday.m, titleTuesday.d + 5);

export const PREMIUM_OPEN = HALLOWEEN_VISUAL_END;

export function halloweenVisuals(now = new Date()) {
  const t = now.getTime();
  return t >= HALLOWEEN_VISUAL_START.getTime() && t < HALLOWEEN_VISUAL_END.getTime();
}

/**
 * Halloween stock is on the peg all season (owner directive 2026-10-25),
 * so this always returns true. The signature stays so callers and tests
 * can keep asking the question; the date no longer gates sales.
 */
export function premiumHalloweenOpen(now = new Date()) {
  void now;
  return true;
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
