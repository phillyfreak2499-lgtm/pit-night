import test from 'node:test';
import assert from 'node:assert/strict';
import { fightStaggeredRumble } from '../src/lib/pit/rumble.server.ts';
import { frontierFighters } from './fixtures/week4-frontier-fighters.ts';
import { buildBeats, beatAt, fightDrive } from '../src/components/pit/cage-motion.ts';

const bots = Array.from({length:12}, (_, i) => ({...structuredClone(frontierFighters[i % 2]!), id:`bot-${i}`, brainFamily:'phoenix', stats:{power:20,speed:20,armor:20,heat:20}}));

test('entry clock and elimination are recorded deterministically', () => {
  const order = bots.map(b => b.id);
  const r = fightStaggeredRumble(bots, 'clock', order);
  assert.deepEqual(r, fightStaggeredRumble(bots, 'clock', order));
  assert.deepEqual(r.entries.map(e => e.at), [0,0,3,6,9,12,15,18,21,24,27,30]);
  const entries = Object.fromEntries(r.entries.map(e => [e.fighterId,e.at]));
  const dead = new Set<string>();
  for (const e of r.exchanges) {
    assert.ok(e.at! >= entries[e.attackerId]! && e.at! >= entries[e.defenderId]!);
    assert.ok(!dead.has(e.attackerId) && !dead.has(e.defenderId));
    for (const [id, trace] of Object.entries(e.combat!)) {
      assert.ok(!trace.revived);
      if (trace.after.hp === 0) dead.add(id);
    }
  }
  assert.equal(dead.size,11);
  assert.ok(r.exchanges.at(-1)!.at! >= 30);
  assert.equal(Object.values(r.hp).filter(h => h > 0).length,1);
});

test('first reciprocal engagement observes the entry constraint', () => {
  for (let shift=0;shift<12;shift++) {
    const order = bots.map((_,i)=>bots[(i+shift)%12]!.id);
    const r = fightStaggeredRumble(bots, `seed-${shift}`, order);
    const acted = new Set<string>();
    const dead = new Set<string>();
    for (const e of r.exchanges) {
      const living = r.entries.filter(x => x.at <= e.at! && !dead.has(x.fighterId));
      for (const id of [e.attackerId,e.defenderId]) {
        const trace=e.combat![id]!;
        if (!acted.has(id) && trace.hitCount > 0) {
          const opponent=id===e.attackerId?e.defenderId:e.attackerId;
          if (living.length>2 && entriesIndex(r.entries,id)>=2) assert.notEqual(opponent,living[0]!.fighterId);
          acted.add(id);
        }
      }
      for (const [id,trace] of Object.entries(e.combat!)) if(trace.after.hp===0) dead.add(id);
    }
  }
});
function entriesIndex(entries:{fighterId:string;at:number}[], id:string) { return entries.findIndex(e=>e.fighterId===id); }

test('recorded clock controls visible arrivals and health while seeking', () => {
  const r = fightStaggeredRumble(bots, 'playback', bots.map(b=>b.id));
  const result = { ...r, fighters:bots, rumbleEntries:r.entries, method:'melee', winnerIds:[r.order[0]!], seed:'playback' } as any;
  const beats=buildBeats(result);
  const rumble=beats.find(b=>b.kind==='rumble')!;
  assert.ok(rumble);
  for (const t of [0,2.9,3,8.5,30]) {
    const at=rumble.t+t;
    const beat=beatAt(beats,at);
    const state=fightDrive(result,beat,(at-beat.t)/beat.dur,at);
    assert.deepEqual(state.bots.map(b=>b.bot.id).sort(), r.entries.filter(e=>e.at<=t).map(e=>e.fighterId).sort());
  }
});

test('a strong first entrant can win and recorded health changes at the hit', () => {
  const field=bots.map((b,i)=>({...b, stats:i===0 ? {power:10000,speed:30,armor:100,heat:20} : {power:5,speed:5,armor:5,heat:5}}));
  const r=fightStaggeredRumble(field,'strong',field.map(b=>b.id));
  assert.equal(r.order[0],field[0]!.id);
  const result={...r,fighters:field,rumbleEntries:r.entries,method:'melee',winnerIds:[r.order[0]!],seed:'strong'} as any;
  const beat=buildBeats(result)[0]!;
  const ex=r.exchanges[0]!;
  const state=(at:number)=>fightDrive(result,beat,at/beat.dur,at);
  assert.equal(state(ex.at!-0.001).bots.find(b=>b.bot.id===ex.defenderId)!.hp,ex.combat![ex.defenderId]!.before.hp);
  assert.equal(state(ex.at!+0.001).bots.find(b=>b.bot.id===ex.defenderId)!.hp,ex.combat![ex.defenderId]!.after.hp);
});
