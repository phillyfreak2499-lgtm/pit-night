import {useCallback,useEffect,useRef,useState} from "react";
import {getReactiveCommentary} from "@/lib/pit/reactive-commentary-server";
import {playBooth} from "@/lib/pit/booth-playback";
import {announcerDelivery,reactiveMoment,type ReactiveCue} from "@/lib/pit/reactive-commentary";
import {createReactiveCueGate,type PlaybackMoment} from "@/lib/pit/reactive-playback";
import {live,soundMuted,subscribeSound} from "@/lib/pit/sound";
import type {BoothClip} from "@/lib/pit/booth";
import type {Bout} from "@/lib/pit/types";

/** A reaction belongs to the depicted impact window, never just to a bout. */
export function useReactiveCommentary(bout:Bout|null,active:boolean,duck:(speaking:boolean)=>void,preview=false) {
  const boutKey=bout?.result?bout.id+":"+bout.result.seed:"";
  const [lastLine,setLastLine]=useState<{key:string;body:string}|null>(null);
  const current=useRef({boutKey,active});current.current={boutKey,active};
  const seen=useRef(new Set<string>()),busy=useRef(false),generation=useRef(0);
  const recorded=useRef<AbortController|null>(null),speech=useRef<SpeechSynthesisUtterance|null>(null);
  const invalidateRef=useRef(()=>{});
  const gateRef=useRef<ReturnType<typeof createReactiveCueGate>|null>(null);
  if(!gateRef.current)gateRef.current=createReactiveCueGate(()=>invalidateRef.current());
  const gate=gateRef.current;
  const release=useCallback(()=>{
    generation.current++;busy.current=false;
    recorded.current?.abort();recorded.current=null;
    speech.current=null;window.speechSynthesis?.cancel();duck(false);setLastLine(null);
  },[duck]);
  invalidateRef.current=release;
  useEffect(()=>{gate.cancel();release();seen.current.clear();},[boutKey,active,gate,release]);
  useEffect(()=>{
    window.speechSynthesis?.getVoices();
    const unsubscribe=subscribeSound(()=>{if(soundMuted()){gate.cancel();release();}});
    return ()=>{unsubscribe();gate.cancel();release();};
  },[gate,release]);
  const onPlaybackMoment=useCallback((moment:PlaybackMoment)=>gate.update(moment),[gate]);
  const onBeat=useCallback((cue:ReactiveCue)=>{
    if(!active||!bout?.result||busy.current||recorded.current||speech.current||soundMuted())return;
    const key=boutKey+"|"+cue.phase+"|"+cue.index;if(seen.current.has(key))return;
    const token=gate.begin(cue);if(!token)return;
    if(token.moment.tapeKey!==boutKey){gate.cancel();return;}
    seen.current.add(key);busy.current=true;
    const requestId=++generation.current;
    const valid=()=>gate.valid(token)&&generation.current===requestId&&current.current.active&&current.current.boutKey===boutKey&&!soundMuted();
    const request=()=>getReactiveCommentary({data:{boutId:bout.id,seed:bout.result!.seed,phase:cue.phase,index:cue.index,preview}});
    void(async()=>{
      let reply=await request();
      for(let retry=0;(reply.status==="pending"||(reply.status==="ready"&&reply.voicePending))&&retry<4;retry++){
        await new Promise<void>(resolve=>window.setTimeout(resolve,1500));if(!valid())return;reply=await request();
      }
      if(!valid()||reply.status!=="ready")return;
      const context=live();
      if(reply.audio&&context?.state==="running"){
        const controller=new AbortController();recorded.current=controller;
        try{
          const clips:BoothClip[]=[{speaker:"Jim",text:reply.body,audio:reply.audio}];
          if(reply.replyClip)clips.push(reply.replyClip);
          await playBooth(context,clips,controller.signal,line=>{if(valid())setLastLine({key:boutKey,body:line.speaker+" · "+line.text});},duck,valid,()=>gate.waitUntilReady(token));
          return;
        }catch{if(!valid())return;}finally{if(recorded.current===controller)recorded.current=null;}
      }
      if(!await gate.waitUntilReady(token))return;
      if(!valid()||typeof SpeechSynthesisUtterance==="undefined"||!window.speechSynthesis)return;
      const synth=window.speechSynthesis;if(synth.speaking||synth.pending)return;
      const utterance=new SpeechSynthesisUtterance(reply.body);
      const english=synth.getVoices().filter(v=>/^en(?:[-_]|$)/i.test(v.lang));
      const voice=english.find(v=>/natural|premium|enhanced|neural/i.test(v.name))??english.find(v=>v.default)??english[0];
      if(voice)utterance.voice=voice;utterance.lang=voice?.lang??"en-US";
      const delivery=announcerDelivery[reactiveMoment(bout.result!,cue)?.kind??"big-hit"];
      utterance.rate=delivery.rate;utterance.pitch=delivery.pitch;speech.current=utterance;
      utterance.onstart=()=>{if(!valid()){synth.cancel();return;}setLastLine({key:boutKey,body:reply.body});duck(true);};
      utterance.onend=utterance.onerror=()=>{if(speech.current===utterance){speech.current=null;duck(false);}};
      if(valid())synth.speak(utterance);
    })().catch(()=>{}).finally(()=>{if(generation.current===requestId)busy.current=false;});
  },[active,bout,boutKey,duck,gate,preview]);
  return {line:lastLine?.key===boutKey?lastLine.body:"",onBeat,onPlaybackMoment};
}
