import { useEffect, useRef, useState } from 'react';
import { getEventCommentary } from '@/lib/pit/event-commentary-server';
import type { EventId, EventSegment } from '@/lib/pit/event-commentary';

type Options = {event:EventId; seed:string; segments:EventSegment[]; time:number; playing:boolean; muted:boolean; preview?:boolean; revealed?:boolean};
export function useEventCommentary({event,seed,segments,time,playing,muted,preview=false,revealed=false}:Options) {
  const [caption,setCaption]=useState('');
  const state=useRef({time,playing,muted,epoch:0,audio:null as HTMLAudioElement|null,last:-1,seed});
  const s=state.current;
  if (s.seed !== seed) { s.audio?.pause(); s.audio=null; s.seed=seed; s.last=-1; s.epoch++; }
  s.time=time; s.playing=playing; s.muted=muted;
  useEffect(()=>{ if (!playing || muted) { s.epoch++; s.audio?.pause(); s.audio=null; } },[playing,muted,s]);
  useEffect(()=>()=>{s.epoch++;s.audio?.pause();},[s]);
  const due = segments.reduce((found,segment)=>segment.at<=time && (segment.phase !== 'closing' || revealed) ? segment.index : found,-1);
  useEffect(()=>{
    if (!playing || due < 0) return;
    if (due < s.last) {s.epoch++;s.audio?.pause();s.audio=null;s.last=-1;}
    if (due === s.last) return;
    s.last=due;
    const moment=segments[due]; if (!moment) return;
    const epoch=++s.epoch; s.audio?.pause(); s.audio=null;
    void getEventCommentary({data:{event,seed,index:due,preview}}).then(result=>{
      if (epoch!==s.epoch || !s.playing || s.time < moment.at || s.time - moment.at > 4 || result.status !== 'ready') return;
      setCaption(result.body);
      if (!s.muted && result.audio) { const audio=new Audio(`data:audio/mpeg;base64,${result.audio}`); s.audio=audio; void audio.play().catch(()=>{}); }
    }).catch(()=>{});
  },[due,event,preview,playing,revealed,seed,segments,s]);
  return caption;
}
