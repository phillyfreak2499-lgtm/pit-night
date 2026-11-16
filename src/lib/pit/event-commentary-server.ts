import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { eventKey, mayReadSegment, readPrepared, rumbleSegments, showcaseSegments, warmPrepared, type CacheRow } from './event-commentary';
import { SHOWCASE_WATCH_AT } from './showcase-model';
import { SATURDAY_BELL, saturdayBout } from './saturday-seal';
import type { PitData } from './types';

const event = z.enum(['rumble','striker-race','tank-pull','specialist-rescue','team-gauntlet']);
const base = {event,index:z.number().int().min(0).max(1000)};
export const eventCommentaryRequestSchema = z.object({...base,seed:z.string().min(1).max(16384),preview:z.boolean().optional()}).strict();
const KIND = 'event-commentary';
type CacheInput = {event:z.infer<typeof event>; seed:string; index:number};
type CacheDeps = {
  read:(kind:string,key:string)=>Promise<CacheRow>;
  reserve:(key:string)=>Promise<'claimed'|'existing'|'capped'>;
  claim:(key:string)=>Promise<boolean>;
  generate:()=>Promise<string>;
  finish:(key:string,result:{body:string}|{error:string})=>Promise<void>;
  voice:(key:string,body:string)=>Promise<{audio?:string;voicePending?:boolean}>;
};
/** Single identity for preparation, voice adapter, and playback. */
async function cacheIdentity({event,seed,index}:CacheInput) {
  const {createHash} = await import('node:crypto');
  const key = eventKey(event, createHash('sha256').update(seed).digest('hex'), index);
  // Jim voice/model identity used by the existing ringsideVoice adapter.
  return {key,audioKey:`DduhIyyKkOosbP8VefhP:eleven_v4:${key}`};
}
export async function prepareEventCache(input:CacheInput,deps:CacheDeps) {
  const {key}=await cacheIdentity(input);
  return warmPrepared({read:()=>deps.read(KIND,key),reserve:()=>deps.reserve(key),claim:()=>deps.claim(key),generate:deps.generate,finish:value=>deps.finish(key,value),voice:body=>deps.voice(key,body)});
}
export async function readEventCache(input:CacheInput,read:CacheDeps['read']) {
  const {key,audioKey}=await cacheIdentity(input);
  return readPrepared({readText:()=>read(KIND,key),readAudio:()=>read('ringside-audio',audioKey)});
}
function resolve(data:PitData, id:z.infer<typeof event>) {
  if (id === 'rumble') {
    const result = saturdayBout(data,'rumble')?.result;
    if (!result) return null;
    return {seed:result.seed, segments:rumbleSegments(result), startedAt:data.saturdayWatch?.rumbleStartedAt ?? null, revealedAt:data.saturdayWatch?.rumbleRevealedAt ?? null, gateAt:SATURDAY_BELL.getTime()};
  }
  const state = data.showcase?.events[id];
  if (!state?.tape) return null;
  return {seed:state.tape.seed,segments:showcaseSegments(state.tape),startedAt:state.startedAt,revealedAt:state.revealedAt,gateAt:SHOWCASE_WATCH_AT};
}
export const prepareEventCommentary = createServerFn({method:'POST'}).validator(z.object(base).strict()).handler(async ({data:input}) => {
  const [{readSeason},{getSql},store,{askClaude,FEATURE_MODEL},{ringsideVoice}] = await Promise.all([import('./authoritative'),import('@/lib/db'),import('./claude-store'),import('./claude.server'),import('./ringside-voice.server')]);
  const season = await readSeason(); season.auth.sameOrigin();
  if ((await season.auth.session(season.data)).role !== 'commissioner') throw new Error('Only the Desk can prepare commentary.');
  const tape = resolve(season.data,input.event), segment = tape?.segments[input.index];
  if (!tape || !segment) return {status:'unavailable' as const,audioReady:false,index:input.index,total:tape?.segments.length ?? 0};
  const sql=await getSql();
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago'}).format(new Date());
  const result=await prepareEventCache({event:input.event,seed:tape.seed,index:input.index},{
    read:(kind,key)=>store.readCopy(sql,kind,key),
    reserve:(key)=>store.reserveCopy(sql,KIND,key,FEATURE_MODEL.live,80,day),
    claim:(key)=>store.claimCopy(sql,KIND,key,FEATURE_MODEL.live),
    generate:async()=> { const text = (await askClaude({feature:'live',system:'You are a live sports announcer. Write one short, energetic sentence using only the supplied facts. Do not predict, invent outcomes, or mention private mechanics. No stage directions.',prompt:segment.facts,maxTokens:100})).text; if (segment.phase !== 'closing' && /\b(wins?|won|winner|champion|victory|final result)\b/i.test(text)) throw new Error('Premature result'); return text; },
    finish:(key,value)=>store.finishCopy(sql,KIND,key,value),
    voice:(key,body)=>ringsideVoice(sql,key,body),
  });
  return {...result,index:input.index,total:tape.segments.length};
});
export const getEventCommentary = createServerFn({method:'POST'}).validator(eventCommentaryRequestSchema).handler(async ({data:input}) => {
  const [{readSeason},{getSql},store]=await Promise.all([import('./authoritative'),import('@/lib/db'),import('./claude-store')]);
  const season=await readSeason(), tape=resolve(season.data,input.event), segment=tape?.segments[input.index];
  if (!tape || !segment || tape.seed !== input.seed) return {status:'unavailable' as const};
  const commissioner = input.preview ? (await season.auth.session(season.data)).role === 'commissioner' : false;
  if (!mayReadSegment({segment,preview:!!input.preview,commissioner,startedAt:tape.startedAt,revealedAt:tape.revealedAt,gateAt:tape.gateAt,now:Date.now()})) return {status:'unavailable' as const};
  const sql=await getSql();
  return readEventCache({event:input.event,seed:tape.seed,index:input.index},(kind,key)=>store.readCopy(sql,kind,key));
});

