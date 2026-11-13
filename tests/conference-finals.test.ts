import test from "node:test";
import assert from "node:assert/strict";
import { makeData } from "../src/lib/pit/seed.ts";
import { buildCard, buildConferenceTiebreakers, conferenceChampion, conferenceTopTie, conferencePlace, regularSeasonComplete, regularSeasonRecordOf, runSaturday, simulateChampionshipDuel, ROYAL_RUMBLE_TITLE } from "../src/lib/pit/engine.ts";
import type { Bout, FightResult } from "../src/lib/pit/types.ts";

function tiedSeason(count: number) {
  const data = makeData();
  const metro = data.stores.filter(s => s.conference === "metro").slice(0, count);
  const frontier = data.stores.filter(s => s.conference === "frontier").slice(0, count);
  data.stores = [...metro, ...frontier];
  data.bots = data.bots.filter(b => data.stores.some(s => s.id === b.storeId));
  data.week = 4;
  data.phase = "locked";
  data.bouts = [];
  for (let week = 1; week <= 4; week++) for (let i = 0; i < count; i++) {
    const a = metro[i]!.id, b = frontier[(i + week) % count]!.id;
    const winner = week <= 2 ? a : b, loser = week <= 2 ? b : a;
    data.bouts.push({ id: `fixture-${week}-${i}`, week, slot: i + 1, kind: "bout", title: "Conference",
      storeIds: [a, b], teamA: [a], teamB: [b], result: { winnerIds: [winner], loserIds: [loser], method: "decision",
        fighters: [], exchanges: [], finisher: null, hp: {}, wear: {}, seed: "fixture", blowout: false } });
  }
  return data;
}

test("first-place ties ignore sales, head-to-head, grades and earned Bolts", () => {
  const data = tiedSeason(3), ids = data.stores.filter(s => s.conference === "metro").map(s => s.id);
  data.storeCards = data.storeCards.map(c => ({ ...c, nsnu: c.storeId === ids[0] ? 999999 : 1, nsnuOfficial: true }));
  data.stores.find(s => s.id === ids[0])!.boltsSpent = 99;
  assert.equal(regularSeasonComplete(data), true);
  assert.deepEqual(new Set(conferenceTopTie(data, "metro").map(s => s.id)), new Set(ids));
  assert.ok(ids.every(id => conferencePlace(data, id) === 1));
  assert.equal(conferenceChampion(data, "metro"), null);
});

test("two tied contenders duel for each conference berth and never use a decision", () => {
  const data = tiedSeason(2), extras = buildConferenceTiebreakers(data);
  assert.equal(extras.length, 2);
  for (const bout of extras) {
    assert.equal(bout.kind, "final"); assert.equal(bout.storeIds.length, 2);
    assert.equal(bout.result!.method, "dump");
    assert.ok(bout.result!.exchanges.at(-1)!.tags.includes("pit-elimination"));
  }
  data.bouts.push(...extras);
  assert.ok(conferenceChampion(data, "metro"));
  assert.equal(buildConferenceTiebreakers(data).length, 0);
});

test("three or more tied contenders battle simultaneously and standings exclude the extra fight", () => {
  const data = tiedSeason(3), before = data.stores.map(s => regularSeasonRecordOf(data, s.id));
  const extras = buildConferenceTiebreakers(data);
  assert.equal(extras.length, 2);
  assert.ok(extras.every(b => b.kind === "melee" && b.teamA.length === 3 && b.teamB.length === 0));
  for (const bout of extras) {
    const result = bout.result!;
    assert.equal(result.meleeOrder!.length, 3);
    assert.equal(Object.values(result.hp).filter(hp => hp > 0).length, 1);
    assert.equal(result.exchanges.filter(e => e.tags.includes("pit-elimination")).length, 2);
  }
  data.bouts.push(...extras);
  assert.deepEqual(data.stores.map(s => regularSeasonRecordOf(data, s.id)), before);
  const winner = conferenceChampion(data, "metro")!;
  assert.equal(conferencePlace(data, winner), 1);
  assert.ok(data.stores.filter(s => s.conference === "metro" && s.id !== winner).every(s => conferencePlace(data, s.id) === 2));
});

test("missing or duplicate regular-season appearances cannot unlock a championship", () => {
  const data = tiedSeason(3), missing = data.bouts.pop()!;
  data.bouts.push({ ...data.bouts[0]!, id: "duplicate" });
  assert.equal(regularSeasonComplete(data), false);
  assert.equal(conferenceChampion(data, "metro"), null);
  assert.deepEqual(buildConferenceTiebreakers(data), []);
  data.bouts.pop(); data.bouts.push(missing);
  assert.equal(regularSeasonComplete(data), true);
});

test("a stale or partial conference tiebreaker result cannot name the champion", () => {
  const data = tiedSeason(3), bout = buildConferenceTiebreakers(data)[0]!;
  const bad: Bout = { ...bout, storeIds: bout.storeIds.slice(1), result: bout.result };
  data.bouts.push(bad);
  assert.equal(conferenceChampion(data, "metro"), null);
  data.bouts[data.bouts.length - 1] = { ...bout, result: { ...bout.result!, winnerIds: ["not-in-field"] } as FightResult };
  assert.equal(conferenceChampion(data, "metro"), null);
});

test("Week 5 fields all nonfinalists in the third-place Rumble before the title", () => {
  const data = makeData();
  for (let week = 1; week <= 4; week++) {
    data.week = week; data.bouts = [...data.bouts, ...runSaturday(data)];
  }
  data.week = 5;
  const card = buildCard(data);
  assert.equal(card.length, 2);
  assert.equal(card[0]!.title, ROYAL_RUMBLE_TITLE);
  assert.equal(card[0]!.storeIds.length, 12);
  assert.equal(card[1]!.kind, "final");
  assert.equal(new Set(card.flatMap(b => b.storeIds)).size, 14);
  assert.match(card[1]!.id, /^w5-final-1-/);
  assert.equal(card[1]!.slot, 2);
});

test("championship replay records a real pit elimination with no duplicate finisher", () => {
  const data = makeData(); data.week = 5;
  const result = simulateChampionshipDuel(data, "plano", "allen", "title-pit-test");
  assert.equal(result.method, "dump"); assert.equal(result.finisher, null);
  assert.deepEqual(result.pitTarget, { x: 0.5, y: 0.64 });
  assert.equal(result.hp[result.loserIds[0]!], 0);
  assert.ok(result.exchanges.at(-1)!.tags.includes("pit-elimination"));
  assert.ok(result.exchanges.slice(0, -1).every(e => e.attackerHp > 0 && e.defenderHp > 0));
});
