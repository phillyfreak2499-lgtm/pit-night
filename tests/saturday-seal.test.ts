import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as vanilla from "zustand/vanilla";
import * as storeModule from "../src/lib/pit/store.ts";
import { runServerCard } from "../src/lib/pit/run-card.server.ts";
import { makeData } from "../src/lib/pit/seed.ts";
import { recordOf, regularSeasonRecordOf, ROYAL_RUMBLE_TITLE, simulateChampionshipDuel } from "../src/lib/pit/engine.ts";
import { buildTape } from "../src/lib/pit/replay.ts";
import {
  browserBlocksSaturdaySeed,
  SATURDAY_BELL,
  saturdayBellReached,
  saturdayLockControls,
  saturdayPlayDecision,
  sealSaturday,
} from "../src/lib/pit/saturday-seal.ts";
import type { PitData, Session } from "../src/lib/pit/types.ts";

const publicSession: Session = { role: "public", storeId: null, crewId: null };
const deskSession: Session = { role: "commissioner", storeId: null, crewId: null };
const beforeBell = new Date(SATURDAY_BELL.getTime() - 1);
const atBell = new Date(SATURDAY_BELL.getTime());

function playedSaturday(): PitData {
  const store = vanilla.createStore(storeModule.createPitCreator(runServerCard));
  store.setState({ ...makeData(), session: deskSession });
  for (let week = 1; week <= 5; week++) {
    for (const row of store.getState().stores) store.getState().setOfficialNsnu(row.id, 1000 + row.seed * 53);
    store.getState().lockFriday();
    store.getState().runSaturday();
    if (week < 5) {
      store.getState().dropDamage();
      store.getState().advanceWeek();
    }
  }
  store.getState().dropDamage();
  const state = store.getState();
  return { ...storeModule.sharedDoc(state), session: deskSession, tutorialSeen: false };
}

const season = playedSaturday();
const rumble = season.bouts.find((bout) => bout.title === ROYAL_RUMBLE_TITLE)!;
const title = season.bouts.find((bout) => bout.title === "Waterman Championship")!;
const winnerId = rumble.result!.winnerIds[0]!;
const winnerName = season.stores.find((store) => store.id === winnerId)!.name;
const champId = title.result!.winnerIds[0]!;
const spoilerCall = rumble.result!.exchanges.find((exchange) => exchange.call.includes(winnerName))?.call ?? rumble.result!.exchanges[0]!.call;
const titleCall = title.result!.exchanges.at(-1)!.call;

test("the live watch opens at 9:30 AM CT on Saturday Nov 28", () => {
  assert.equal(SATURDAY_BELL.toISOString(), "2026-11-28T15:30:00.000Z");
  assert.equal(saturdayBellReached(beforeBell), false);
  assert.equal(saturdayBellReached(atBell), true);
});

test("client season JSON hides the Rumble and the Championship from fans and the Desk", () => {
  for (const session of [publicSession, deskSession]) {
    const view = storeModule.clientDoc(season, session);
    const body = JSON.stringify(view);
    assert.equal(view.bouts.find((bout) => bout.id === rumble.id)?.result, null);
    assert.equal(view.bouts.find((bout) => bout.id === title.id)?.result, null);
    assert.equal(view.replays?.find((row) => row.week === 5)?.bouts.every((bout) => bout.result == null), true);
    assert.equal(view.honors.thirdPlace ?? null, null);
    assert.equal(view.honors.pitBelt, null);
    assert.equal(view.honors.plate, null);
    assert.equal(view.honors.titleDrop, null);
    assert.equal(view.saturdayBaseline, undefined);
    assert.equal(body.includes(spoilerCall), false);
    assert.equal(body.includes(titleCall), false);
    assert.equal(body.includes(`"saturdayBaseline"`), false);
    assert.equal(view.gazette.some((entry) => entry.week === 5 && `${entry.headline} ${entry.body}`.includes(winnerName)), false);
    const worn = view.bots.find((bot) => bot.storeId === winnerId)!;
    const face = season.saturdayBaseline!.bots.find((bot) => bot.storeId === winnerId)!;
    assert.deepEqual(worn.wear, face.wear);
    const champFace = season.saturdayBaseline!.bots.find((bot) => bot.storeId === champId)!;
    const champBot = view.bots.find((bot) => bot.storeId === champId)!;
    assert.ok(champBot.owned.filter((id) => id.endsWith("-championship")).every((id) => champFace.owned.includes(id)));
    assert.equal(view.craft.some((row) => row.week === 5), false);
    assert.equal(view.log.some((line) => line.includes(winnerName)), false);
  }
  assert.equal(season.bouts.find((bout) => bout.id === rumble.id)?.result?.winnerIds[0], winnerId);
  assert.ok(season.saturdayBaseline);
});

test("weeks 1 through 4, including a conference tiebreaker, stay on the public tape", () => {
  const tie = {
    id: "w4-final-9-plano",
    week: 4,
    slot: 9,
    kind: "final" as const,
    title: "Metro Conference Tiebreaker",
    storeIds: ["plano", "allen"],
    teamA: ["plano"],
    teamB: ["allen"],
    result: title.result,
  };
  const withTie = { ...season, bouts: [...season.bouts, tie] };
  const view = sealSaturday(withTie);
  const weekOne = season.bouts.find((bout) => bout.week === 1 && bout.result);
  assert.ok(weekOne?.result);
  assert.equal(view.bouts.find((bout) => bout.id === weekOne!.id)?.result?.seed, weekOne!.result!.seed);
  assert.equal(view.bouts.find((bout) => bout.id === tie.id)?.result?.seed, title.result!.seed);
  for (const store of season.stores) {
    assert.deepEqual(regularSeasonRecordOf(view, store.id), regularSeasonRecordOf(season, store.id));
  }
  assert.ok(recordOf(view, winnerId).w < recordOf(season, winnerId).w);
  assert.equal(view.honors.bestBuild, season.honors.bestBuild);
});

test("sealed Saturday projections withhold opponents' actual computation inputs", () => {
  const hidden=structuredClone(season);
  hidden.bots=hidden.bots.map(bot=>({...bot,draft:{...bot.draft,brain:"brain-hunter-super"},locked:{...bot.locked!,brain:"brain-hunter-super"},equipped:{...bot.equipped,brain:"brain-hunter-super"}}));
  for (const role of ["public","commissioner","captain"] as const) {
    const own=role==="captain"?hidden.stores[0]!.id:null;
    const view=storeModule.clientDoc(hidden,{role,storeId:own,crewId:null});
    assert.equal(view.bouts.find(b=>b.id===title.id)?.result,null);
    for(const bot of view.bots) {
      if(bot.storeId===own)assert.equal(bot.draft.brain,"brain-hunter-super");
      else {assert.notEqual(bot.draft.brain,"brain-hunter-super");assert.deepEqual(bot.owned,[]);}
    }
  }
});

test("results publish one fight at a time and only after the bell for the Desk", () => {
  assert.deepEqual(saturdayPlayDecision({ role: "public", fight: "rumble", now: atBell, data: season }), {
    ok: false,
    error: "The Desk PIN starts this fight.",
  });
  assert.equal(saturdayPlayDecision({ role: "captain", fight: "rumble", now: atBell, data: season }).ok, false);
  const early = saturdayPlayDecision({ role: "commissioner", fight: "rumble", now: beforeBell, data: season });
  assert.equal(early.ok, false);
  if (!early.ok) assert.match(early.error, /9:30 AM CT/);
  assert.equal(saturdayPlayDecision({ role: "commissioner", fight: "championship", now: atBell, data: season }).ok, false);
  assert.equal(saturdayPlayDecision({ role: "commissioner", fight: "rumble", now: atBell, data: season }).ok, true);

  const afterRumble = sealSaturday({
    ...season,
    saturdayWatch: { ...season.saturdayWatch!, rumbleRevealedAt: atBell.getTime() },
  });
  assert.equal(afterRumble.bouts.find((bout) => bout.id === rumble.id)?.result?.winnerIds[0], winnerId);
  assert.equal(afterRumble.honors.thirdPlace, winnerId);
  assert.equal(afterRumble.bouts.find((bout) => bout.id === title.id)?.result, null);
  assert.equal(afterRumble.honors.pitBelt, null);
  assert.equal(afterRumble.honors.plate, null);
  const rumbleTape = buildTape(afterRumble, 5);
  assert.equal(rumbleTape.bouts.some((bout) => bout.id === rumble.id), true);
  assert.equal(rumbleTape.held.some((bout) => bout.id === title.id), true);
  assert.equal(saturdayPlayDecision({ role: "commissioner", fight: "championship", now: atBell, data: { ...season, saturdayWatch: afterRumble.saturdayWatch } }).ok, true);

  const both = sealSaturday({
    ...season,
    saturdayWatch: {
      ...season.saturdayWatch!,
      rumbleRevealedAt: atBell.getTime(),
      championshipRevealedAt: atBell.getTime() + 1,
    },
  });
  assert.equal(both.honors.pitBelt, champId);
  assert.equal(buildTape(both, 5).held.length, 0);
  assert.equal(buildTape(both, 5).bouts.length, 2);
});

test("a sealed week 5 card cannot be previewed or scrubbed from the public tape", () => {
  const view = storeModule.clientDoc(season, publicSession);
  const tape = buildTape(view, 5);
  assert.equal(tape.bouts.length, 0);
  assert.equal(tape.held.length, 2);
  assert.ok(tape.held.every((bout) => bout.result == null));
  const weekOne = buildTape(view, 1);
  assert.ok(weekOne.bouts.length > 0);
  assert.ok(weekOne.bouts.every((bout) => bout.result));
  assert.equal(weekOne.held.length, 0);
});

test("the lock screen asks non-desk viewers for the PIN and gives them no scrubber", () => {
  const fan = saturdayLockControls("public");
  const crew = saturdayLockControls("crew");
  const desk = saturdayLockControls("commissioner");
  assert.equal(fan.showPin, true);
  assert.equal(fan.showStart, false);
  assert.equal(fan.showScrub, false);
  assert.equal(crew.showStart, false);
  assert.equal(desk.showPin, false);
  assert.equal(desk.showStart, true);
  assert.equal(desk.showPeek, true);
  assert.equal(desk.showReveal, true);
  assert.equal(desk.showScrub, false);
  const source = readFileSync(new URL("../src/components/pit/saturday-gate.tsx", import.meta.url), "utf8");
  assert.match(source, /data-testid="saturday-lock"/);
  assert.match(source, /data-testid="saturday-pin"/);
  assert.match(source, /saturday-start-/);
  assert.match(source, /Desk eyes only/);
  assert.equal(source.includes('type="range"'), false);
  assert.match(source, /tape\?\.result && desk/);
  const startBody = source.slice(source.indexOf("const start = async"), source.indexOf("const post = async"));
  const armAt = startBody.indexOf("armBroadcastAudio()");
  const fetchAt = startBody.indexOf("await openSaturdayTape");
  assert.ok(armAt >= 0 && fetchAt > armAt);
});

test("the browser cannot compute a Saturday tape even if it calls the fight math", () => {
  assert.equal(browserBlocksSaturdaySeed("Period 12|w5|w5-final-2-plano|x"), false);
  const previous = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {};
  try {
    assert.equal(browserBlocksSaturdaySeed("Period 12|w4|w4-final-8-plano|x"), false);
    assert.equal(browserBlocksSaturdaySeed("Period 12|w5|w5-melee-1-plano|x"), true);
    const blocked = simulateChampionshipDuel(season, "plano", "allen", "Period 12|w5|w5-final-2-plano|x");
    assert.deepEqual(blocked.winnerIds, []);
    assert.deepEqual(blocked.exchanges, []);
    assert.deepEqual(blocked.hp, {});
  } finally {
    if (previous === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = previous;
  }
});
