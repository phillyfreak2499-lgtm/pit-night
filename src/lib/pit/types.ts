export type ClassId = "striker" | "tank" | "specialist";
export type Slot = "chassis" | "drive" | "weapon" | "armor" | "utility" | "brain";
export type Tier = "stock" | "sport" | "pro" | "super" | "championship";
export type Grade = "green" | "blue" | "orange" | "red";
export type Condition = "clean" | "scratched" | "bent" | "disabled";
export type Phase = "open" | "locked" | "fought" | "inspected" | "complete";
/** The six weekly numbers. Each one pays coins to one part of the bot. */
export type StatKey = "nsnu" | "conv" | "demoRate" | "demoClose" | "arch" | "ticket";
/** A coin jar. One per part of the bot. */
export type KeyName = Slot;
export type BoutKind = "bout" | "bye" | "tag" | "semi" | "final" | "melee";
export type Method = "ko" | "dump" | "decision" | "melee" | "scrimmage" | "bye";
export type GarageLook = "hazard" | "concrete" | "night" | "bone" | "checker";
export type BotLook = "plain" | "stripe" | "chevron" | "rivets";
export type BotFinish = "factory" | "chrome" | "matte" | "worn";
export type BotDecal = "none" | "flames" | "lightning" | "teeth" | "checker" | "hazard" | "camo" | "arch";

/** Cosmetics only. None of it touches Power, Speed, Armor, or Heat. */
export type BotStyle = {
  finish: BotFinish;
  decal: BotDecal;
  /** Key into TRIM. Edges, rims, and the flag. */
  trim: string;
  /** Key into EYES. The visor light. */
  eye: string;
  flag: boolean;
  /** Bolt Locker unlocks. Shown on fight day. */
  walkout?: string;
  victory?: string;
};

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
  /** Bolt Locker items this bay owns. */
  unlocks?: string[];
  boltsSpent?: number;
};

export type Crew = {
  id: string;
  storeId: string;
  name: string;
  role: "captain" | "specialist";
  /** Weeks the captain marked this person off. They do not count against the Full Tune-Up. */
  offWeeks?: number[];
};

export type Loadout = {
  chassis: string;
  drive: string;
  weapon: string;
  armor: string;
  utility: string | null;
  /** How smart the bot is. Fed by Demo Ticket Avg. */
  brain: string;
};

export type Bot = {
  id: string;
  storeId: string;
  name: string;
  classId: ClassId;
  /** Repair-only credit, any part. Last place gets it. */
  voucher: number;
  repairSpent: number;
  owned: string[];
  /** One coin jar per part. Green pays 3, blue 2, orange 1. Spent on that part only. */
  coins: Record<KeyName, number>;
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
  /** Older saves do not have it. Read through styleOf(). */
  style?: BotStyle;
};

export type StoreCard = {
  id: string;
  storeId: string;
  week: number;
  /** Dollars. */
  nsnu: number;
  /** Percent. */
  conv: number;
  /** Percent. */
  demoRate: number;
  /** Percent. */
  demoClose: number;
  /** Arch supports per sale. */
  arch: number;
  /** Dollars. */
  demoTicket: number;
  projected: boolean;
  /** Colors the desk clicked in. Beat the typed number for that metric. */
  grades?: Partial<Record<StatKey, Grade>>;
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
  style?: BotStyle;
  /** Brain tier, for the sensor dome. */
  brainTier?: Tier;
  brainName?: string;
  /** Full Tune-Up this week: every job and Spark done. */
  tuned?: boolean;
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
  /** Pit Week. */
  jobLog: JobEntry[];
  sparkLog: SparkEntry[];
  shouts: Shout[];
  picks: Pick[];
  /** Desk switch: open every training day now, ignoring dates. */
  trainingOpenAll: boolean;
  /** Week 1 kickoff: Period 11 colors pay the first coins and set the seeds. */
  kickoff: Kickoff;
};

export type Kickoff = {
  grades: Record<string, Partial<Record<StatKey, Grade>>>;
  /** Coins already paid per store, so a correction pays only the difference. */
  paid: Record<string, Partial<Record<KeyName, number>>>;
  appliedAt: number | null;
};

export type JobEntry = {
  /** `${week}:${jobId}:${crewId}` */
  id: string;
  week: number;
  jobId: string;
  storeId: string;
  crewId: string;
  crewName: string;
  note: string;
  status: "pending" | "approved";
  at: number;
};

export type SparkEntry = {
  /** `${week}:${day}:${crewId}` */
  id: string;
  week: number;
  day: string;
  storeId: string;
  crewId: string;
  correct: number;
  total: number;
  at: number;
};

export type Shout = {
  id: string;
  week: number;
  storeId: string;
  fromCrewId: string;
  fromName: string;
  to: string;
  text: string;
  at: number;
};

export type Pick = {
  /** `${boutId}:${crewId}` */
  id: string;
  week: number;
  boutId: string;
  storeId: string;
  crewId: string;
  pick: string;
  at: number;
};
