import { useState } from 'react';
import { prepareEventCommentary } from '@/lib/pit/event-commentary-server';
import type { EventId } from '@/lib/pit/event-commentary';

export function PreparedCommentaryButton({event,label}:{event:EventId;label:string}) {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const prepare=async()=>{
    setBusy(true);setMessage('');
    try{
      let total=1;
      for(let index=0;index<total;index++){
        const r=await prepareEventCommentary({data:{event,index}}); total=r.total;
        setMessage(`${index+1} / ${total} clips`);
        if(r.status!=='ready'||!r.audioReady) throw new Error(`Preparation stopped: ${r.status}; audio ${r.audioReady?'ready':'not ready'}. Completed clips are kept for retry.`);
      }
      setMessage('Commentary ready.');
    }catch(e){setMessage(e instanceof Error?e.message:'Commentary preparation stopped.');}finally{setBusy(false);}
  };
  return <div><button disabled={busy} onClick={()=>void prepare()} className="min-h-11 border border-line px-4 text-sm">{busy?'Preparing…':label}</button>{message&&<p role="status" className="mt-1 max-w-sm text-xs text-muted">{message}</p>}</div>;
}
