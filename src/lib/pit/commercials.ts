/**
 * House commercials for the watch party.
 *
 * A card breaks between every pair of bouts, and not after the last one.
 * On a seven-bout card that is six breaks: one after each of bouts 1–6,
 * none after the main event. A longer card still stops at six.
 *
 * Each week has a three-spot reel. Those three play in order, then repeat
 * from the top so every break still gets a spot. A break never borrows a
 * spot from another week. The same week number always picks the same reel.
 *
 * Rotation:
 *   Week 1 (and any week below 1) stays on catalog 1–3, so a Shakedown
 *   replay keeps Pit Mutual, VOLTAGE, and Scrapyard Sal's.
 *   Week 2 plays the new spots 7–9. The original six already aired on the
 *   Week 1 broadcast, and new spots come before 4–6.
 *   Weeks 3+ walk one disjoint block per week: 4–6, then 1–3, then 7–9,
 *   and so on. A spot therefore never airs in back-to-back weeks. When two
 *   blocks are both eligible, the newer spots win, which puts 7–9 on week 2
 *   ahead of 4–6 and makes the cycle 1–3, 7–9, 4–6, repeat.
 *
 *   Week 1: 1, 2, 3
 *   Week 2: 7, 8, 9
 *   Week 3: 4, 5, 6
 *   Week 4: 1, 2, 3
 *   Week 5: 7, 8, 9
 *
 * Drop a finished spot at `public/ads/<slug>.mp4`. The player uses that file
 * (H.264 video, AAC audio, about 15 seconds). If the file is missing or fails
 * to load, the animated text spot below plays instead.
 */

export const AD_MS = 15_000;

/**
 * Breaks that get a house spot on a seven-bout card.
 * The week's reel is shorter than this; it repeats to fill the breaks.
 */
export const COMMERCIAL_ROTATION_BLOCK = 6;

export type CommercialTone = "lead" | "vo" | "end" | "flash" | "aside";

export type CommercialScene = "mutual" | "voltage" | "sals" | "brain" | "hotline" | "nap" | "bank" | "gravy" | "movers";

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
  {
    number: 7,
    slug: "bolt-bank",
    sponsor: "First National Bolt Bank",
    scene: "bank",
    lines: [
      { tone: "lead", text: "Got a coffee can full of loose Bolts rattling around the garage?" },
      { tone: "vo", text: "First National Bolt Bank. Ten Bolts, one coin. Up to five coins a week." },
      { tone: "end", text: "Bolt Bank. We count, so you don't have to." },
      { tone: "aside", text: "We also can't count." },
    ],
    fine: "10 Bolts = 1 coin. Weekly limit 5 coins. Stripped, bent or emotionally attached Bolts not accepted. Not insured by Pit Mutual (nothing is). All counting performed by a robot who cannot count. Void where bolted down.",
  },
  {
    number: 8,
    slug: "gobble-grade",
    sponsor: "Gobble-Grade Gear Grease",
    scene: "gravy",
    lines: [
      { tone: "lead", text: "This Thanksgiving, don't let your bot be the driest thing at the table." },
      {
        tone: "vo",
        text: "Gobble-Grade Gear Grease. Made from 100% leftover gravy. Fewer squeaks, smoother joints, and a faint smell of stuffing.",
      },
      { tone: "end", text: "Gobble-Grade. Pass it to the left." },
    ],
    fine: "Made with 100% leftover gravy. May attract dogs, uncles and second helpings. Do not pour on mashed potatoes (we tried). Not a food. Not a sauce. Legally, barely a grease.",
  },
  {
    number: 9,
    slug: "class-act-movers",
    sponsor: "Class Act Movers",
    scene: "movers",
    lines: [
      { tone: "lead", text: "Switching from Tank to Striker? Striker to Specialist? Specialist to… whatever that was?" },
      { tone: "vo", text: "Class Act Movers! We pack your bot, label every bolt, and only lose the important ones." },
      { tone: "end", text: "One hundred twenty Bolts and a strong back!" },
    ],
    fine: "Class switch fee: 120 Bolts. Movers not responsible for lost wheels, arms, antennas, dignity or personality. Strong back not included. Some assembly required. Some disassembly already occurred.",
  },
];

export function commercialVideoSrc(ad: Pick<Commercial, "slug">): string {
  return `/ads/${ad.slug}.mp4`;
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * Week blocks, in cycle order. New spots (7–9) sit ahead of 4–6.
 * Week 1 is the first block so replays of that card stay on 1–3.
 */
const WEEK_REELS: readonly (readonly number[])[] = [
  [1, 2, 3],
  [7, 8, 9],
  [4, 5, 6],
];

function commercialByNumber(number: number): Commercial {
  const ad = COMMERCIALS.find((item) => item.number === number);
  if (!ad) throw new Error(`Commercial ${number} is not in the catalog`);
  return ad;
}

/** The three spots for this week, in play order. Weeks below 1 use the week-1 reel. */
function reelForWeek(week: number): readonly Commercial[] {
  const w = Number.isFinite(week) ? Math.trunc(week) : 1;
  const index = w >= 1 ? (w - 1) % WEEK_REELS.length : 0;
  return WEEK_REELS[index]!.map(commercialByNumber);
}

/** True when this 1-based fight should cut to a house spot before the next program. */
export function commercialAfterFight(fightNumber: number, fightCount: number): boolean {
  if (!Number.isInteger(fightNumber) || !Number.isInteger(fightCount)) return false;
  if (fightCount < 2 || fightNumber < 1 || fightNumber >= fightCount) return false;
  // Up to six breaks. The main event takes none.
  return fightNumber <= COMMERCIAL_ROTATION_BLOCK && fightNumber <= COMMERCIALS.length;
}

/**
 * Catalog spot for the slotIndex-th break (0-based).
 * The week's three-spot reel repeats to cover a longer card.
 */
export function commercialAt(week: number, slotIndex: number): Commercial {
  const reel = reelForWeek(week);
  const safeSlot = Number.isFinite(slotIndex) ? Math.trunc(slotIndex) : 0;
  return reel[mod(safeSlot, reel.length)]!;
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
