import {test} from 'node:test';
import assert from 'node:assert/strict';
import {eventKey, mayReadSegment, readPrepared, rumbleSegments, showcaseSegments, warmPrepared} from '../src/lib/pit/event-commentary.ts';
import {showcaseDemo} from '../src/lib/pit/showcase-model.ts';
import type {FightResult} from '../src/lib/pit/types.ts';
const result = {seed:'tape-a',winnerIds:['b'],method:'decision',hp:{a:0,b:20},fighters:[{id:'a',botName:'Alpha'},{id:'b',botName:'Beta'},{id:'c',botName:'Hidden'}],rumbleEntries:[{fighterId:'a',at:0},{fighterId:'b',at:5},{fighterId:'c',at:50}],exchanges:[{at:7,attackerId:'b',defenderId:'a'},{at:1,attackerId:'a',defenderId:'c'}]} as unknown as FightResult;
test('saved exchanges are ordered and do not expose future entrants or result',()=>{const s=rumbleSegments(result);assert.deepEqual(s.map(x=>x.at),[1,7,7]);assert.doesNotMatch(s[0]!.facts,/Hidden|Beta|decision|20/);assert.doesNotMatch(s[1]!.facts,/Hidden|decision/);assert.match(s[2]!.facts,/Beta/);});
test('showcase checkpoints never include outcome',()=>{const tape=showcaseDemo('striker-race');const segments=showcaseSegments(tape);assert.equal(segments.at(-1)?.phase,'closing');assert.ok(segments.slice(0,-1).every(s=>!s.facts.includes('Result:')&&!s.facts.includes('Prize:')));});
test('closing stays private until reveal including commissioner preview',()=>{const closing=rumbleSegments(result).at(-1)!;const common={segment:closing,preview:true,commissioner:true,startedAt:null,revealedAt:null,gateAt:0,now:100000};assert.equal(mayReadSegment(common),false);assert.equal(mayReadSegment({...common,revealedAt:1}),true);assert.equal(mayReadSegment({...common,revealedAt:1,commissioner:false}),false);});
test('preview requires commissioner and public requires moment and gate',()=>{const segment=rumbleSegments(result)[0]!;const common={segment,preview:false,commissioner:false,startedAt:1000,revealedAt:null,gateAt:2000,now:1500};assert.equal(mayReadSegment(common),false);assert.equal(mayReadSegment({...common,preview:true}),false);assert.equal(mayReadSegment({...common,preview:true,commissioner:true}),true);assert.equal(mayReadSegment({...common,now:2000}),true);});
test('cache identity includes event and full tape seed',()=>{assert.notEqual(eventKey('rumble','a',0),eventKey('rumble','b',0));assert.notEqual(eventKey('rumble','a',0),eventKey('tank-pull','a',0));});
test('runtime reads cache only and warmup reuses ready rows',async()=>{let writes=0, calls=0;let row: {status:string;body:string|null}|undefined;const deps={read:async()=>row,reserve:async()=>{writes++;return 'claimed' as const},claim:async()=>false,generate:async()=>{calls++;return 'A recorded moment.'},finish:async(v:{body:string}|{error:string})=>{row='body' in v?{status:'ready',body:v.body}:{status:'failed',body:null}},voice:async()=>({audio:'abc'})};await warmPrepared(deps);await warmPrepared(deps);assert.equal(writes,1);assert.equal(calls,1);const fetched=await readPrepared({readText:async()=>row,readAudio:async()=>({status:'ready',body:'abc'})});assert.deepEqual(fetched,{status:'ready',body:'A recorded moment.',audio:'abc'});assert.equal(calls,1);});
import { eventCommentaryRequestSchema } from '../src/lib/pit/event-commentary-server.ts';
test('playback validator accepts real length loadout seeds within bound',()=>{const seed='season|w5|w5-melee-1|'+ 'loadout:weapon-drive-armor-utility|'.repeat(100);assert.ok(seed.length>1000);assert.equal(eventCommentaryRequestSchema.parse({event:'rumble',index:0,seed}).seed,seed);assert.equal(eventCommentaryRequestSchema.safeParse({event:'rumble',index:0,seed:'x'.repeat(16385)}).success,false);});
test('recorded trace separates burn and hazard from weapon hits and records elimination',()=>{const trace=(before:number,after:number,burn:number,hazard:number,hits:number,damage:number)=>({before:{hp:before},after:{hp:after},burnDamage:burn,hazardDamage:hazard,hitCount:hits,damageDealt:damage,reflectedDamageTaken:0,healing:0,revived:false});const r=structuredClone(result);r.exchanges=[{index:1,at:7,attackerId:'a',defenderId:'b',damage:8,attackerHp:70,defenderHp:0,call:'secret',tags:['burn'],combat:{a:trace(70,70,0,0,0,0),b:trace(8,0,8,0,0,0)}}] as unknown as FightResult['exchanges'];const facts=rumbleSegments(r)[0]!.facts;assert.match(facts,/Beta takes 8 burn damage/);assert.match(facts,/Beta is eliminated; cause: burn/);assert.doesNotMatch(facts,/weapon hit/);});
test('showcase facts report recorded current checkpoints without final fields',()=>{const tape=showcaseDemo('tank-pull');const s=showcaseSegments(tape);assert.match(s[1]!.facts,/metres pulled; stage/);assert.doesNotMatch(s[1]!.facts,/Result:|Prize:/);const race=showcaseSegments(showcaseDemo('striker-race'));assert.match(race[1]!.facts,/Current race leader/);const rescue=showcaseSegments(showcaseDemo('specialist-rescue'));assert.match(rescue[1]!.facts,/cores delivered/);});
import {prepareEventCache, readEventCache} from '../src/lib/pit/event-commentary-server.ts';
test('prepared long-seed closing text and audio are found by playback using the same cache identity',async()=>{
  const seed='season|w5|w5-melee-1|'+ 'loadout:weapon-drive-armor-utility|'.repeat(100);
  const input={event:'rumble' as const,seed,index:42};
  const rows=new Map<string,{status:string;body:string|null}>();
  const read=async(kind:string,key:string)=>rows.get(`${kind}:${key}`);
  let calls=0;
  const prepared=await prepareEventCache(input,{
    read,
    reserve:async(key)=>{rows.set(`event-commentary:${key}`,{status:'pending',body:null});return 'claimed';},
    claim:async()=>false,
    generate:async()=>{calls++;return 'A final result.';},
    finish:async(key,value)=>{rows.set(`event-commentary:${key}`,'body' in value?{status:'ready',body:value.body}:{status:'failed',body:null});},
    voice:async(key)=>{rows.set(`ringside-audio:DduhIyyKkOosbP8VefhP:eleven_v4:${key}`,{status:'ready',body:'audio-base64'});return {audio:'audio-base64'};},
  });
  assert.deepEqual(prepared,{status:'ready',audioReady:true});
  assert.deepEqual(await readEventCache(input,read),{status:'ready',body:'A final result.',audio:'audio-base64'});
  assert.deepEqual(await readEventCache({...input,seed:seed+'changed'},read),{status:'unavailable'});
  assert.equal(calls,1);
});
test('failed and stale pending text can be reclaimed while active claims stay pending',async()=>{
  for (const [status,retryAllowed,expected] of [['failed',true,'ready'],['pending',true,'ready'],['pending',false,'pending'],['failed',false,'unavailable']] as const) {
    let row:{status:string;body:string|null}={status,body:null}; let claims=0,generated=0,reserved=0;
    const response=await warmPrepared({read:async()=>row,reserve:async()=>{reserved++;return 'claimed';},claim:async()=>{claims++;return retryAllowed;},generate:async()=>{generated++;return 'Recovered line.';},finish:async(value)=>{row='body' in value?{status:'ready',body:value.body}:{status:'failed',body:null};},voice:async()=>({audio:'clip'})});
    assert.equal(response.status,expected); assert.equal(claims,1); assert.equal(reserved,0); assert.equal(generated,retryAllowed?1:0);
  }
});
test('new capped text never generates and ready text is never reclaimed',async()=>{
  let generated=0,claimed=0;
  const base={claim:async()=>{claimed++;return true;},generate:async()=>{generated++;return 'line';},finish:async()=>{},voice:async()=>({audio:'clip'})};
  assert.equal((await warmPrepared({...base,read:async()=>undefined,reserve:async()=> 'capped'})).status,'capped');
  assert.equal((await warmPrepared({...base,read:async()=>({status:'ready',body:'old line'}),reserve:async()=> 'claimed'})).status,'ready');
  assert.equal(claimed,0);assert.equal(generated,0);
});
