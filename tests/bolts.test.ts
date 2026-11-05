/** Bolts beyond the Locker: Garage repairs paid in Bolts and the capped Bolt exchange. */
import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "zustand/vanilla";
import { pitCreator, sharedDoc } from "../src/lib/pit/store.ts";
import { boltCoinsLeft, boltsOf } from "../src/lib/pit/week.ts";
import { BOLT_EXCHANGE, BOLTS } from "../src/lib/pit/training.ts";
import { REPAIR_PRICE } from "../src/lib/pit/catalog.ts";
import { authorize, CAPTAIN_BUILD_COMMANDS, commandArgs } from "../src/lib/pit/commands.ts";

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
