import type {ReactiveCue} from './reactive-commentary';
import type {FightResult} from './types';
import {DUEL_STRIKE_AT,FINISH_VISIBLE_AT,IMPACT_AT,usesDuelPresentation} from './impact-presentation';

export type PlaybackMoment={tapeKey:string;beatKey:string;time:number;speed:number;playing:boolean;cue:ReactiveCue|null;cueAt:number;expiresAt:number};
type Token={epoch:number;moment:PlaybackMoment;cue:ReactiveCue};
const sameCue=(a:ReactiveCue|null,b:ReactiveCue)=>a?.phase===b.phase&&a.index===b.index;
const inRequestWindow=(m:PlaybackMoment,cue:ReactiveCue)=>m.playing&&sameCue(m.cue,cue)&&m.time<m.expiresAt;
/** Clock refs drive cancellation, including asynchronous response/decode and delayed analyst speech. */
export function createReactiveCueGate(onInvalidate:()=>void) {
  let current:PlaybackMoment|null=null,epoch=0,token:Token|null=null;
  const waiters=new Set<{token:Token;resolve:(ready:boolean)=>void}>();
  const valid=(value:Token)=>value===token&&value.epoch===epoch&&!!current&&current.tapeKey===value.moment.tapeKey&&current.beatKey===value.moment.beatKey&&inRequestWindow(current,value.cue);
  const flush=()=>{for(const w of waiters)if(!valid(w.token)||current!.time>=current!.cueAt){waiters.delete(w);w.resolve(valid(w.token));}};
  const cancel=()=>{epoch++;if(token){token=null;onInvalidate();}flush();};
  return {
    update(next:PlaybackMoment) {
      const old=current;current=next;
      if(token && (!inRequestWindow(next,token.cue)||old?.tapeKey!==next.tapeKey||old.beatKey!==next.beatKey||old.speed!==next.speed||next.time<old.time||next.time-old.time>1)) cancel();
      flush();
    },
    begin(cue:ReactiveCue):Token|null {
      if(!current||!inRequestWindow(current,cue))return null;
      cancel();token={epoch,moment:current,cue};return token;
    },
    valid,
    waitUntilReady(value:Token):Promise<boolean> {
      if(!valid(value))return Promise.resolve(false);
      if(current!.time>=current!.cueAt)return Promise.resolve(true);
      return new Promise(resolve=>waiters.add({token:value,resolve}));
    },
    cancel,
  };
}
export function playbackMoment(tapeKey:string,result:FightResult,beat:{kind:string;t:number;dur:number;index?:number},time:number,playing:boolean,speed:number):PlaybackMoment {
  const cue:ReactiveCue|null=beat.kind==='exchange'?{phase:'exchange',index:beat.index!}:beat.kind==='finisher'?{phase:'finisher',index:result.exchanges.length}:null;
  const local=beat.kind==='finisher'?FINISH_VISIBLE_AT:usesDuelPresentation(result)?DUEL_STRIKE_AT:IMPACT_AT;
  const cueAt=beat.t+beat.dur*local;
  return {tapeKey,beatKey:`${beat.kind}:${beat.index??''}`,time,speed,playing,cue,cueAt,expiresAt:Math.min(beat.t+beat.dur,cueAt+6)};
}
