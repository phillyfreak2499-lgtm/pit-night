import type { BotDecal, BotFinish, BotStyle, ClassId, KeyName, Slot, StatKey, Tier } from "./types";

export const SCRAP_CAP = 18;
export const VERSION = 4;

export const CLASS_META: Record<
  ClassId,
  { label: string; chassis: string; superName: string; blurb: string; threat: string }
> = {
  striker: {
    label: "Striker",
    chassis: "Shrike",
    superName: "Glass Ghost",
    blurb: "Demo and closing. Hits first. Dies if the fight gets long.",
    threat: "Pressures a tank early.",
  },
  tank: {
    label: "Tank",
    chassis: "Keystone",
    superName: "Anvil",
    blurb: "Former-customer ticket and a stack of greens. Wins late.",
    threat: "Smothers a specialist if the claw misses.",
  },
  specialist: {
    label: "Specialist",
    chassis: "Windlass",
    superName: "Vice",
    blurb: "Reviews and NSNU-to-goal. Grapple and Heat.",
    threat: "Shuts a striker down when Heat is real.",
  },
};

export const PAINT: Record<string, string> = {
  amber: "#e2a21a",
  rust: "#c4552a",
  bone: "#d9d3c7",
  teal: "#3c8f78",
  crimson: "#c4473a",
  gold: "#e0bc58",
  steel: "#7ea2c4",
  mud: "#8d6a43",
  brass: "#b9a24a",
  olive: "#7d8a6a",
  copper: "#d4783a",
  cobalt: "#3d6fd1",
  sky: "#5fb8e0",
  lime: "#9bc53d",
  forest: "#3f7d4e",
  violet: "#8457c9",
  magenta: "#cf4f93",
  cherry: "#c0283f",
  graphite: "#6b6f78",
};

export const FINISHES: { id: BotFinish; label: string; note: string }[] = [
  { id: "factory", label: "Factory", note: "Clean gloss." },
  { id: "chrome", label: "Chrome", note: "Mirror bands." },
  { id: "matte", label: "Matte", note: "Flat, no shine." },
  { id: "worn", label: "Battle-worn", note: "Scratches and rust." },
];

export const DECALS: { id: BotDecal; label: string }[] = [
  { id: "none", label: "None" },
  { id: "flames", label: "Flames" },
  { id: "lightning", label: "Lightning" },
  { id: "teeth", label: "Shark teeth" },
  { id: "checker", label: "Race checks" },
  { id: "hazard", label: "Hazard stripes" },
  { id: "camo", label: "Camo" },
  { id: "arch", label: "Arch badge" },
];

export const TRIM: Record<string, string> = {
  steel: "#b8b2a6",
  black: "#1a1918",
  white: "#f3efe6",
  gold: "#e8c25a",
  red: "#e0402e",
  blue: "#3d8fe8",
  green: "#4fcf6a",
  pink: "#ff5fa8",
};

export const EYES: Record<string, string> = {
  green: "#50ff8c",
  red: "#ff3b30",
  amber: "#ffb020",
  blue: "#3fb4ff",
  white: "#f4f8ff",
  purple: "#b46bff",
};

export const DEFAULT_STYLE: BotStyle = { finish: "factory", decal: "none", trim: "steel", eye: "green", flag: false };

export function styleOf(source: { style?: Partial<BotStyle> } | null | undefined): BotStyle {
  return { ...DEFAULT_STYLE, ...(source?.style ?? {}) };
}

export type Part = {
  id: string;
  slot: Slot;
  family: string;
  name: string;
  tier: Tier;
  classLock?: ClassId;
  stat: StatKey;
  key: KeyName;
  job: string;
  tags: string[];
  nudge: { power: number; speed: number; armor: number; heat: number };
  scrap: number;
  greens: number;
  keys: number;
};

const ZERO = { power: 0, speed: 0, armor: 0, heat: 0 };

function nudge(
  power = 0,
  speed = 0,
  armor = 0,
  heat = 0,
): Part["nudge"] {
  return { power, speed, armor, heat };
}

type Family = {
  slot: Slot;
  family: string;
  stat: StatKey;
  key: KeyName;
  classLock?: ClassId;
  tags: string[];
  names: Partial<Record<Tier, string>>;
  jobs: Partial<Record<Tier, string>>;
  nudge: Part["nudge"];
};

const TIER_COST: Record<Tier, number> = {
  stock: 0,
  sport: 4,
  pro: 7,
  super: 12,
  championship: 0,
};
/** Legacy green-week gate. Keys are the only gate now. */
const TIER_GREENS: Record<Tier, number> = {
  stock: 0,
  sport: 0,
  pro: 0,
  super: 0,
  championship: 0,
};
/**
 * The ladder. A green week earns one key for that slot, and keys are never spent.
 * Holding the keys unlocks the tier; scrap pays for the part.
 */
export const TIER_KEYS: Record<Tier, number> = {
  stock: 0,
  sport: 1,
  pro: 2,
  super: 3,
  championship: 0,
};

/** Which weekly number earns which key. */
export const KEY_SOURCE: Record<KeyName, { stat: StatKey; label: string; green: string }> = {
  chassis: { stat: "nsnu", label: "NSNU-to-goal", green: "100% of goal" },
  drive: { stat: "demo", label: "Demo %", green: "80%+" },
  weapon: { stat: "close", label: "Closing %", green: "65%+" },
  armor: { stat: "ticket", label: "Former-customer ticket", green: "$400+" },
  utility: { stat: "reviews", label: "Named 5-stars", green: "2 per crew on the clock" },
};

export const KEY_ORDER: KeyName[] = ["chassis", "drive", "weapon", "armor", "utility"];

const FAMILIES: Family[] = [
  {
    slot: "chassis",
    family: "shrike",
    stat: "nsnu",
    key: "chassis",
    classLock: "striker",
    tags: ["speed"],
    nudge: nudge(1, 4, -1, 0),
    names: {
      stock: "Shrike",
      sport: "Shrike Sport",
      pro: "Shrike Pro",
      super: "Glass Ghost",
      championship: "Glass Ghost — Title",
    },
    jobs: {
      stock: "The striker chassis. Light, mean, and first through the door.",
      sport: "Same bird, braced keel. Still a striker.",
      pro: "A Shrike that can take one extra exchange before the glass shows.",
      super: "Skin off. Faster. The long fight will still kill you.",
      championship: "Title metal. Not for sale. The cage remembers this one.",
    },
  },
  {
    slot: "chassis",
    family: "keystone",
    stat: "nsnu",
    key: "chassis",
    classLock: "tank",
    tags: ["armor"],
    nudge: nudge(1, -2, 5, 0),
    names: {
      stock: "Keystone",
      sport: "Keystone Sport",
      pro: "Keystone Pro",
      super: "Anvil",
      championship: "Anvil — Title",
    },
    jobs: {
      stock: "The tank chassis. It arrives late and leaves last.",
      sport: "Extra plate on the same idea. Still wins after the crowd sits down.",
      pro: "A Keystone that treats the third exchange as the real bout.",
      super: "Stopped being a bot and started being a building.",
      championship: "Title anvil. Hung, never sold.",
    },
  },
  {
    slot: "chassis",
    family: "windlass",
    stat: "nsnu",
    key: "chassis",
    classLock: "specialist",
    tags: ["heat"],
    nudge: nudge(0, 0, 0, 5),
    names: {
      stock: "Windlass",
      sport: "Windlass Sport",
      pro: "Windlass Pro",
      super: "Vice",
      championship: "Vice — Title",
    },
    jobs: {
      stock: "The specialist chassis. Built to grab and cook.",
      sport: "Tighter drum on the winch. Heat comes up cleaner.",
      pro: "A Windlass that does not miss the second grab.",
      super: "The grip gets mean. Strikers hate this shape.",
      championship: "Title vice. Salvage or a Title Monday drop. Never a price tag.",
    },
  },
  {
    slot: "drive",
    family: "mag",
    stat: "demo",
    key: "drive",
    tags: ["speed"],
    nudge: nudge(0, 4, 0, 0),
    names: {
      stock: "Mag Tires",
      sport: "Sticky Mag",
      pro: "Race Mag",
      super: "Glue",
      championship: "Tar Glue",
    },
    jobs: {
      stock: "Demo-week rubber. It goes where the specialist pointed.",
      sport: "Less slide on the polished mall floor.",
      pro: "Tires for a store that actually books the demo.",
      super: "They do not drift. They adhere.",
      championship: "Title compound. The floor loses the argument.",
    },
  },
  {
    slot: "drive",
    family: "omni",
    stat: "demo",
    key: "drive",
    tags: ["heat", "lateral"],
    nudge: nudge(0, 2, 0, 2),
    names: {
      stock: "Omni Casters",
      sport: "Pit Omni",
      pro: "Ghost Step",
      super: "Ghost Drive",
      championship: "No Track",
    },
    jobs: {
      stock: "Sideways on purpose. Specialists live here.",
      sport: "Cleaner cut-ins. The claw arrives from the wrong angle.",
      pro: "A step that does not telegraph.",
      super: "The bot is beside you. Then it is not.",
      championship: "Title casters. No line on the floor to follow.",
    },
  },
  {
    slot: "drive",
    family: "treads",
    stat: "demo",
    key: "drive",
    tags: ["armor"],
    nudge: nudge(1, -2, 4, 0),
    names: {
      stock: "Tank Treads",
      sport: "Shop Treads",
      pro: "Pro Treads",
      super: "Bulldozer",
      championship: "County Line",
    },
    jobs: {
      stock: "Slow, planted, rude. A tank's commute.",
      sport: "Shop-grade track. Still not a sports car.",
      pro: "Treads that keep the wedge honest through exchange three.",
      super: "It does not turn. It rezones the cage.",
      championship: "Title track. The county line, in steel.",
    },
  },
  {
    slot: "drive",
    family: "flip",
    stat: "demo",
    key: "drive",
    tags: ["control"],
    nudge: nudge(2, 1, 1, 0),
    names: {
      stock: "Flip Kit",
      sport: "Sport Flip",
      pro: "Pro Flip",
      super: "Unbreakable",
      championship: "Never Down",
    },
    jobs: {
      stock: "A kit that puts people on their lid if you time it.",
      sport: "Shorter travel, harder pop.",
      pro: "The flip that ends a bad angle.",
      super: "You can bend it. You cannot park it.",
      championship: "Title hips. It gets up angry.",
    },
  },
  {
    slot: "weapon",
    family: "saw",
    stat: "close",
    key: "weapon",
    tags: ["speed", "saw"],
    nudge: nudge(3, 3, -1, 0),
    names: {
      stock: "Vertical Saw",
      sport: "Sport Saw",
      pro: "Keel Saw",
      super: "Bone Saw",
      championship: "Mercy Kill",
    },
    jobs: {
      stock: "The closer's saw. First contact, not a speech.",
      sport: "A toothier disc on the same idea.",
      pro: "Keel-mounted. It finds the seam and stays there.",
      super: "Does not care what the mall did last year.",
      championship: "Title saw. One cut, then the lights.",
    },
  },
  {
    slot: "weapon",
    family: "drum",
    stat: "close",
    key: "weapon",
    tags: ["speed", "drum"],
    nudge: nudge(4, 2, -1, 0),
    names: {
      stock: "Drum",
      sport: "Sport Drum",
      pro: "Pro Drum",
      super: "Thresher",
      championship: "Harvest",
    },
    jobs: {
      stock: "A drum that rewards a fast week and a clean demo.",
      sport: "Heavier barrel. Still a speed weapon.",
      pro: "The drum that turns armor into confetti if you earned the speed.",
      super: "It threshes. Bring a week that can feed it.",
      championship: "Title drum. The harvest is not metaphorical.",
    },
  },
  {
    slot: "weapon",
    family: "wedge",
    stat: "close",
    key: "weapon",
    tags: ["control", "wedge"],
    nudge: nudge(2, -1, 3, 0),
    names: {
      stock: "Wedge",
      sport: "Sport Wedge",
      pro: "Pro Wedge",
      super: "Door",
      championship: "Closed Sign",
    },
    jobs: {
      stock: "Get under them. The conversation is over when the floor is gone.",
      sport: "A sharper leading edge for a tank that already has the greens.",
      pro: "The wedge that feeds the late fight.",
      super: "It is a door. You are on the wrong side of it.",
      championship: "Title door. Somebody flipped the sign.",
    },
  },
  {
    slot: "weapon",
    family: "hammer",
    stat: "close",
    key: "weapon",
    tags: ["smash", "hammer"],
    nudge: nudge(5, -2, 1, 0),
    names: {
      stock: "Hammer",
      sport: "Sport Hammer",
      pro: "Pro Hammer",
      super: "Gavel",
      championship: "Sentence",
    },
    jobs: {
      stock: "Overhead. Slow. Honest. A tank's punctuation.",
      sport: "More mass, same sermon.",
      pro: "The hammer that only needs one clean Monday.",
      super: "The gavel. Deliberation is over.",
      championship: "Title hammer. The sentence was already written.",
    },
  },
  {
    slot: "weapon",
    family: "claw",
    stat: "close",
    key: "weapon",
    tags: ["control", "claw", "heat"],
    nudge: nudge(1, 0, 0, 5),
    names: {
      stock: "Claw",
      sport: "Sport Claw",
      pro: "Pro Claw",
      super: "Lockjaw",
      championship: "Held",
    },
    jobs: {
      stock: "Grab. If Heat is real, the striker never gets the second hit.",
      sport: "A wider bite. Still a grapple, not a blender.",
      pro: "The claw that does not let go when the crowd gets loud.",
      super: "Lockjaw. You leave when it says so.",
      championship: "Title claw. Held. That is the whole decision.",
    },
  },
  {
    slot: "weapon",
    family: "disc",
    stat: "close",
    key: "weapon",
    tags: ["speed", "disc"],
    nudge: nudge(3, 4, -2, 1),
    names: {
      stock: "Spinner Disc",
      sport: "Sport Disc",
      pro: "Pro Disc",
      super: "Halo",
      championship: "Crown",
    },
    jobs: {
      stock: "A disc that only works if the week was fast. On a tank it is a ceiling fan.",
      sport: "More rpm. Still a speed weapon. Do not bolt it to a building.",
      pro: "The disc that pays rent only on a striker chassis.",
      super: "Halo. Pretty, loud, and useless if you cannot get there first.",
      championship: "Title disc. A crown with teeth.",
    },
  },
  {
    slot: "armor",
    family: "plate",
    stat: "ticket",
    key: "armor",
    tags: ["armor"],
    nudge: nudge(0, -1, 5, 0),
    names: {
      stock: "Plate",
      sport: "Sport Plate",
      pro: "Pro Plate",
      super: "Vault",
      championship: "The Safe",
    },
    jobs: {
      stock: "Flat plate. Former-customer armor starts here.",
      sport: "Thicker where the saw usually looks.",
      pro: "Plate for a ticket average that can carry it.",
      super: "A vault. They hit it. The number does not move.",
      championship: "Title safe. The combination is the week.",
    },
  },
  {
    slot: "armor",
    family: "skirt",
    stat: "ticket",
    key: "armor",
    tags: ["armor", "wedge"],
    nudge: nudge(1, 0, 3, 0),
    names: {
      stock: "Skirt",
      sport: "Sport Skirt",
      pro: "Pro Skirt",
      super: "Scoop",
      championship: "Plow Saint",
    },
    jobs: {
      stock: "Low skirt. Hard to get under.",
      sport: "Tighter to the floor. Wedges hate it.",
      pro: "A skirt that turns their wedge into your ramp.",
      super: "Scoop. You take the floor with you.",
      championship: "Title skirt. The plow has a parish.",
    },
  },
  {
    slot: "armor",
    family: "angle",
    stat: "ticket",
    key: "armor",
    tags: ["armor", "deflect"],
    nudge: nudge(0, 1, 3, 1),
    names: {
      stock: "Angle Kit",
      sport: "Sport Angle",
      pro: "Pro Angle",
      super: "Ricochet",
      championship: "Bank Shot",
    },
    jobs: {
      stock: "Slopes. Vertical weapons waste the first bite.",
      sport: "Steeper. The saw buys less.",
      pro: "Angles cut for a store that knows who is swinging.",
      super: "Ricochet. Their weapon works for you for half a second.",
      championship: "Title geometry. The bank shot was drawn on purpose.",
    },
  },
  {
    slot: "armor",
    family: "cage",
    stat: "ticket",
    key: "armor",
    tags: ["heat", "open"],
    nudge: nudge(0, 1, -1, 3),
    names: {
      stock: "Open Cage",
      sport: "Sport Cage",
      pro: "Pro Cage",
    },
    jobs: {
      stock: "No roof, more heat, less forgiveness. There is no Super of this.",
      sport: "A cage that still lets the claw out.",
      pro: "The last honest cage. Super was never on the menu.",
    },
  },
  {
    slot: "utility",
    family: "burn",
    stat: "reviews",
    key: "utility",
    tags: ["speed"],
    nudge: nudge(0, 3, -1, 1),
    names: {
      stock: "Afterburner",
      sport: "Sport Burn",
      pro: "Pro Burn",
      super: "Redline",
      championship: "Overrev",
    },
    jobs: {
      stock: "A can of speed. Strikers already know the smell.",
      sport: "Longer burn. Still a glass-jaw choice.",
      pro: "The burn you earn with a review week, not a wish.",
      super: "Redline. Everything forward. Nothing in reserve.",
      championship: "Title burn. The tach is a suggestion.",
    },
  },
  {
    slot: "utility",
    family: "peace",
    stat: "reviews",
    key: "utility",
    tags: ["control"],
    nudge: nudge(1, 0, 2, 1),
    names: {
      stock: "Peace Lock",
      sport: "Sport Lock",
      pro: "Pro Lock",
      super: "Mercy",
      championship: "Handshake",
    },
    jobs: {
      stock: "A lock that keeps a wild bot from eating its own week.",
      sport: "Cleaner disengage. You choose when it restarts.",
      pro: "The lock a captain trusts on a loud Monday.",
      super: "Mercy. You can end it without a dumpster fire.",
      championship: "Title lock. The handshake is mandatory.",
    },
  },
  {
    slot: "utility",
    family: "crowd",
    stat: "reviews",
    key: "utility",
    tags: ["crowd"],
    nudge: nudge(1, 1, 1, 1),
    names: {
      stock: "Crowd Magnet",
      sport: "Sport Magnet",
      pro: "Pro Magnet",
      super: "House",
      championship: "Sellout",
    },
    jobs: {
      stock: "The cage leans your way. Reviews put bodies in the seats.",
      sport: "Louder section. The judges hear it.",
      pro: "A magnet built from names, not noise.",
      super: "You are the house. The other bot is visiting.",
      championship: "Title crowd. Sold out, and they know the bot's name.",
    },
  },
  {
    slot: "utility",
    family: "weld",
    stat: "reviews",
    key: "utility",
    tags: ["repair"],
    nudge: nudge(0, 0, 2, 0),
    names: {
      stock: "Pit Weld",
      sport: "Sport Weld",
      pro: "Pro Weld",
      super: "Crew Chief",
      championship: "Overtime",
    },
    jobs: {
      stock: "A bead that keeps a scratched week from becoming a bent one.",
      sport: "Cleaner bead. The crew already did the work on Saturday.",
      pro: "Weld for a garage that does not panic at the quote.",
      super: "Crew Chief on the rail. The bot fights like somebody has the clipboard.",
      championship: "Title weld. Overtime, and the bead holds.",
    },
  },
  {
    slot: "utility",
    family: "scry",
    stat: "reviews",
    key: "utility",
    tags: ["read", "underdog"],
    nudge: nudge(0, 0, 0, 2),
    names: {
      stock: "Scry",
      sport: "Sport Scry",
      pro: "Pro Scry",
      super: "Blueprint",
      championship: "The Tell",
    },
    jobs: {
      stock: "Underdog read. See their tier — or their class and weapon family.",
      sport: "A clearer read. Still worthless if you are already the bully.",
      pro: "The scry a quiet store uses to pick the counter.",
      super: "Blueprint. You fight the drawing, not the rumor.",
      championship: "Title tell. You knew the lock before the bell.",
    },
  },
];

function buildParts(): Part[] {
  const parts: Part[] = [];
  for (const family of FAMILIES) {
    (Object.keys(family.names) as Tier[]).forEach((tier) => {
      const name = family.names[tier];
      const job = family.jobs[tier];
      if (!name || !job) return;
      parts.push({
        id: `${family.slot}-${family.family}-${tier}`,
        slot: family.slot,
        family: family.family,
        name,
        tier,
        classLock: family.classLock,
        stat: family.stat,
        key: family.key,
        job,
        tags: family.tags,
        nudge: family.nudge,
        scrap: TIER_COST[tier],
        greens: TIER_GREENS[tier],
        keys: TIER_KEYS[tier],
      });
    });
  }
  return parts;
}

export const PARTS: Part[] = buildParts();

const BY_ID = new Map(PARTS.map((p) => [p.id, p]));

export function partById(id: string | null | undefined): Part | undefined {
  if (!id) return undefined;
  return BY_ID.get(id);
}

export function partsFor(slot: Slot, classId?: ClassId): Part[] {
  return PARTS.filter((p) => {
    if (p.slot !== slot) return false;
    if (p.classLock && classId && p.classLock !== classId) return false;
    return true;
  });
}

export function stockPart(slot: Slot, classId: ClassId, family?: string): Part {
  if (slot === "chassis") {
    const fam = classId === "striker" ? "shrike" : classId === "tank" ? "keystone" : "windlass";
    return partById(`chassis-${fam}-stock`)!;
  }
  if (family) {
    const hit = partById(`${slot}-${family}-stock`);
    if (hit) return hit;
  }
  const defaults: Record<ClassId, Record<Exclude<Slot, "chassis" | "utility">, string>> = {
    striker: { drive: "mag", weapon: "saw", armor: "plate" },
    tank: { drive: "treads", weapon: "wedge", armor: "plate" },
    specialist: { drive: "omni", weapon: "claw", armor: "cage" },
  };
  if (slot === "utility") return partById("utility-scry-stock")!;
  const fam = defaults[classId][slot];
  return partById(`${slot}-${fam}-stock`)!;
}

export function tierWord(tier: Tier): string {
  if (tier === "championship") return "Title";
  return tier[0]!.toUpperCase() + tier.slice(1);
}

export const SLOT_LABEL: Record<Slot, string> = {
  chassis: "Chassis",
  drive: "Drive",
  weapon: "Weapon",
  armor: "Armor",
  utility: "Utility",
};

export const GRADE_WORD: Record<string, string> = {
  green: "Green",
  blue: "Blue",
  orange: "Orange",
  red: "Red",
};

export function classOfChassis(partId: string): ClassId | null {
  const p = partById(partId);
  return p?.classLock ?? null;
}
