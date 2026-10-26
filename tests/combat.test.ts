import test from "node:test";
import assert from "node:assert/strict";
import { makeData } from "../src/lib/pit/seed.ts";
import { partById } from "../src/lib/pit/catalog.ts";
import { preferFighter } from "../src/lib/pit/combat.ts";
import {
  CHASSIS_WEIGHT,
  UTILITY_FIT,
  buyCheck,
  partInWindow,
  printedStats,
  simulateDuel,
} from "../src/lib/pit/engine.ts";
import { central } from "../src/lib/pit/time.ts";
import type { ClassId, Grade, Loadout, PitData, StatKey } from "../src/lib/pit/types.ts";

const A = "waco";
const B = "arlington";
const GREEN: Grade = "green";

function stock(classId: ClassId): Loadout {
  const chassis = classId === "striker" ? "shrike" : classId === "tank" ? "keystone" : "windlass";
  const drive = classId === "striker" ? "mag" : classId === "tank" ? "treads" : "omni";
  const weapon = classId === "striker" ? "saw" : classId === "tank" ? "wedge" : "claw";
  const armor = "plate";
  return {
    chassis: `chassis-${chassis}-stock`,
    drive: `drive-${drive}-stock`,
    weapon: `weapon-${weapon}-stock`,
    armor: `armor-${armor}-stock`,
    utility: null,
    brain: "brain-logic-stock",
  };
}

function full(classId: ClassId): Loadout {
  const base = stock(classId);
  const chassis = classId === "striker" ? "shrike" : classId === "tank" ? "keystone" : "windlass";
  const drive = classId === "striker" ? "swerve" : classId === "tank" ? "anchor" : "air";
  const weapon = classId === "striker" ? "saw" : classId === "tank" ? "hammer" : "claw";
  return {
    ...base,
    chassis: `chassis-${chassis}-super`,
    drive: `drive-${drive}-super`,
    weapon: `weapon-${weapon}-super`,
    armor: "armor-plate-super",
    utility: "utility-burn-super",
    brain: "brain-logic-super",
  };
}

function equip(data: PitData, id: string, classId: ClassId, load: Loadout) {
  const bot = data.bots.find((row) => row.storeId === id)!;
  bot.classId = classId;
  bot.wear = {
    chassis: "clean",
    drive: "clean",
    weapon: "clean",
    armor: "clean",
    utility: "clean",
    brain: "clean",
  };
  bot.partWear = {};
  bot.draft = { ...load };
  bot.locked = { ...load };
  bot.equipped = { ...load };
  bot.owned = Object.values(load).filter((part): part is string => Boolean(part));
  const card = data.storeCards.find((row) => row.storeId === id && row.week === 1)!;
  card.nsnu = 950;
  card.conv = 70;
  card.demoRate = 90;
  card.demoClose = 80;
  card.arch = 4;
  card.demoTicket = 1800;
  card.projected = false;
  card.grades = undefined;
}

function fight(classId: ClassId, left: Loadout, right: Loadout, seed = "alpha") {
  const data = makeData();
  equip(data, A, classId, left);
  equip(data, B, classId, right);
  return simulateDuel(data, A, B, seed);
}

/** How many of the two seatings the better build wins. */
function seats(classId: ClassId, better: Loadout, worse: Loadout) {
  const home = fight(classId, better, worse);
  const away = fight(classId, worse, better);
  let n = 0;
  if (home.winnerIds[0] === A) n += 1;
  if (away.winnerIds[0] === B) n += 1;
  return { n, home, away };
}

function margin(result: ReturnType<typeof fight>, betterId: string) {
  const worseId = betterId === A ? B : A;
  return result.hp[betterId]! - result.hp[worseId]!;
}

test("same builds produce the same fight no matter the seed", () => {
  const left = full("striker");
  const right = stock("striker");
  const one = fight("striker", left, right, "seed-one");
  const two = fight("striker", left, right, "seed-two");
  assert.deepEqual(two.exchanges, one.exchanges);
  assert.deepEqual(two.hp, one.hp);
  assert.deepEqual(two.winnerIds, one.winnerIds);
  assert.deepEqual(two.wear, one.wear);
  assert.equal(two.method, one.method);
  assert.notEqual(one.seed, two.seed);
});

test("a weapon upgrade is monotonic and the super wins both seats", () => {
  const foe = stock("striker");
  let previous = -100;
  for (const tier of ["stock", "sport", "pro", "super"] as const) {
    const load = { ...stock("striker"), weapon: `weapon-saw-${tier}` };
    const home = fight("striker", load, foe, tier);
    const away = fight("striker", foe, load, tier);
    const edge = Math.min(margin(home, A), margin(away, B));
    assert.ok(edge >= previous, `${tier} margin ${edge} fell behind ${previous}`);
    previous = edge;
    if (tier !== "stock") assert.equal(seats("striker", load, foe).n, 2, tier);
  }
});

test("a brain upgrade is monotonic without changing the printed numbers", () => {
  const foe = stock("striker");
  const base = stock("striker");
  const printed = ["stock", "sport", "pro", "super"].map((tier) =>
    printedStats(
      dataBot(base, tier === "stock" ? base : { ...base, brain: `brain-logic-${tier}` }),
      tier === "stock" ? base : { ...base, brain: `brain-logic-${tier}` },
      1,
    ),
  );
  for (const row of printed) assert.deepEqual(row.stats, printed[0]!.stats);
  const hunter = printedStats(
    dataBot(base, { ...base, brain: "brain-hunter-stock" }),
    { ...base, brain: "brain-hunter-stock" },
    1,
  );
  assert.deepEqual(hunter.stats, printed[0]!.stats);

  let previous = -100;
  for (const tier of ["stock", "sport", "pro", "super"] as const) {
    const load = { ...base, brain: `brain-logic-${tier}` };
    const home = fight("striker", load, foe, tier);
    const away = fight("striker", foe, load, tier);
    const edge = Math.min(margin(home, A), margin(away, B));
    assert.ok(edge >= previous, `${tier} brain margin ${edge} fell behind ${previous}`);
    previous = edge;
    if (tier === "super") assert.equal(seats("striker", load, foe).n, 2);
  }
});

test("the better build wins the vast majority of seatings", () => {
  const classes: ClassId[] = ["striker", "tank", "specialist"];
  let wins = 0;
  let total = 0;
  const lines: string[] = [];
  for (const classId of classes) {
    const fullSeats = seats(classId, full(classId), stock(classId));
    wins += fullSeats.n;
    total += 2;
    lines.push(`full ${classId} ${fullSeats.n}/2`);
    assert.equal(fullSeats.n, 2, `full ${classId}`);

    const slots: [string, Loadout][] = [
      [
        "weapon",
        {
          ...stock(classId),
          weapon:
            classId === "tank"
              ? "weapon-hammer-super"
              : classId === "specialist"
                ? "weapon-claw-super"
                : "weapon-saw-super",
        },
      ],
      ["armor", { ...stock(classId), armor: "armor-plate-super" }],
      [
        "drive",
        {
          ...stock(classId),
          drive:
            classId === "tank"
              ? "drive-treads-super"
              : classId === "specialist"
                ? "drive-omni-super"
                : "drive-mag-super",
        },
      ],
      [
        "chassis",
        {
          ...stock(classId),
          chassis:
            classId === "tank"
              ? "chassis-keystone-super"
              : classId === "specialist"
                ? "chassis-windlass-super"
                : "chassis-shrike-super",
        },
      ],
      ["utility", { ...stock(classId), utility: "utility-crowd-super" }],
      ["brain", { ...stock(classId), brain: "brain-logic-super" }],
    ];
    for (const [slot, load] of slots) {
      const row = seats(classId, load, stock(classId));
      wins += row.n;
      total += 2;
      lines.push(`${slot} ${classId} ${row.n}/2`);
    }
  }
  const rate = wins / total;
  console.log(`balance ${wins}/${total} = ${(rate * 100).toFixed(1)}%\n${lines.join("\n")}`);
  assert.ok(rate >= 0.85, `better builds won ${wins}/${total}`);
});

test("class counters and hazard brains are real", () => {
  const tankDisc = { ...stock("tank"), weapon: "weapon-disc-stock" };
  const tankWedge = stock("tank");
  assert.equal(seats("tank", tankWedge, tankDisc).n, 2);

  const strikerWedge = { ...stock("striker"), weapon: "weapon-wedge-stock" };
  assert.equal(seats("striker", stock("striker"), strikerWedge).n, 2);

  const specSaw = { ...stock("specialist"), weapon: "weapon-saw-stock" };
  assert.equal(seats("specialist", stock("specialist"), specSaw).n, 2);

  const berserk = { ...stock("striker"), brain: "brain-berserker-sport" };
  const logic = stock("striker");
  const hazard = seats("striker", logic, berserk);
  assert.equal(hazard.n, 2);
  const tags = hazard.home.exchanges.flatMap((row) => row.tags);
  assert.ok(tags.includes("saw") || tags.includes("hazard"));
  const quiet = fight("striker", logic, logic);
  assert.equal(
    quiet.exchanges.some((row) => row.tags.includes("saw")),
    false,
  );
});

test("reactor outlasts sprinter and phoenix does not overturn a full build", () => {
  const rest = stock("striker");
  const reactor = { ...rest, chassis: "chassis-reactor-super" };
  const sprinter = { ...rest, chassis: "chassis-sprinter-sport" };
  assert.equal(seats("striker", reactor, sprinter).n, 2);

  const phoenix = { ...stock("striker"), brain: "brain-phoenix-super" };
  assert.equal(seats("striker", phoenix, stock("striker")).n, 2);
  for (const classId of ["striker", "tank", "specialist"] as const) {
    assert.equal(
      seats(classId, full(classId), { ...stock(classId), brain: "brain-phoenix-super" }).n,
      2,
    );
  }
});

test("weights, names, windows and green gates match the shop", () => {
  assert.equal(CHASSIS_WEIGHT, 0.7);
  assert.equal(UTILITY_FIT, 1);
  const ghost = partById("chassis-shrike-super")!;
  assert.equal(ghost.name, "Glass Ghost");
  assert.equal(ghost.price, 8);
  assert.deepEqual(ghost.nudge, { power: 1, speed: 4, armor: -1, heat: 0 });
  assert.equal(partById("utility-smoke-super")!.name, "Smoke Screen");
  assert.equal(partById("utility-smoke-super")!.price, 8);
  assert.equal(partById("utility-uv-super")!.name, "UV Lamp");
  assert.equal(partById("utility-uv-super")!.price, 8);
  assert.equal(partById("utility-fog-super"), undefined);
  assert.equal(partById("utility-blacklight-super"), undefined);
  const chainsaw = partById("weapon-chainsaw-super")!;
  assert.equal(chainsaw.name, "Texas Chainsaw");
  assert.equal(chainsaw.price, 8);
  assert.deepEqual(chainsaw.nudge, { power: 4, speed: 1, armor: -2, heat: 0 });
  const chaser = partById("drive-ghostchaser-super")!;
  assert.equal(chaser.name, "Ghost Chaser");
  assert.equal(chaser.price, 8);
  assert.deepEqual(chaser.nudge, { power: 0, speed: 3, armor: -2, heat: 1 });
  assert.equal(partById("drive-chaser-super"), undefined);
  assert.deepEqual(partById("brain-logic-super")!.nudge, { power: 0, speed: 0, armor: 0, heat: 0 });
  assert.equal(partById("chassis-reactor-super")!.price, 12);
  assert.equal(partById("chassis-monolith-super")!.price, 10);
  assert.equal(partById("utility-veil-super")!.name, "Ghost Veil");

  const skeleton = partById("chassis-skeleton-super")!;
  const veil = partById("utility-veil-super")!;
  // On the peg all season (owner directive 2026-10-25): neither part carries
  // a purchase window anymore, so partInWindow is true at every date —
  // including the dates that used to be shut (Oct 25, Nov 29, December).
  assert.equal(skeleton.window, undefined);
  assert.equal(veil.window, undefined);
  assert.equal(partInWindow(skeleton, central(2026, 10, 25)), true);
  assert.equal(partInWindow(skeleton, central(2026, 11, 1)), true);
  assert.equal(partInWindow(skeleton, central(2026, 11, 15)), true);
  assert.equal(partInWindow(skeleton, central(2026, 11, 28)), true);
  assert.equal(partInWindow(skeleton, central(2026, 11, 29)), true);
  assert.equal(partInWindow(skeleton, central(2026, 12, 5)), true);
  assert.equal(partInWindow(veil, central(2026, 10, 25)), true);
  assert.equal(partInWindow(veil, central(2026, 11, 15)), true);
  assert.equal(partInWindow(veil, central(2026, 12, 5)), true);

  const data = makeData();
  data.week = 4;
  data.phase = "open";
  data.kickoff = { appliedAt: 1, grades: {}, paid: {} };
  const stats: StatKey[] = ["nsnu", "conv", "demoRate", "demoClose", "arch", "ticket"];
  const paint = (id: string, weeks: number[], broken?: number) => {
    data.kickoff.grades[id] = Object.fromEntries(stats.map((stat) => [stat, GREEN])) as Record<
      StatKey,
      Grade
    >;
    for (const week of weeks) {
      const card = data.storeCards.find((row) => row.storeId === id && row.week === week);
      const grades = Object.fromEntries(
        stats.map((stat) => [stat, week === broken ? "red" : GREEN]),
      ) as Record<StatKey, Grade>;
      if (card) card.grades = grades;
      else {
        data.storeCards.push({
          id: `${id}-w${week}`,
          storeId: id,
          week,
          nsnu: 1,
          conv: 1,
          demoRate: 1,
          demoClose: 1,
          arch: 1,
          demoTicket: 1,
          projected: false,
          grades,
        });
      }
    }
  };
  paint(A, [1, 2, 3]);
  const bot = data.bots.find((row) => row.storeId === A)!;
  bot.locked = null;
  bot.coins.chassis = 12;
  const reactor = partById("chassis-reactor-super")!;
  assert.equal(buyCheck(data, A, reactor).ok, true, buyCheck(data, A, reactor).reason);
  paint(B, [1, 2, 3], 2);
  const other = data.bots.find((row) => row.storeId === B)!;
  other.locked = null;
  other.coins.chassis = 12;
  assert.equal(buyCheck(data, B, reactor).ok, false);

  bot.coins.chassis = 9;
  const monolith = partById("chassis-monolith-super")!;
  const short = buyCheck(data, A, monolith);
  assert.equal(short.ok, false);
  bot.coins.chassis = 10;
  assert.equal(buyCheck(data, A, monolith).ok, true);
});

test("pits and jets actually happen, and hover and air ignore the pit", () => {
  const reckless = { ...stock("striker"), brain: "brain-berserker-sport" };
  const calm = stock("striker");
  const data = makeData();
  data.week = 3;
  equip(data, A, "striker", reckless);
  equip(data, B, "striker", calm);
  const hot = simulateDuel(data, A, B, "jets");
  const tags = hot.exchanges.flatMap((row) => row.tags);
  assert.ok(tags.includes("pit"), tags.join(","));
  assert.ok(tags.includes("jet"), tags.join(","));
  assert.ok(tags.includes("saw"), tags.join(","));

  const hover = { ...reckless, chassis: "chassis-hover-stock" };
  const crossed = fight("striker", hover, reckless, "pit-hover");
  const crossTags = crossed.exchanges.flatMap((row) => row.tags);
  assert.ok(crossTags.includes("hover"), crossTags.join(","));
  assert.ok(crossTags.includes("pit"), crossTags.join(","));
  const air = { ...reckless, drive: "drive-air-stock" };
  const wheels = { ...reckless, drive: "drive-mag-stock" };
  const skirt = fight("striker", air, wheels, "pit-air");
  const skirtTags = skirt.exchanges.flatMap((row) => row.tags);
  assert.ok(skirtTags.includes("air"), skirtTags.join(","));
  assert.ok(skirtTags.includes("pit"), skirtTags.join(","));
  assert.ok(crossed.hp[A]! > crossed.hp[B]!, "hover keeps the health the pit takes from the other bot");
  const airLeft = fight("striker", air, calm, "air-logic").hp[A]!;
  const wheelLeft = fight("striker", wheels, calm, "wheel-logic").hp[A]!;
  assert.ok(airLeft > wheelLeft, `air ${airLeft} should outlast wheels ${wheelLeft} after the pit`);
});

test("named counters and niche brains are real in both seats", () => {
  const base = stock("striker");
  const air = { ...base, drive: "drive-air-super" };
  const anchor = { ...base, drive: "drive-anchor-super" };
  const wheels = { ...base, drive: "drive-mag-stock" };
  assert.equal(seats("striker", air, wheels).n, 2, "air still beats a stock drive");
  assert.equal(seats("striker", anchor, air).n, 2, "anchor is the air counter");

  const plate = { ...base, armor: "armor-plate-super" };
  const reactive = { ...base, armor: "armor-reactive-super" };
  const saw = { ...base, weapon: "weapon-saw-super" };
  const flame = { ...base, weapon: "weapon-flame-super" };
  assert.equal(seats("striker", reactive, { ...saw, armor: "armor-plate-stock" }).n, 2, "reactive answers a saw");
  assert.equal(seats("striker", flame, reactive).n, 2, "flame is the reactive counter");
  assert.ok(seats("striker", reactive, plate).n >= 1);

  const storm = { ...base, weapon: "weapon-tesla-super" };
  const lodestone = { ...base, armor: "armor-magnet-super" };
  const bare = { ...base, armor: "armor-plate-stock" };
  assert.equal(seats("striker", storm, bare).n, 2, "storm beats plain plate");
  assert.equal(seats("striker", lodestone, storm).n, 2, "lodestone flips storm");

  const skeleton = { ...base, chassis: "chassis-skeleton-super" };
  const bones = seats("striker", skeleton, base);
  assert.equal(bones.n, 2, "skeleton beats free stock");
  assert.ok(margin(bones.home, A) >= 4 && margin(bones.away, B) >= 4);

  const logic = base;
  const hunter = { ...base, brain: "brain-hunter-stock" };
  const berserk = { ...base, brain: "brain-berserker-sport" };
  const turtle = { ...base, brain: "brain-turtle-pro" };
  const sniper = { ...base, brain: "brain-sniper-pro" };
  const brawler = { ...base, brain: "brain-brawler-super" };
  const skynet = { ...base, brain: "brain-skynet-super" };
  const mind = { ...base, brain: "brain-logic-super" };
  const title = { ...base, brain: "brain-logic-championship" };
  assert.equal(seats("striker", logic, berserk).n, 2);
  assert.equal(seats("striker", hunter, turtle).n, 2, "hunter beats turtle");
  assert.equal(seats("striker", berserk, turtle).n, 2, "berserker beats turtle");
  assert.equal(seats("striker", brawler, hunter).n, 2, "brawler punishes a hunter");
  assert.equal(seats("striker", sniper, turtle).n, 2, "sniper beats turtle from range");
  assert.equal(seats("striker", skynet, mind).n, 2, "skynet beats the best buyable logic");
  assert.equal(seats("striker", title, skynet).n, 2, "the title brain still sits above skynet");
});

test("a 750-fight panel keeps better iron ahead and skynet under the title brain", () => {
  const classes: ClassId[] = ["striker", "tank", "specialist"];
  const brains = [
    "brain-logic-stock",
    "brain-logic-sport",
    "brain-logic-pro",
    "brain-logic-super",
    "brain-logic-championship",
    "brain-hunter-stock",
    "brain-hunter-super",
    "brain-berserker-sport",
    "brain-turtle-pro",
    "brain-sniper-pro",
    "brain-brawler-super",
    "brain-jammer-super",
    "brain-phoenix-super",
    "brain-skynet-super",
  ];
  const wins = new Map<string, number>();
  const fights = new Map<string, number>();
  let total = 0;
  for (const classId of classes) {
    for (const brain of brains) {
      for (const foe of brains) {
        if (brain === foe) continue;
        const left = { ...stock(classId), brain };
        const right = { ...stock(classId), brain: foe };
        const row = seats(classId, left, right);
        wins.set(brain, (wins.get(brain) ?? 0) + row.n);
        fights.set(brain, (fights.get(brain) ?? 0) + 2);
        total += 2;
      }
    }
  }
  const drives = ["mag", "swerve", "rocket", "anchor", "air", "treads", "omni", "flip"];
  for (const drive of drives) {
    for (const foe of drives) {
      if (drive === foe) continue;
      const left = { ...stock("striker"), drive: `drive-${drive}-super` };
      const right = { ...stock("striker"), drive: `drive-${foe}-stock` };
      if (!partById(left.drive) || !partById(right.drive)) continue;
      const row = seats("striker", left, right);
      total += 2;
      void row;
    }
  }
  const rate = (id: string) => (wins.get(id) ?? 0) / (fights.get(id) ?? 1);
  const buyable = brains.filter((id) => id !== "brain-logic-championship");
  const bestBuyable = buyable.reduce((top, id) => (rate(id) > rate(top) ? id : top));
  const lines = brains.map((id) => `${id} ${(rate(id) * 100).toFixed(1)}% (${wins.get(id)}/${fights.get(id)})`);
  console.log(`panel fights ${total}\n${lines.join("\n")}`);
  assert.ok(total >= 750, `panel was ${total}`);
  assert.equal(bestBuyable, "brain-skynet-super", lines.join("\n"));
  assert.ok(rate("brain-skynet-super") < rate("brain-logic-championship"), "skynet under the title brain");
  assert.ok(rate("brain-skynet-super") < 0.96, `skynet dominated at ${rate("brain-skynet-super")}`);
  assert.ok(rate("brain-skynet-super") > rate("brain-logic-super"));
  for (const id of ["brain-hunter-stock", "brain-berserker-sport", "brain-brawler-super", "brain-sniper-pro"]) {
    assert.ok(rate(id) > 0.25, `${id} win rate ${rate(id)}`);
  }
  let upgrades = 0;
  let upgradeWins = 0;
  for (const classId of classes) {
    const row = seats(classId, full(classId), stock(classId));
    upgrades += 2;
    upgradeWins += row.n;
  }
  assert.equal(upgradeWins, upgrades);
});

test("a mirror keeps the first name, and a fuller build breaks a health tie", () => {
  const same = fight("striker", stock("striker"), stock("striker"), "mirror");
  assert.equal(same.hp[A], same.hp[B]);
  assert.equal(same.winnerIds[0], A);
  const stockSnap = same.fighters.find((row) => row.id === A)!;
  const richer = {
    ...stockSnap,
    id: "rich",
    tiers: { ...stockSnap.tiers, weapon: "super" as const },
  };
  assert.equal(preferFighter(stockSnap, richer, 40, 40).id, "rich");
  assert.equal(preferFighter(richer, stockSnap, 40, 40).id, "rich");
  assert.equal(preferFighter(stockSnap, { ...stockSnap, id: "other" }, 40, 40).id, stockSnap.id);
});

function dataBot(_load: Loadout, next: Loadout) {
  const data = makeData();
  equip(data, A, "striker", next);
  return data.bots.find((row) => row.storeId === A)!;
}
