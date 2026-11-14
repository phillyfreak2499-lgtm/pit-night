/**
 * House commercials for the watch party.
 *
 * A card breaks between every pair of bouts, and not after the last one.
 * On a seven-bout card that is six breaks: one after each of bouts 1–6,
 * none after the main event. A longer card still stops at six.
 *
 * Most weeks have a three-spot reel. Those three play in order, then repeat
 * from the top so every break still gets a spot. Week 3's reel is six spots
 * and fills a six-break card once. A break never borrows a spot from another
 * week. The same week number and the same card length always pick the same
 * reel, so a replay stays put.
 *
 * Rotation:
 *   Week 1 (and any week below 1) stays on catalog 1–3, so a Shakedown
 *   replay keeps Pit Mutual, VOLTAGE, and Scrapyard Sal's.
 *   Week 2 stays on spots 7–9. Bolt Bank, Gobble-Grade, and Class Act Movers
 *   keep the reel they aired, ahead of 4–6.
 *   Week 3 (Tue Nov 10 – Mon Nov 16, 2026; the card runs Monday Nov 16)
 *   plays only the new spots 10–15, in catalog order. A card with six or
 *   more breaks plays all six. A shorter card fills every break from 10
 *   forward and does not pad with 1–9.
 *   Week 4 plays whatever of 10–15 that shorter Week 3 card did not reach,
 *   then its usual 1–3. A seven-bout Week 3 uses every new spot, so that
 *   Week 4 stays on 1–3 with nothing left over. Regular-season weeks share
 *   a bout count, so the handoff uses the card length you ask about.
 *   Weeks 5+ keep the earlier cycle: 7–9, then 4–6, then 1–3, and so on.
 *   A spot therefore never airs in back-to-back weeks, including every week
 *   after 3. Spots 10–15 return when that week is replayed, or at the front
 *   of Week 4 when Week 3 could not fit them.
 *
 *   Week 1: 1, 2, 3
 *   Week 2: 7, 8, 9
 *   Week 3: 10, 11, 12, 13, 14, 15
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
 * A shorter reel repeats to fill the breaks. Week 3's reel is this long.
 */
export const COMMERCIAL_ROTATION_BLOCK = 6;

export type CommercialTone = "lead" | "vo" | "end" | "flash" | "aside";

export type CommercialScene =
  | "mutual"
  | "voltage"
  | "sals"
  | "brain"
  | "hotline"
  | "nap"
  | "bank"
  | "gravy"
  | "movers"
  | "reach"
  | "extra-pass"
  | "roses"
  | "machine"
  | "hall-pass"
  | "spare-parts";

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
  {
    number: 10,
    slug: "rios-reach",
    sponsor: "Rios Reach",
    scene: "reach",
    lines: [
      {
        tone: "lead",
        text: "Specialists are supposed to keep their distance. The claw, unfortunately, did not get the memo.",
      },
      {
        tone: "vo",
        text: "Rios Reach. Shreveport's Daniel Rios measures twice, grabs once, and gives RED RIVER just enough arm to be polite.",
      },
      { tone: "end", text: "Rios Reach. Stand back. He already did." },
    ],
    fine: "Polite is a hope, not a warranty. Claw length may vary after contact with saws, hammers or the pit. Daniel is pit crew, not a spare part. Do not attempt this reach at home, or in someone else's bay.",
  },
  {
    number: 11,
    slug: "philips-extra-pass",
    sponsor: "Philip's Extra Pass",
    scene: "extra-pass",
    lines: [
      { tone: "lead", text: "The tank looks ready. It isn't. The last cotter pin would like a word." },
      {
        tone: "vo",
        text: "Philip's Extra Pass. Abilene specialist Philip Rodriguez walks KEY CITY one more time and only then says now.",
      },
      { tone: "end", text: "Philip's Extra Pass. Once is how you lose a nut." },
      { tone: "aside", text: "The nut was important." },
    ],
    fine: "Extra pass is a habit, not a paid upgrade. Tightening is performed with ordinary wrenches and extraordinary patience. Missing nuts remain missing if they already left for the pit. Not responsible for hammers that were already confident.",
  },
  {
    number: 12,
    slug: "samanthas-spare-rose",
    sponsor: "Samantha's Spare Rose",
    scene: "roses",
    lines: [
      { tone: "lead", text: "Forgot the finishing touch? ROSE CITY never does, if Samantha's in the bay." },
      {
        tone: "vo",
        text: "Samantha's Spare Rose. Tyler specialist Samantha Rodriguez keeps one extra bouquet in the locker, just in case Monday needs a little ceremony.",
      },
      { tone: "end", text: "Samantha's Spare Rose. Armor first. Flowers second." },
    ],
    fine: "Bouquet is ceremonial and will not stop a saw, a hammer or a mild breeze. Free in Tyler only. Other bays must bring their own flowers, which we do not recommend placing in the drivetrain. Not a weapon. Not a shield. Cute, though.",
  },
  {
    number: 13,
    slug: "the-machine",
    sponsor: "The Machine's Maintenance Plan",
    scene: "machine",
    lines: [
      { tone: "lead", text: "Some captains have a name. Southlake's has a job title." },
      {
        tone: "vo",
        text: "The Machine runs SEACHICKEN like clockwork: oiled, locked, and loudly unbothered.",
      },
      { tone: "end", text: "The Machine's Maintenance Plan. Results not human." },
      { tone: "aside", text: "We asked. It just said beep." },
    ],
    fine: "Results not human, and neither is the service schedule. Oiling, locking and being unbothered sold as a set. Beep is not a legally binding answer. SEACHICKEN appears courtesy of the Southlake bay. Clockwork may squeak. Void if you ask too many questions.",
  },
  {
    number: 14,
    slug: "helens-hall-pass",
    sponsor: "Helen's Hall Pass",
    scene: "hall-pass",
    lines: [
      { tone: "lead", text: "Double plat. Double smash. Double-check the paperwork." },
      {
        tone: "vo",
        text: "Alliance specialist Helen keeps DOUBLE PLAT SMASHER cleared, cleaned and ready for Monday.",
      },
      { tone: "end", text: "Helen's Hall Pass. No bot fights without it." },
    ],
    fine: "Hall pass required for entry to Monday. Does not excuse late locks, missing bolts or unsanctioned smashing. Paperwork is ceremonial but the bot is not. Alliance specialist Helen keeps the forms; the forms do not keep the bot. One pass per fight, no copies, no folding.",
  },
  {
    number: 15,
    slug: "scotts-spare-parts",
    sponsor: "Scott's Spare Parts",
    scene: "spare-parts",
    lines: [
      { tone: "lead", text: "TEMPLETRON lost a bolt. Scott found three. Nobody asks where." },
      {
        tone: "vo",
        text: "Temple specialist Scott keeps the bay stocked so TEMPLETRON never fights short a part.",
      },
      { tone: "end", text: "Scott's Spare Parts. If it fell off, he's got it." },
      { tone: "aside", text: "Probably." },
    ],
    fine: "If it fell off, he's got it, probably. Origin of spare bolts not disclosed, insured or remembered. TEMPLETRON appears courtesy of the Temple bay. Parts may have prior arena experience. Do not ask where. Asking where voids the pile.",
  },
];

export function commercialVideoSrc(ad: Pick<Commercial, "slug">): string {
  return `/ads/${ad.slug}.mp4`;
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * Week blocks, in cycle order, for every week except the Week 3 premiere.
 * New spots (7–9) sit ahead of 4–6.
 * Week 1 is the first block so replays of that card stay on 1–3.
 */
const WEEK_REELS: readonly (readonly number[])[] = [
  [1, 2, 3],
  [7, 8, 9],
  [4, 5, 6],
];

/** Catalog 10–15. Week 3 plays these and nothing older. */
const WEEK_3_PREMIERE = [10, 11, 12, 13, 14, 15] as const;

/** A seven-bout card. `commercialAt` assumes this when the caller omits a length. */
const SEVEN_BOUT_CARD = 7;

function commercialByNumber(number: number): Commercial {
  const ad = COMMERCIALS.find((item) => item.number === number);
  if (!ad) throw new Error(`Commercial ${number} is not in the catalog`);
  return ad;
}

/** Breaks that actually air. The main event takes none, and a longer card stops at six. */
function breakCount(fightCount: number): number {
  if (!Number.isInteger(fightCount) || fightCount < 2) return 0;
  return Math.min(fightCount - 1, COMMERCIAL_ROTATION_BLOCK, COMMERCIALS.length);
}

function classicNumbers(week: number): readonly number[] {
  const w = Number.isFinite(week) ? Math.trunc(week) : 1;
  const index = w >= 1 ? (w - 1) % WEEK_REELS.length : 0;
  return WEEK_REELS[index]!;
}

function reelNumbers(week: number, fightCount: number): readonly number[] {
  const w = Number.isFinite(week) ? Math.trunc(week) : 1;
  if (w === 3) {
    const slots = breakCount(fightCount);
    const count = slots > 0 ? Math.min(WEEK_3_PREMIERE.length, slots) : WEEK_3_PREMIERE.length;
    return WEEK_3_PREMIERE.slice(0, count);
  }
  if (w === 4) {
    const slots = breakCount(fightCount);
    if (slots > 0 && slots < WEEK_3_PREMIERE.length) {
      return [...WEEK_3_PREMIERE.slice(slots), ...classicNumbers(4)];
    }
  }
  return classicNumbers(w);
}

/** Spots for this week, in play order. Weeks below 1 use the week-1 reel. */
function reelForWeek(week: number, fightCount: number): readonly Commercial[] {
  return reelNumbers(week, fightCount).map(commercialByNumber);
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
 * A three-spot reel repeats to cover a longer card. Week 3's six-spot reel
 * fills a seven-bout card once. Pass fightCount for a shorter card; omitted,
 * the seven-bout card is assumed.
 */
export function commercialAt(
  week: number,
  slotIndex: number,
  fightCount = SEVEN_BOUT_CARD,
): Commercial {
  const reel = reelForWeek(week, fightCount);
  const safeSlot = Number.isFinite(slotIndex) ? Math.trunc(slotIndex) : 0;
  return reel[mod(safeSlot, reel.length)]!;
}

/** The spot that plays after this fight, or null when the card rolls on. */
export function commercialAfter(week: number, fightNumber: number, fightCount: number): Commercial | null {
  if (!commercialAfterFight(fightNumber, fightCount)) return null;
  return commercialAt(week, fightNumber - 1, fightCount);
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
