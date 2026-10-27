import type { Affinity, Part, PartWindow } from "./catalog";
import type { Tier } from "./types";
import { THANKSGIVING_WINDOW } from "./thanksgiving";

/** Thanksgiving peg window for the roster ladders below (Nov 24–28). */
const TG: PartWindow = THANKSGIVING_WINDOW;

/**
 * Parts added on top of the original six families per slot.
 * Prices outside 0/3/5/8 are set on the part. Brains here do not nudge stats.
 */

const PRICE: Record<Tier, number> = { stock: 0, sport: 3, pro: 5, super: 8, championship: 0 };

type Row = {
  tier: Tier;
  name: string;
  job: string;
  nudge?: Part["nudge"];
  price?: number;
  greenWeeks?: number;
  straight?: boolean;
  window?: PartWindow;
  battery?: number;
  fit?: number;
};

function ladder(
  slot: Part["slot"],
  family: string,
  stat: Part["stat"],
  tags: string[],
  rows: Row[],
  affinity?: Affinity,
): Part[] {
  return rows.map((row) => ({
    id: `${slot}-${family}-${row.tier}`,
    slot,
    family,
    name: row.name,
    tier: row.tier,
    stat,
    key: slot,
    job: row.job,
    tags,
    nudge: row.nudge ?? { power: 0, speed: 0, armor: 0, heat: 0 },
    price: row.price ?? PRICE[row.tier],
    greenWeeks: row.greenWeeks,
    straight: row.straight,
    window: row.window,
    battery: row.battery,
    fit: row.fit,
    affinity,
  }));
}

const n = (power = 0, speed = 0, armor = 0, heat = 0) => ({ power, speed, armor, heat });

const DRIVES: Part[] = [
  ...ladder(
    "drive",
    "swerve",
    "demoRate",
    ["speed", "dodge"],
    [
      {
        tier: "stock",
        name: "Swerve",
        job: "Pivots in place and changes direction on the spot. Saws miss a bot that can spin out of the lane.",
        nudge: n(0, 2, 0, 0),
      },
      {
        tier: "sport",
        name: "Sport Swerve",
        job: "A tighter pivot. The floor saw gets a smaller bite.",
        nudge: n(0, 3, 0, 0),
      },
      {
        tier: "pro",
        name: "Pro Swerve",
        job: "The bot faces a new direction before the saw finishes a turn.",
        nudge: n(0, 4, 0, 1),
      },
      {
        tier: "super",
        name: "Super Swerve",
        job: "Instant heading. A popping saw is a suggestion.",
        nudge: n(0, 5, 0, 1),
      },
    ],
  ),
  ...ladder(
    "drive",
    "rocket",
    "demoRate",
    ["speed", "burst"],
    [
      {
        tier: "stock",
        name: "Rocket Boost",
        job: "One short burst per match, then the drive overheats.",
        nudge: n(1, 2, 0, 1),
      },
      {
        tier: "sport",
        name: "Sport Rocket",
        job: "A harder first burst. The overheat still comes.",
        nudge: n(1, 3, 0, 1),
      },
      {
        tier: "pro",
        name: "Pro Rocket",
        job: "The opening rush covers the cage. Later exchanges run hot.",
        nudge: n(2, 3, -1, 2),
      },
      {
        tier: "super",
        name: "Super Rocket",
        job: "One violent launch. After that the tires are cooking.",
        nudge: n(2, 4, -1, 2),
      },
    ],
  ),
  ...ladder(
    "drive",
    "anchor",
    "demoRate",
    ["armor", "plant"],
    [
      {
        tier: "stock",
        name: "Anchor",
        job: "Cannot be pushed or flipped. Cannot move, either. It fights from the home pad.",
        nudge: n(0, -3, 3, 0),
      },
      {
        tier: "sport",
        name: "Sport Anchor",
        job: "A deeper spike. Wedges and flip kits waste the shove.",
        nudge: n(1, -3, 4, 0),
      },
      {
        tier: "pro",
        name: "Pro Anchor",
        job: "Planted. The bot gives up the chase and keeps its wheels on the floor.",
        nudge: n(1, -2, 5, 0),
      },
      {
        tier: "super",
        name: "Super Anchor",
        job: "Nothing rolls it. Nothing moves it. Range weapons hate the wait less than it does.",
        nudge: n(2, -2, 6, 0),
      },
    ],
  ),
  ...ladder(
    "drive",
    "air",
    "demoRate",
    ["speed", "hover"],
    [
      {
        tier: "stock",
        name: "Air Cushion",
        job: "A swamp-boat skirt. Crosses land, water and pits without slowing, then slides on a turn.",
        nudge: n(0, 3, 0, 0),
      },
      {
        tier: "sport",
        name: "Sport Cushion",
        job: "More air. Water and the pit are just painted floor. A hard turn still washes out.",
        nudge: n(0, 4, 0, 0),
      },
      {
        tier: "pro",
        name: "Pro Cushion",
        job: "A real hovercraft. Speed is up. Traction on a turn is not.",
        nudge: n(0, 5, 0, 1),
      },
      {
        tier: "super",
        name: "Super Cushion",
        job: "The fastest way across the wet lane, and the easiest bot to sidestep.",
        nudge: n(1, 6, -1, 1),
      },
    ],
  ),
  ...ladder("drive", "haywagon", "demoRate", ["speed", "thanksgiving"], [
    {
      tier: "super",
      name: "Hay Wagon",
      job: "A hay-ride wagon on pit wheels. It closes steady and gives up plate to do it, and it smells faintly of a parade route. Championship Week only. Eight drive coins.",
      nudge: n(1, 3, -2, 0),
      window: TG,
    },
  ]),
];

const WEAPONS: Part[] = [
  ...ladder(
    "weapon",
    "flail",
    "demoClose",
    ["speed", "momentum"],
    [
      {
        tier: "stock",
        name: "Flail",
        job: "A swinging head. Damage climbs with how fast the bot was moving.",
        nudge: n(2, 2, -1, 0),
      },
      {
        tier: "sport",
        name: "Sport Flail",
        job: "A heavier head on the same chain. Momentum still does the work.",
        nudge: n(3, 2, -1, 0),
      },
      {
        tier: "pro",
        name: "Pro Flail",
        job: "The chain stays tight. A fast drive hits harder than a planted one.",
        nudge: n(4, 3, -1, 0),
      },
      {
        tier: "super",
        name: "Wrecking Ball",
        job: "The momentum weapon at full mass. Gel pads blunt the impact. A still bot wastes it.",
        nudge: n(5, 3, -1, 0),
        greenWeeks: 2,
      },
    ],
  ),
  ...ladder(
    "weapon",
    "piston",
    "demoClose",
    ["reach"],
    [
      {
        tier: "stock",
        name: "Piston Lance",
        job: "A long spike. It still reaches a bot that tried to stay away.",
        nudge: n(2, 0, 0, 0),
      },
      {
        tier: "sport",
        name: "Sport Lance",
        job: "More travel. Range is the point.",
        nudge: n(3, 0, 0, 0),
      },
      {
        tier: "pro",
        name: "Pro Lance",
        job: "The poke arrives before the other bot finishes backing up.",
        nudge: n(4, 1, 0, 0),
      },
      {
        tier: "super",
        name: "Impaler",
        job: "The longest reach in the cage. Backing up is not a defense.",
        nudge: n(6, 1, 0, 0),
        greenWeeks: 3,
      },
    ],
  ),
  ...ladder(
    "weapon",
    "flame",
    "demoClose",
    ["heat", "burn"],
    [
      {
        tier: "stock",
        name: "Flamethrower",
        job: "Fire sticks. The foe takes burn after the hit, while your bot builds Heat for its next attack.",
        nudge: n(1, 0, 0, 2),
      },
      {
        tier: "sport",
        name: "Sport Flame",
        job: "A longer burn on the foe. Your bot's Heat keeps climbing after the exchange.",
        nudge: n(2, 0, 0, 3),
      },
      {
        tier: "pro",
        name: "Pro Flame",
        job: "The jet cooks armor that a saw would only scratch.",
        nudge: n(2, 0, 0, 4),
      },
      {
        tier: "super",
        name: "Inferno",
        job: "Burn damage over time on the foe, and a Heat boost for your own bot. Gel does not drink this.",
        nudge: n(3, 0, -1, 6),
        greenWeeks: 3,
      },
    ],
  ),
  ...ladder(
    "weapon",
    "tesla",
    "demoClose",
    ["heat", "stun"],
    [
      {
        tier: "stock",
        name: "Tesla Coil",
        job: "A brief stun, and it pulls charge out of the other bot's battery.",
        nudge: n(2, 0, 0, 1),
      },
      {
        tier: "sport",
        name: "Sport Coil",
        job: "A longer arc. The foe's next swing is late and their battery is lower.",
        nudge: n(2, 1, 0, 2),
      },
      {
        tier: "pro",
        name: "Pro Coil",
        job: "The stun is obvious. So is the sag in their weapon afterward.",
        nudge: n(3, 1, 0, 2),
      },
      {
        tier: "super",
        name: "Storm",
        job: "A hard stun and a deep battery drain. Magnet armor is the counter.",
        nudge: n(4, 1, 0, 3),
        greenWeeks: 4,
      },
    ],
  ),
];

const ARMOR: Part[] = [
  ...ladder(
    "armor",
    "ablative",
    "conv",
    ["armor", "layer"],
    [
      {
        tier: "stock",
        name: "Ablative",
        job: "The first hit sheds a layer. Later hits find a thinner bot.",
        nudge: n(0, 0, 2, 0),
      },
      {
        tier: "sport",
        name: "Sport Ablative",
        job: "A thicker first layer. It is still gone after the opening exchange.",
        nudge: n(0, 0, 3, 0),
      },
      {
        tier: "pro",
        name: "Pro Ablative",
        job: "Opens like a vault and ends like a tin.",
        nudge: n(0, 0, 4, 0),
        greenWeeks: 1,
      },
      {
        tier: "super",
        name: "Onion",
        job: "Layer after layer. The first clean hit barely counts. The third one does.",
        nudge: n(0, -1, 6, 0),
        greenWeeks: 2,
      },
    ],
  ),
  ...ladder(
    "armor",
    "gel",
    "conv",
    ["armor", "impact"],
    [
      {
        tier: "stock",
        name: "Gel Pads",
        job: "Soft iron. Hammers, flails and lances sink in. Fire does not.",
        nudge: n(0, 0, 2, 0),
      },
      {
        tier: "sport",
        name: "Sport Gel",
        job: "Thicker pads. Momentum weapons lose their best inch.",
        nudge: n(0, 0, 3, 0),
      },
      {
        tier: "pro",
        name: "Pro Gel",
        job: "Impact dies in the pad. A flame still cooks it.",
        nudge: n(0, 0, 4, 1),
        greenWeeks: 1,
      },
      {
        tier: "super",
        name: "Jelly Fortress",
        job: "The cage's best answer to a wrecking ball. Bring fire if you want through.",
        nudge: n(0, 0, 5, 1),
        greenWeeks: 2,
      },
    ],
  ),
  ...ladder(
    "armor",
    "chain",
    "conv",
    ["armor", "cut"],
    [
      {
        tier: "stock",
        name: "Chainmail",
        job: "Rings. Saws, drums and discs buy less per tooth.",
        nudge: n(0, 0, 2, 0),
      },
      {
        tier: "sport",
        name: "Sport Mail",
        job: "Tighter rings. A vertical saw works for its dinner.",
        nudge: n(0, 0, 3, 0),
      },
      {
        tier: "pro",
        name: "Pro Mail",
        job: "Cut weapons skate. A hammer does not care.",
        nudge: n(1, 0, 4, 0),
        greenWeeks: 1,
      },
      {
        tier: "super",
        name: "Dragon Scale",
        job: "The saw's worst day. Blunt iron still has a job.",
        nudge: n(1, 0, 6, 0),
        greenWeeks: 3,
      },
    ],
  ),
  ...ladder(
    "armor",
    "spike",
    "conv",
    ["armor", "reflect"],
    [
      {
        tier: "stock",
        name: "Spike Shell",
        job: "Hurts a bot that stays in the pocket. A sniper never hugs it.",
        nudge: n(1, 0, 2, 0),
      },
      {
        tier: "sport",
        name: "Sport Spikes",
        job: "Longer barbs. Closing in is a choice with a bill.",
        nudge: n(1, 0, 3, 0),
      },
      {
        tier: "pro",
        name: "Pro Spikes",
        job: "The pocket fights back.",
        nudge: n(2, 0, 3, 0),
        greenWeeks: 1,
      },
      {
        tier: "super",
        name: "Iron Maiden",
        job: "Anyone who finishes a charge pays for it. Stay long and it is just armor.",
        nudge: n(2, -1, 5, 0),
        greenWeeks: 3,
      },
    ],
  ),
  ...ladder(
    "armor",
    "ceramic",
    "conv",
    ["armor", "brittle"],
    [
      {
        tier: "stock",
        name: "Ceramic",
        job: "Hard first skin. It shatters, and the later exchanges are honest.",
        nudge: n(0, 0, 3, 0),
      },
      {
        tier: "sport",
        name: "Sport Ceramic",
        job: "A cleaner plate. Still a plate, not a lifestyle.",
        nudge: n(0, 0, 4, 0),
      },
      {
        tier: "pro",
        name: "Pro Ceramic",
        job: "The opening hit sounds expensive. The third one sounds cheap.",
        nudge: n(0, 0, 5, 0),
        greenWeeks: 1,
      },
      {
        tier: "super",
        name: "Porcelain Fortress",
        job: "The best first exchange in the armor bay. Do not make it a long night.",
        nudge: n(0, 0, 7, 0),
        greenWeeks: 3,
      },
    ],
  ),
  ...ladder(
    "armor",
    "magnet",
    "conv",
    ["armor", "field"],
    [
      {
        tier: "stock",
        name: "Magnetic Field",
        job: "Tugs metal weapons off line: saws, flails, lances, coils. Flame ignores it.",
        nudge: n(0, 0, 2, 1),
      },
      {
        tier: "sport",
        name: "Sport Field",
        job: "A wider field. Steel arrives late and lighter.",
        nudge: n(0, 0, 3, 1),
      },
      {
        tier: "pro",
        name: "Pro Field",
        job: "Metal jobs pay a tax. Fire is the way around.",
        nudge: n(0, 0, 4, 1),
        greenWeeks: 1,
      },
      {
        tier: "super",
        name: "Lodestone",
        job: "The cage's answer to steel and lightning. A flamethrower does not stick to it.",
        nudge: n(0, 0, 5, 2),
        greenWeeks: 4,
      },
    ],
  ),
  ...ladder(
    "armor",
    "reactive",
    "conv",
    ["armor", "blast"],
    [
      {
        tier: "stock",
        name: "Reactive",
        job: "A big hit blows outward. The attacker wears some of their own shot.",
        nudge: n(1, 0, 2, 0),
      },
      {
        tier: "sport",
        name: "Sport Reactive",
        job: "A sharper tile. Heavy swings come back lighter.",
        nudge: n(1, 0, 3, 0),
      },
      {
        tier: "pro",
        name: "Pro Reactive",
        job: "The harder they swing, the more of it they keep.",
        nudge: n(2, 0, 4, 0),
        greenWeeks: 1,
      },
      {
        tier: "super",
        name: "Blast Shell",
        job: "A real answer to a single huge hit. Chip damage never lights the tile.",
        nudge: n(2, 0, 5, 0),
        greenWeeks: 4,
      },
    ],
  ),
  ...ladder("armor", "platter", "conv", ["armor", "thanksgiving"], [
    {
      tier: "super",
      name: "Serving Platter",
      job: "A broad steel platter that takes the serving so the bot doesn't. Spreads one big hit across the whole table. Championship Week only. Eight armor coins.",
      nudge: n(0, 0, 4, 1),
      window: TG,
    },
  ]),
];

const CHASSIS: Part[] = [
  ...ladder(
    "chassis",
    "hover",
    "nsnu",
    ["speed", "hover"],
    [
      {
        tier: "stock",
        name: "Hover",
        job: "Ignores pits and low obstacles. No grip: it has to commit, and a swerve bolted underneath still slides.",
        nudge: n(0, 1, 0, 0),
        battery: 74,
      },
      {
        tier: "sport",
        name: "Sport Hover",
        job: "More cushion. Pits and popping saws are low. Water is not.",
        nudge: n(0, 2, 0, 0),
        battery: 78,
      },
      {
        tier: "pro",
        name: "Pro Hover",
        job: "A committed line. It does not hop the water, and it does not change its mind.",
        nudge: n(1, 3, 0, 0),
        battery: 82,
      },
      {
        tier: "super",
        name: "Super Hover",
        job: "The cleanest path over the pit. Turns are a promise you already made.",
        nudge: n(1, 4, 1, 0),
        battery: 88,
      },
    ],
  ),
  ...ladder(
    "chassis",
    "spring",
    "nsnu",
    ["control", "launch"],
    [
      {
        tier: "stock",
        name: "Spring",
        job: "One short launch, to escape or to land on somebody. Then a long cooldown.",
        nudge: n(1, 0, 0, 0),
        battery: 60,
      },
      {
        tier: "sport",
        name: "Sport Spring",
        job: "A higher hop. The rest of the match is on the floor.",
        nudge: n(2, 1, 0, 0),
        battery: 62,
      },
      {
        tier: "pro",
        name: "Pro Spring",
        job: "The launch can leave a saw lane or start a fight. It does not come back soon.",
        nudge: n(2, 1, 1, 0),
        battery: 66,
      },
      {
        tier: "super",
        name: "Super Spring",
        job: "One real ambush. After that the springs are just decoration until the bell.",
        nudge: n(3, 2, 1, 0),
        battery: 70,
      },
    ],
  ),
  ...ladder(
    "chassis",
    "skeleton",
    "nsnu",
    ["speed", "thin"],
    [
      {
        tier: "super",
        name: "Skeleton",
        job: "Halloween chassis, on the peg all season. Hard to hit and erratic, and thin: the mirror of Glass Ghost. Glass Ghost's numbers are not these numbers.",
        nudge: n(0, 3, -3, 0),
        battery: 52,
      },
    ],
  ),
  ...ladder(
    "chassis",
    "sprinter",
    "nsnu",
    ["speed"],
    [
      {
        tier: "sport",
        name: "Sprinter",
        job: "A dart chassis. 5 NSNU coins and 1 green NSNU week. Light battery, loves a speed drive. Fast early, thin late.",
        nudge: n(1, 5, -1, 0),
        price: 5,
        greenWeeks: 1,
        battery: 72,
        fit: 0.12,
      },
    ],
    { classId: "striker", slot: "drive", families: ["mag", "swerve", "rocket", "air", "ghostchaser"] },
  ),
  ...ladder(
    "chassis",
    "hornet",
    "nsnu",
    ["speed"],
    [
      {
        tier: "sport",
        name: "Hornet",
        job: "5 NSNU coins and 1 green NSNU week. A stinger body that likes a fast weapon. The battery is not a long one.",
        nudge: n(2, 4, -1, 1),
        price: 5,
        greenWeeks: 1,
        battery: 70,
        fit: 0.12,
      },
    ],
    { classId: "striker", slot: "weapon", families: ["saw", "disc", "flail", "chainsaw"] },
  ),
  ...ladder(
    "chassis",
    "hybrid",
    "nsnu",
    ["heat"],
    [
      {
        tier: "pro",
        name: "Hybrid",
        job: "6 NSNU coins and 2 green NSNU weeks. Split hull. Likes a utility and pays the battery back slower than a sprinter.",
        nudge: n(1, 1, 1, 2),
        price: 6,
        greenWeeks: 2,
        battery: 86,
        fit: 0.15,
      },
    ],
    {
      classId: "specialist",
      slot: "utility",
      families: ["burn", "scry", "leech", "medbay", "grapple", "spotlight"],
    },
  ),
  ...ladder(
    "chassis",
    "dynamo",
    "nsnu",
    ["heat"],
    [
      {
        tier: "pro",
        name: "Dynamo",
        job: "6 NSNU coins and 2 green NSNU weeks. A coil body. Likes a heat weapon and holds a deeper battery.",
        nudge: n(1, 0, 1, 3),
        price: 6,
        greenWeeks: 2,
        battery: 90,
        fit: 0.15,
      },
    ],
    { classId: "specialist", slot: "weapon", families: ["claw", "flame", "tesla"] },
  ),
  ...ladder(
    "chassis",
    "scorpion",
    "nsnu",
    ["heat"],
    [
      {
        tier: "pro",
        name: "Scorpion",
        job: "7 NSNU coins and 2 green NSNU weeks. Tail chassis. Likes a claw or a lance. Battery sits in the middle of the pack.",
        nudge: n(2, 1, 0, 3),
        price: 7,
        greenWeeks: 2,
        battery: 84,
        fit: 0.17,
      },
    ],
    { classId: "specialist", slot: "weapon", families: ["claw", "piston"] },
  ),
  ...ladder(
    "chassis",
    "crab",
    "nsnu",
    ["armor"],
    [
      {
        tier: "pro",
        name: "Crab",
        job: "7 NSNU coins and 2 green NSNU weeks. Wide shell. Likes armor and does not like being rushed.",
        nudge: n(1, -1, 4, 0),
        price: 7,
        greenWeeks: 2,
        battery: 92,
        fit: 0.17,
      },
    ],
    {
      classId: "tank",
      slot: "armor",
      families: ["plate", "ablative", "ceramic", "reactive", "spike"],
    },
  ),
  ...ladder(
    "chassis",
    "capacitor",
    "nsnu",
    ["speed"],
    [
      {
        tier: "super",
        name: "Capacitor",
        job: "8 NSNU coins and 3 green NSNU weeks. Twin cells. Likes a utility and spends its big battery late.",
        nudge: n(2, 2, 1, 1),
        price: 8,
        greenWeeks: 3,
        battery: 104,
        fit: 0.22,
      },
    ],
    {
      classId: "striker",
      slot: "utility",
      families: ["burn", "spotlight", "mirror", "uv"],
    },
  ),
  ...ladder(
    "chassis",
    "mule",
    "nsnu",
    ["armor"],
    [
      {
        tier: "super",
        name: "Mule",
        job: "8 NSNU coins and 3 green NSNU weeks. A cargo box. Likes plate and ablative, and it is still there in the third exchange.",
        nudge: n(2, -2, 5, 0),
        price: 8,
        greenWeeks: 3,
        battery: 100,
        fit: 0.22,
      },
    ],
    { classId: "tank", slot: "armor", families: ["plate", "ablative", "chain", "ceramic"] },
  ),
  ...ladder(
    "chassis",
    "monolith",
    "nsnu",
    ["armor"],
    [
      {
        tier: "super",
        name: "Monolith",
        job: "10 NSNU coins and 3 green NSNU weeks. A slab. Three greens pay 9 coins, so the jar also needs one more coin from another week.",
        nudge: n(2, -2, 7, 0),
        price: 10,
        greenWeeks: 3,
        battery: 114,
        fit: 0.26,
      },
    ],
    { classId: "tank", slot: "armor", families: ["plate", "ceramic", "reactive", "magnet"] },
  ),
  ...ladder(
    "chassis",
    "reactor",
    "nsnu",
    ["heat", "armor"],
    [
      {
        tier: "super",
        name: "Reactor",
        job: "12 NSNU coins and 4 straight green NSNU weeks. The deepest battery and the strongest chassis iron. Four greens pay exactly 12.",
        nudge: n(4, 2, 4, 2),
        price: 12,
        greenWeeks: 4,
        straight: true,
        battery: 132,
        fit: 0.32,
      },
    ],
  ),
];

const UTILITIES: Part[] = [
  ...ladder(
    "utility",
    "spotlight",
    "arch",
    ["read"],
    [
      {
        tier: "sport",
        name: "Spotlight",
        job: "Puts light on the other bot. Cuts through a smoke screen, decoys, veils, blackouts and jammed aim. No damage of its own.",
        nudge: n(0, 1, 0, 1),
      },
    ],
  ),
  ...ladder(
    "utility",
    "decoy",
    "arch",
    ["read"],
    [
      {
        tier: "sport",
        name: "Decoy",
        job: "A false bot. Attacks that were aimed true land softer, until a spotlight or UV lamp is on.",
        nudge: n(0, 1, 1, 0),
      },
    ],
  ),
  ...ladder(
    "utility",
    "oil",
    "arch",
    ["control"],
    [
      {
        tier: "sport",
        name: "Oil Slick",
        job: "The other drive loses traction. Swerve, air, omni and mag all pay for the puddle.",
        nudge: n(0, 2, 0, 0),
      },
    ],
  ),
  ...ladder(
    "utility",
    "medbay",
    "arch",
    ["repair"],
    [
      {
        tier: "pro",
        name: "Med Bay",
        job: "Between exchanges, a little health comes back. The reinforced bay also adds Armor to the printed build.",
        nudge: n(0, 0, 2, 0),
      },
    ],
  ),
  ...ladder(
    "utility",
    "leech",
    "arch",
    ["heat"],
    [
      {
        tier: "pro",
        name: "Leech",
        job: "On a hit, it steals heat from the other bot and adds it to yours.",
        nudge: n(0, 0, 0, 2),
      },
    ],
  ),
  ...ladder(
    "utility",
    "tremor",
    "arch",
    ["control"],
    [
      {
        tier: "pro",
        name: "Tremor",
        job: "Shakes the floor. Bots that are not hovering or on an air cushion stumble.",
        nudge: n(1, 0, 1, 0),
      },
    ],
  ),
  ...ladder(
    "utility",
    "blackout",
    "arch",
    ["read"],
    [
      {
        tier: "pro",
        name: "Blackout",
        job: "Kills the other bot's picture of the cage. Their brain aims worse and stops reading hazards, unless they brought a light.",
        nudge: n(0, 0, 0, 2),
      },
    ],
  ),
  ...ladder(
    "utility",
    "grapple",
    "arch",
    ["control"],
    [
      {
        tier: "super",
        name: "Grapple",
        job: "Once per match, it holds the other bot through the opening exchange.",
        nudge: n(1, 0, 1, 1),
      },
    ],
  ),
  ...ladder(
    "utility",
    "siren",
    "arch",
    ["read"],
    [
      {
        tier: "super",
        name: "Siren",
        job: "Disrupts the other brain. Hazard reading and careful aim fall off for the match.",
        nudge: n(0, 0, 0, 3),
      },
    ],
  ),
  ...ladder(
    "utility",
    "mirror",
    "arch",
    ["armor"],
    [
      {
        tier: "super",
        name: "Mirror",
        job: "Returns a share of each hit. It does not add a weapon of its own.",
        nudge: n(0, 0, 2, 0),
      },
    ],
  ),
  ...ladder(
    "utility",
    "veil",
    "arch",
    ["read"],
    [
      {
        tier: "super",
        name: "Ghost Veil",
        job: "Halloween utility, on the peg all season. Semi-transparent, with a ghostly afterimage that baits attacks and throws off aim. Support only. It deals no damage. This is the veil; there is no Poltergeist.",
        nudge: n(0, 1, 0, 0),
      },
    ],
  ),
  ...ladder(
    "utility",
    "smoke",
    "arch",
    ["read"],
    [
      {
        tier: "super",
        name: "Smoke Screen",
        job: "Eight utility coins. The other bot loses the cage. A UV lamp cuts it. This is not the Fog Machine.",
        nudge: n(0, 0, 0, 1),
      },
    ],
  ),
  ...ladder(
    "utility",
    "uv",
    "arch",
    ["read"],
    [
      {
        tier: "super",
        name: "UV Lamp",
        job: "Eight utility coins. Reveals veils, decoys, smoke, blackouts and jammed aim, and paints the hazards. This is not Blacklight Mode.",
        nudge: n(0, 0, 0, 2),
      },
    ],
  ),
];

const BRAINS: Part[] = [
  ...ladder(
    "brain",
    "berserker",
    "ticket",
    ["aggro"],
    [
      {
        tier: "sport",
        name: "Berserker",
        job: "All offense, and the cheapest brain after Logic and Hunter. It does not change Power, Speed, Armor or Heat. It takes the dangerous lane and swings.",
      },
    ],
  ),
  ...ladder(
    "brain",
    "turtle",
    "ticket",
    ["smart"],
    [
      {
        tier: "pro",
        name: "Turtle",
        job: "Slow, nearly indestructible, low damage. Behavior only: the printed four numbers do not move.",
      },
    ],
  ),
  ...ladder(
    "brain",
    "sniper",
    "ticket",
    ["smart"],
    [
      {
        tier: "pro",
        name: "Sniper",
        job: "Fragile, hits hard from range, and stays off the hazards. Behavior only.",
      },
    ],
  ),
  ...ladder(
    "brain",
    "brawler",
    "ticket",
    ["aggro"],
    [
      {
        tier: "super",
        name: "Brawler",
        job: "Short radius. Punishes a bot that closes in, and whiffs against one that will not. Behavior only.",
      },
    ],
  ),
  ...ladder(
    "brain",
    "jammer",
    "ticket",
    ["read"],
    [
      {
        tier: "super",
        name: "Jammer",
        job: "Scrambles the other bot's targeting. Behavior only. A spotlight or UV lamp cleans the picture.",
      },
    ],
  ),
  ...ladder(
    "brain",
    "phoenix",
    "ticket",
    ["smart"],
    [
      {
        tier: "super",
        name: "Phoenix",
        job: "Very expensive. Revives once after a killing blow and the next swing spikes. It does not add Power, Speed, Armor or Heat. Needs 3 green Demo Ticket weeks.",
        greenWeeks: 3,
      },
    ],
  ),
  ...ladder(
    "brain",
    "skynet",
    "ticket",
    ["smart", "aggro"],
    [
      {
        tier: "super",
        name: "Skynet",
        job: "The hardest brain and the strictest gate: 4 straight green Demo Ticket weeks, on top of the Super price. Logic's hazard reading plus Hunter's hit. Behavior only.",
        greenWeeks: 4,
        straight: true,
      },
    ],
  ),
];

export const ROSTER_PARTS: Part[] = [
  ...DRIVES,
  ...WEAPONS,
  ...ARMOR,
  ...CHASSIS,
  ...UTILITIES,
  ...BRAINS,
];
