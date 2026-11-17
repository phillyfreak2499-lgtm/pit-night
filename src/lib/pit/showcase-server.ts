import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { PitData, StoreCard } from './types';
import type { ShowcaseEventId } from './showcase-model';

const event = z.enum(['striker-race', 'tank-pull', 'specialist-rescue', 'team-gauntlet']);
async function owner(readOnly = false) {
  const { loadSeason, readSeason } = await import('./authoritative');
  const s = await (readOnly ? readSeason() : loadSeason());
  s.auth.sameOrigin();
  if ((await s.auth.session(s.data)).role !== 'commissioner') throw new Error('The Desk PIN is required.');
  return s;
}
async function change<T>(update: (data: PitData, now: number) => { data: PitData; response: T }) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const s = await owner();
    const next = update(s.data, Date.now());
    const doc = JSON.stringify(s.store.sharedDoc(next.data));
    if (doc === s.row.doc) return next.response;
    const rows = await s.sql<{rev:number}>`update pit_season set rev=rev+1, doc=${doc}, updated_at=now() where id='main' and rev=${s.row.rev} returning rev`;
    if (rows[0]) return next.response;
  }
  throw new Error('The league is busy. Try again.');
}
export const getShowcasePreparation = createServerFn({method:'POST'}).handler(async () => {
  const s = await owner(true);
  return { cards:s.data.showcase?.cards ?? [], lockedAt:s.data.showcase?.lockedAt ?? null, preparedAt:s.data.showcase?.preparedAt ?? null };
});
export const lockShowcaseBuilds = createServerFn({method:'POST'}).handler(async () => {
  const { freezeShowcase } = await import('./showcase-state.server.ts');
  return change((data,now) => ({data:freezeShowcase(data,now),response:{ok:true as const}}));
});
const card = z.object({
  id:z.string().min(1).max(160), storeId:z.string().min(1).max(120), week:z.number().int().min(1).max(5),
  nsnu:z.number().min(0).max(1000000), conv:z.number().min(0).max(100), demoRate:z.number().min(0).max(100),
  demoClose:z.number().min(0).max(100), arch:z.number().min(0).max(100), demoTicket:z.number().min(0).max(100000),
  nsnuOfficial:z.boolean().optional(), projected:z.boolean(),
  grades:z.object({nsnu:z.enum(['green','blue','orange','red']).optional(),conv:z.enum(['green','blue','orange','red']).optional(),demoRate:z.enum(['green','blue','orange','red']).optional(),demoClose:z.enum(['green','blue','orange','red']).optional(),arch:z.enum(['green','blue','orange','red']).optional(),ticket:z.enum(['green','blue','orange','red']).optional()}).strict().optional(),
}).strict();
export const saveShowcaseMetrics = createServerFn({method:'POST'}).validator(z.object({card}).strict()).handler(async ({data:input}) => {
  const {saveShowcaseCard}=await import('./showcase-state.server.ts');
  return change((data,now)=>({data:saveShowcaseCard(data,input.card as StoreCard,now),response:{ok:true as const}}));
});
export const prepareShowcaseTapes = createServerFn({method:'POST'}).handler(async()=>{
  const {prepareShowcase}=await import('./showcase-state.server.ts');
  return change((data,now)=>({data:prepareShowcase(data,now),response:{ok:true as const}}));
});
export const openShowcaseEvent = createServerFn({method:'POST'}).validator(z.object({event}).strict()).handler(async ({data:input})=>{
  const {startShowcaseEvent}=await import('./showcase-state.server.ts');
  return change((data,now)=>{const next=startShowcaseEvent(data,input.event,now); return {data:next,response:{tape:next.showcase!.events[input.event]!.tape!}};});
});
export const publishShowcaseEvent = createServerFn({method:'POST'}).validator(z.object({event}).strict()).handler(async ({data:input})=>{
  const {revealShowcaseEvent}=await import('./showcase-state.server.ts');
  return change((data,now)=>({data:revealShowcaseEvent(data,input.event,now),response:{ok:true as const}}));
});
export const saveShowcaseEntryOrder = createServerFn({method:'POST'}).validator(z.object({order:z.array(z.string().min(1).max(120)).length(4)}).strict()).handler(async ({data:input})=>{
  const {setShowcaseEntryOrder}=await import('./showcase-state.server.ts');
  return change((data,now)=>({data:setShowcaseEntryOrder(data,input.order,now),response:{ok:true as const}}));
});
export const previewShowcaseEvent = createServerFn({method:'POST'}).validator(z.object({event,source:z.enum(['rehearsal','prepared'])}).strict()).handler(async ({data:input})=>{
  const s=await owner(true);
  const {previewShowcase}=await import('./showcase-state.server.ts');
  let data: PitData=s.data;
  if(input.source==='rehearsal') {
    const {pendingApprovedFinale,FINALE_POST_AFTER}=await import('./period12-tape');
    if(pendingApprovedFinale(data)) {
      const {reconcilePeriod12Finale}=await import('./period12-finale');
      data=reconcilePeriod12Finale(data,new Date(FINALE_POST_AFTER+1));
    }
  }
  return {tape:previewShowcase(data,input.event as ShowcaseEventId,input.source),source:input.source};
});
