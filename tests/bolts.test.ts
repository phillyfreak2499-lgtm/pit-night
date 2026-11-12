/** Bolts beyond the Locker: Garage repairs paid in Bolts and the capped Bolt exchange. */
import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "zustand/vanilla";
import { pitCreator, sharedDoc } from "../src/lib/pit/store.ts";
import { LOCKER, boltCoinsLeft, boltsOf } from "../src/lib/pit/week.ts";
import { BOLT_EXCHANGE, BOLTS, boltsForCoins } from "../src/lib/pit/training.ts";
import { PARTS, PART_BOLTS_PER_COIN, REPAIR_PRICE, stockPart, partById } from "../src/lib/pit/catalog.ts";
import { CLASS_SWITCH_BOLTS, classSwitchCheck, buyCheck, simulateDuel } from "../src/lib/pit/engine.ts";
import { SHOW_PRICE } from "../src/lib/pit/halloween.ts";
import { central } from "../src/lib/pit/time.ts";
import { authorize, CAPTAIN_BUILD_COMMANDS, commandArgs } from "../src/lib/pit/commands.ts";
import { cosmeticUnlocked } from "../src/lib/pit/cosmetics.ts";

const STORE = "plano";
const PART = "weapon-saw-pro";

/** Week 2, open, Plano's captain signed in with a bent weapon and `jobs` approved jobs of Bolts. */
function setup(jobs = 40) {
  const store = createStore(pitCreator);
  const data = store.getState();
  const captain = data.crew.find((c) => c.storeId === STORE && c.role === "captain")!;
  store.setState({
    week: 2,
    phase: "open",
    session: { role: "captain", storeId: STORE, crewId: captain.id },
    storeCards: data.storeCards.map((card) => ({ ...card, week: 2 })),
    jobLog: Array.from({ length: jobs }, (_, i) => ({
      id: `bolt-${i}`,
      week: 2,
      jobId: `job-${i}`,
      storeId: STORE,
      crewId: captain.id,
      crewName: captain.name,
      note: "Done",
      status: "approved" as const,
      at: Date.now(),
    })),
    bots: data.bots.map((bot) =>
      bot.storeId !== STORE
        ? bot
        : {
            ...bot,
            classId: "striker",
            locked: null,
            owned: [...bot.owned, PART],
            equipped: { ...bot.equipped, weapon: PART },
            draft: { ...bot.draft, weapon: PART },
            coins: { ...bot.coins, weapon: 0 },
            voucher: 0,
            wear: { ...bot.wear, weapon: "bent" },
            partWear: { [PART]: "bent" },
          },
    ),
  });
  return store;
}

const bot = (store: ReturnType<typeof setup>) => store.getState().bots.find((b) => b.storeId === STORE)!;
const balance = (store: ReturnType<typeof setup>) => boltsOf(store.getState(), STORE).balance;

test("a repair quote can be paid in Bolts when the coin jar is empty", () => {
  const store = setup();
  const start = balance(store);
  assert.equal(start, 40 * BOLTS.job);
  store.getState().repairSlot(STORE, "weapon", "full");
  assert.equal(bot(store).partWear[PART], "bent", "the empty jar cannot pay");

  store.getState().repairSlot(STORE, "weapon", "bolts");
  const cost = REPAIR_PRICE.bent * BOLT_EXCHANGE.repairBoltsPerCoin;
  assert.equal(bot(store).partWear[PART], "clean");
  assert.equal(bot(store).wear.weapon, "clean");
  assert.equal(bot(store).coins.weapon, 0, "coins untouched");
  assert.equal(balance(store), start - cost);
  assert.match(store.getState().flash, new RegExp(`${cost} Bolts`));
});

test("a Bolt repair needs enough Bolts and is closed once the card locks", () => {
  const short = setup(1);
  short.getState().repairSlot(STORE, "weapon", "bolts");
  assert.equal(bot(short).partWear[PART], "bent");
  assert.match(short.getState().flash, /The bay has 2/);

  const locked = setup();
  locked.setState({ phase: "locked" });
  locked.getState().repairSlot(STORE, "weapon", "bolts");
  assert.equal(bot(locked).partWear[PART], "bent");
  assert.equal(balance(locked), 80);
});

test("the Bolt exchange trades Bolts for coins up to the weekly cap", () => {
  const store = setup();
  const rate = BOLT_EXCHANGE.boltsPerCoin;
  const cap = BOLT_EXCHANGE.weeklyCoinCap;
  store.getState().convertBolts(STORE, "drive", 1);
  assert.equal(bot(store).coins.drive, 1);
  assert.equal(balance(store), 80 - rate);
  assert.equal(boltCoinsLeft(store.getState(), STORE), cap - 1);

  store.getState().convertBolts(STORE, "drive", cap);
  assert.equal(bot(store).coins.drive, 1, "asking past the cap trades nothing");

  for (let i = 1; i < cap; i++) store.getState().convertBolts(STORE, "drive", 1);
  assert.equal(bot(store).coins.drive, cap);
  store.getState().convertBolts(STORE, "drive", 1);
  assert.equal(bot(store).coins.drive, cap, "cap reached");
  assert.match(store.getState().flash, /used/);
  assert.equal(balance(store), 80 - cap * rate);

  // A new Pit Week opens a fresh allowance.
  store.setState({ week: 3 });
  assert.equal(boltCoinsLeft(store.getState(), STORE), cap);
  store.getState().convertBolts(STORE, "armor", 1);
  assert.equal(bot(store).coins.armor, 1);
  assert.equal(sharedDoc(store.getState()).stores.find((s) => s.id === STORE)?.boltCoins?.["2"], cap, "the ledger syncs");
});

test("the exchange needs enough Bolts and only the captain can trade", () => {
  const short = setup(BOLT_EXCHANGE.boltsPerCoin / BOLTS.job - 1);
  short.getState().convertBolts(STORE, "weapon", 1);
  assert.equal(bot(short).coins.weapon, 0);

  const store = setup();
  const crew = store.getState().crew.find((c) => c.storeId === STORE && c.role === "specialist")!;
  store.setState({ session: { role: "crew", storeId: STORE, crewId: crew.id } });
  store.getState().convertBolts(STORE, "weapon", 1);
  assert.equal(bot(store).coins.weapon, 0);
  const data = store.getState();
  assert.throws(() => authorize(data, { role: "crew", storeId: STORE, crewId: crew.id }, "convertBolts", [STORE, "weapon", 1]));
  const other = data.crew.find((c) => c.storeId !== STORE && c.role === "captain")!;
  assert.throws(() => authorize(data, { role: "captain", storeId: other.storeId, crewId: other.id }, "convertBolts", [STORE, "weapon", 1]));
});

test("command schemas accept the new Bolt moves and keep the exchange off the build lock", () => {
  assert.ok(commandArgs.repairSlot.safeParse([STORE, "weapon", "bolts"]).success);
  assert.ok(commandArgs.convertBolts.safeParse([STORE, "weapon", 1]).success);
  assert.ok(!commandArgs.convertBolts.safeParse([STORE, "weapon", BOLT_EXCHANGE.weeklyCoinCap + 1]).success);
  assert.ok(!commandArgs.convertBolts.safeParse([STORE, "weapon", 0]).success);
  assert.ok(CAPTAIN_BUILD_COMMANDS.has("repairSlot"));
  assert.ok(!CAPTAIN_BUILD_COMMANDS.has("convertBolts"));
});

test("Bolt-only looks require purchase and equip without changing the build", () => {
  const store = setup();
  const before = bot(store);
  const build = JSON.stringify({ equipped: before.equipped, stats: before.stats });
  assert.equal(cosmeticUnlocked(store.getState(), STORE, "wheelColor", "neon"), false);
  assert.equal(cosmeticUnlocked(store.getState(), STORE, "weaponSkin", "neon-fang"), false);
  store.getState().setStyle(STORE, { wheelColor: "neon", weaponSkin: "neon-fang" });
  assert.notEqual(bot(store).style?.wheelColor, "neon");

  for (const id of ["wheel-neon", "weapon-neon-fang", "paint-coral"]) store.getState().buyLocker(STORE, id);
  store.getState().setStyle(STORE, { wheelColor: "neon", weaponSkin: "neon-fang" });
  store.getState().setPaint(STORE, "coral");
  assert.equal(bot(store).style?.wheelColor, "neon");
  assert.equal(bot(store).style?.weaponSkin, "neon-fang");
  assert.equal(store.getState().stores.find((s) => s.id === STORE)?.paint, "coral");
  assert.equal(JSON.stringify({ equipped: bot(store).equipped, stats: bot(store).stats }), build);
});

test("captain may switch Striker, Tank and Specialist for Bolts without spending part coins", () => {
  const store = setup(150); // 300 earned Bolts. Two class changes cost 240.
  const origCoins = JSON.stringify(bot(store).coins);
  const originalParts = [...bot(store).owned];
  const first = balance(store);
  const oldChassis = bot(store).draft.chassis;
  assert.equal(CLASS_SWITCH_BOLTS, 120);
  assert.ok(classSwitchCheck(store.getState(), STORE, "tank").ok);
  store.getState().switchClass(STORE, "tank");
  assert.equal(bot(store).classId, "tank");
  assert.equal(bot(store).draft.chassis, stockPart("chassis", "tank").id);
  assert.notEqual(bot(store).draft.chassis, oldChassis);
  assert.equal(bot(store).equipped.chassis, bot(store).draft.chassis);
  assert.equal(bot(store).style?.body, "keystone");
  assert.deepEqual(bot(store).owned, originalParts, "all previously purchased parts are retained");
  assert.equal(JSON.stringify(bot(store).coins), origCoins, "no upgrade coin jar is touched");
  assert.equal(balance(store), first - CLASS_SWITCH_BOLTS);
  assert.equal(store.getState().stores.find((row) => row.id === STORE)?.boltsSpent, CLASS_SWITCH_BOLTS);
  store.getState().switchClass(STORE, "tank");
  assert.equal(balance(store), first - CLASS_SWITCH_BOLTS, "same-class repeat cannot spend twice");
  store.getState().switchClass(STORE, "specialist");
  assert.equal(bot(store).classId, "specialist");
  assert.equal(bot(store).draft.chassis, stockPart("chassis", "specialist").id);
  assert.equal(bot(store).style?.body, "windlass");
  assert.equal(balance(store), first - CLASS_SWITCH_BOLTS * 2);
  assert.equal(commandArgs.switchClass.safeParse([STORE, "striker"]).success, true);
  assert.equal(commandArgs.switchClass.safeParse([STORE, "invalid"]).success, false);
  assert.ok(CAPTAIN_BUILD_COMMANDS.has("switchClass"));
});

test("class switching refuses insufficient Bolts, crew members, Week 1, and locked builds", () => {
  const short = setup(29); // 58 Bolts, short of a 120 Bolt class change.
  const before = JSON.stringify(bot(short));
  short.getState().switchClass(STORE, "tank");
  assert.equal(JSON.stringify(bot(short)), before);
  assert.match(short.getState().flash, /Needs 120 Bolts/);
  assert.equal(balance(short), 58);
  const crewStore = setup(50);
  const crew = crewStore.getState().crew.find((c) => c.storeId === STORE && c.role === "specialist")!;
  crewStore.setState({ session: { role: "crew", storeId: STORE, crewId: crew.id } });
  crewStore.getState().switchClass(STORE, "tank");
  assert.equal(bot(crewStore).classId, "striker");
  assert.throws(() => authorize(crewStore.getState(), crewStore.getState().session, "switchClass", [STORE, "tank"]));
  const firstWeek = setup(50);
  firstWeek.setState({ week: 1, phase: "open" });
  firstWeek.getState().switchClass(STORE, "tank");
  assert.equal(bot(firstWeek).classId, "striker");
  const locked = setup(50);
  locked.setState({
    bots: locked.getState().bots.map((b) => b.storeId === STORE ? { ...b, locked: { ...b.draft } } : b),
  });
  locked.getState().switchClass(STORE, "tank");
  assert.equal(bot(locked).classId, "striker");
  assert.equal(balance(locked), 100);

  const bypass = setup(50);
  const wrongChassis = stockPart("chassis", "tank").id;
  bypass.getState().setDraftPart(STORE, "chassis", wrongChassis);
  assert.equal(bot(bypass).classId, "striker");
  assert.equal(bot(bypass).draft.chassis, stockPart("chassis", "striker").id);
  assert.equal(buyCheck(bypass.getState(), STORE, partById("chassis-keystone-sport")!).ok, false);
  assert.match(buyCheck(bypass.getState(), STORE, partById("chassis-keystone-sport")!).reason, /Change class/);
});

function snapshot(store: ReturnType<typeof setup>) {
  const row = bot(store);
  return JSON.stringify({
    owned: row.owned,
    coins: row.coins,
    classId: row.classId,
    draft: row.draft,
    equipped: row.equipped,
    wear: row.wear,
    partWear: row.partWear,
    welded: row.weldedParts ?? {},
    bolts: balance(store),
    spent: store.getState().stores.find((s) => s.id === STORE)?.boltsSpent ?? 0,
  });
}

function zeroJars(store: ReturnType<typeof setup>) {
  store.setState({
    bots: store.getState().bots.map((row) =>
      row.storeId === STORE
        ? { ...row, coins: { chassis: 0, armor: 0, drive: 0, weapon: 0, utility: 0, brain: 0 } }
        : row,
    ),
  });
}

test("the coin rate is 10 Bolts and the weekly exchange cap is 5", () => {
  assert.equal(BOLT_EXCHANGE.boltsPerCoin, 10);
  assert.equal(BOLT_EXCHANGE.repairBoltsPerCoin, BOLT_EXCHANGE.boltsPerCoin);
  assert.equal(BOLT_EXCHANGE.weeklyCoinCap, 5);
  assert.equal(boltsForCoins(1), 10);
  assert.equal(boltsForCoins(REPAIR_PRICE.weld), 10);
  assert.equal(CLASS_SWITCH_BOLTS, 120);
  assert.equal(SHOW_PRICE, 100);
  assert.equal(PART_BOLTS_PER_COIN, BOLT_EXCHANGE.boltsPerCoin * 2);
});

test("gameplay parts cost double Bolts and a saved bay keeps what it already owns", () => {
  for (const part of PARTS) {
    if (part.price > 0) assert.equal(part.boltPrice, part.price * BOLT_EXCHANGE.boltsPerCoin * 2, part.id);
    else assert.equal(part.boltPrice, 0, part.id);
  }
  const lockerPrices: Record<string, number> = {
    "walkout-pyro": 12,
    "walkout-smoke": 10,
    "walkout-sparks": 10,
    "victory-confetti": 8,
    "victory-fireworks": 14,
    "paint-neon": 6,
    "paint-candy": 6,
    "paint-ice": 6,
    "paint-royal": 6,
    "paint-coral": 6,
    "paint-mint": 6,
    "paint-sunset": 6,
    "paint-ultraviolet": 6,
    "paint-midnight": 6,
    "paint-bubblegum": 6,
    "wheel-neon": 5,
    "wheel-candy": 5,
    "wheel-ice": 5,
    "wheel-gold": 5,
    "wheel-ultraviolet": 5,
    "weapon-neon-fang": 8,
    "weapon-gold-fang": 8,
    "weapon-ice-fang": 8,
    "sticker-foil": 4,
    "finish-holographic": 14,
    "smoke-neon": 10,
    "smoke-candy": 10,
    "smoke-ice": 10,
    "smoke-royal": 10,
  };
  assert.deepEqual(
    Object.fromEntries(LOCKER.map((item) => [item.id, item.price])),
    lockerPrices,
  );
  const store = setup(0);
  store.setState({
    stores: store.getState().stores.map((row) =>
      row.id === STORE ? { ...row, boltsSpent: 30, unlocks: ["paint-neon"] } : row,
    ),
    bots: store.getState().bots.map((row) =>
      row.storeId === STORE ? { ...row, owned: [...row.owned, "weapon-saw-sport"] } : row,
    ),
  });
  assert.ok(bot(store).owned.includes("weapon-saw-sport"));
  assert.equal(store.getState().stores.find((row) => row.id === STORE)?.boltsSpent, 30);
  assert.equal(partById("weapon-saw-sport")!.price, 3);
  assert.equal(partById("weapon-saw-sport")!.boltPrice, 60);
  assert.equal(partById("weapon-saw-stock")!.boltPrice, 0);
  assert.equal(partById("weapon-saw-championship")!.boltPrice, 0);
});

test("the exchange can trade several coins at once and still stops at the weekly cap", () => {
  const store = setup();
  zeroJars(store);
  const start = balance(store);
  store.getState().convertBolts(STORE, "armor", 3);
  assert.equal(bot(store).coins.armor, 3);
  assert.equal(balance(store), start - boltsForCoins(3));
  assert.equal(boltCoinsLeft(store.getState(), STORE), BOLT_EXCHANGE.weeklyCoinCap - 3);

  const mid = snapshot(store);
  store.getState().convertBolts(STORE, "armor", 5);
  assert.equal(snapshot(store), mid, "a trade past the remaining cap changes nothing");
  assert.match(store.getState().flash, /2 more coins/);

  store.getState().convertBolts(STORE, "brain", 2);
  assert.equal(bot(store).coins.brain, 2);
  assert.equal(bot(store).coins.armor, 3);
  assert.equal(boltCoinsLeft(store.getState(), STORE), 0);
  assert.equal(balance(store), start - boltsForCoins(BOLT_EXCHANGE.weeklyCoinCap));

  const capped = snapshot(store);
  store.getState().convertBolts(STORE, "drive", 1);
  assert.equal(snapshot(store), capped);
  assert.match(store.getState().flash, /used/);
});

test("an emergency weld can be paid in Bolts and a short bay changes nothing", () => {
  const store = setup();
  store.setState({
    bots: store.getState().bots.map((row) =>
      row.storeId === STORE
        ? {
            ...row,
            coins: { ...row.coins, weapon: 4 },
            wear: { ...row.wear, weapon: "disabled" as const },
            partWear: { ...row.partWear, [PART]: "disabled" as const },
          }
        : row,
    ),
  });
  const start = balance(store);
  store.getState().repairSlot(STORE, "weapon", "weldBolts");
  assert.equal(bot(store).partWear[PART], "bent");
  assert.equal(bot(store).wear.weapon, "bent");
  assert.equal(bot(store).coins.weapon, 4, "the coin jar is untouched");
  assert.equal(bot(store).weldedParts?.[PART], 2);
  assert.equal(balance(store), start - boltsForCoins(REPAIR_PRICE.weld));
  assert.match(store.getState().flash, new RegExp(`${boltsForCoins(REPAIR_PRICE.weld)} Bolts`));

  const paid = setup();
  paid.setState({
    bots: paid.getState().bots.map((row) =>
      row.storeId === STORE
        ? {
            ...row,
            coins: { ...row.coins, weapon: 3 },
            wear: { ...row.wear, weapon: "disabled" as const },
            partWear: { ...row.partWear, [PART]: "disabled" as const },
          }
        : row,
    ),
  });
  const boltsBefore = balance(paid);
  paid.getState().repairSlot(STORE, "weapon", "weld");
  assert.equal(bot(paid).partWear[PART], "bent");
  assert.equal(bot(paid).coins.weapon, 2);
  assert.equal(balance(paid), boltsBefore, "a coin weld does not spend Bolts");

  const short = setup(1);
  short.setState({
    bots: short.getState().bots.map((row) =>
      row.storeId === STORE
        ? {
            ...row,
            coins: { ...row.coins, weapon: 4 },
            wear: { ...row.wear, weapon: "disabled" as const },
            partWear: { ...row.partWear, [PART]: "disabled" as const },
          }
        : row,
    ),
  });
  const before = snapshot(short);
  short.getState().repairSlot(STORE, "weapon", "weldBolts");
  assert.equal(snapshot(short), before);
  assert.match(short.getState().flash, /A Bolt weld is 10 Bolts\. The bay has 2/);
});

test("a captain can buy every slot with Bolts when the part is already on the peg", () => {
  const store = setup(200);
  zeroJars(store);
  const ids = [
    "chassis-shrike-sport",
    "armor-plate-sport",
    "drive-omni-sport",
    "weapon-saw-sport",
    "utility-peace-sport",
    "brain-logic-sport",
  ];
  const start = balance(store);
  for (const id of ids) {
    const part = partById(id)!;
    assert.equal(part.boltPrice, part.price * PART_BOLTS_PER_COIN);
    assert.equal(part.price * BOLT_EXCHANGE.boltsPerCoin * 2, part.boltPrice);
    assert.equal(buyCheck(store.getState(), STORE, part).ok, false, `${id} has no coins`);
    assert.equal(buyCheck(store.getState(), STORE, part, "bolts").ok, true, id);
    store.getState().buyPart(STORE, id, "bolts");
    assert.ok(bot(store).owned.includes(id), id);
    assert.equal(bot(store).equipped[part.slot], id);
    assert.equal(bot(store).coins[part.key], 0);
  }
  assert.equal(balance(store), start - ids.reduce((n, id) => n + partById(id)!.boltPrice, 0));
  assert.equal(commandArgs.buyPart.safeParse([STORE, ids[0]]).success, true);
  assert.equal(commandArgs.buyPart.safeParse([STORE, ids[0], "bolts"]).success, true);
  assert.equal(commandArgs.buyPart.safeParse([STORE, ids[0], "coins"]).success, true);
  assert.equal(commandArgs.buyPart.safeParse([STORE, ids[0], "gold"]).success, false);
  assert.equal(commandArgs.repairSlot.safeParse([STORE, "weapon", "weldBolts"]).success, true);
  assert.equal(commandArgs.repairSlot.safeParse([STORE, "weapon", "weld"]).success, true);
});

test("too few Bolts leaves a part, its coins, and the bay exactly as they were", () => {
  const store = setup(14);
  zeroJars(store);
  const before = snapshot(store);
  const part = partById("weapon-saw-sport")!;
  assert.equal(buyCheck(store.getState(), STORE, part, "bolts").ok, false);
  store.getState().buyPart(STORE, part.id, "bolts");
  assert.equal(snapshot(store), before);
  assert.match(store.getState().flash, /Needs 60 Bolts\. This bay has 28/);
});

test("Bolts do not skip grade, class, championship, date, captain, or lock gates", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: central(2026, 12, 1, 12).getTime() });
  const rich = setup(200);
  zeroJars(rich);

  const flail = partById("weapon-flail-super")!;
  assert.match(buyCheck(rich.getState(), STORE, flail, "bolts").reason, /2 green/);
  const flailBefore = snapshot(rich);
  rich.getState().buyPart(STORE, flail.id, "bolts");
  assert.equal(snapshot(rich), flailBefore);
  assert.match(rich.getState().flash, /2 green/);

  const axe = partById("weapon-axe-super")!;
  const rivet = partById("weapon-rivetgun-super")!;
  assert.match(buyCheck(rich.getState(), STORE, axe, "bolts").reason, /not on the peg/);
  assert.match(buyCheck(rich.getState(), STORE, rivet, "bolts").reason, /not on the peg/);
  const closed = snapshot(rich);
  rich.getState().buyPart(STORE, axe.id, "bolts");
  rich.getState().buyPart(STORE, rivet.id, "bolts");
  assert.equal(snapshot(rich), closed);

  const title = partById("weapon-saw-championship")!;
  assert.match(buyCheck(rich.getState(), STORE, title, "bolts").reason, /never sold/);
  rich.getState().buyPart(STORE, title.id, "bolts");
  assert.equal(bot(rich).owned.includes(title.id), false);

  const tankChassis = partById("chassis-keystone-sport")!;
  assert.match(buyCheck(rich.getState(), STORE, tankChassis, "bolts").reason, /Change class/);
  const classBefore = snapshot(rich);
  rich.getState().buyPart(STORE, tankChassis.id, "bolts");
  assert.equal(snapshot(rich), classBefore);
  assert.equal(bot(rich).classId, "striker");

  const crewStore = setup(80);
  zeroJars(crewStore);
  const crew = crewStore.getState().crew.find((c) => c.storeId === STORE && c.role === "specialist")!;
  crewStore.setState({ session: { role: "crew", storeId: STORE, crewId: crew.id } });
  const crewBefore = snapshot(crewStore);
  crewStore.getState().buyPart(STORE, "weapon-saw-sport", "bolts");
  assert.equal(snapshot(crewStore), crewBefore);
  assert.match(crewStore.getState().flash, /captain/);
  assert.throws(() => authorize(crewStore.getState(), crewStore.getState().session, "buyPart", [STORE, "weapon-saw-sport", "bolts"]));

  const locked = setup(80);
  zeroJars(locked);
  locked.setState({
    bots: locked.getState().bots.map((row) => (row.storeId === STORE ? { ...row, locked: { ...row.draft } } : row)),
  });
  const lockedBefore = snapshot(locked);
  locked.getState().buyPart(STORE, "armor-plate-sport", "bolts");
  assert.equal(snapshot(locked), lockedBefore);
  assert.match(locked.getState().flash, /locked/);

  const week5 = setup(80);
  zeroJars(week5);
  week5.setState({ week: 5, phase: "open" });
  const weekBefore = snapshot(week5);
  week5.getState().buyPart(STORE, "drive-omni-sport", "bolts");
  assert.equal(snapshot(week5), weekBefore);
  assert.match(week5.getState().flash, /Championship Week/);

  const shut = setup(80);
  zeroJars(shut);
  shut.setState({ phase: "locked" });
  const shutBefore = snapshot(shut);
  shut.getState().buyPart(STORE, "brain-logic-sport", "bolts");
  assert.equal(snapshot(shut), shutBefore);
  assert.match(shut.getState().flash, /shop shuts/i);
});

test("a seasonal part opens for Bolts only inside its window, and coins stay in the jar", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: central(2026, 11, 3, 12).getTime() });
  const store = setup(80);
  zeroJars(store);
  const axe = partById("weapon-axe-super")!;
  assert.equal(buyCheck(store.getState(), STORE, axe).ok, false);
  assert.equal(buyCheck(store.getState(), STORE, axe, "bolts").ok, true);
  const start = balance(store);
  store.getState().buyPart(STORE, axe.id, "bolts");
  assert.ok(bot(store).owned.includes(axe.id));
  assert.equal(bot(store).coins.weapon, 0);
  assert.equal(balance(store), start - axe.boltPrice);
  assert.equal(axe.price, 8);
  assert.equal(axe.boltPrice, 160);

  t.mock.timers.setTime(central(2026, 11, 10, 12).getTime());
  const later = setup(80);
  zeroJars(later);
  const rivet = partById("weapon-rivetgun-super")!;
  assert.equal(buyCheck(later.getState(), STORE, rivet, "bolts").ok, true);
  later.getState().buyPart(STORE, rivet.id, "bolts");
  assert.ok(bot(later).owned.includes(rivet.id));
  assert.equal(bot(later).coins.weapon, 0);
  assert.equal(buyCheck(later.getState(), STORE, partById("weapon-axe-super")!, "bolts").ok, false);
});

test("new two-tone, camouflage, tie-dye and Texas skins can be applied without changing fights", () => {
  const store = setup(50);
  const fight = simulateDuel(store.getState(), "plano", "allen", "skin-only");
  const coins = JSON.stringify(bot(store).coins);
  const starts = balance(store);
  for (const skin of ["two-tone", "camouflage", "tie-dye", "texas"] as const) {
    assert.equal(cosmeticUnlocked(store.getState(), STORE, "look", skin), true);
    assert.equal(commandArgs.setLook.safeParse([STORE, skin]).success, true);
    store.getState().setLook(STORE, skin);
    assert.equal(bot(store).look, skin);
    assert.equal(JSON.stringify(bot(store).coins), coins);
    assert.equal(balance(store), starts);
    const dressed = simulateDuel(store.getState(), "plano", "allen", "skin-only");
    assert.deepEqual(dressed.exchanges, fight.exchanges);
    assert.deepEqual(dressed.winnerIds, fight.winnerIds);
  }
  for (const color of ["lagoon", "peach", "berry", "lemon"]) {
    assert.equal(cosmeticUnlocked(store.getState(), STORE, "paint", color), true);
    store.getState().setPaint(STORE, color);
    assert.equal(store.getState().stores.find((row) => row.id === STORE)?.paint, color);
  }
});
