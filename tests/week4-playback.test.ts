import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedFinaleTape} from '../src/lib/pit/period12-tape.ts';
import {reactiveMoment} from '../src/lib/pit/reactive-commentary.ts';
import {buildBeats,fightDrive} from '../src/components/pit/cage-motion.ts';
import {playbackMoment} from '../src/lib/pit/reactive-playback.ts';

test('approved Waco scoring facts match the visible remaining strike and round',()=>{
 const result=approvedFinaleTape()[1]!.result!;
 for(const [index,damage,round] of [[0,27,1],[1,16,2]]) {
  const moment=reactiveMoment(result,{phase:'exchange',index})!;
  const beat=buildBeats(result).find(b=>b.kind==='exchange'&&b.index===index)!;
  const hit=fightDrive(result,beat,0,beat.t).hitAt;
  const shown=fightDrive(result,beat,hit+.001,beat.t+beat.dur*(hit+.001));
  assert.equal(moment.damage,damage); assert.equal(moment.damage,shown.dmg);
  assert.equal(moment.round,round); assert.equal(shown.round,round);
  assert.equal(moment.defenderHp,shown.bots.find(b=>b.bot.id===shown.victim)!.hp);
 }
});

test('finishing speech becomes eligible only when the displayed elimination commits',()=>{
 for(const id of ['w4-bout-3-abilene','w4-bout-4-tyler','w4-bout-7-plano']) {
  const result=approvedFinaleTape().find(b=>b.id===id)!.result!;
  const beat=buildBeats(result).find(b=>b.kind==='finisher')!;
  const clock=playbackMoment(id+':'+result.seed,result,beat,beat.t,true,1.5);
  const local=(clock.cueAt-beat.t)/beat.dur;
  const before=fightDrive(result,beat,local-.001,clock.cueAt-.008).bots.find(b=>b.bot.id===result.finisher!.against)!;
  const committed=fightDrive(result,beat,local+.001,clock.cueAt+.008).bots.find(b=>b.bot.id===result.finisher!.against)!;
  assert.ok(before.hp>0);assert.equal(before.dead,false);
  assert.equal(committed.hp,0);assert.equal(committed.dead,true);
  if(result.method==='dump')assert.equal(committed.gone,1);
 }
});

test('approved standalone finishes start from the last exchange without a health gift',()=>{
 for(const [id,hp] of [['w4-bout-3-abilene',{abilene:82,temple:33}],['w4-bout-4-tyler',{tyler:28,rockwall:33}],['w4-bout-7-plano',{plano:52,hulen:20}]] as const) {
  const result=approvedFinaleTape().find(b=>b.id===id)!.result!;
  const beat=buildBeats(result).find(b=>b.kind==='finisher')!;
  const drive=fightDrive(result,beat,0,beat.t);
  assert.deepEqual(Object.fromEntries(drive.bots.map(b=>[b.bot.id,b.hp])),hp);
 }
});

test('legacy positive-HP pit finish is a ringout through finish, replay and decision',()=>{
 for(const id of ['w4-bout-3-abilene','w4-bout-4-tyler']) {
  const result=approvedFinaleTape().find(b=>b.id===id)!.result!;
  const original=JSON.stringify(result),victim=result.finisher!.against;
  const moment=reactiveMoment(result,{phase:'finisher',index:result.exchanges.length})!;
  assert.equal(moment.kind,'ringout'); assert.doesNotMatch(moment.event,/knocked out/i);
  const beats=buildBeats(result); assert.ok(beats.some(b=>b.kind==='replay'));
  for(const kind of ['finisher','replay','decision']) {
   const beat=beats.find(b=>b.kind===kind)!;
   const drive=fightDrive(result,beat,1,beat.t+beat.dur);
   const out=drive.bots.find(b=>b.bot.id===victim)!;
   assert.equal(out.gone,1); assert.equal(out.dead,true); assert.equal(out.hp,0);
   assert.ok(drive.bots.every(b=>b.flame===0));
   if(kind!=='decision') assert.equal(drive.weapon,result.fighters.find(f=>f.id===result.finisher!.by)!.weaponFamily);
  }
  assert.equal(JSON.stringify(result),original);
 }
});
