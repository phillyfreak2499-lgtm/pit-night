import test from 'node:test';
import assert from 'node:assert/strict';
import {createReactiveCueGate,type PlaybackMoment} from '../src/lib/pit/reactive-playback.ts';

const moment:PlaybackMoment={tapeKey:'bout:seed',beatKey:'exchange:1',time:105,speed:1.5,playing:true,cue:{phase:'exchange',index:1},cueAt:104.96,expiresAt:110.96};
test('delayed responses cannot survive expiry, next beat, pause, seek, speed or tape changes',async()=>{
 for(const patch of [{time:111},{beatKey:'clash:2',time:118.46,cue:null},{playing:false},{time:104},{speed:2},{tapeKey:'other'}]) {
  let aborted=0;const gate=createReactiveCueGate(()=>aborted++);gate.update(moment);
  const token=gate.begin(moment.cue!)!;assert.ok(token);assert.equal(gate.valid(token),true);
  let resolve!:()=>void;const delayed=new Promise<void>(r=>resolve=r);
  const response=delayed.then(()=>gate.valid(token));
  gate.update({...moment,...patch});resolve();
  assert.equal(await response,false);assert.equal(aborted,1);
 }
});
test('a current cue survives ordinary frame ticks but not decode completion after expiry',async()=>{
 const gate=createReactiveCueGate(()=>{});gate.update(moment);const token=gate.begin(moment.cue!)!;
 gate.update({...moment,time:105.1});assert.equal(gate.valid(token),true);
 await Promise.resolve();gate.update({...moment,time:110.97});assert.equal(gate.valid(token),false);
 assert.equal(gate.begin(moment.cue!),null);
});
test('entry prefetch waits for committed contact and cancels a future cue on pause',async()=>{
 for(const pause of [false,true]) {
  const gate=createReactiveCueGate(()=>{});gate.update({...moment,time:100});
  const token=gate.begin(moment.cue!)!;assert.ok(token);
  let spoken=false;const prepared=gate.waitUntilReady(token).then(ready=>{spoken=ready;});
  await Promise.resolve();assert.equal(spoken,false);
  for(let time=100.5;time<=104.5;time+=.5)gate.update({...moment,time});
  assert.equal(spoken,false);
  gate.update({...moment,time:105,playing:!pause});await prepared;
  assert.equal(spoken,!pause);
 }
});
