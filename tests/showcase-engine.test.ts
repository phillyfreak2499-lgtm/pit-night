import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShowcaseTeams, simulateShowcaseEvent } from '../src/lib/pit/showcase-engine.server.ts';
import type { FighterSnap } from '../src/lib/pit/types.ts';

const fighters = Array.from({length:12},(_,i)=>({ id:`fixture-${i}`, name:`Fixture ${i}`, classId:i<3?'striker':i<6?'tank':'specialist', stats:{speed:30+i,power:30+i,armor:30+i,heat:30+i} } as FighterSnap));
test('teams are deterministic, balanced and assign four distinct roles',()=>{
 const teams=buildShowcaseTeams(fighters,'seed');
 assert.deepEqual(teams,buildShowcaseTeams(fighters,'seed'));
 assert.equal(new Set(teams.flatMap(t=>t.storeIds)).size,12);
 for(const t of teams){ assert.equal(t.storeIds.length,4); assert.equal(new Set(Object.values(t.roles!)).size,4); assert.equal(new Set(t.storeIds.map(id=>fighters.find(f=>f.id===id)!.classId)).size,3); }
});
test('all sports record deterministic, bounded movement and outcomes',()=>{
 const teams=buildShowcaseTeams(fighters,'seed');
 for(const event of ['striker-race','tank-pull','specialist-rescue','team-gauntlet'] as const){
  const tape=simulateShowcaseEvent(fighters,event,teams,'seed');
  assert.deepEqual(tape,simulateShowcaseEvent(fighters,event,teams,'seed'));
  assert.ok(tape.runs.length); assert.ok(tape.winnerIds.length); assert.ok(tape.duration<=120);
  for(const run of tape.runs){ assert.ok(run.frames.length>2); for(const f of run.frames){ assert.ok(f.x>=0&&f.x<=1&&f.y>=0&&f.y<=1); assert.ok(f.progress>=0&&f.progress<=1&&f.cargo>=0&&f.cargo<=3); assert.ok(f.stage<tape.course.stages.length); } }
 }
 assert.equal(simulateShowcaseEvent(fighters,'team-gauntlet',teams,'seed').winnerIds.length,4);
});
test('empty class is graceful and class stats influence the sport',()=>{
 const empty=simulateShowcaseEvent([],'striker-race',[],'seed'); assert.deepEqual(empty.winnerIds,[]);
 const pair=[fighters[0]!,{...fighters[1]!,stats:{...fighters[1]!.stats,speed:100}}];
 const tape=simulateShowcaseEvent(pair,'striker-race',[],'seed'); assert.deepEqual(tape.winnerIds,[pair[1]!.id]);
});
test('rescue records gate windows, carrying and delivered cores',()=>{
 const tape=simulateShowcaseEvent(fighters,'specialist-rescue',[],'seed');
 assert.ok(tape.course.objects.some(o=>o.kind==='gate'&&o.openWindows?.length));
 assert.ok(tape.runs.some(r=>r.frames.some(f=>f.carrying)));
 assert.ok(tape.runs.some(r=>r.frames.some(f=>f.cargo===3)));
});
test('sporting ties share class prizes and team ties record one seeded draw',()=>{
 const equal=fighters.map(f=>({...f,stats:{speed:40,power:40,armor:40,heat:40}}));
 const teams=buildShowcaseTeams(equal,'draw');
 const race=simulateShowcaseEvent(equal,'striker-race',teams,'draw');
 assert.equal(race.winnerIds.length,3);
 const team=simulateShowcaseEvent(equal,'team-gauntlet',teams,'draw');
 assert.equal(team.winnerIds.length,4); assert.equal(team.tieBreak?.contenders.length,3);
 assert.deepEqual(team.winnerIds,teams.find(t=>t.id===team.tieBreak?.winnerId)!.storeIds);
});
test('a rescue bot never crosses a closed gate',()=>{
 const tape=simulateShowcaseEvent(fighters,'specialist-rescue',[],'gates');
 const windows=tape.course.objects.find(o=>o.id==='rescue-gate')!.openWindows!;
 for(const run of tape.runs) for(let i=1;i<run.frames.length;i++){
  const a=run.frames[i-1]!,b=run.frames[i]!;
  if((a.x<.5&&b.x>=.5)||(a.x>.5&&b.x<=.5)) assert.ok(windows.some(w=>b.at>=w.from&&b.at<w.to));
 }
});
test('changed class composition stays within the tape budget',()=>{
 const tanks=fighters.map(f=>({...f,classId:'tank' as const}));
 const tape=simulateShowcaseEvent(tanks,'tank-pull',[],'larger-field');
 assert.equal(tape.runs.length,12); assert.ok(tape.duration<=120);
});

test('seeded draw ranks the selected crew first and retains lower ties',()=>{
 const equal=fighters.map(f=>({...f,stats:{speed:40,power:40,armor:40,heat:40}}));
 const teams=buildShowcaseTeams(equal,'draw1'); const tape=simulateShowcaseEvent(equal,'team-gauntlet',teams,'draw1');
 assert.equal(tape.tieBreak?.contenders.length,3);
 for(const run of tape.runs) assert.equal(run.rank,tape.winnerIds.includes(run.storeId)?1:2);
});

test('completed Gauntlet members finish at the exit without a backward final step',()=>{
 const equal=fighters.map(f=>({...f,stats:{speed:55,power:55,armor:55,heat:55}}));
 const tape=simulateShowcaseEvent(equal,'team-gauntlet',buildShowcaseTeams(equal,'exit'),'exit');
 for(const run of tape.runs){
  assert.equal(run.finishAt,111);
  const before=run.frames.at(-2)!,last=run.frames.at(-1)!;
  assert.equal(last.x,.88); assert.ok(last.x>=before.x); assert.equal(last.progress,1);
  assert.equal(run.score,111);
 }
});

test('Gauntlet recorded lanes and race starting lanes leave room for distinct portraits',()=>{
 const teams=buildShowcaseTeams(fighters,'spacing');
 const tape=simulateShowcaseEvent(fighters,'team-gauntlet',teams,'spacing');
 const allLanes=tape.runs.map(r=>r.frames[0]!.y).sort((a,b)=>a-b);
 for(let i=1;i<allLanes.length;i++) assert.ok((allLanes[i]!-allLanes[i-1]!)*560>=42,'separate neighboring crews too');
 for(const team of teams) {
  const runs=tape.runs.filter(r=>r.teamId===team.id);
  for(let at=0;at<=tape.duration;at++) for(let i=1;i<runs.length;i++) {
   const a=runs[i-1]!.frames.filter(f=>f.at<=at).at(-1)!;
   const b=runs[i]!.frames.filter(f=>f.at<=at).at(-1)!;
   assert.ok(Math.abs(b.y-a.y)*560>=42,'crew portraits need vertical separation at every phase');
  }
 }
 const race=simulateShowcaseEvent(fighters,'striker-race',teams,'spacing');
 const starts=race.runs.map(r=>r.frames[0]!.y).sort();
 for(let i=1;i<starts.length;i++) assert.ok((starts[i]!-starts[i-1]!)*560>=42);
});
