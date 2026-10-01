import { stockPart, VERSION } from "./catalog";
import type { Bot, BotLook, ClassId, Crew, GarageLook, Loadout, PitData, Store, StoreCard, WeekMeta } from "./types";

const ZERO_COINS = { chassis: 0, drive: 0, weapon: 0, armor: 0, utility: 0, brain: 0 };
const CLEAN = {
  chassis: "clean" as const,
  drive: "clean" as const,
  weapon: "clean" as const,
  armor: "clean" as const,
  utility: "clean" as const,
  brain: "clean" as const,
};

type Row = {
  id: string;
  name: string;
  region: string;
  paint: string;
  garage: GarageLook;
  look: BotLook;
  number: string;
  seed: number;
  goal: number;
  captain: string;
  crew: string[];
  bot: string;
  classId: ClassId;
  drive: string;
  weapon: string;
  armor: string;
  /** NSNU $, Conv %, Demo Rate %, Demo Close %, Arch Supports, Demo Ticket $. */
  card: [number, number, number, number, number, number];
};

const ROWS: Row[] = [
  {
    id: "waco",
    name: "Waco",
    region: "Central",
    paint: "mud",
    garage: "concrete",
    look: "rivets",
    number: "1",
    seed: 8,
    goal: 13,
    captain: "George Peña",
    crew: ["Hannah Briggs", "Victor Lang", "Esther Cole", "Neil Sharma"],
    bot: "BIG BRIDGE",
    classId: "tank",
    drive: "treads",
    weapon: "hammer",
    armor: "skirt",
    card: [1025, 61, 83, 70, 3.4, 1700],
  },
  {
    id: "arlington",
    name: "Arlington",
    region: "DFW",
    paint: "crimson",
    garage: "hazard",
    look: "stripe",
    number: "2",
    seed: 3,
    goal: 17,
    captain: "Renee Cobb",
    crew: ["Andre Walsh", "Mina Farouk", "Joel Steiner", "Tess Nguyen"],
    bot: "DIVISION",
    classId: "striker",
    drive: "mag",
    weapon: "wedge",
    armor: "plate",
    card: [1175, 68, 89, 73, 2.8, 1750],
  },
  {
    id: "rockwall",
    name: "Rockwall",
    region: "DFW",
    paint: "teal",
    garage: "night",
    look: "chevron",
    number: "3",
    seed: 6,
    goal: 14,
    captain: "Chris Palma",
    crew: ["Anita Desai", "Luis Ortega", "Kenji Mori", "Hope Allen"],
    bot: "ROCK JAW",
    classId: "specialist",
    drive: "omni",
    weapon: "claw",
    armor: "cage",
    card: [980, 58, 81, 69, 3.9, 1590],
  },
  {
    id: "southlake",
    name: "Southlake",
    region: "DFW",
    paint: "bone",
    garage: "bone",
    look: "plain",
    number: "4",
    seed: 1,
    goal: 18,
    captain: "Helen Cho",
    crew: ["Grant Ellis", "Noor Rahman", "Paige Solis", "Brett Young"],
    bot: "SOUTH FORK",
    classId: "tank",
    drive: "treads",
    weapon: "wedge",
    armor: "plate",
    card: [1145, 65, 88, 72, 3.6, 1790],
  },
  {
    id: "college",
    name: "College Station",
    region: "Central",
    paint: "copper",
    garage: "checker",
    look: "stripe",
    number: "5",
    seed: 5,
    goal: 15,
    captain: "Jordan Peck",
    crew: ["Camille Ortiz", "Ben Sato", "Ruth Keller", "Sasha Rahman"],
    bot: "BRAZOS",
    classId: "striker",
    drive: "mag",
    weapon: "saw",
    armor: "angle",
    card: [920, 60, 84, 70, 3.1, 1440],
  },
  {
    id: "hulen",
    name: "Fort Worth — Hulen",
    region: "DFW",
    paint: "olive",
    garage: "hazard",
    look: "chevron",
    number: "6",
    seed: 9,
    goal: 13,
    captain: "Teresa Quinn",
    crew: ["Omar Farley", "Denise Cho", "Pete Navarro", "Willa Grant"],
    bot: "HULEN",
    classId: "tank",
    drive: "treads",
    weapon: "wedge",
    armor: "plate",
    card: [855, 57, 79, 68, 2.7, 1570],
  },
  {
    id: "allen",
    name: "Allen",
    region: "DFW",
    paint: "rust",
    garage: "concrete",
    look: "rivets",
    number: "7",
    seed: 4,
    goal: 20,
    captain: "Marcus Hale",
    crew: ["June Adler", "Theo Park", "Samir Iqbal", "Lila Brooks", "Wes Duran"],
    bot: "DISC COUNTY",
    classId: "tank",
    drive: "treads",
    weapon: "disc",
    armor: "plate",
    card: [1280, 70, 91, 74, 4.1, 1900],
  },
  {
    id: "plano",
    name: "Plano",
    region: "DFW",
    paint: "amber",
    garage: "night",
    look: "stripe",
    number: "8",
    seed: 2,
    goal: 16,
    captain: "Dana Ruiz",
    crew: ["Miles Okonkwo", "Priya Shah", "Cole Brennan", "Erin Voss"],
    bot: "NORTH SAW",
    classId: "striker",
    drive: "mag",
    weapon: "saw",
    armor: "plate",
    card: [1015, 66, 87, 73, 3.5, 1370],
  },
  {
    id: "temple",
    name: "Temple",
    region: "Central",
    paint: "brass",
    garage: "bone",
    look: "plain",
    number: "9",
    seed: 10,
    goal: 12,
    captain: "Robin Gates",
    crew: ["Paulina Varga", "Ike Johnson", "Mara Singh", "Colin Drake"],
    bot: "BELL LOCK",
    classId: "specialist",
    drive: "omni",
    weapon: "claw",
    armor: "cage",
    card: [1110, 48, 73, 64, 3.0, 1350],
  },
  {
    id: "alliance",
    name: "Alliance — Fort Worth",
    region: "DFW",
    paint: "steel",
    garage: "checker",
    look: "chevron",
    number: "10",
    seed: 7,
    goal: 14,
    captain: "Alicia Trent",
    crew: ["Drew Hansen", "Sofia Marin", "Malik Reed", "Bonnie Clark"],
    bot: "RANGE",
    classId: "specialist",
    drive: "omni",
    weapon: "claw",
    armor: "cage",
    card: [960, 54, 78, 67, 3.3, 1480],
  },
  {
    id: "waxahachie",
    name: "Waxahachie",
    region: "Central",
    paint: "gold",
    garage: "concrete",
    look: "stripe",
    number: "11",
    seed: 11,
    goal: 12,
    captain: "Lydia Marsh",
    crew: ["Owen Blake", "Gina Peralta", "Chris Adeyemi", "Holly Nguyen"],
    bot: "CHALK LINE",
    classId: "striker",
    drive: "mag",
    weapon: "drum",
    armor: "angle",
    card: [900, 52, 77, 66, 2.6, 1420],
  },
];

function loadout(classId: ClassId, drive: string, weapon: string, armor: string): Loadout {
  return {
    chassis: stockPart("chassis", classId).id,
    drive: `drive-${drive}-stock`,
    weapon: `weapon-${weapon}-stock`,
    armor: `armor-${armor}-stock`,
    utility: null,
    brain: stockPart("brain", classId).id,
  };
}

function botFrom(row: Row): Bot {
  const gear = loadout(row.classId, row.drive, row.weapon, row.armor);
  return {
    id: `bot-${row.id}`,
    storeId: row.id,
    name: row.bot,
    classId: row.classId,
    voucher: 0,
    repairSpent: 0,
    owned: [],
    coins: { ...ZERO_COINS },
    wear: { ...CLEAN },
    partWear: {},
    equipped: { ...gear },
    draft: { ...gear },
    locked: null,
    weldForWeek: {},
    look: row.look,
    number: row.number,
  };
}

export const WEEK_META: WeekMeta[] = [
  {
    number: 1,
    name: "Shakedown",
    blurb: "Oct 25–31. Locks Saturday at close. Fights Monday Nov 2. Seeded card. One bye, and the bye counts as a win.",
    tagsEnabled: false,
  },
  {
    number: 2,
    name: "Class Night",
    blurb: "Nov 1–7. Locks Saturday at close. Fights Monday Nov 9. The wheel turns. Next seed draws the bye.",
    tagsEnabled: false,
  },
  {
    number: 3,
    name: "Grudge Night",
    blurb: "Nov 8–14. Locks Saturday at close. Fights Monday Nov 16. The wheel turns again. The last-place repair voucher still pays.",
    tagsEnabled: false,
  },
  {
    number: 4,
    name: "Title Monday",
    blurb: "Nov 15–21. Locks Saturday at close. Title fights Monday Nov 23. Best record takes the trophy. A tie fights for it.",
    tagsEnabled: false,
  },
];

export function makeData(): PitData {
  const stores: Store[] = ROWS.map((row) => ({
    id: row.id,
    name: row.name,
    region: row.region,
    captain: row.captain,
    paint: row.paint,
    garage: row.garage,
    seed: row.seed,
  }));

  const crew: Crew[] = ROWS.flatMap((row) => [
    { id: `${row.id}-captain`, storeId: row.id, name: row.captain, role: "captain" as const },
    ...row.crew.map((name, i) => ({
      id: `${row.id}-crew-${i}`,
      storeId: row.id,
      name,
      role: "specialist" as const,
    })),
  ]);

  const storeCards: StoreCard[] = ROWS.map((row) => ({
    id: `${row.id}-w1`,
    storeId: row.id,
    week: 1,
    nsnu: row.card[0],
    conv: row.card[1],
    demoRate: row.card[2],
    demoClose: row.card[3],
    arch: row.card[4],
    demoTicket: row.card[5],
    projected: false,
  }));

  return {
    version: VERSION,
    seasonName: "Period 12",
    tagline: "Oct 25 – Nov 21, 2026. Eleven stores. One trophy.",
    week: 1,
    phase: "open",
    stores,
    crew,
    bots: ROWS.map(botFrom),
    weeks: WEEK_META,
    storeCards,
    bouts: [],
    gazette: [
      {
        id: "g-open",
        week: 1,
        boutId: null,
        kicker: "Shakedown",
        headline: "The bays are numbered. The trophy is not.",
        body: "Period 12 opens October 25. Eleven stores. The first card runs Monday morning, November 2: five fights and a bye, seeded on Period 11. The 1 seed draws the first bye, and a bye counts as a win.",
      },
    ],
    quotes: {},
    proposals: [],
    mvps: [],
    honors: { pitBelt: null, plate: null, bestBuild: null, bestBuildWhy: "", titleDrop: null },
    craft: [],
    session: { role: "public", storeId: null, crewId: null },
    log: ["Period 12 opened. Eleven bays. Oct 25 through Nov 21. Week 1 is seeded. A bye counts as a win."],
    tutorialSeen: false,
    intel: [],
    jobLog: [],
    sparkLog: [],
    shouts: [],
    picks: [],
    trainingOpenAll: false,
    kickoff: { grades: {}, paid: {}, appliedAt: null },
  };
}

export const STORE_IDS = ROWS.map((r) => r.id);
