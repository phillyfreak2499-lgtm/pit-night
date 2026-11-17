import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGauntletTape,gauntletAt,gauntletTask} from '../src/lib/pit/showcase-gauntlet.ts';
import {buildShowcaseTeams,simulateShowcaseEvent} from '../src/lib/pit/showcase-engine.server.ts';
import {showcaseDemo} from '../src/lib/pit/showcase-model.ts';
import {showcaseSegments,mayReadSegment} from '../src/lib/pit/event-commentary.ts';
import type {FighterSnap} from '../src/lib/pit/types.ts';
import {createHash} from 'node:crypto';
import {makeData} from '../src/lib/pit/seed.ts';
import {snapshot} from '../src/lib/pit/engine.ts';

const field=(stat:number|null=55)=>Array.from({length:12},(_,i)=>({id:'g'+i,botName:'Bot '+i,classId:i<3?'striker':i<6?'tank':'specialist',stats:{power:stat??30+i,speed:stat??30+i,armor:stat??30+i,heat:stat??30+i}} as FighterSnap));

test('shared Gauntlet keeps 55 timing, original-seed draws and sporting ranking rules',()=>{
 for(const stats of [55,0,null] as const){
  const fighters=field(stats),teams=buildShowcaseTeams(fighters,'gauntlet-parity'),tape=buildGauntletTape(fighters,teams,'gauntlet-parity');
  assert.match(tape.seed,/gauntlet-course-v2/);
  if(stats===55){assert.equal(tape.gauntlet!.pace,1);for(const run of tape.runs){assert.equal(run.finishAt,111);assert.equal(run.score,111);assert.equal(run.frames.at(-1)!.progress,1);}}
  else {assert.ok(tape.gauntlet!.pace>1);assert.ok(tape.runs[0]!.finishAt!>=108&&tape.runs[0]!.finishAt!<=112);}
  if(stats!==null){assert.equal(tape.tieBreak!.winnerId,'crew-1');assert.equal(tape.tieBreak!.contenders.length,3);for(const run of tape.runs)assert.equal(run.rank,tape.winnerIds.includes(run.storeId)?1:2);}
  assert.deepEqual(tape,simulateShowcaseEvent(fighters,'team-gauntlet',teams,'gauntlet-parity'));
 }
});

test('four sequential tasks record scouting, pull, three carried returns, gate and whole-crew exit',()=>{
 const fighters=field(),teams=buildShowcaseTeams(fighters,'actions'),tape=buildGauntletTape(fighters,teams,'actions');
 for(const crew of tape.gauntlet!.crews) {
  assert.deepEqual([...new Set(crew.frames.map(f=>f.stage))],[0,1,2,3]);
  const team=teams.find(t=>t.id===crew.teamId)!,carrier=tape.runs.find(r=>r.storeId===Object.keys(team.roles!).find(id=>team.roles![id]==='carrier'))!;
  const frames=crew.frames;
  assert.ok(frames.some(f=>f.scoutProgress!>0&&f.scoutProgress!<1));
  assert.ok(frames.some(f=>f.barrierX!>.22&&f.barrierX!<.40));
  assert.ok(frames.some(f=>f.gatePower!>0&&f.gatePower!<1));
  assert.ok(frames.some(f=>f.gateOpen&&!f.finished));
  for(const delivered of [0,1,2]) {
   const taskFrames=frames.filter(f=>f.stage===2&&f.coresDelivered===delivered);
   assert.ok(taskFrames.length);
   const poses=taskFrames.map(f=>carrier.frames.find(p=>p.at===f.at)!);
   assert.ok(poses.some(p=>p.carrying));assert.ok(poses.some(p=>!p.carrying));
   assert.ok(Math.max(...poses.map(p=>p.x))>.62);
  }
  assert.equal(frames.at(-1)!.coresDelivered,3);assert.equal(frames.at(-1)!.checkpoints,4);
  assert.equal(frames.at(-1)!.finished,true);
  for(const run of tape.runs.filter(r=>r.teamId===team.id)) {
   assert.equal(run.frames.at(-1)!.x,.88);assert.equal(run.frames.at(-1)!.progress,1);
   for(let i=1;i<run.frames.length;i++)assert.ok(Math.abs(run.frames[i]!.x-run.frames[i-1]!.x)<.08,'continuous recorded paths across phase transitions');
  }
 }
});

test('every recorded pickup reaches the core and every delivery reaches the depot, including cutoff trips',()=>{
 for(const stat of [20,25,30,55,95]){
  const initial=field(stat),teams=buildShowcaseTeams(initial,'trip'),fighters=initial.map(f=>stat<55&&teams[0]!.storeIds.includes(f.id)?{...f,stats:{power:55,speed:55,armor:55,heat:55}}:f),tape=buildGauntletTape(fighters,teams,'trip');
  for(const team of teams){
   const run=tape.runs.find(r=>team.roles![r.storeId]==='carrier'&&r.teamId===team.id)!;
   for(let i=1;i<run.frames.length;i++){
    const a=run.frames[i-1]!,b=run.frames[i]!;
    if(!a.carrying&&b.carrying)assert.ok(Math.abs(b.x-.66)<1e-9,`pickup at the core, stat ${stat}`);
    if(b.cargo>a.cargo){assert.ok(Math.abs(b.x-.46)<1e-9);assert.equal(b.carrying,false);}
   }
  }
 }
});

test('the other three fictional class tapes remain byte-identical',()=>{
 for(const [event,expected] of [['striker-race','5b7068ff7a29791bd9961ed0b5b6758fba3f3bf4057418d282351abac742a7da'],['tank-pull','8d3662b41496228bab65e82bd2f988f51d6a88632cec551c0744b1d99e9a48c4'],['specialist-rescue','247bc54f6f69c99cf5552735f4e06c74cc6f89fee2b0e95441d1f412f38938eb']] as const)
  assert.equal(createHash('sha256').update(JSON.stringify(showcaseDemo(event))).digest('hex'),expected);
});

test('barrier parks behind the course and clears the carrier and returning puller',()=>{
 const fighters=field(),teams=buildShowcaseTeams(fighters,'barrier'),tape=buildGauntletTape(fighters,teams,'barrier');
 for(const team of teams){
  const record=tape.gauntlet!.crews.find(c=>c.teamId===team.id)!;
  const active=record.frames.filter(f=>f.stage===1);
  assert.ok(active.some(f=>f.barrierX!<.4&&f.barrierX!>.22));
  for(const state of record.frames.filter(f=>f.stage>=2||f.stage===1&&f.phaseWork>=.6)){
   const crew=gauntletAt(tape,state.at,true).crews.find(c=>c.team.id===team.id)!;
   for(const member of crew.members.filter(m=>state.stage>=2||team.roles![m.fighter.id]==='puller')){
    const dx=Math.abs(member.frame.x-state.barrierX!)*1000,dy=Math.abs(member.frame.y-state.barrierY!)*560;
    assert.ok(dx>=49||dy>=51,'body clears the parked barrier');
   }
  }
 }
});

test('one recorded uniform pace makes realistic low builds show all four roles without changing 55/House pace',()=>{
 const data=makeData(),fighters=data.stores.filter(s=>!['rockwall','abilene'].includes(s.id)).map(s=>snapshot(data,s.id));
 const teams=buildShowcaseTeams(fighters,'low-builds'),tape=buildGauntletTape(fighters,teams,'low-builds');
 assert.ok(tape.gauntlet!.pace>1);
 const best=tape.runs.find(r=>r.rank===1)!;assert.ok(best.finishAt!==null&&best.finishAt>=108&&best.finishAt<=112);
 assert.ok(tape.gauntlet!.crews.some(c=>c.frames.some(f=>f.gateOpen)&&c.frames.at(-1)!.finished));
 for(const crew of tape.gauntlet!.crews)assert.equal(crew.pace,tape.gauntlet!.pace);
 const strong=field(),unchanged=buildGauntletTape(strong,buildShowcaseTeams(strong,'strong'),'strong');
 assert.equal(unchanged.gauntlet!.pace,1);assert.equal(unchanged.runs[0]!.finishAt,111);
 assert.equal(showcaseDemo('team-gauntlet').gauntlet!.pace,1);
 const mixed=field().map((f,i)=>({...f,stats:{power:i<4?55:0,speed:i<4?55:0,armor:i<4?55:0,heat:i<4?55:0}}));
 const fixedTeams=[0,1,2].map(i=>({id:'mixed-'+i,name:'Mixed '+i,storeIds:mixed.slice(i*4,i*4+4).map(f=>f.id),roles:Object.fromEntries(mixed.slice(i*4,i*4+4).map((f,j)=>[f.id,['scout','puller','carrier','operator'][j]!]))})) as typeof teams;
 const cutoff=buildGauntletTape(mixed,fixedTeams,'mixed');assert.equal(cutoff.gauntlet!.pace,1);
 assert.equal(cutoff.runs.filter(r=>r.finishAt===null).length,8);assert.equal(cutoff.duration,120);
});

test('House demo uses the same completed team course with computed winner sensitive to builds',()=>{
 const demo=showcaseDemo('team-gauntlet');
 const rebuilt=buildGauntletTape(demo.fighters,demo.teams!,'house-exhibition:team-gauntlet');
 assert.deepEqual(demo.runs,rebuilt.runs);assert.deepEqual(demo.winnerIds,rebuilt.winnerIds);
 const chosen=demo.teams![2]!;
 const changed=demo.fighters.map(f=>({...f,stats:{power:chosen.storeIds.includes(f.id)?95:30,speed:chosen.storeIds.includes(f.id)?95:30,armor:chosen.storeIds.includes(f.id)?95:30,heat:chosen.storeIds.includes(f.id)?95:30}}));
 assert.deepEqual(buildGauntletTape(changed,demo.teams!,'house-exhibition:team-gauntlet').winnerIds,chosen.storeIds);
});

test('leader and cutoff come from current recorded progress; old tapes need no new actions',()=>{
 const fighters=field(0),teams=buildShowcaseTeams(fighters,'cutoff'),tape=buildGauntletTape(fighters,teams,'cutoff');
 assert.equal(gauntletAt(tape,0).leaderIds.length,3);
 assert.equal(gauntletAt(tape,120).crews.every(c=>c.frame.finished),true);
 assert.equal(gauntletAt(tape,120).leaderIds.length,3);
 const legacy=structuredClone(tape);delete legacy.gauntlet;
 const original=JSON.stringify(legacy),view=gauntletAt(legacy,60);
 assert.equal(view.crews.length,3);assert.ok(view.crews.every(c=>c.legacy&&c.frame.barrierX===undefined));
 assert.equal(JSON.stringify(legacy),original);
 assert.match(gauntletTask(view.crews[0]!),/Recorded/);
});

test('Gauntlet checkpoint facts describe crews and do not expose the winning crew before closing',()=>{
 const tape=showcaseDemo('team-gauntlet'),segments=showcaseSegments(tape);
 for(const segment of segments.slice(0,-1)) {
  assert.match(segment.facts,/crew/i);assert.match(segment.facts,/cores delivered|checkpoints/);
  assert.doesNotMatch(segment.facts,/Result:|Prize:|winning crew|slots 9/);
 }
 const closing=segments.at(-1)!;assert.match(closing.facts,/slots 9–12/);
 assert.equal(mayReadSegment({segment:closing,preview:true,commissioner:true,startedAt:1,revealedAt:null,gateAt:0,now:1e9}),false);
});
