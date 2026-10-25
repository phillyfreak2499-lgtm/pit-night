import { bannerVerdict } from "../../../scripts/copy-guard.mjs";
import { STICKER_ART, type BotBody, type BotDecal, type BotFinish, type BotLeds, type BotMask, type BotSmoke, type BotStyle, type BotTopper, type BotWeaponSkin, type ClassId, type KeyName, type Slot, type StatKey, type StickerArt, type Tier } from "./types";
import { ROSTER_PARTS } from "./roster";

export const SCRAP_CAP = 18;
export const VERSION = 6;

export const CLASS_META: Record<
  ClassId,
  { label: string; chassis: string; superName: string; blurb: string; threat: string }
> = {
  striker: {
    label: "Striker",
    chassis: "Shrike",
    superName: "Glass Ghost",
    blurb: "Demo Rate and Demo Close. Hits first. Dies if the fight gets long.",
    threat: "Pressures a tank early.",
  },
  tank: {
    label: "Tank",
    chassis: "Keystone",
    superName: "Anvil",
    blurb: "Demo Ticket and Conv. Wins late.",
    threat: "Smothers a specialist if the claw misses.",
  },
  specialist: {
    label: "Specialist",
    chassis: "Windlass",
    superName: "Vice",
    blurb: "Arch Supports and NSNU. Grapple and Heat.",
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
  obsidian: "#17191d",
  electric: "#00b7ff",
  hotpink: "#ff4fa3",
  toxic: "#a8ff2a",
  pearl: "#f0e8dc",
  neon: "#39ff6a",
  candy: "#e3123f",
  ice: "#bfe8ff",
  royal: "#6a2bd9",
};

/** Paints only the Bolt Locker sells. Key is the paint, value is the locker item. */
export const LOCKER_PAINTS: Record<string, string> = {
  neon: "paint-neon",
  candy: "paint-candy",
  ice: "paint-ice",
  royal: "paint-royal",
};

export const FINISHES: { id: BotFinish; label: string; note: string }[] = [
  { id: "factory", label: "Factory", note: "Clean gloss." },
  { id: "matte", label: "Matte", note: "Flat, no shine." },
  { id: "satin", label: "Satin", note: "Soft sheen under arena lights." },
  { id: "chrome", label: "Chrome", note: "Mirror bands." },
  { id: "carbon", label: "Carbon", note: "Dark woven race finish." },
  { id: "iridescent", label: "Iridescent", note: "Color shifts under the lights." },
  { id: "worn", label: "Battle-worn", note: "Scratches and rust." },
  { id: "gold", label: "Champion Gold", note: "Reserved for the Waterman Champion." },
  { id: "holographic", label: "Holographic", note: "Full Tune-Ups in 3 weeks, or 14 Bolts." },
];

const BASE_DECALS: { id: StickerArt; label: string }[] = [
  { id: "none", label: "None" },
  { id: "hazard", label: "Hazard stripes" },
  { id: "arch", label: "Arch badge" },
  { id: "checker", label: "Race checks" },
  { id: "lightning", label: "Lightning" },
  { id: "flames", label: "Flames" },
  { id: "teeth", label: "Shark teeth" },
  { id: "camo", label: "Camo" },
  { id: "stars", label: "Victory stars" },
  { id: "circuit", label: "Circuit board" },
  { id: "splash", label: "Paint splash" },
  { id: "champion", label: "Champion crest" },
  { id: "pumpkin", label: "Pumpkin sticker" },
  { id: "roundel", label: "Number roundel" },
  { id: "gear", label: "Gear" },
  { id: "wrench", label: "Wrench" },
  { id: "optics", label: "Robot eyes" },
  { id: "skull", label: "Cartoon skull" },
  { id: "bullseye", label: "Bullseye" },
  { id: "plate", label: "Armor plate" },
  { id: "gearhead", label: "Gearhead Garage" },
  { id: "brace", label: "Bolt & Brace Co." },
  { id: "fuel", label: "Pit Fuel" },
  { id: "tonic", label: "Torque Tonic" },
  { id: "archlabs", label: "Arch Labs" },
  { id: "turbo", label: "Ticket Turbo" },
];

export const MASKS: { id: BotMask; label: string }[] = [
  { id: "none", label: "No mask" },
  { id: "lantern", label: "Lantern Mask" },
  { id: "hockey", label: "Hockey Mask" },
];

export const WEAPON_SKINS: { id: BotWeaponSkin; label: string }[] = [
  { id: "none", label: "No weapon skin" },
  { id: "hockey-machete", label: "Hockey Mask Machete" },
];

export const DECALS: { id: BotDecal; label: string }[] = [
  ...BASE_DECALS,
  ...BASE_DECALS.filter((row) => row.id !== "none").map((row) => ({
    id: `${row.id}-foil` as BotDecal,
    label: `${row.label} · foil`,
  })),
];

/** Strip a foil suffix. Unknown ids come back unchanged and not foil. */
export function decalArt(id: string): { art: string; foil: boolean } {
  const foil = id.endsWith("-foil");
  const art = foil ? id.slice(0, -"-foil".length) : id;
  return { art: (STICKER_ART as readonly string[]).includes(art) ? art : id, foil: foil && (STICKER_ART as readonly string[]).includes(art) };
}

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

/** LED strip colors, one per weekly metric. */
export const LEDS: Record<Exclude<BotLeds, "none">, { label: string; hex: string }> = {
  nsnu: { label: "NSNU gold", hex: "#ffd23a" },
  conv: { label: "Conv green", hex: "#3dff8a" },
  demoRate: { label: "Demo blue", hex: "#3fb4ff" },
  demoClose: { label: "Close ember", hex: "#ff6a2a" },
  arch: { label: "Arch violet", hex: "#c46bff" },
  ticket: { label: "Ticket pink", hex: "#ff4fa3" },
};

/** Smoke colors. Locker paints plus knockout black. rgb feeds the particle renderer. */
export const SMOKE: Record<Exclude<BotSmoke, "">, { label: string; hex: string; rgb: string }> = {
  neon: { label: "Neon smoke", hex: "#39ff6a", rgb: "57,255,106" },
  candy: { label: "Candy smoke", hex: "#e3123f", rgb: "227,18,63" },
  ice: { label: "Glacier smoke", hex: "#bfe8ff", rgb: "191,232,255" },
  royal: { label: "Royal smoke", hex: "#6a2bd9", rgb: "106,43,217" },
  black: { label: "Black smoke", hex: "#2a2c31", rgb: "42,44,49" },
};

export const DEFAULT_STYLE: BotStyle = {
  finish: "factory",
  decal: "none",
  trim: "steel",
  eye: "green",
  flag: false,
  topper: "none",
  leds: "none",
  smoke: "",
  banner: "",
  mask: "none",
  weaponSkin: "none",
};

export function defaultBody(classId: ClassId): BotBody {
  return classId === "tank" ? "keystone" : classId === "specialist" ? "windlass" : "shrike";
}

export type BodyStyle = {
  id: BotBody;
  classId: ClassId;
  label: string;
  starter: boolean;
  note: string;
};
export const BODY_STYLES: BodyStyle[] = [
  {
    id: "shrike",
    classId: "striker",
    label: "Shrike",
    starter: true,
    note: "Low race-bot wedge profile.",
  },
  {
    id: "raptor",
    classId: "striker",
    label: "Raptor",
    starter: true,
    note: "Long nose, exposed shoulders.",
  },
  {
    id: "stinger",
    classId: "striker",
    label: "Stinger",
    starter: true,
    note: "Narrow, angular and mean.",
  },
  {
    id: "viper",
    classId: "striker",
    label: "Viper",
    starter: false,
    note: "Full Tune-Up reward shell.",
  },
  {
    id: "warhawk",
    classId: "striker",
    label: "Warhawk",
    starter: false,
    note: "Conference Champion shell.",
  },
  {
    id: "keystone",
    classId: "tank",
    label: "Keystone",
    starter: true,
    note: "Classic armored block.",
  },
  {
    id: "juggernaut",
    classId: "tank",
    label: "Juggernaut",
    starter: true,
    note: "Wide shoulders and heavy stance.",
  },
  {
    id: "bunker",
    classId: "tank",
    label: "Bunker",
    starter: true,
    note: "Low enclosed armor shell.",
  },
  {
    id: "fortress",
    classId: "tank",
    label: "Fortress",
    starter: false,
    note: "Full Tune-Up reward shell.",
  },
  {
    id: "colossus",
    classId: "tank",
    label: "Colossus",
    starter: false,
    note: "Conference Champion shell.",
  },
  {
    id: "windlass",
    classId: "specialist",
    label: "Windlass",
    starter: true,
    note: "Industrial grappler profile.",
  },
  {
    id: "scorpion",
    classId: "specialist",
    label: "Scorpion",
    starter: true,
    note: "Forward pincers and raised deck.",
  },
  {
    id: "mantis",
    classId: "specialist",
    label: "Mantis",
    starter: true,
    note: "Tall front arms and cut waist.",
  },
  {
    id: "phantom",
    classId: "specialist",
    label: "Phantom",
    starter: false,
    note: "Full Tune-Up reward shell.",
  },
  {
    id: "reaper",
    classId: "specialist",
    label: "Reaper",
    starter: false,
    note: "Conference Champion shell.",
  },
];

export const TOPPERS: { id: BotTopper; label: string }[] = [
  { id: "none", label: "None" },
  { id: "antenna", label: "Whip antenna" },
  { id: "horns", label: "Pit horns" },
  { id: "mohawk", label: "Steel mohawk" },
  { id: "crown", label: "Champion crown" },
  { id: "beacon", label: "Beacon" },
  { id: "dish", label: "Satellite dish" },
  { id: "flagpole", label: "Flag pole" },
];

export function bodyStyle(id: string | undefined) {
  return BODY_STYLES.find((row) => row.id === id);
}
export function starterBodies(classId?: ClassId) {
  return BODY_STYLES.filter((row) => row.starter && (!classId || row.classId === classId));
}
export function styleOf(
  source: { style?: Partial<BotStyle>; classId?: ClassId } | null | undefined,
  classId?: ClassId,
): BotStyle {
  const cls = classId ?? source?.classId ?? "striker";
  const style = { ...DEFAULT_STYLE, body: source?.style?.body ?? defaultBody(cls), ...(source?.style ?? {}) };
  const stickers = { left: "none" as const, right: "none" as const, hood: style.decal, rear: "none" as const, ...style.stickers };
  const leds = style.leds && style.leds in LEDS ? style.leds : "none";
  const smoke = style.smoke && style.smoke in SMOKE ? style.smoke : "";
  const rawBanner = typeof style.banner === "string" ? style.banner : "";
  const judged = bannerVerdict(rawBanner);
  const banner = judged.ok ? judged.text : "";
  return { ...style, decal: stickers.hood, stickers, leds, smoke, banner };
}

/** Inclusive month/day window inside the 2026 season, Central time. */
export type PartWindow = { start: [number, number]; end: [number, number] };

/** A chassis likes one class, and one other slot when that slot is a listed family. */
export type Affinity = {
  classId?: ClassId;
  slot?: "drive" | "weapon" | "armor" | "utility";
  families?: string[];
};

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
  /** Coins from this part's own jar. */
  price: number;
  /** Green weeks of this part's own stat required before it can be bought. */
  greenWeeks?: number;
  /** Those green weeks have to be the most recent ones, with no break. */
  straight?: boolean;
  /** Shop window. Absent means the peg is up all season. */
  window?: PartWindow;
  /** Chassis stamina. Omitted chassis use the stock battery. */
  battery?: number;
  /** Build-fit override for a price that is off the 3/5/8 ladder. */
  fit?: number;
  affinity?: Affinity;
};

function nudge(power = 0, speed = 0, armor = 0, heat = 0): Part["nudge"] {
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
  nudges?: Partial<Record<Tier, Part["nudge"]>>;
  prices?: Partial<Record<Tier, number>>;
  gates?: Partial<Record<Tier, { weeks: number; straight?: boolean }>>;
  windows?: Partial<Record<Tier, PartWindow>>;
  batteries?: Partial<Record<Tier, number>>;
  fits?: Partial<Record<Tier, number>>;
  affinity?: Affinity;
};

/**
 * Coin prices. A green week pays 3 into that metric's jar, and each green
 * after the first adds one pair-bonus coin. Six greens pay 23. Reactor is
 * priced at 12, which is four plain green payouts before the pair bonus.
 */
export const TIER_PRICE: Record<Tier, number> = {
  stock: 0,
  sport: 3,
  pro: 5,
  super: 8,
  championship: 0,
};

/** Coins a grade pays into its part's jar. */
export const GRADE_COINS: Record<"green" | "blue" | "orange" | "red", number> = {
  green: 3,
  blue: 2,
  orange: 1,
  red: 0,
};

/** Repair bills, from the damaged part's own jar. */
export const REPAIR_PRICE = { scratched: 1, bent: 2, disabled: 4, weld: 1 } as const;

export type Metric = {
  stat: StatKey;
  slot: KeyName;
  label: string;
  short: string;
  /** Lowest value for green, blue, orange. Below orange is red. */
  bands: [number, number, number];
  format: (n: number) => string;
  step: number;
};

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const pct = (n: number) => `${Math.round(n)}%`;

/** The six weekly numbers, the part each one feeds, and the grade bands. */
export const METRICS: Metric[] = [
  {
    stat: "nsnu",
    slot: "chassis",
    label: "NSNU",
    short: "NSNU",
    bands: [1000, 900, 800],
    format: money,
    step: 1,
  },
  {
    stat: "conv",
    slot: "armor",
    label: "Conv %",
    short: "Conv",
    bands: [64, 56, 47],
    format: pct,
    step: 1,
  },
  {
    stat: "demoRate",
    slot: "drive",
    label: "Demo Rate",
    short: "Demo",
    bands: [88, 80, 72],
    format: pct,
    step: 1,
  },
  {
    stat: "demoClose",
    slot: "weapon",
    label: "Demo Close %",
    short: "Close",
    bands: [73, 70, 65],
    format: pct,
    step: 1,
  },
  {
    stat: "arch",
    slot: "utility",
    label: "Arch Supports",
    short: "Arch",
    bands: [3.8, 3.0, 2.5],
    format: (n) => n.toFixed(1),
    step: 0.1,
  },
  {
    stat: "ticket",
    slot: "brain",
    label: "Demo Ticket Avg",
    short: "Ticket",
    bands: [1800, 1600, 1400],
    format: money,
    step: 1,
  },
];

export function metricFor(stat: StatKey): Metric {
  return METRICS.find((m) => m.stat === stat)!;
}

export function metricForSlot(slot: KeyName): Metric {
  return METRICS.find((m) => m.slot === slot)!;
}

/** "Green 1,000+ · Blue 900–999 …" for any metric. */
export function bandText(m: Metric) {
  const [g, b, o] = m.bands;
  const dec = m.step < 1;
  const minus = (n: number) => (dec ? (n - 0.1).toFixed(1) : String(n - 1));
  const f = (n: number) =>
    m.format === money
      ? `$${n.toLocaleString("en-US")}`
      : m.format === pct
        ? `${n}%`
        : dec
          ? n.toFixed(1)
          : String(n);
  const fm = (n: string) =>
    m.format === money ? `$${Number(n).toLocaleString("en-US")}` : m.format === pct ? `${n}%` : n;
  return {
    green: `${f(g)}+`,
    blue: `${f(b)}–${fm(minus(g))}`,
    orange: `${f(o)}–${fm(minus(b))}`,
    red: `under ${f(o)}`,
  };
}

/** Which weekly number fills which part's coin jar. */
export const KEY_SOURCE: Record<KeyName, { stat: StatKey; label: string; green: string }> =
  Object.fromEntries(
    METRICS.map((m) => [m.slot, { stat: m.stat, label: m.label, green: bandText(m).green }]),
  ) as Record<KeyName, { stat: StatKey; label: string; green: string }>;

export const KEY_ORDER: KeyName[] = ["chassis", "drive", "weapon", "armor", "utility", "brain"];

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
      championship: "Title vice. Salvage or a Championship Saturday drop. Never a price tag.",
    },
  },
  {
    slot: "drive",
    family: "mag",
    stat: "demoRate",
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
    stat: "demoRate",
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
    stat: "demoRate",
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
    stat: "demoRate",
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
    stat: "demoClose",
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
    stat: "demoClose",
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
    stat: "demoClose",
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
    stat: "demoClose",
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
    stat: "demoClose",
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
    stat: "demoClose",
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
    stat: "conv",
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
      stock: "Flat plate. Conversion armor starts here.",
      sport: "Thicker where the saw usually looks.",
      pro: "Plate for a ticket average that can carry it.",
      super: "A vault. They hit it. The number does not move.",
      championship: "Title safe. The combination is the week.",
    },
  },
  {
    slot: "armor",
    family: "skirt",
    stat: "conv",
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
    stat: "conv",
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
    stat: "conv",
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
    stat: "arch",
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
    stat: "arch",
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
    stat: "arch",
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
      stock: "The cage leans your way. Arch supports put bodies in the seats.",
      sport: "Louder section. The judges hear it.",
      pro: "A magnet built from names, not noise.",
      super: "You are the house. The other bot is visiting.",
      championship: "Title crowd. Sold out, and they know the bot's name.",
    },
  },
  {
    slot: "utility",
    family: "weld",
    stat: "arch",
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
      stock:
        "A bead in the fight. A little health comes back every exchange. It does not pay a repair quote.",
      sport: "Cleaner bead. The crew already did the work on Saturday.",
      pro: "Weld for a garage that does not panic at the quote.",
      super: "Crew Chief on the rail. The bot fights like somebody has the clipboard.",
      championship: "Title weld. Overtime, and the bead holds.",
    },
  },
  {
    slot: "utility",
    family: "scry",
    stat: "arch",
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
      stock:
        "Underdog read. See their tier, or their class and weapon family. In the cage, a bot that is behind hits a little cleaner.",
      sport: "A clearer read. Still worthless if you are already the bully.",
      pro: "The scry a quiet store uses to pick the counter.",
      super: "Blueprint. You fight the drawing, not the rumor.",
      championship: "Title tell. You knew the lock before the bell.",
    },
  },
  {
    slot: "brain",
    family: "logic",
    stat: "ticket",
    key: "brain",
    tags: ["smart"],
    nudge: nudge(0, 0, 0, 0),
    names: {
      stock: "Logic Board",
      sport: "Sport Logic",
      pro: "Pro Targeting Core",
      super: "Battle Mind",
      championship: "The Oracle — Title",
    },
    jobs: {
      stock:
        "Defensive. Reads the cage and stays off the hazards. A higher tier reads them better. It does not change Power, Speed, Armor or Heat.",
      sport: "Picks a side and stays on it. Fewer wasted charges.",
      pro: "Tracks the weapon, not the paint. Hits land where they count.",
      super: "Plans three moves out. The other driver feels slow.",
      championship: "Title brain. It already knows how this ends.",
    },
  },
  {
    slot: "brain",
    family: "hunter",
    stat: "ticket",
    key: "brain",
    tags: ["smart", "aggro"],
    nudge: nudge(0, 0, 0, 0),
    names: {
      stock: "Hunter Chip",
      sport: "Sport Hunter",
      pro: "Pro Hunter",
      super: "Apex Predator",
      championship: "Apex — Title",
    },
    jobs: {
      stock:
        "Aggressive. Goes for the closest bot and will cross a saw to do it. A higher tier hits cleaner. It does not change the four printed numbers.",
      sport: "Smells a bent wheel from across the cage.",
      pro: "Finds the gap in the armor and keeps hitting it.",
      super: "Never lets go. Never backs off. Costs armor to run.",
      championship: "Title hunter. Nothing walks out of the cage clean.",
    },
  },
  {
    slot: "weapon",
    family: "chainsaw",
    stat: "demoClose",
    key: "weapon",
    tags: ["speed", "saw", "halloween"],
    nudge: nudge(4, 1, -2, 0),
    names: { super: "Texas Chainsaw" },
    jobs: {
      super: "A parade saw with a loud first bite. It bogs down when the other bot is wearing more plate. On the peg November 1 through Championship Saturday. Eight weapon coins.",
    },
  },
  {
    slot: "weapon",
    family: "slasher",
    stat: "demoClose",
    key: "weapon",
    tags: ["speed", "halloween"],
    nudge: nudge(2, 3, -2, 0),
    names: { super: "Slasher Blade" },
    jobs: {
      super: "A long kitchen blade. The lunge lands when you are already faster. If you are not, it is just a late swing. November 1 through Championship Saturday. Eight weapon coins.",
    },
  },
  {
    slot: "weapon",
    family: "ghost",
    stat: "demoClose",
    key: "weapon",
    tags: ["heat", "halloween"],
    nudge: nudge(2, 2, -3, 2),
    names: { super: "Ghost Blade" },
    jobs: {
      super: "A pale blade that slips partway through plate and leaves a light trail. Without Heat it fades. November 1 through Championship Saturday. Eight weapon coins.",
    },
  },
  {
    slot: "weapon",
    family: "launcher",
    stat: "demoClose",
    key: "weapon",
    tags: ["smash", "halloween"],
    nudge: nudge(3, -2, 0, 1),
    names: { super: "Pumpkin Launcher" },
    jobs: {
      super: "Lobs a pumpkin into the middle exchange. The first swing is the wind-up. November 1 through Championship Saturday. Eight weapon coins.",
    },
  },
  {
    slot: "weapon",
    family: "bones",
    stat: "demoClose",
    key: "weapon",
    tags: ["control", "claw", "heat", "halloween"],
    nudge: nudge(0, 0, -1, 4),
    names: { super: "Skeleton Claws" },
    jobs: {
      super: "A rattling grapple. It can still walk someone to the edge, and it likes strikers more than tanks. Less Heat than Lockjaw. November 1 through Championship Saturday. Eight weapon coins.",
    },
  },
  {
    slot: "weapon",
    family: "broom",
    stat: "demoClose",
    key: "weapon",
    tags: ["heat", "halloween"],
    nudge: nudge(1, 2, 0, 2),
    names: { super: "Witch's Broom" },
    jobs: {
      super: "A broom that plants like a staff when your Heat is up. Until then it is a broom. November 1 through Championship Saturday. Eight weapon coins.",
    },
  },
  {
    slot: "chassis",
    family: "pumpkin",
    stat: "nsnu",
    key: "chassis",
    tags: ["armor", "halloween"],
    nudge: nudge(2, -1, 4, -2),
    names: { super: "Pumpkin Chassis" },
    jobs: {
      super: "A round festive shell for any class. It shrugs the first bite and swings a little softer all night. It does not change your class. November 1 through Championship Saturday. Eight chassis coins.",
    },
  },
  {
    slot: "drive",
    family: "ghostchaser",
    stat: "demoRate",
    key: "drive",
    tags: ["speed", "halloween"],
    nudge: nudge(0, 3, -2, 1),
    names: { super: "Ghost Chaser" },
    jobs: {
      super: "A light-bar chase wagon with round lamps. It closes on a slower bot and gives up plate to do it. November 1 through Championship Saturday. Eight drive coins.",
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
      const gate = family.gates?.[tier];
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
        nudge: family.nudges?.[tier] ?? family.nudge,
        price: family.prices?.[tier] ?? TIER_PRICE[tier],
        greenWeeks: gate?.weeks,
        straight: gate?.straight,
        window: family.windows?.[tier],
        battery: family.batteries?.[tier],
        fit: family.fits?.[tier],
        affinity: family.affinity,
      });
    });
  }
  return parts;
}

export const PARTS: Part[] = [...buildParts(), ...ROSTER_PARTS];

/** Stamina on a chassis that does not name its own battery. */
export const STOCK_BATTERY = 64;

export function batteryOf(part: Part | null | undefined): number {
  if (!part || part.slot !== "chassis") return STOCK_BATTERY;
  return part.battery ?? STOCK_BATTERY;
}

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
    striker: { drive: "mag", weapon: "saw", armor: "plate", brain: "hunter" },
    tank: { drive: "treads", weapon: "wedge", armor: "plate", brain: "logic" },
    specialist: { drive: "omni", weapon: "claw", armor: "cage", brain: "logic" },
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
  brain: "Brain",
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
