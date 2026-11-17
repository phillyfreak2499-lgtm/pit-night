import { useEffect, useState } from 'react';
import { usePit } from '@/lib/pit/store';
import { takeLeagueSeason } from '@/lib/pit/sync';
import { SHOWCASE_EVENTS, SHOWCASE_LOCK_LABEL } from '@/lib/pit/showcase-model';
import { getShowcasePreparation, lockShowcaseBuilds, prepareShowcaseTapes, saveShowcaseMetrics } from '@/lib/pit/showcase-server';
import { prepareEventCommentary } from '@/lib/pit/event-commentary-server';
import type { StoreCard } from '@/lib/pit/types';
import {mergeShowcaseCards} from './showcase-metrics-drafts';

const metrics = [['nsnu','NSNU $'],['conv','Conversion %'],['demoRate','Demo rate %'],['demoClose','Demo close %'],['arch','Arch'],['demoTicket','Ticket $']] as const;
export function ShowcaseOperations() {
  const stores=usePit(s=>s.stores);
  const [cards,setCards]=useState<StoreCard[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const refresh=async(submitted?:StoreCard)=>{const state=await getShowcasePreparation();setCards(current=>mergeShowcaseCards(current,state.cards,submitted));};
  useEffect(()=>{void refresh().catch(()=>{});},[]);
  const run=async(action:()=>Promise<unknown>,submitted?:StoreCard)=>{setBusy(true);setMessage('');try{await action();await refresh(submitted);await takeLeagueSeason();setMessage('Saved.');}catch(e){setMessage(e instanceof Error?e.message:'The preparation step could not finish.');}finally{setBusy(false);}};
  const warm=async()=>{
    setBusy(true);setMessage('');
    try{
      for(const event of SHOWCASE_EVENTS){
        let total=1;
        for(let index=0;index<total;index++){
          const r=await prepareEventCommentary({data:{event:event.id,index}});total=r.total;
          setMessage(`${event.title}: ${index+1} / ${total} clips`);
          if(r.status!=='ready'||!r.audioReady)throw new Error(`${event.title}: commentary is ${r.status}; recording is ${r.audioReady?'ready':'not ready'}. Try preparation again to reuse completed clips.`);
        }
      }
      setMessage('All showcase commentary clips are prepared.');
    }catch(e){setMessage(e instanceof Error?e.message:'Commentary preparation stopped.');}finally{setBusy(false);}
  };
  return <section className="border border-line bg-deep p-5" aria-label="Showcase preparation"><h2 className="font-display text-2xl">Desk preparation</h2><p className="mt-2 text-sm text-muted">Build lock: {SHOWCASE_LOCK_LABEL}. Enter the weekend showcase metrics here, then prepare the four event tapes and commentary.</p><div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} className="min-h-11 border border-amber px-4 text-amber" onClick={()=>void run(lockShowcaseBuilds)}>Freeze showcase builds</button><button disabled={busy||!cards.length} className="min-h-11 border border-line px-4" onClick={()=>void run(prepareShowcaseTapes)}>Prepare event tapes</button><button disabled={busy} className="min-h-11 border border-line px-4" onClick={()=>void warm()}>Prepare commentary</button></div>{message&&<p role="status" className="mt-3 text-sm text-amber">{message}</p>}
    <details className="mt-5"><summary className="cursor-pointer font-display text-lg">Showcase metric cards ({cards.filter(c=>c.nsnuOfficial).length}/{cards.length} saved)</summary><div className="mt-4 grid gap-4 md:grid-cols-2">{cards.map((card,index)=><form key={card.storeId} className="border border-line p-4" onSubmit={e=>{e.preventDefault();void run(()=>saveShowcaseMetrics({data:{card:{...card,nsnuOfficial:true,projected:false}}}),card);}}><h3 className="font-display text-xl">{stores.find(s=>s.id===card.storeId)?.name}</h3><div className="mt-3 grid grid-cols-2 gap-3">{metrics.map(([key,label])=><label key={key} className="text-xs text-muted">{label}<input aria-label={`${stores.find(s=>s.id===card.storeId)?.name} ${label}`} className="mt-1 block w-full border border-line bg-black p-2 text-white" type="number" min="0" step="any" required value={card[key]} onChange={e=>setCards(all=>all.map((c,i)=>i===index?{...c,[key]:Number(e.target.value),grades:undefined}:c))}/></label>)}</div><button disabled={busy} className="mt-3 min-h-11 bg-amber px-4 font-display text-black">Save metrics</button></form>)}</div></details>
  </section>;
}
