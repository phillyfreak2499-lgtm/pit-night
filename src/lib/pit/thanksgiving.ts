import { central, centralDay } from "./time";
import { dayDate, programWeek } from "./training";
import type { PartWindow } from "./catalog";

/**
 * Thanksgiving set: five Super parts and one show effect for Championship
 * Week. Thanksgiving keeps its OWN gate, window, and refusal reasons — it
 * does not inherit the Halloween all-season availability and never routes
 * through the Halloween premium helpers. Parts are buyable only during the
 * window and, in Week 5, only by the two championship finalists. The show
 * effect is league-wide during the window. Owned parts stay owned and
 * equippable under the normal rules after the window closes; nothing here
 * expires ownership.
 */

/** Calendar peg window shared by the catalog families and roster ladders. */
export const THANKSGIVING_WINDOW: PartWindow = { start: [11, 24], end: [11, 28] };

const week = programWeek(5)!;

/** Tuesday of Championship Week (Nov 24, 2026), midnight Central. */
export const THANKSGIVING_WEEK_START = dayDate(week, "tue");

const titleTuesday = centralDay(THANKSGIVING_WEEK_START);

/** Monday Nov 23, 00:00 CT. Decorations may show while the floor is setting up. */
export const THANKSGIVING_VISUAL_START = central(titleTuesday.y, titleTuesday.m, titleTuesday.d - 1);
/** Parts and the show effect go on sale when the parts window opens. */
export const THANKSGIVING_OPEN = THANKSGIVING_WEEK_START;
/** Sunday Nov 29, 00:00 CT. End of Championship Saturday. */
export const THANKSGIVING_CLOSE = central(titleTuesday.y, titleTuesday.m, titleTuesday.d + 5);

export const THANKSGIVING_CLOSED_REASON =
  "Thanksgiving iron goes on the peg Tuesday, November 24 at midnight Central, for the two title builds, through Championship Saturday, November 28.";
export const THANKSGIVING_FINALIST_REASON =
  "Thanksgiving iron is for the two title builds. Rally behind a finalist instead.";
export const THANKSGIVING_SHOW_CLOSED_REASON =
  "Falling Leaves goes on sale Tuesday, November 24 at midnight Central, through Championship Saturday, November 28.";

/** True while Thanksgiving parts and the show effect can be bought. */
export function thanksgivingOpen(now = new Date()): boolean {
  return now >= THANKSGIVING_OPEN && now < THANKSGIVING_CLOSE;
}

/** True while the arena and shell wear Thanksgiving dressing (Mon–Sat). */
export function thanksgivingVisuals(now = new Date()): boolean {
  return now >= THANKSGIVING_VISUAL_START && now < THANKSGIVING_CLOSE;
}

export const THANKSGIVING_PART_IDS = [
  "weapon-carver-super",
  "weapon-yamcannon-super",
  "chassis-harvesttable-super",
  "armor-platter-super",
  "drive-haywagon-super",
] as const;

export function isThanksgivingPart(partId: string): boolean {
  return (THANKSGIVING_PART_IDS as readonly string[]).includes(partId);
}

/**
 * Thanksgiving show effects live apart from the Halloween SHOW_EFFECTS list:
 * different window, different refusal reason. Visual only — combat.ts never
 * reads show effects.
 */
export const THANKSGIVING_SHOW_EFFECTS = [
  {
    id: "leaves" as const,
    name: "Falling Leaves",
    price: 8,
    key: "utility" as const,
    blurb:
      "Amber and cranberry leaves drift across the ring during your bouts, and a win shakes the tree. Light and paper only. It does not change damage, coins, or the card.",
  },
];

export type ThanksgivingShowEffectId = (typeof THANKSGIVING_SHOW_EFFECTS)[number]["id"];

export function thanksgivingShowEffect(id: string) {
  return THANKSGIVING_SHOW_EFFECTS.find((effect) => effect.id === id);
}
