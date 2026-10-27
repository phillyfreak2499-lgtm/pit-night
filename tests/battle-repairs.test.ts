import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "zustand/vanilla";
import { applyLeague14, clientDoc, pitCreator, sharedDoc } from "../src/lib/pit/store.ts";
import { buildCard, simulateDuel } from "../src/lib/pit/engine.ts";

const STORE = "plano";
const WELDED = "weapon-saw-pro";
const OTHER = "weapon-drum-pro";

function setup() {
  const store = createStore(pitCreator);
  const data = store.getState();
  store.setState({
    week: 2,
    phase: "open",
    session: { role: "commissioner", storeId: null, crewId: null },
    storeCards: data.storeCards.map((card) => ({ ...card, week: 2 })),
    bots: data.bots.map((bot) =>
      bot.storeId !== STORE
        ? bot
        : {
            ...bot,
            classId: "striker",
            locked: null,
            owned: [...bot.owned, WELDED, OTHER],
            equipped: { ...bot.equipped, weapon: WELDED },
            draft: { ...bot.draft, weapon: WELDED },
            coins: { ...bot.coins, weapon: 30 },
            voucher: 0,
            wear: { ...bot.wear, weapon: "disabled" },
            partWear: { [WELDED]: "disabled", [OTHER]: "bent" },
          },
    ),
  });
  return store;
}

const bot = (store: ReturnType<typeof setup>) =>
  store.getState().bots.find((row) => row.storeId === STORE)!;

function advance(store: ReturnType<typeof setup>) {
  store.setState({ phase: "inspected" });
  store.getState().advanceWeek();
}

test("an emergency weld expires on the repaired part after swapping and saving the league", () => {
  const store = setup();
  store.getState().repairSlot(STORE, "weapon", "weld");
  assert.equal(bot(store).partWear[WELDED], "bent");
  store.getState().setDraftPart(STORE, "weapon", OTHER);
  assert.equal(bot(store).equipped.weapon, OTHER);
  const restored = setup();
  restored.setState(JSON.parse(JSON.stringify(sharedDoc(store.getState()))));
  advance(restored);
  assert.equal(bot(restored).partWear[WELDED], "disabled");
  assert.equal(bot(restored).partWear[OTHER], "bent");
  assert.equal(bot(restored).wear.weapon, "bent");
});

test("legacy slot welds are bound to their current part before a later swap", () => {
  const store = setup();
  store.setState({
    bots: store.getState().bots.map((row) =>
      row.storeId !== STORE
        ? row
        : {
            ...row,
            partWear: { ...row.partWear, [WELDED]: "bent" },
            wear: { ...row.wear, weapon: "bent" },
            weldForWeek: { weapon: 2 },
          },
    ),
  });
  store.setState(applyLeague14(store.getState()));
  assert.ok((bot(store).services ?? 0) >= 1, "legacy repair achievement survives migration");
  store.getState().setDraftPart(STORE, "weapon", OTHER);
  advance(store);
  assert.equal(bot(store).partWear[WELDED], "disabled");
  assert.equal(bot(store).partWear[OTHER], "bent");
});

test("two welds in one slot expire independently and a full repair cancels only its part", () => {
  const store = setup();
  store.getState().repairSlot(STORE, "weapon", "weld");
  store.getState().setDraftPart(STORE, "weapon", OTHER);
  store.setState({
    bots: store.getState().bots.map((row) =>
      row.storeId !== STORE
        ? row
        : {
            ...row,
            partWear: { ...row.partWear, [OTHER]: "disabled" },
            wear: { ...row.wear, weapon: "disabled" },
          },
    ),
  });
  store.getState().repairSlot(STORE, "weapon", "weld");
  store.getState().repairSlot(STORE, "weapon", "full");
  advance(store);
  assert.equal(bot(store).partWear[WELDED], "disabled");
  assert.equal(bot(store).partWear[OTHER], "clean");
});

test("selling or salvaging clears only the removed part's weld expiry", () => {
  for (const action of ["sell", "salvage"] as const) {
    const store = setup();
    store.getState().repairSlot(STORE, "weapon", "weld");
    store.setState({
      bots: store.getState().bots.map((row) =>
        row.storeId !== STORE
          ? row
          : {
              ...row,
              weldedParts: { ...row.weldedParts, [OTHER]: 2 },
            },
      ),
    });
    if (action === "sell") store.getState().sellPart(STORE, WELDED);
    else store.getState().repairSlot(STORE, "weapon", "salvage");
    assert.equal(bot(store).owned.includes(WELDED), false, action);
    assert.equal(bot(store).weldedParts?.[WELDED], undefined, action);
    assert.equal(bot(store).weldedParts?.[OTHER], 2, action);
  }
});

test("championship salvage clears the replaced Super weld while preserving other repairs", () => {
  const store = setup();
  const superPart = "weapon-saw-super";
  store.setState({
    bots: store.getState().bots.map((row) =>
      row.storeId !== STORE
        ? row
        : {
            ...row,
            owned: [...row.owned, superPart],
            equipped: { ...row.equipped, weapon: superPart },
            draft: { ...row.draft, weapon: superPart },
            partWear: { ...row.partWear, [superPart]: "disabled" },
            weldedParts: { [superPart]: 2, [OTHER]: 2 },
          },
    ),
  });
  const bout = buildCard(store.getState()).find((row) => row.storeIds.includes(STORE))!;
  const result = simulateDuel(store.getState(), bout.teamA[0]!, bout.teamB[0]!, "crown");
  store.setState({ bouts: [{ ...bout, result: { ...result, winnerIds: [STORE] } }] });
  store.getState().repairSlot(STORE, "weapon", "crown");
  assert.equal(bot(store).equipped.weapon, "weapon-saw-championship");
  assert.equal(bot(store).weldedParts?.[superPart], undefined);
  assert.equal(bot(store).weldedParts?.[OTHER], 2);
});

test("private part weld IDs are hidden from public and opposing bays", () => {
  const store = setup();
  store.getState().repairSlot(STORE, "weapon", "weld");
  for (const session of [
    { role: "public", storeId: null, crewId: null },
    { role: "captain", storeId: "arlington", crewId: null },
  ] as const) {
    const hidden = clientDoc(store.getState(), session).bots.find((row) => row.storeId === STORE)!;
    assert.deepEqual(hidden.weldedParts, {});
  }
  assert.equal(
    sharedDoc(store.getState()).bots.find((row) => row.storeId === STORE)!.weldedParts?.[WELDED],
    2,
  );
});
