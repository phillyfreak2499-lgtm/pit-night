import test from 'node:test';
import assert from 'node:assert/strict';
import {playBooth} from '../src/lib/pit/booth-playback.ts';

test('decoded audio cannot start after its cue expires while decode is pending',async()=>{
 let resolve!:(value:{duration:number})=>void,current=true,starts=0,lines=0;
 const context={state:'running',currentTime:0,decodeAudioData:()=>new Promise(r=>resolve=r),createBufferSource:()=>{starts++;return {};}} as unknown as AudioContext;
 const playback=playBooth(context,[{speaker:'Jim',text:'Recorded hit',audio:'YQ=='}],new AbortController().signal,()=>lines++,undefined,()=>current);
 current=false;resolve({duration:2});await playback;
 assert.equal(starts,0);assert.equal(lines,0);
});

test('pause/expired cue aborts scheduled Cathy audio and its delayed caption',async()=>{
 const previousWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
 const previousClear=globalThis.clearTimeout;
 const timers=new Map<number,()=>void>();let sequence=0,stops=0;
 Object.defineProperty(globalThis,'window',{configurable:true,value:{setTimeout:(fn:()=>void)=>{timers.set(++sequence,fn);return sequence;}}});
 globalThis.clearTimeout=((id:number)=>{timers.delete(id);}) as typeof clearTimeout;
 try {
  const sources:{onended:(()=>void)|null;buffer:unknown;connect:()=>void;start:()=>void;stop:()=>void;disconnect:()=>void}[]=[];
  const context={state:'running',currentTime:0,destination:{},decodeAudioData:async()=>({duration:2}),createBufferSource:()=>{const source={onended:null,buffer:null,connect:()=>{},start:()=>{},stop:()=>{stops++;},disconnect:()=>{}};sources.push(source);return source;}} as unknown as AudioContext;
  const controller=new AbortController(),lines:string[]=[];
  const playback=playBooth(context,[{speaker:'Jim',text:'Hit',audio:'YQ=='},{speaker:'Cathy',text:'Analysis',audio:'YQ=='}],controller.signal,l=>lines.push(l.text));
  for(let i=0;i<8;i++)await Promise.resolve();
  assert.deepEqual(lines,['Hit']);assert.equal(sources.length,2);assert.equal(timers.size,1);
  controller.abort();await playback;
  assert.equal(stops,2);assert.equal(timers.size,0);assert.deepEqual(lines,['Hit']);
 } finally {
  globalThis.clearTimeout=previousClear;
  if(previousWindow)Object.defineProperty(globalThis,'window',previousWindow);else Reflect.deleteProperty(globalThis,'window');
 }
});
