import test from 'node:test';
import assert from 'node:assert/strict';
import {showcaseDemo} from '../src/lib/pit/showcase-model.ts';

test('fictional Gauntlet demonstrates a completed cooperative winning crew',()=>{
 const tape=showcaseDemo('team-gauntlet');
 for(const id of tape.winnerIds) {
  const run=tape.runs.find(r=>r.storeId===id)!;
  assert.ok(run.finishAt!==null && run.finishAt<=tape.duration,'winning members finish during the tape');
  assert.equal(run.frames.at(-1)!.progress,1);
  assert.equal(run.frames.at(-1)!.cargo,3);
 }
});

test('fictional race start and representative replay frames identify each competitor',()=>{
 const tape=showcaseDemo('striker-race');
 for(const at of [0,20,40,60]) for(let i=0;i<tape.runs.length;i++) for(let j=i+1;j<tape.runs.length;j++) {
  const a=tape.runs[i]!.frames[at]!,b=tape.runs[j]!.frames[at]!;
  assert.ok(Math.abs(a.x-b.x)*1000>=108 || Math.abs(a.y-b.y)*560>=42,`portraits/markers collide at ${at}: ${i}/${j}`);
 }
 assert.deepEqual(tape.runs.map(r=>r.score),[52,54,56]);
 assert.deepEqual(tape.winnerIds,['house-1']);
});

for(const event of ['specialist-rescue','team-gauntlet'] as const) test(`fictional ${event} keeps all recorded lanes identifiable through the replay`,()=>{
 const tape=showcaseDemo(event);
 for(let at=0;at<=tape.duration;at++) {
  const lanes=tape.runs.map(r=>r.frames.filter(f=>f.at<=at).at(-1)!.y).sort((a,b)=>a-b);
  for(let i=1;i<lanes.length;i++) assert.ok((lanes[i]!-lanes[i-1]!)*560>=42,`collapsed lanes at ${at}`);
 }
 assert.ok(tape.fighters.every(f=>f.id.startsWith('house-')));
 if(event==='specialist-rescue') assert.deepEqual(tape.runs.map(r=>r.score),tape.fighters.map((_,i)=>52+i*2));
 if(event==='team-gauntlet') {
  assert.deepEqual(tape.winnerIds,tape.teams!.find(t=>t.storeIds.includes(tape.winnerIds[0]!))!.storeIds);
  for(const team of tape.teams!) assert.deepEqual(Object.values(team.roles??{}),['scout','puller','carrier','operator']);
 }
});
