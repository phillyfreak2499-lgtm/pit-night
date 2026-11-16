import test from 'node:test';
import assert from 'node:assert/strict';
import { makeData } from '../src/lib/pit/seed.ts';
import { approvedCard, approvedCards, expectedHistory } from '../src/lib/pit/period12-approved-card.ts';
import { championshipFinalists } from '../src/lib/pit/engine.ts';
import { SHOWCASE_EVENTS, SHOWCASE_LOCK_AT, SHOWCASE_WATCH_AT, showcaseField } from '../src/lib/pit/showcase-model.ts';
import { freezeShowcase, saveShowcaseCard, prepareShowcase, previewShowcase, startShowcaseEvent, revealShowcaseEvent, setShowcaseEntryOrder, sealShowcase, showcaseBuildLocked } from '../src/lib/pit/showcase-state.server.ts';
import type { Bout } from '../src/lib/pit/types.ts';

function fixture() {
 const d=makeData(); d.week=5; d.phase='open'; d.storeCards.push(...structuredClone(approvedCards));
 d.bouts=[...expectedHistory.map((b,i)=>({ id:b.id,week:Number(b.id[1]),slot:i%7+1,kind:'bout',title:'Conference',storeIds:[...b.winners,...b.losers],teamA:[b.winners[0]!],teamB:[b.losers[0]!],result:{...structuredClone(approvedCard[0]!.result!),winnerIds:[...b.winners],loserIds:[...b.losers]} })),...structuredClone(approvedCard)] as Bout[];
 return d;
}
function ready() {
 let d=freezeShowcase(fixture(),SHOWCASE_LOCK_AT);
 for(const c of d.showcase!.cards!) d=saveShowcaseCard(d,{...c,nsnuOfficial:true},SHOWCASE_LOCK_AT);
 return prepareShowcase(d,SHOWCASE_LOCK_AT+1);
}
test('freeze uses current draft, preserves season, and locks only nonfinalists',()=>{
 const d=fixture(), field=showcaseField(d); assert.equal(field.length,12); assert.equal(championshipFinalists(d).length,2);
 const b=d.bots.find(x=>x.storeId===field[0])!; b.locked={...b.draft,weapon:'old-weapon'}; const original=structuredClone(d);
 assert.throws(()=>freezeShowcase(d,SHOWCASE_LOCK_AT-1),/before/);
 assert.equal(showcaseBuildLocked(d,field[0]!,SHOWCASE_LOCK_AT-1),false); assert.equal(showcaseBuildLocked(d,field[0]!,SHOWCASE_LOCK_AT),true);
 assert.equal(showcaseBuildLocked(d,championshipFinalists(d)[0]!,SHOWCASE_LOCK_AT),false);
 const frozen=freezeShowcase(d,SHOWCASE_LOCK_AT); assert.deepEqual(d,original);
 assert.deepEqual(frozen.showcase!.frozenBots![0]!.locked,b.draft); assert.deepEqual(frozen.showcase!.frozenBots![0]!.equipped,b.draft);
 assert.deepEqual(freezeShowcase(frozen,SHOWCASE_LOCK_AT+1),frozen); assert.deepEqual(frozen.storeCards,d.storeCards);
});
test('separate cards, deterministic preparation, read-only rehearsal and sealed projection',()=>{
 let d=freezeShowcase(fixture(),SHOWCASE_LOCK_AT); const before=structuredClone(d);
 previewShowcase(d,'team-gauntlet','rehearsal'); assert.deepEqual(d,before);
 assert.throws(()=>prepareShowcase(d,SHOWCASE_LOCK_AT),/official/);
 const first=d.showcase!.cards![0]!; assert.throws(()=>saveShowcaseCard(d,{...first,conv:101},SHOWCASE_LOCK_AT),/metric/);
 for(const c of d.showcase!.cards!) d=saveShowcaseCard(d,{...c,nsnuOfficial:true},SHOWCASE_LOCK_AT);
 const p=prepareShowcase(d,SHOWCASE_LOCK_AT+1), p2=prepareShowcase(d,SHOWCASE_LOCK_AT+100);
 assert.deepEqual(p.showcase!.events,p2.showcase!.events); assert.deepEqual(prepareShowcase(p,SHOWCASE_LOCK_AT+200),p);
 assert.deepEqual(previewShowcase(p,'team-gauntlet','prepared'),p.showcase!.events['team-gauntlet']!.tape);
 const sealed=sealShowcase(p); assert.equal(sealed.showcase!.frozenBots,undefined); assert.equal(sealed.showcase!.cards,undefined);
 assert.ok(SHOWCASE_EVENTS.every(e=>sealed.showcase!.events[e.id]!.tape===null));
 assert.deepEqual(p.storeCards,before.storeCards);
});
test('ordered reveal awards recorded winners and preserves the drawn entry prefix',()=>{
 let d=ready(); const originals=structuredClone([d.bots,d.bouts,d.honors,d.storeCards]);
 assert.throws(()=>startShowcaseEvent(d,'striker-race',SHOWCASE_WATCH_AT-1),/opened/);
 assert.throws(()=>startShowcaseEvent(d,'tank-pull',SHOWCASE_WATCH_AT),/prior/);
 for(const e of SHOWCASE_EVENTS){
  d=startShowcaseEvent(d,e.id,SHOWCASE_WATCH_AT); assert.deepEqual(startShowcaseEvent(d,e.id,SHOWCASE_WATCH_AT),d);
  const tape=structuredClone(d.showcase!.events[e.id]!.tape!); d=revealShowcaseEvent(d,e.id,SHOWCASE_WATCH_AT+1); assert.deepEqual(revealShowcaseEvent(d,e.id,SHOWCASE_WATCH_AT+2),d);
  assert.deepEqual(d.showcase!.events[e.id]!.tape,tape);
  if(tape.prize) for(const store of d.stores) assert.equal(!!store.unlocks?.includes(`showcase-prize:${tape.prize}`),tape.winnerIds.includes(store.id));
 }
 const team=d.showcase!.events['team-gauntlet']!.tape!, order=d.showcase!.entryOrder!; assert.equal(team.winnerIds.length,4); assert.deepEqual(new Set(order.slice(8)),new Set(team.winnerIds));
 const changed=setShowcaseEntryOrder(d,[...team.winnerIds].reverse(),SHOWCASE_WATCH_AT+2); assert.deepEqual(changed.showcase!.entryOrder!.slice(0,8),order.slice(0,8));
 assert.throws(()=>setShowcaseEntryOrder(d,team.winnerIds,Date.parse('2026-11-28T00:00:00Z')),/locked/);
 assert.deepEqual([d.bots,d.bouts,d.honors,d.storeCards],originals); assert.equal(showcaseBuildLocked(d,order[0]!,SHOWCASE_WATCH_AT+3),false);
 assert.deepEqual(sealShowcase(d).showcase!.events['team-gauntlet']!.tape,team);
});
