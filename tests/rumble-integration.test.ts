import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from 'zustand/vanilla';
import { makeData } from '../src/lib/pit/seed.ts';
import { buildCard, runSaturday, simulateBout, ROYAL_RUMBLE_TITLE } from '../src/lib/pit/engine.ts';
import { createPitCreator, sharedDoc } from '../src/lib/pit/store.ts';
import { runServerCard } from '../src/lib/pit/run-card.server.ts';
import type { PitData } from '../src/lib/pit/types.ts';

function saturday(): PitData {
  let data = makeData();
  for (let week = 1; week <= 4; week++) {
    data = { ...data, week };
    data = { ...data, bouts: [...data.bouts, ...runSaturday(data)] };
  }
  return { ...data, week: 5, phase: 'locked', session: { role: 'commissioner', storeId: null, crewId: null } };
}

test('the server card saves the adapted Rumble before deriving honors, news and archive', () => {
  const data = saturday();
  const past = structuredClone(data.bouts);
  const title = buildCard(data).find(b => b.title === 'Waterman Championship')!;
  const expectedTitle = simulateBout(data, title);
  const state = createStore(createPitCreator(runServerCard));
  state.setState(data);
  state.getState().runSaturday();
  const saved = sharedDoc(state.getState());
  const rumble = saved.bouts.find(b => b.title === ROYAL_RUMBLE_TITLE)!;
  assert.ok(rumble.result);
  assert.deepEqual(rumble.result.rumbleEntries?.map(e => e.at), [0,0,3,6,9,12,15,18,21,24,27,30]);
  assert.equal(rumble.result.winnerIds[0], rumble.result.meleeOrder?.[0]);
  assert.equal(rumble.result.loserIds.length, 11);
  assert.equal(saved.honors.thirdPlace, rumble.result.winnerIds[0]);
  const persistedRumble = JSON.parse(JSON.stringify(rumble.result));
  assert.deepEqual(JSON.parse(JSON.stringify(saved.replays?.find(r => r.week === 5)?.bouts.find(b => b.id === rumble.id)?.result)), persistedRumble);
  assert.deepEqual(saved.bouts.filter(b => b.week <= 4), past);
  assert.deepEqual(saved.bouts.find(b => b.title === 'Waterman Championship')?.result, expectedTitle);
  assert.ok(saved.gazette.some(g => g.boutId === rumble.id));
  assert.deepEqual(JSON.parse(JSON.stringify(saved)).bouts.find((b: {id:string}) => b.id === rumble.id).result, persistedRumble);
});

test('a Royal Rumble cannot fall back to the old simultaneous resolver', () => {
  const data = saturday();
  assert.throws(() => runSaturday(data), /server resolver/);
  const rumble = buildCard(data).find(b => b.title === ROYAL_RUMBLE_TITLE)!;
  assert.throws(() => simulateBout(data, rumble), /server resolver/);
});
