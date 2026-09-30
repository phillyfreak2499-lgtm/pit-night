export type ClassId = "striker" | "tank" | "specialist";
export type Slot = "chassis" | "drive" | "weapon" | "armor" | "utility";
export type Tier = "stock" | "sport" | "pro" | "super" | "championship";
export type Grade = "green" | "blue" | "orange" | "red";
export type Condition = "clean" | "scratched" | "bent" | "disabled";
export type Phase = "open" | "locked" | "fought" | "inspected" | "complete";
export type StatKey = "demo" | "close" | "nsnu" | "reviews" | "ticket";
export type KeyName = "chassis" | "drive" | "weapon" | "armor" | "utility";
export type BoutKind = "bout" | "bye" | "tag" | "semi" | "final" | "melee";
export type Method = "ko" | "dump" | "decision" | "melee" | "scrimmage" | "bye";
export type GarageLook = "hazard" | "concrete" | "night" | "bone" | "checker";
export type BotLook = "plain" | "stripe" | "chevron" | "rivets";

export type StatBlock = {
  power: number;
  speed: number;
  armor: number;
  heat: number;
};

export type Store = {
  id: string;
  name: string;
  region: string;
  captain: string;
  passcode: string;
  paint: string;
  garage: GarageLook;
  seed: number;
  /** Weekly NSNU goal. Desk only — never shown as units on the floor. */
  nsnuGoal: number;
};

export type Crew = {
  id: string;
  storeId: string;
  name: string;
  role: "captain" | "specialist";
};

export type Loadout = {
  chassis: string;
  drive: string;
  weapon: string;
  armor: string;
  utility: string | null;
};

export type Bot = {
  id: string;
  storeId: string;
  name: string;
  classId: ClassId;
  scrap: number;
  /** Repair-only scrap. Does not sit in the bank cap. */
  voucher: number;
  repairSpent: number;
  owned: string[];
  keys: Record<KeyName, number>;
  greens: Record<StatKey, number>;
  wear: Record<Slot, Condition>;
  /** Condition stored on the part itself, so a swap does not move the scar. */
  partWear: Record<string, Condition>;
  equipped: Loadout;
  /** Friday draft. Becomes the lock. */
  draft: Loadout;
  locked: Loadout | null;
  /** Week number whose Saturday the emergency weld covers. */
  weldForWeek: Partial<Record<Slot, number>>;
  look: BotLook;
  /** Bay number painted on the bot. Decoration, not a stat. */
  number: string;
};

export type StoreCard = {
  id: string;
  storeId: string;
  week: number;
  demoPct: number;
  closePct: number;
  /** Percent of the printed goal, before proration. */
  nsnuPct: number;
  /** 1 full week, 0.5 means the commissioner cut the goal in half. */
  prorate: number;
  reviews: number;
  crewOnClock: number;
  formerTicket: number;
  projected: boolean;
};

export type Exchange = {
  index: number;
  attackerId: string;
  defenderId: string;
  damage: number;
  attackerHp: number;
  defenderHp: number;
  call: string;
  tags: string[];
};

export type FighterSnap = {
  id: string;
  name: string;
  storeName: string;
  classId: ClassId;
  paint: string;
  botName: string;
  stats: StatBlock;
  rating: number;
  fit: number;
  weekQ: number;
  weaponFamily: string;
  weaponName: string;
  driveName: string;
  armorName: string;
  utilityName: string | null;
  chassisName: string;
  look: BotLook;
  number: string;
};

export type FightResult = {
  winnerIds: string[];
  loserIds: string[];
  method: Method;
  blowout: boolean;
  exchanges: Exchange[];
  finisher: { by: string; against: string; damage: number; call: string } | null;
  hp: Record<string, number>;
  fighters: FighterSnap[];
  wear: Record<string, Record<Slot, Condition>>;
  seed: string;
  meleeOrder?: string[];
};

export type Bout = {
  id: string;
  week: number;
  slot: number;
  kind: BoutKind;
  title: string;
  storeIds: string[];
  teamA: string[];
  teamB: string[];
  result: FightResult | null;
};

export type GazetteEntry = {
  id: string;
  week: number;
  boutId: string | null;
  kicker: string;
  headline: string;
  body: string;
};

export type WeekMeta = {
  number: number;
  name: string;
  blurb: string;
  tagsEnabled: boolean;
};

export type Quote = {
  slot: Slot;
  partId: string;
  partName: string;
  condition: Condition;
  repairCost: number;
  weldCost: number | null;
  salvageScrap: number | null;
  crown: boolean;
  line: string;
};

export type Proposal = {
  id: string;
  storeId: string;
  crewId: string;
  crewName: string;
  partId: string;
  note: string;
};

export type Mvp = {
  week: number;
  storeId: string;
  crewId: string;
  name: string;
};

export type Honors = {
  pitBelt: string | null;
  plate: string | null;
  bestBuild: string | null;
  bestBuildWhy: string;
  titleDrop: string | null;
};

export type Intel = {
  week: number;
  from: string;
  target: string;
  signature: string;
  tier: Tier;
  lines: string[];
  /** Weapon family the bay called before the read. Empty on looks taken before calls. */
  guess: string;
};

export type Session = {
  role: "public" | "crew" | "captain" | "commissioner";
  storeId: string | null;
  crewId: string | null;
};

export type PitData = {
  version: number;
  seasonName: string;
  tagline: string;
  pin: string;
  week: number;
  phase: Phase;
  stores: Store[];
  crew: Crew[];
  bots: Bot[];
  weeks: WeekMeta[];
  storeCards: StoreCard[];
  bouts: Bout[];
  gazette: GazetteEntry[];
  quotes: Record<string, Quote[]>;
  proposals: Proposal[];
  mvps: Mvp[];
  honors: Honors;
  craft: { week: number; storeId: string; score: number }[];
  session: Session;
  log: string[];
  tutorialSeen: boolean;
  intel: Intel[];
};
