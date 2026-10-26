/** Selling bought parts back for 2 coins into that part's jar. */
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "zustand/vanilla";
import { pitCreator } from "../src/lib/pit/store.ts";
import { buyCheck, sellCheck, SELL_BACK } from "../src/lib/pit/engine.ts";
import { PARTS, partById, stockPart } from "../src/lib/pit/catalog.ts";
import { authorize, CAPTAIN_BUILD_COMMANDS } from "../src/lib/pit/commands.ts";
import type { Session } from "../src/lib/pit/types.ts";

beforeEach((t) => t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-27T15:00:00Z") }));

/** Week 1 with the kickoff paid (all green), signed in as Plano's captain with a starter body chosen. */
function plano() {
  const store = createStore(pitCreator);
  store.setState({ session: { role: "commissioner", storeId: null, crewId: null } });
  const s = store.getState();
  for (const st of s.stores) for (const m of ["nsnu", "conv", "demoRate", "demoClose", "arch", "ticket"] as const) s.setKickoffGrade(st.id, m, "green");
  store.getState().applyKickoff();
  const captain = store.getState().crew.find((c) => c.storeId === "plano" && c.role === "captain")!;
  store.setState({ session: { role: "captain", storeId: "plano", crewId: captain.id } });
  store.getState().chooseStarterBody("plano", "striker", "shrike");
  return store;
}

const bot = (store: ReturnType<typeof plano>) => store.getState().bots.find((b) => b.storeId === "plano")!;

/** A plain Sport weapon Plano can buy now (3 coins): no class lock, green-week gate or date window. */
function sportWeapon(store: ReturnType<typeof plano>) {
  return PARTS.find(
    (p) => p.slot === "weapon" && p.tier === "sport" && !p.classLock && !p.greenWeeks && !p.window && buyCheck(store.getState(), "plano", p).ok,
  )!;
}

test("a bought part sells for 2 coins into its own jar and the slot drops to stock", () => {
  const store = plano();
  const part = sportWeapon(store);
  assert.ok(part, "a Sport weapon is on the peg");
  const start = bot(store).coins[part.key];
  store.getState().buyPart("plano", part.id);
  assert.equal(bot(store).coins[part.key], start - part.price);
  assert.equal(bot(store).draft.weapon, part.id);

  store.getState().sellPart("plano", part.id);
  const after = bot(store);
  assert.equal(after.coins[part.key], start - part.price + SELL_BACK, "3 spent, 2 back");
  assert.ok(!after.owned.includes(part.id));
  assert.equal(after.draft.weapon, stockPart("weapon", after.classId).id);
  assert.equal(after.equipped.weapon, stockPart("weapon", after.classId).id);
  assert.match(store.getState().flash, /sold\. 2 weapon coins back/);
  // A sold part costs full price again.
  assert.equal(buyCheck(store.getState(), "plano", part).cost, part.price);
});

test("only bought parts sell, and not while the build is locked", () => {
  const store = plano();
  const part = sportWeapon(store);
  const stock = stockPart("weapon", bot(store).classId);
  assert.equal(sellCheck(store.getState(), "plano", stock).ok, false);
  assert.equal(sellCheck(store.getState(), "plano", part).ok, false, "not owned yet");
  const champ = PARTS.find((p) => p.tier === "championship")!;
  assert.match(sellCheck(store.getState(), "plano", champ).reason, /earned, not sold/);

  store.getState().buyPart("plano", part.id);
  store.getState().lockStore("plano");
  const coins = bot(store).coins[part.key];
  store.getState().sellPart("plano", part.id);
  assert.equal(bot(store).coins[part.key], coins, "locked builds cannot sell");
  assert.ok(bot(store).owned.includes(part.id));
});

test("selling is a captain build command for the captain's own store", () => {
  assert.ok(CAPTAIN_BUILD_COMMANDS.has("sellPart"));
  const store = plano();
  const data = store.getState();
  const captain = data.crew.find((c) => c.storeId === "plano" && c.role === "captain")!;
  const crew = data.crew.find((c) => c.storeId === "plano" && c.role === "specialist")!;
  const asCaptain: Session = { role: "captain", storeId: "plano", crewId: captain.id };
  const asCrew: Session = { role: "crew", storeId: "plano", crewId: crew.id };
  assert.doesNotThrow(() => authorize(data, asCaptain, "sellPart", ["plano", "x"]));
  assert.throws(() => authorize(data, asCaptain, "sellPart", ["waco", "x"]), /another store/);
  assert.throws(() => authorize(data, asCrew, "sellPart", ["plano", "x"]), /captain/);
  assert.ok(partById(sportWeapon(store).id));
});
