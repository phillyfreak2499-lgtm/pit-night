import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "zustand/vanilla";
import { pitCreator } from "../src/lib/pit/store.ts";
import { makeData, WEEK_META } from "../src/lib/pit/seed.ts";
import { PARTS, TIER_PRICE, partById } from "../src/lib/pit/catalog.ts";
import { programWeek } from "../src/lib/pit/training.ts";
import { cosmeticUnlocked } from "../src/lib/pit/cosmetics.ts";
import { authorize, commandArgs } from "../src/lib/pit/commands.ts";
import {
  buyCheck,
  halloweenStrikeAdjust,
  printedStats,
  showCheck,
  simulateDuel,
} from "../src/lib/pit/engine.ts";
import { central } from "../src/lib/pit/time.ts";
import {
  CHAMPIONSHIP_SATURDAY,
  HALLOWEEN_PIT_SATURDAY,
  HALLOWEEN_PIT_START,
  HALLOWEEN_VISUAL_END,
  HALLOWEEN_VISUAL_START,
  PREMIUM_CLOSE,
  PREMIUM_OPEN,
  PREMIUM_PART_IDS,
  SHOW_EFFECTS,
  SHOW_PRICE,
  halloweenVisuals,
  premiumHalloweenOpen,
} from "../src/lib/pit/halloween.ts";
import type { Bot, FighterSnap, PitData, Session, StatBlock } from "../src/lib/pit/types.ts";

const NAMES: Record<(typeof PREMIUM_PART_IDS)[number], string> = {
  "weapon-chainsaw-super": "Texas Chainsaw",
  "weapon-slasher-super": "Slasher Blade",
  "weapon-ghost-super": "Ghost Blade",
  "weapon-launcher-super": "Pumpkin Launcher",
  "weapon-bones-super": "Skeleton Claws",
  "weapon-broom-super": "Witch's Broom",
  "chassis-pumpkin-super": "Pumpkin Chassis",
  "drive-ghostchaser-super": "Ghost Chaser",
};

test("Halloween dates follow Pit Week 1 and Championship Saturday", () => {
  const week1 = programWeek(1)!;
  const week5 = programWeek(5)!;
  assert.equal(week1.start, "2026-10-27");
  assert.equal(week5.start, "2026-11-24");
  assert.match(WEEK_META[0]!.blurb, /Oct 25/);
  assert.match(WEEK_META[0]!.blurb, /31/);
  assert.match(WEEK_META[4]!.blurb, /Nov 28/);
  assert.equal(HALLOWEEN_PIT_START.toISOString(), "2026-10-27T05:00:00.000Z");
  assert.equal(HALLOWEEN_PIT_SATURDAY.toISOString(), "2026-10-31T05:00:00.000Z");
  assert.equal(HALLOWEEN_VISUAL_START.toISOString(), "2026-10-26T05:00:00.000Z");
  assert.equal(HALLOWEEN_VISUAL_END.toISOString(), "2026-11-01T05:00:00.000Z");
  assert.equal(PREMIUM_OPEN.toISOString(), "2026-11-01T05:00:00.000Z");
  assert.equal(CHAMPIONSHIP_SATURDAY.toISOString(), "2026-11-28T06:00:00.000Z");
  assert.equal(PREMIUM_CLOSE.toISOString(), "2026-11-29T06:00:00.000Z");

  const oct25 = central(2026, 10, 25, 12);
  const oct26 = HALLOWEEN_VISUAL_START;
  const oct31late = central(2026, 10, 31, 23);
  assert.equal(halloweenVisuals(oct25), false);
  assert.equal(halloweenVisuals(oct26), true);
  assert.equal(halloweenVisuals(oct31late), true);
  assert.equal(halloweenVisuals(new Date(HALLOWEEN_VISUAL_END.getTime() - 1)), true);
  assert.equal(halloweenVisuals(HALLOWEEN_VISUAL_END), false);

  assert.equal(premiumHalloweenOpen(HALLOWEEN_PIT_START), false);
  assert.equal(premiumHalloweenOpen(oct31late), false);
  assert.equal(premiumHalloweenOpen(new Date(PREMIUM_OPEN.getTime() - 1)), false);
  assert.equal(premiumHalloweenOpen(PREMIUM_OPEN), true);
  assert.equal(premiumHalloweenOpen(central(2026, 11, 28, 18)), true);
  assert.equal(premiumHalloweenOpen(new Date(PREMIUM_CLOSE.getTime() - 1)), true);
  assert.equal(premiumHalloweenOpen(PREMIUM_CLOSE), false);
});

test("Pit Week 1 jobs earn Halloween looks without touching coins or the fight", () => {
  const league = state();
  const coins = JSON.stringify(league.getState().bots.map((b) => b.coins));
  const before = simulateDuel(league.getState(), "plano", "allen", "halloween-looks");
  assert.equal(cosmeticUnlocked(league.getState(), "plano", "decal", "pumpkin"), false);
  league.getState().completeJob(1, "w1-crate", "Crate opened");
  assert.equal(cosmeticUnlocked(league.getState(), "plano", "decal", "pumpkin"), false);

  league.getState().completeJob(1, "w1-tue-culture", "We build one complete Solution.");
  assert.equal(cosmeticUnlocked(league.getState(), "plano", "decal", "pumpkin"), true);
  assert.equal(cosmeticUnlocked(league.getState(), "plano", "mask", "lantern"), false);
  assert.ok(league.getState().ooze > 0);
  assert.match(league.getState().flash, /Pumpkin Sticker/);
  assert.match(league.getState().flash, /does not change the fight/);

  const captain = league.getState().session;
  const crew = league.getState().crew.find((c) => c.storeId === "plano" && c.role === "specialist")!;
  league.setState({ session: { role: "crew", storeId: "plano", crewId: crew.id } });
  league.getState().completeJob(1, "w1-tue-skill", "Greeted and seated.");
  assert.equal(league.getState().jobLog.find((e) => e.jobId === "w1-tue-skill")!.status, "pending");
  assert.equal(cosmeticUnlocked(league.getState(), "plano", "mask", "lantern"), false);
  league.setState({ session: captain });
  league.getState().approveJob(league.getState().jobLog.find((e) => e.jobId === "w1-tue-skill")!.id);
  assert.equal(cosmeticUnlocked(league.getState(), "plano", "mask", "lantern"), true);
  assert.match(league.getState().flash, /Lantern Mask/);

  for (const id of ["w1-wed-culture", "w1-wed-skill"]) {
    league.getState().completeJob(1, id, "Done on the floor.");
  }
  assert.equal(cosmeticUnlocked(league.getState(), "plano", "mask", "hockey"), true);
  assert.equal(cosmeticUnlocked(league.getState(), "plano", "weaponSkin", "hockey-machete"), false);
  for (const id of ["w1-thu-culture", "w1-thu-skill"]) {
    league.getState().completeJob(1, id, "Done on the floor.");
  }
  assert.equal(cosmeticUnlocked(league.getState(), "plano", "weaponSkin", "hockey-machete"), true);
  assert.equal(partById("weapon-hockey-machete-super"), undefined);
  assert.equal(JSON.stringify(league.getState().bots.map((b) => b.coins)), coins);
  const after = simulateDuel(league.getState(), "plano", "allen", "halloween-looks");
  assert.deepEqual(after.exchanges, before.exchanges);
  assert.deepEqual(after.winnerIds, before.winnerIds);

  const later = { ...league.getState(), week: 3 };
  assert.equal(cosmeticUnlocked(later, "plano", "weaponSkin", "hockey-machete"), true);
  assert.equal(cosmeticUnlocked(later, "plano", "decal", "pumpkin"), true);

  const otherWeek = makeData();
  otherWeek.jobLog.push({
    id: "2:w2-tue-culture:plano-captain",
    week: 2,
    jobId: "w2-tue-culture",
    storeId: "plano",
    crewId: "plano-captain",
    crewName: "Dana Ruiz",
    note: "A later week",
    status: "approved",
    at: 1,
  });
  assert.equal(cosmeticUnlocked(otherWeek, "plano", "decal", "pumpkin"), false);
  assert.equal(cosmeticUnlocked(otherWeek, "plano", "weaponSkin", "hockey-machete"), false);
});

test("premium iron and show effects cost 8 and stay shut until November 1", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: HALLOWEEN_PIT_START.getTime() });
  const league = state();
  fund(league);
  const saw = partById("weapon-saw-super")!;
  const chainsaw = partById("weapon-chainsaw-super")!;
  assert.equal(buyCheck(league.getState(), "plano", saw).ok, true);
  for (const id of PREMIUM_PART_IDS) {
    const part = partById(id)!;
    assert.equal(part.name, NAMES[id]);
    assert.equal(part.price, 8);
    assert.equal(part.price, TIER_PRICE.super);
    assert.equal(part.tier, "super");
    const closed = buyCheck(league.getState(), "plano", part);
    assert.equal(closed.ok, false);
    assert.equal(closed.cost, 8);
    assert.match(closed.reason, /November 1/);
  }
  for (const effect of SHOW_EFFECTS) {
    assert.equal(effect.price, SHOW_PRICE);
    assert.equal(effect.price, 8);
    const closed = showCheck(league.getState(), "plano", effect.id);
    assert.equal(closed.ok, false);
    assert.match(closed.reason, /November 1/);
  }
  const coinsBefore = plano(league).coins.weapon;
  league.getState().buyPart("plano", chainsaw.id);
  league.getState().buyShow("plano", "fog");
  assert.equal(plano(league).coins.weapon, coinsBefore);
  assert.equal(plano(league).coins.utility, 40);
  assert.equal(plano(league).owned.includes(chainsaw.id), false);
  assert.equal(plano(league).shows, undefined);

  t.mock.timers.setTime(central(2026, 10, 31, 23).getTime());
  assert.equal(buyCheck(league.getState(), "plano", chainsaw).ok, false);
  assert.equal(showCheck(league.getState(), "plano", "blacklight").ok, false);
  assert.equal(buyCheck(league.getState(), "plano", saw).ok, true);

  const week1 = state();
  week1.setState({
    kickoff: { ...week1.getState().kickoff, appliedAt: 1 },
    bots: week1.getState().bots.map((b) => (b.storeId === "plano" ? { ...b, coins: fullCoins(40), locked: null } : b)),
  });
  assert.equal(buyCheck(week1.getState(), "plano", saw).ok, true);
  assert.equal(buyCheck(week1.getState(), "plano", chainsaw).ok, false);

  t.mock.timers.setTime(PREMIUM_OPEN.getTime());
  const beforeWeapon = plano(league).coins.weapon;
  const beforeChassis = plano(league).coins.chassis;
  const beforeDrive = plano(league).coins.drive;
  const beforeUtility = plano(league).coins.utility;
  assert.equal(buyCheck(league.getState(), "plano", chainsaw).ok, true);
  league.getState().buyPart("plano", "weapon-chainsaw-super");
  league.getState().buyPart("plano", "chassis-pumpkin-super");
  league.getState().buyPart("plano", "drive-ghostchaser-super");
  league.getState().buyShow("plano", "fog");
  league.getState().buyShow("plano", "blacklight");
  const bot = plano(league);
  assert.equal(bot.coins.weapon, beforeWeapon - 8);
  assert.equal(bot.coins.chassis, beforeChassis - 8);
  assert.equal(bot.coins.drive, beforeDrive - 8);
  assert.equal(bot.coins.utility, beforeUtility - 16);
  assert.deepEqual(bot.shows, ["fog", "blacklight"]);
  assert.equal(bot.classId, "striker");
  assert.ok(bot.owned.includes("weapon-chainsaw-super"));
  assert.ok(bot.owned.includes("chassis-pumpkin-super"));
  assert.ok(bot.owned.includes("drive-ghostchaser-super"));
  assert.equal(partById("chassis-pumpkin-super")!.classLock, undefined);

  t.mock.timers.setTime(central(2026, 11, 28, 18).getTime());
  assert.equal(buyCheck(league.getState(), "plano", partById("weapon-slasher-super")!).ok, true);
  assert.equal(showCheck(league.getState(), "plano", "fog").ok, false);

  t.mock.timers.setTime(PREMIUM_CLOSE.getTime());
  assert.equal(buyCheck(league.getState(), "plano", partById("weapon-slasher-super")!).ok, false);
  assert.equal(showCheck(league.getState(), "plano", "fog").ok, false);
  assert.equal(buyCheck(league.getState(), "plano", saw).ok, true);

  const session = league.getState().session;
  assert.doesNotThrow(() => authorize(league.getState(), session, "buyShow", ["plano", "fog"]));
  assert.throws(() => authorize(league.getState(), { ...session, role: "crew", crewId: league.getState().crew.find((c) => c.storeId === "plano" && c.role === "specialist")!.id }, "buyShow", ["plano", "fog"]));
  assert.equal(commandArgs.buyShow.safeParse(["plano", "fog"]).success, true);
  assert.equal(commandArgs.buyShow.safeParse(["plano", "gore"]).success, false);
});

test("Halloween parts trade off against each other and against other super parts", () => {
  const keys = ["power", "speed", "armor", "heat"] as const;
  const strict = (a: { power: number; speed: number; armor: number; heat: number }, b: typeof a) => {
    let better = false;
    for (const key of keys) {
      if (a[key] < b[key]) return false;
      if (a[key] > b[key]) better = true;
    }
    return better;
  };
  const premium = PREMIUM_PART_IDS.map((id) => partById(id)!);
  for (const part of premium) {
    const peers = PARTS.filter((other) => other.slot === part.slot && other.tier === "super" && other.id !== part.id);
    assert.ok(peers.length > 0);
    for (const other of peers) assert.equal(strict(part.nudge, other.nudge), false, `${part.name} vs ${other.name}`);
  }
  const banned = /jason|voorhees|myers|ghostbusters|ecto-1|ecto 1/i;
  for (const part of premium) {
    assert.equal(banned.test(`${part.name} ${part.job}`), false);
    assert.match(part.job, /Eight/);
  }
  assert.equal(partById("weapon-slasher-super")!.name, "Slasher Blade");
  assert.equal(partById("drive-ghostchaser-super")!.name, "Ghost Chaser");
  assert.equal(SHOW_EFFECTS.map((row) => row.name).join(","), "Fog Machine,Blacklight Mode");
});

test("Halloween strike trades are real and fog does not change the bout", () => {
  const tags: string[] = [];
  const even = snap();
  const reset = () => {
    tags.length = 0;
  };
  reset();
  assert.equal(halloweenStrikeAdjust(snap({ weaponFamily: "chainsaw" }), even, 0, 40, tags), 44);
  assert.deepEqual(tags, ["chainsaw"]);
  reset();
  assert.equal(halloweenStrikeAdjust(snap({ weaponFamily: "chainsaw" }), even, 1, 40, tags), 40);
  assert.deepEqual(tags, []);
  reset();
  const bogged = halloweenStrikeAdjust(
    snap({ weaponFamily: "chainsaw", stats: stats({ armor: 10 }) }),
    snap({ stats: stats({ armor: 30 }) }),
    0,
    40,
    tags,
  );
  near(bogged, 37.4);
  assert.deepEqual(tags, ["chainsaw", "bog"]);

  reset();
  assert.equal(
    halloweenStrikeAdjust(snap({ weaponFamily: "slasher", stats: stats({ speed: 10 }) }), snap({ stats: stats({ speed: 30 }) }), 0, 40, tags),
    32,
  );
  assert.ok(tags.includes("late-slash"));
  reset();
  assert.equal(
    halloweenStrikeAdjust(snap({ weaponFamily: "slasher", stats: stats({ speed: 30 }) }), snap({ stats: stats({ speed: 10 }) }), 0, 40, tags),
    46,
  );
  assert.ok(tags.includes("lunge"));

  reset();
  const faded = halloweenStrikeAdjust(snap({ weaponFamily: "ghost", stats: stats({ heat: 4 }) }), even, 0, 40, tags);
  assert.ok(Math.abs(faded - (40 + 20 * 0.38 * 0.3) * 0.72) < 1e-9);
  assert.ok(tags.includes("fade") && tags.includes("phase"));
  reset();
  const phased = halloweenStrikeAdjust(snap({ weaponFamily: "ghost", stats: stats({ heat: 20 }) }), even, 1, 40, tags);
  assert.ok(Math.abs(phased - (40 + 20 * 0.38 * 0.3)) < 1e-9);
  assert.deepEqual(tags, ["phase"]);

  reset();
  const windup = halloweenStrikeAdjust(snap({ weaponFamily: "launcher" }), even, 0, 40, tags);
  reset();
  const lob = halloweenStrikeAdjust(snap({ weaponFamily: "launcher" }), even, 1, 40, tags);
  assert.ok(windup < lob);
  near(windup, 28.8);
  assert.equal(lob, 48);
  assert.ok(tags.includes("lob"));

  reset();
  const vsTank = halloweenStrikeAdjust(snap({ weaponFamily: "bones" }), snap({ classId: "tank" }), 0, 40, tags);
  reset();
  const vsStriker = halloweenStrikeAdjust(snap({ weaponFamily: "bones" }), snap({ classId: "striker" }), 0, 40, tags);
  assert.ok(vsTank < vsStriker);
  assert.equal(vsTank, 34);
  assert.equal(vsStriker, 42);
  assert.ok(tags.includes("rattle"));

  reset();
  assert.equal(
    halloweenStrikeAdjust(snap({ weaponFamily: "broom", stats: stats({ heat: 30 }) }), snap({ stats: stats({ heat: 10 }) }), 0, 40, tags),
    43,
  );
  assert.ok(tags.includes("staff"));
  reset();
  assert.equal(
    halloweenStrikeAdjust(snap({ weaponFamily: "broom", stats: stats({ heat: 10 }) }), snap({ stats: stats({ heat: 30 }) }), 0, 40, tags),
    36,
  );
  assert.ok(tags.includes("broom"));

  reset();
  near(halloweenStrikeAdjust(snap({ chassisFamily: "pumpkin" }), even, 1, 40, tags), 37.2);
  near(halloweenStrikeAdjust(even, snap({ chassisFamily: "pumpkin" }), 0, 40, tags), 37.6);
  assert.equal(halloweenStrikeAdjust(even, snap({ chassisFamily: "pumpkin" }), 1, 40, tags), 40);

  reset();
  assert.equal(
    halloweenStrikeAdjust(
      snap({ driveFamily: "ghostchaser", stats: stats({ speed: 30 }) }),
      snap({ stats: stats({ speed: 10 }) }),
      0,
      40,
      tags,
    ),
    43,
  );
  assert.ok(tags.includes("chase"));
  reset();
  assert.equal(
    halloweenStrikeAdjust(
      snap({ driveFamily: "ghostchaser", stats: stats({ speed: 10 }) }),
      snap({ stats: stats({ speed: 30 }) }),
      0,
      40,
      tags,
    ),
    40,
  );
  near(halloweenStrikeAdjust(even, snap({ driveFamily: "ghostchaser" }), 2, 40, tags), 42.4);

  const plain = makeData();
  const dressed = structuredClone(plain) as PitData;
  dressed.bots = dressed.bots.map((b) => (b.storeId === "plano" ? { ...b, shows: ["fog", "blacklight"] } : b));
  const bot = plain.bots.find((b) => b.storeId === "plano")!;
  assert.deepEqual(printedStats(bot, bot.draft, 0.5), printedStats(dressed.bots.find((b) => b.storeId === "plano")!, bot.draft, 0.5));
  const fogFight = simulateDuel(dressed, "plano", "allen", "fog-check");
  const clearFight = simulateDuel(plain, "plano", "allen", "fog-check");
  assert.deepEqual(
    fogFight.exchanges.map((e) => [e.damage, e.attackerHp, e.defenderHp, e.tags]),
    clearFight.exchanges.map((e) => [e.damage, e.attackerHp, e.defenderHp, e.tags]),
  );

  const armed = structuredClone(plain) as PitData;
  armed.bots = armed.bots.map((b) =>
    b.storeId === "plano"
      ? { ...b, owned: [...b.owned, "weapon-chainsaw-super"], draft: { ...b.draft, weapon: "weapon-chainsaw-super" }, equipped: { ...b.equipped, weapon: "weapon-chainsaw-super" } }
      : b,
  );
  const stockFight = simulateDuel(plain, "plano", "allen", "saw-vs-chainsaw");
  const sawFight = simulateDuel(armed, "plano", "allen", "saw-vs-chainsaw");
  assert.ok(sawFight.exchanges.some((e) => e.attackerId === "plano" && (e.tags.includes("chainsaw") || e.tags.includes("bog"))));
  assert.equal(stockFight.exchanges.some((e) => e.tags.includes("chainsaw") || e.tags.includes("bog")), false);
});

function state() {
  const store = createStore(pitCreator);
  const crew = store.getState().crew.find((c) => c.storeId === "plano" && c.role === "captain")!;
  store.setState({
    trainingOpenAll: true,
    session: { role: "captain", storeId: "plano", crewId: crew.id } satisfies Session,
  });
  store.getState().chooseStarterBody("plano", "striker", "shrike");
  return store;
}

function fullCoins(n: number): Bot["coins"] {
  return { chassis: n, armor: n, drive: n, weapon: n, utility: n, brain: n };
}

function fund(store: ReturnType<typeof state>) {
  store.setState({
    week: 2,
    phase: "open",
    bots: store.getState().bots.map((b) => (b.storeId === "plano" ? { ...b, locked: null, coins: fullCoins(40) } : b)),
  });
}

function plano(store: ReturnType<typeof state>) {
  return store.getState().bots.find((b) => b.storeId === "plano")!;
}

function stats(over: Partial<StatBlock> = {}): StatBlock {
  return { power: 20, speed: 20, armor: 20, heat: 20, ...over };
}

function snap(over: Partial<FighterSnap> = {}): FighterSnap {
  return {
    id: "a",
    name: "A",
    storeName: "A",
    classId: "striker",
    paint: "amber",
    botName: "A",
    stats: stats(),
    rating: 50,
    fit: 1,
    weekQ: 1,
    weaponFamily: "saw",
    weaponName: "saw",
    driveName: "drive",
    armorName: "armor",
    utilityName: null,
    chassisName: "chassis",
    look: "plain",
    number: "1",
    ...over,
  };
}

function near(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ~= ${expected}`);
}
