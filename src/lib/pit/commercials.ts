/**
 * House commercials for the watch party.
 *
 * A card breaks between every pair of bouts, and not after the last one.
 * On a seven-bout card that is six breaks: one after each of bouts 1–6,
 * none after the main event. The reel is the catalog in order, every week,
 * and each spot is used once. A longer card does not repeat the reel.
 *
 * Drop a finished spot at `public/ads/<slug>.mp4`. The player uses that file
 * (H.264 video, AAC audio, about 15 seconds). If the file is missing or fails
 * to load, the animated text spot below plays instead.
 */

export const AD_MS = 15_000;

/**
 * Breaks on a seven-bout card, and the length of one fixed pass.
 * The reel does not rotate by week.
 */
export const COMMERCIAL_ROTATION_BLOCK = 6;

export type CommercialTone = "lead" | "vo" | "end" | "flash" | "aside";

export type CommercialScene = "mutual" | "voltage" | "sals" | "brain" | "hotline" | "nap";

export type CommercialLine = {
  tone: CommercialTone;
  text: string;
};

export type Commercial = {
  /** 1-based catalog number. */
  number: number;
  slug: string;
  sponsor: string;
  scene: CommercialScene;
  lines: readonly CommercialLine[];
  /** Unreadably fast small print. Not spoken. */
  fine?: string;
};

export const COMMERCIALS: readonly Commercial[] = [
  {
    number: 1,
    slug: "pit-mutual",
    sponsor: "Pit Mutual Insurance",
    scene: "mutual",
    lines: [
      { tone: "lead", text: "Got flipped? Got sawed? Got personally insulted by a hammer?" },
      {
        tone: "vo",
        text: "Pit Mutual. We cover everything except fire, saws, flipping, hammers, and the pit. Mostly the paperwork.",
      },
    ],
    fine: "EXCLUDES FIRE · EXCLUDES SAWS · EXCLUDES FLIPPING · EXCLUDES HAMMERS · EXCLUDES THE PIT · MOSTLY THE PAPERWORK · ",
  },
  {
    number: 2,
    slug: "voltage",
    sponsor: "VOLTAGE",
    scene: "voltage",
    lines: [
      { tone: "lead", text: "Made with 400% of your daily recommended sparks. Not for humans. Barely for robots." },
      { tone: "end", text: "VOLTAGE. Side effects include winning, smoking, and a suddenly void warranty." },
    ],
  },
  {
    number: 3,
    slug: "scrapyard-sals",
    sponsor: "Scrapyard Sal's Auto Parts",
    scene: "sals",
    lines: [
      { tone: "lead", text: "Lost an arm? Sal's got arms. Lost a wheel? Sal's got wheels. Don't ask where Sal gets 'em." },
      { tone: "end", text: "Sal's. Previously loved parts. Very recently loved." },
    ],
  },
  {
    number: 4,
    slug: "brain-be-gone",
    sponsor: "Brain-Be-Gone Tech Support",
    scene: "brain",
    lines: [
      { tone: "lead", text: "Is your Logic brain overthinking? Is your Berserker emotionally unavailable?" },
      { tone: "vo", text: "Have you tried turning your bot off and on again? 50% chance it comes back angrier." },
      { tone: "end", text: "Brain-Be-Gone. Unplug responsibly." },
    ],
  },
  {
    number: 5,
    slug: "repair-hotline",
    sponsor: "Repair Quote Hotline",
    scene: "hotline",
    lines: [
      {
        tone: "lead",
        text: "Monday's damage report hurt? Call 1-800-BOLT-ON. Operators are standing by, mostly because their legs fell off.",
      },
      { tone: "flash", text: "No coins? No problem. Also no repairs." },
    ],
  },
  {
    number: 6,
    slug: "nap-pod-3000",
    sponsor: "Nap Pod 3000",
    scene: "nap",
    lines: [
      { tone: "lead", text: "After a long day of being punched by a chainsaw, your bot deserves rest." },
      { tone: "end", text: "Nap Pod 3000. Now with optional lid." },
      { tone: "aside", text: "The lid locks from the outside." },
    ],
  },
];

export function commercialVideoSrc(ad: Pick<Commercial, "slug">): string {
  return `/ads/${ad.slug}.mp4`;
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** True when this 1-based fight should cut to a house spot before the next program. */
export function commercialAfterFight(fightNumber: number, fightCount: number): boolean {
  if (!Number.isInteger(fightNumber) || !Number.isInteger(fightCount)) return false;
  if (fightCount < 2 || fightNumber < 1 || fightNumber >= fightCount) return false;
  // One pass of the catalog. Bout 1 takes spot 1; the main event takes none.
  return fightNumber <= COMMERCIAL_ROTATION_BLOCK && fightNumber <= COMMERCIALS.length;
}

/**
 * Catalog spot for the slotIndex-th break (0-based).
 * Week is accepted so the watch party can keep passing the card week.
 * It does not change the order.
 */
export function commercialAt(_week: number, slotIndex: number): Commercial {
  const safeSlot = Number.isFinite(slotIndex) ? Math.trunc(slotIndex) : 0;
  return COMMERCIALS[mod(safeSlot, COMMERCIALS.length)]!;
}

/** The spot that plays after this fight, or null when the card rolls on. */
export function commercialAfter(week: number, fightNumber: number, fightCount: number): Commercial | null {
  if (!commercialAfterFight(fightNumber, fightCount)) return null;
  return commercialAt(week, fightNumber - 1);
}

/** Every spot on a card, in the order the room will see them. */
export function commercialsForCard(week: number, fightCount: number): Commercial[] {
  if (!Number.isInteger(fightCount) || fightCount < 2) return [];
  const spots: Commercial[] = [];
  for (let fight = 1; fight <= fightCount; fight++) {
    const spot = commercialAfter(week, fight, fightCount);
    if (spot) spots.push(spot);
  }
  return spots;
}
