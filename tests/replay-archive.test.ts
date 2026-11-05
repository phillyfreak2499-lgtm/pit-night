import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createStore } from "zustand/vanilla";
import { buildBeats } from "../src/components/pit/cage-motion.ts";
import { recordOf } from "../src/lib/pit/engine.ts";
import { buildTape, replayFingerprint, replayWeek } from "../src/lib/pit/replay.ts";
import { applyLeague14, pitCreator, sharedDoc } from "../src/lib/pit/store.ts";
import type { Bout, PitData, StatKey } from "../src/lib/pit/types.ts";

const GRADES = ["nsnu", "conv", "demoRate", "demoClose", "arch", "ticket"] as const satisfies readonly StatKey[];

function desk() {
  const store = createStore(pitCreator);
  store.setState({ session: { role: "commissioner", storeId: null, crewId: null } });
  return store;
}

function runCard(store: ReturnType<typeof desk>) {
  for (const row of store.getState().stores) {
    store.getState().setOfficialNsnu(row.id, 900 + row.seed * 10);
    for (const key of GRADES) store.getState().setGrade(row.id, key, "blue");
  }
  store.getState().lockFriday();
  store.getState().runSaturday();
}

function pack(bouts: readonly Bout[]) {
  return JSON.parse(JSON.stringify(bouts.map((bout) => bout.result)));
}

function seasonSlice(data: PitData) {
  return {
    week: data.week,
    phase: data.phase,
    coins: data.bots.map((bot) => ({ id: bot.storeId, coins: bot.coins, wear: bot.partWear, voucher: bot.voucher })),
    records: data.stores.map((store) => ({ id: store.id, ...recordOf(data, store.id) })),
    doc: JSON.stringify(sharedDoc(data)),
  };
}

test("advancing keeps the prior week replayable in the season document", () => {
  const store = desk();
  runCard(store);
  const original = replayWeek(store.getState(), 1);
  assert.equal(original.length, 7);
  assert.ok(original.every((bout) => bout.result && bout.result.exchanges.length > 0 && bout.result.fighters.length > 0 && bout.result.seed));
  const fingerprint = replayFingerprint(original);
  const originalBeats = original.map((bout) => buildBeats(bout.result!));

  store.getState().dropDamage();
  store.getState().advanceWeek();

  assert.equal(store.getState().week, 2);
  assert.equal(store.getState().phase, "open");
  const doc = sharedDoc(store.getState());
  const saved = JSON.parse(JSON.stringify(doc)) as PitData;
  assert.ok(saved.replays?.some((card) => card.week === 1 && card.bouts.length === 7));
  assert.equal(saved.bouts.filter((bout) => bout.week === 1 && bout.result).length, 7);

  const replay = replayWeek(saved, 1);
  assert.equal(replayFingerprint(replay), fingerprint);
  assert.deepEqual(pack(replay), pack(original));
  assert.deepEqual(
    replay.map((bout) => buildBeats(bout.result!)),
    originalBeats,
  );
  assert.equal(buildTape(saved, 1).replay, true);
  assert.equal(replayFingerprint(buildTape(saved, 1).bouts), fingerprint);

  // A later card, and even deleting the live bout rows, cannot erase the frozen tape.
  runCard(store);
  store.getState().dropDamage();
  store.getState().advanceWeek();
  assert.equal(store.getState().week, 3);
  store.setState({
    bouts: store.getState().bouts.filter((bout) => bout.week !== 1),
    bots: store.getState().bots.map((bot) => ({
      ...bot,
      coins: { chassis: 9, drive: 9, weapon: 9, armor: 9, utility: 9, brain: 9 },
      draft: { ...bot.draft, weapon: bot.draft.weapon },
      locked: null,
    })),
  });
  const still = replayWeek(store.getState(), 1);
  assert.equal(replayFingerprint(still), fingerprint);
  assert.deepEqual(pack(still), pack(original));
  assert.equal(replayWeek(store.getState(), 2).length, 7);
  assert.notEqual(replayFingerprint(replayWeek(store.getState(), 2)), fingerprint);
});

test("replaying is deterministic and identical to the original card", () => {
  const store = desk();
  runCard(store);
  const posted = replayWeek(store.getState(), 1);
  store.getState().dropDamage();
  store.getState().advanceWeek();
  const roundTrip = JSON.parse(JSON.stringify(sharedDoc(store.getState()))) as PitData;

  const first = replayWeek(roundTrip, 1);
  const second = replayWeek(roundTrip, 1);
  assert.notEqual(first, second);
  assert.deepEqual(first, second);
  assert.deepEqual(pack(first), pack(posted));
  assert.equal(replayFingerprint(first), replayFingerprint(posted));
  for (const bout of first) {
    const beats = buildBeats(bout.result!);
    assert.deepEqual(buildBeats(bout.result!), beats);
    const original = posted.find((row) => row.id === bout.id)!;
    assert.deepEqual(beats, buildBeats(original.result!));
  }
  assert.deepEqual(buildTape(roundTrip, 1).bouts, first);
});

test("replay does not mutate coins, damage, records, or the week", () => {
  const store = desk();
  runCard(store);
  store.getState().dropDamage();
  const coinsBefore = store.getState().bots.map((bot) => bot.coins.weapon);
  store.getState().advanceWeek();
  assert.notDeepEqual(
    store.getState().bots.map((bot) => bot.coins.weapon),
    coinsBefore,
  );

  const before = seasonSlice(store.getState());
  const tape = replayWeek(store.getState(), 1);
  const shown = buildTape(store.getState(), 1);
  tape[0]!.result!.winnerIds = ["tampered"];
  tape[0]!.result!.exchanges = [];
  shown.bouts[0]!.result!.hp = {};
  const again = replayWeek(store.getState(), 1);

  assert.deepEqual(seasonSlice(store.getState()), before);
  assert.equal(store.getState().week, 2);
  assert.equal(store.getState().phase, "open");
  assert.notEqual(again[0]!.result!.winnerIds[0], "tampered");
  assert.ok(again[0]!.result!.exchanges.length > 0);
  assert.equal(replayFingerprint(again), replayFingerprint(JSON.parse(before.doc).replays[0].bouts));
});

test("a season saved before the archive still replays from its posted bouts", () => {
  const store = desk();
  runCard(store);
  const fingerprint = replayFingerprint(replayWeek(store.getState(), 1));
  const legacy = { ...store.getState(), replays: undefined };
  const filled = applyLeague14(legacy);
  assert.equal(replayFingerprint(replayWeek(filled, 1)), fingerprint);
  const doc = JSON.parse(JSON.stringify(sharedDoc(filled))) as PitData;
  assert.equal(replayFingerprint(replayWeek(doc, 1)), fingerprint);
});

test("Fight Day and the watch party list the replay archive and play the saved card", () => {
  const show = readFileSync(new URL("../src/components/pit/show-page.tsx", import.meta.url), "utf8");
  const watch = readFileSync(new URL("../src/components/pit/watch-page.tsx", import.meta.url), "utf8");
  assert.match(show, /data-testid="replay-archive"/);
  assert.match(watch, /data-testid="replay-archive"/);
  assert.match(show, /replay-week-/);
  assert.match(watch, /replay-week-/);
  assert.match(show, /buildTape\(data, weekPick\)/);
  assert.match(readFileSync(new URL("../src/lib/pit/replay.ts", import.meta.url), "utf8"), /previewSaturday\(data\)/);
  assert.match(show, /Watching it does not change coins, damage, records, or the week/);
  assert.match(watch, /Watching it does not change coins, damage, records, or the week/);
});
