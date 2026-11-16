import { useEffect, useRef, useState } from "react";
import { getEventCommentary } from "@/lib/pit/event-commentary-server";
import type { EventId, EventSegment } from "@/lib/pit/event-commentary";
type Options = {event:EventId; seed:string; segments:EventSegment[]; time:number; playing:boolean; muted:boolean; preview?:boolean; revealed?:boolean; closingReady?:boolean; allowStoppedClosing?:boolean};
export function useEventCommentary({event,seed,segments,time,playing,muted,preview=false,revealed=false,closingReady=false,allowStoppedClosing=false}:Options) {
  const [caption,setCaption]=useState("");
  const [seekRevision,setSeekRevision]=useState(0);
  const state=useRef({epoch:0,audio:null as HTMLAudioElement|null, consumed:"", previousKey:"", previousTime:time, time, playing, muted});
  const s=state.current; s.time=time; s.playing=playing; s.muted=muted;
  const due = segments.reduce<EventSegment | undefined>((found, segment) => segment.at <= time && (segment.phase !== "closing" || (revealed && closingReady)) ? segment : found, undefined);
  useEffect(() => { if (time < s.previousTime) { s.consumed=""; s.epoch++; s.audio?.pause(); s.audio=null; setCaption(""); setSeekRevision(n => n+1); } s.previousTime=time; }, [time,s]);
  const key = due ? `${event}|${seed}|${due.index}` : "";
  useEffect(() => {
    s.epoch++; s.audio?.pause(); s.audio=null; setCaption("");
    if (s.previousKey !== key) { s.consumed=""; s.previousKey=key; }
    if (!due || muted || (!playing && !(due.phase === "closing" && closingReady && allowStoppedClosing)) || s.consumed === key) return;
    const epoch=s.epoch;
    void getEventCommentary({data:{event,seed,index:due.index,preview}}).then(result => {
      if (epoch !== s.epoch || s.muted || s.time < due.at || (due.phase !== "closing" && (!s.playing || s.time-due.at > 4)) || result.status !== "ready") return;
      s.consumed=key; setCaption(result.body);
      if (result.audio) {const audio=new Audio(`data:audio/mpeg;base64,${result.audio}`);s.audio=audio;void audio.play().catch(()=>{});}
    }).catch(()=>{});
    return () => { s.epoch++; s.audio?.pause(); s.audio=null; };
  }, [key, playing, muted, preview, revealed, closingReady, allowStoppedClosing, event, seed, seekRevision, s]);
  useEffect(() => { s.consumed=""; }, [event,seed]);
  useEffect(() => () => {s.epoch++;s.audio?.pause();}, [s]);
  return caption;
}
