import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from 'zustand/vanilla';
import { makeData } from '../src/lib/pit/seed.ts';
import { approvedCard, approvedCards, expectedHistory } from '../src/lib/pit/period12-approved-card.ts';
import { buildCard, championshipFinalists, ROYAL_RUMBLE_TITLE, runSaturday, snapshot } from '../src/lib/pit/engine.ts';
import { captainBuildRejection, commandArgs } from '../src/lib/pit/commands.ts';
import { clientDoc, pitCreator, sharedDoc, showcaseFreezeDue } from '../src/lib/pit/store.ts';
import { styleOf } from '../src/lib/pit/catalog.ts';
import { SHOWCASE_EVENTS, SHOWCASE_LOCK_AT, SHOWCASE_WATCH_AT, showcaseField } from '../src/lib/pit/showcase-model.ts';
import { freezeShowcase, prepareShowcase, saveShowcaseCard, startShowcaseEvent, revealShowcaseEvent, previewShowcase, sealShowcase } from '../src/lib/pit/showcase-state.server.ts';
import { runServerCard } from '../src/lib/pit/run-card.server.ts';
import type { Bout, PitData } from '../src/lib/pit/types.ts';

function fixture(): PitData {
 const d=makeData(); d.week=5; d.phase='open'; d.storeCards.push(...structuredClone(approvedCards));
 d.bouts=[...expectedHistory.map((b,i)=>({id:b.id,week:Number(b.id[1]),slot:i%7+1,kind:'bout',title:'Conference',storeIds:[...b.winners,...b.losers],teamA:[b.winners[0]!],teamB:[b.losers[0]!],result:{...structuredClone(approvedCard[0]!.result!),winnerIds:[...b.winners],loserIds:[...b.losers]}})),...structuredClone(approvedCard)] as Bout[];
 return d;
}
function prepared() {
 let d=freezeShowcase(fixture(),SHOWCASE_LOCK_AT);
 for (const c of d.showcase!.cards!) d=saveShowcaseCard(d,{...c,nsnuOfficial:true},SHOWCASE_LOCK_AT);
 return prepareShowcase(d,SHOWCASE_LOCK_AT+1);
}
test('automatic freeze becomes due only for a valid confirmed field at the lock',()=>{
 const d=fixture(); assert.equal(showcaseFreezeDue(d,SHOWCASE_LOCK_AT-1),false);
 assert.equal(showcaseFreezeDue(d,SHOWCASE_LOCK_AT),true);
 assert.equal(showcaseFreezeDue(freezeShowcase(d,SHOWCASE_LOCK_AT),SHOWCASE_LOCK_AT+1),false);
 const invalid=structuredClone(d); invalid.bots=invalid.bots.filter(b=>b.storeId!==showcaseField(d)[0]);
 assert.equal(showcaseFreezeDue(invalid,SHOWCASE_LOCK_AT),false);
 assert.equal(showcaseFreezeDue(makeData(),SHOWCASE_LOCK_AT),false);
});
test('build boundary targets the showcase field, including accepted proposals',()=>{
 const d=fixture(), id=showcaseField(d)[0]!, finalist=championshipFinalists(d)[0]!;
 d.proposals.push({id:'p',storeId:id,crewId:'x',crewName:'x',partId:'x',note:''});
 const reject=(name: keyof typeof commandArgs,args:unknown[],at=SHOWCASE_LOCK_AT)=>captainBuildRejection(name,'captain',5,new Date(at),{data:d,args});
 assert.equal(reject('setDraftPart',[id],SHOWCASE_LOCK_AT-1),null);
 for(const name of ['setDraftPart','setDraftLoadout','lockStore','chooseStarterBody','switchClass','buyPart','sellPart','buyShow','repairSlot'] as const) assert.match(reject(name,[id])!,/Showcase/);
 assert.match(reject('acceptProposal',['p'])!,/Showcase/);
 assert.equal(reject('setDraftPart',[finalist]),null);
 assert.equal(reject('setStyle',[id]),null);
 assert.equal(captainBuildRejection('setDraftPart','commissioner',5,new Date(SHOWCASE_LOCK_AT),{data:d,args:[id]}),null);
 d.showcase=prepared().showcase; for(const e of SHOWCASE_EVENTS) d.showcase!.events[e.id]!.revealedAt=SHOWCASE_WATCH_AT;
 assert.equal(reject('setDraftPart',[id]),null);
 assert.ok(reject('setDraftPart',[id],Date.parse('2026-11-28T01:00:00Z')));
});
test('client build feedback blocks a field captain at the same boundary', t=>{
 t.mock.timers.enable({apis:['Date'],now:SHOWCASE_LOCK_AT});
 const d=prepared(), id=d.showcase!.field[0]!; const state=createStore(pitCreator);
 state.setState({...d,session:{role:'captain',storeId:id,crewId:null}});
 const before=structuredClone(state.getState().bots.find(b=>b.storeId===id)!.draft);
 state.getState().setDraftPart(id,'weapon','fake-part');
 assert.match(state.getState().flash,/Showcase/);
 assert.deepEqual(state.getState().bots.find(b=>b.storeId===id)!.draft,before);
});
test('client projection seals prepared private data for every role without mutation',()=>{
 const d=prepared(); d.showcase!.entryOrder=['PRIVATE-ENTRY'];
 d.showcase!.frozenBots![0]!.name='PRIVATE-BOT'; d.showcase!.cards![0]!.id='PRIVATE-CARD';
 const tape=d.showcase!.events['tank-pull']!.tape!; tape.seed='PRIVATE-TAPE'; tape.fighters[0]!.botName='PRIVATE-INJURED'; tape.title='PRIVATE-WINNER';
 const original=structuredClone(d), persisted=sharedDoc(d);
 assert.equal(persisted.showcase!.events['tank-pull']!.tape!.seed,'PRIVATE-TAPE');
 for(const role of ['public','crew','captain','commissioner'] as const){
  const view=clientDoc(d,{role,storeId:d.showcase!.field[0]!,crewId:null}); const json=JSON.stringify(view.showcase);
  for(const secret of ['PRIVATE-ENTRY','PRIVATE-BOT','PRIVATE-CARD','PRIVATE-TAPE','PRIVATE-INJURED','PRIVATE-WINNER']) assert.ok(!json.includes(secret),`${role} leaked ${secret}`);
  assert.ok(SHOWCASE_EVENTS.every(e=>view.showcase!.events[e.id]!.tape===null));
 }
 assert.deepEqual(d,original);
});
test('awards are required for direct and proposed cosmetics, and can be equipped or removed',()=>{
 let d=prepared(); const event=d.showcase!.events['striker-race']!.tape!, id=event.winnerIds[0]!;
 const captain=d.crew.find(c=>c.storeId===id && c.role==='captain')!;
 const state=createStore(pitCreator); state.setState({...d,session:{role:'captain',storeId:id,crewId:captain.id}});
 state.getState().setStyle(id,{showcasePrize:'rocket-tail'}); assert.notEqual(state.getState().bots.find(b=>b.storeId===id)!.style?.showcasePrize,'rocket-tail');
 const bot=d.bots.find(b=>b.storeId===id)!, store=d.stores.find(s=>s.id===id)!;
 const loadout={paint:store.paint,look:bot.look,number:bot.number,style:{...styleOf(bot),showcasePrize:'rocket-tail' as const}};
 const crew=d.crew.find(c=>c.storeId===id && c.role==='specialist')!; state.setState({session:{role:'crew',storeId:id,crewId:crew.id}});
 state.getState().proposeCosmetic(id,loadout); assert.equal(state.getState().cosmeticProposals.length,0);
 state.setState({session:{role:'captain',storeId:id,crewId:captain.id}});
 state.setState({cosmeticProposals:[{id:'forged',storeId:id,crewId:'x',crewName:'x',loadout,voters:[],at:0,status:'open'}]});
 state.getState().acceptCosmetic('forged'); assert.equal(state.getState().cosmeticProposals[0]!.status,'open');
 assert.equal(Object.hasOwn(commandArgs,'buyShowcasePrize'),false);
 state.getState().buyLocker(id,'showcase-prize:rocket-tail');
 assert.ok(!state.getState().stores.find(s=>s.id===id)!.unlocks?.includes('showcase-prize:rocket-tail'));
 d=startShowcaseEvent(d,'striker-race',SHOWCASE_WATCH_AT); d=revealShowcaseEvent(d,'striker-race',SHOWCASE_WATCH_AT+1);
 state.setState({...d,session:{role:'captain',storeId:id,crewId:null}}); state.getState().setStyle(id,{showcasePrize:'rocket-tail'});
 assert.equal(state.getState().bots.find(b=>b.storeId===id)!.style?.showcasePrize,'rocket-tail');
 state.getState().setStyle(id,{showcasePrize:'none'}); assert.equal(state.getState().bots.find(b=>b.storeId===id)!.style?.showcasePrize,'none');
});
test('earned equipped prize changes only the Rumble fighter snapshot',()=>{
 let d=makeData(); for(let week=1;week<=4;week++){ d={...d,week}; d={...d,bouts:[...d.bouts,...runSaturday(d)]}; }
 d={...d,week:5,phase:'locked'}; const id=buildCard(d).find(b=>b.title===ROYAL_RUMBLE_TITLE)!.storeIds[0]!;
 const base=runServerCard(d), before=snapshot(d,id), bot=d.bots.find(b=>b.storeId===id)!, store=d.stores.find(s=>s.id===id)!;
 bot.style={...bot.style,showcasePrize:'rocket-tail'}; const unowned=runServerCard(d);
 const fighter=(rows:Bout[])=>rows.find(b=>b.title===ROYAL_RUMBLE_TITLE)!.result!.fighters.find(f=>f.id===id)!;
 assert.deepEqual(fighter(unowned).stats,fighter(base).stats);
 store.unlocks=[...(store.unlocks??[]),'showcase-prize:rocket-tail']; const earned=runServerCard(d);
 assert.equal(fighter(earned).stats.speed,fighter(base).stats.speed+2); assert.deepEqual(snapshot(d,id).stats,before.stats);
 assert.deepEqual(earned.find(b=>b.title==='Waterman Championship')!.result,base.find(b=>b.title==='Waterman Championship')!.result);
 bot.style.showcasePrize='none'; assert.deepEqual(fighter(runServerCard(d)).stats,fighter(base).stats);
});

test('frozen identities and seed survive later paint and name changes; rehearsal uses current identity',()=>{
 let frozen=freezeShowcase(fixture(),SHOWCASE_LOCK_AT);
 for(const c of frozen.showcase!.cards!) frozen=saveShowcaseCard(frozen,{...c,nsnuOfficial:true},SHOWCASE_LOCK_AT);
 const changed=structuredClone(frozen), id=changed.showcase!.field[0]!;
 const store=changed.stores.find(s=>s.id===id)!; store.paint='mud'; store.name='Changed name';
 const baseline=prepareShowcase(frozen,SHOWCASE_LOCK_AT+1), after=prepareShowcase(changed,SHOWCASE_LOCK_AT+1);
 assert.deepEqual(after.showcase!.events,baseline.showcase!.events);
 assert.equal(after.showcase!.events['team-gauntlet']!.tape!.fighters.find(f=>f.id===id)!.paint,frozen.stores.find(s=>s.id===id)!.paint);
 assert.equal(previewShowcase(changed,'team-gauntlet','rehearsal').fighters.find(f=>f.id===id)!.paint,'mud');
 assert.equal(sealShowcase(after).showcase!.frozenStores,undefined);
 assert.ok(sharedDoc(after).showcase!.frozenStores);
 for(const role of ['public','crew','captain','commissioner'] as const) assert.equal(clientDoc(after,{role,storeId:id,crewId:null}).showcase!.frozenStores,undefined);
});

test('prize changes stop at Friday lock while ordinary edits and Desk override remain available',t=>{
 const lock=Date.parse('2026-11-28T00:00:00Z'); t.mock.timers.enable({apis:['Date'],now:lock-1});
 const d=prepared(), id=d.showcase!.field[0]!, store=d.stores.find(s=>s.id===id)!, bot=d.bots.find(b=>b.storeId===id)!;
 store.unlocks=[...(store.unlocks??[]),'showcase-prize:rocket-tail'];
 const captain=d.crew.find(c=>c.storeId===id && c.role==='captain')!;
 const state=createStore(pitCreator); state.setState({...d,session:{role:'captain',storeId:id,crewId:captain.id}});
 state.getState().setStyle(id,{showcasePrize:'rocket-tail'}); assert.equal(state.getState().bots.find(b=>b.storeId===id)!.style?.showcasePrize,'rocket-tail');
 state.getState().setStyle(id,{showcasePrize:'none'}); assert.equal(state.getState().bots.find(b=>b.storeId===id)!.style?.showcasePrize,'none');
 const loadout={paint:'amber',look:'plain' as const,number:bot.number,style:{...styleOf({classId:bot.classId}),showcasePrize:'rocket-tail' as const}};
 const proposal={id:'valid',storeId:id,crewId:'x',crewName:'x',loadout,voters:[],at:0,status:'open' as const};
 const specialist=d.crew.find(c=>c.storeId===id && c.role==='specialist')!;
 state.setState({session:{role:'crew',storeId:id,crewId:specialist.id},cosmeticProposals:[]});
 state.getState().proposeCosmetic(id,loadout); assert.equal(state.getState().cosmeticProposals.length,1);
 state.setState({session:{role:'captain',storeId:id,crewId:captain.id}});
 state.setState({cosmeticProposals:[proposal]}); state.getState().acceptCosmetic('valid'); assert.equal(state.getState().cosmeticProposals[0]!.status,'accepted',state.getState().flash);
 state.getState().setStyle(id,{showcasePrize:'none'}); state.setState({cosmeticProposals:[proposal]});
 t.mock.timers.setTime(lock);
 state.getState().setStyle(id,{showcasePrize:'rocket-tail'}); assert.equal(state.getState().bots.find(b=>b.storeId===id)!.style?.showcasePrize,'none');
 state.getState().acceptCosmetic('valid'); assert.equal(state.getState().cosmeticProposals[0]!.status,'open');
 const crew=d.crew.find(c=>c.storeId===id && c.role==='specialist')!; state.setState({session:{role:'crew',storeId:id,crewId:crew.id},cosmeticProposals:[]});
 state.getState().proposeCosmetic(id,loadout); assert.equal(state.getState().cosmeticProposals.length,0);
 state.setState({session:{role:'captain',storeId:id,crewId:captain.id}}); state.getState().setStyle(id,{flag:true}); assert.equal(state.getState().bots.find(b=>b.storeId===id)!.style?.flag,true);
 state.getState().setPaint(id,'amber'); assert.equal(state.getState().stores.find(s=>s.id===id)!.paint,'amber');
 state.setState({session:{role:'commissioner',storeId:null,crewId:null}}); state.getState().setStyle(id,{showcasePrize:'rocket-tail'}); assert.equal(state.getState().bots.find(b=>b.storeId===id)!.style?.showcasePrize,'rocket-tail');
 state.setState({session:{role:'captain',storeId:id,crewId:captain.id},phase:'locked'}); t.mock.timers.setTime(lock-1);
 state.getState().setStyle(id,{showcasePrize:'none'}); assert.equal(state.getState().bots.find(b=>b.storeId===id)!.style?.showcasePrize,'rocket-tail');
 state.setState({cosmeticProposals:[proposal]}); state.getState().acceptCosmetic('valid'); assert.equal(state.getState().cosmeticProposals[0]!.status,'accepted');
});

test('readSeasonFrom reads the actual row without any write',async()=>{
 const {readSeasonFrom}=await import('../src/lib/pit/authoritative.ts'); const store=await import('../src/lib/pit/store.ts'); const vanilla=await import('zustand/vanilla');
 const data=fixture(), doc=JSON.stringify(sharedDoc(data)); const calls:string[]=[];
 const sql=async (strings:TemplateStringsArray)=>{const query=strings.join('?'); calls.push(query); if(!/^select /i.test(query.trim())) throw new Error('unexpected write'); return [{rev:7,doc,schema_tag:'old'}];};
 const result=await readSeasonFrom({sql,store,vanilla,auth:{publicSession:{role:'public',storeId:null,crewId:null}},mode:'preview'} as never);
 assert.equal(result.row.rev,7); assert.equal(result.data.week,5); assert.equal(calls.length,1); assert.match(calls[0]!,/^select /i); assert.equal(result.data.showcase,undefined);
});
