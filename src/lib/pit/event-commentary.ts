import type { FightResult } from './types';
import type { ShowcaseTape, ShowcaseEventId } from './showcase-model';
import {gauntletAt,gauntletTask} from './showcase-gauntlet';

export type EventId = 'rumble' | ShowcaseEventId;
export type EventSegment = { id: string; index: number; at: number; phase: 'exchange' | 'closing'; facts: string };
export function eventKey(event: EventId, seed: string, index: number) {
  return `${event==='team-gauntlet'?'event-v3-gauntlet':'event-v2'}:${encodeURIComponent(event)}:${encodeURIComponent(seed)}:${index}`;
}
export function rumbleSegments(result: FightResult): EventSegment[] {
  const entries = result.rumbleEntries ?? [];
  const name = (id: string) => result.fighters.find(f => f.id === id)?.botName ?? 'A competitor';
  const exchanges = result.exchanges.map((x, i) => ({ x, i })).sort((a,b) => (a.x.at ?? a.i) - (b.x.at ?? b.i) || a.i-b.i);
  const segments: EventSegment[] = exchanges.map(({x}, index) => {
    const at = x.at ?? index;
    const entered = new Set(entries.filter(e => e.at <= at).map(e => e.fighterId));
    const allowed = (id: string) => !entries.length || entered.has(id);
    const details: string[] = [];
    const ids = [x.attackerId, x.defenderId].filter(allowed);
    for (const id of ids) {
      const trace = x.combat?.[id];
      const hp = id === x.attackerId ? x.attackerHp : x.defenderHp;
      if (trace) {
        if (trace.burnDamage > 0) details.push(`${name(id)} takes ${trace.burnDamage} burn damage`);
        if (trace.hazardDamage > 0) details.push(`${name(id)} takes ${trace.hazardDamage} arena hazard damage`);
        if (trace.hitCount > 0 && !x.tags?.includes('pit-elimination')) details.push(`${name(id)} lands ${trace.hitCount} weapon hit(s), dealing ${trace.damageDealt} direct damage`);
        if (trace.reflectedDamageTaken > 0) details.push(`${name(id)} takes ${trace.reflectedDamageTaken} reflected damage`);
        if (trace.healing > 0) details.push(`${name(id)} recovers ${trace.healing} HP`);
        if (trace.revived) details.push(`${name(id)} revives`);
      }
      if (Number.isFinite(hp)) details.push(`${name(id)} has ${hp} HP after this exchange`);
      if (hp === 0) {
        let cause = 'cause not established';
        if (x.tags?.includes('pit-elimination')) cause = 'pit';
        else if (trace && trace.before.hp <= trace.burnDamage) cause = 'burn';
        else if (trace && trace.before.hp - trace.burnDamage <= trace.hazardDamage) cause = 'arena hazard';
        else if (trace && ids.some(other => other !== id && (x.combat?.[other]?.hitCount ?? 0) > 0)) cause = 'combat damage';
        details.push(`${name(id)} is eliminated; cause: ${cause}`);
      }
    }
    // Never use call/tags containing private targeting details or unentered names.
    return { id: `exchange-${index}`, index, at, phase: 'exchange', facts: `At ${at} seconds: ${details.join('; ') || 'action continues'}.` };
  });
  const index = segments.length;
  segments.push({ id: 'closing', index, at: (segments.at(-1)?.at ?? 0), phase: 'closing', facts: `Result: ${result.winnerIds.map(name).join(', ')}. Method: ${result.method}. Final HP: ${JSON.stringify(result.hp)}.` });
  return segments;
}
export function showcaseSegments(tape: ShowcaseTape): EventSegment[] {
  const times = [...new Set([0, tape.duration / 3, tape.duration * 2 / 3, Math.max(0, tape.duration - 1)])].sort((a,b)=>a-b);
  if(tape.eventId==='team-gauntlet'){
    const segments:EventSegment[]=times.map((at,index)=>{
      const view=gauntletAt(tape,at,true);
      const details=view.crews.map(c=>`${c.team.name}: ${gauntletTask(c)}; ${c.frame.checkpoints} of 4 checkpoints complete; ${c.frame.coresDelivered} of 3 cores delivered; progress ${Math.round(c.frame.progress*1000)/10}%`);
      if(view.leaderIds.length)details.push(`Current lead: ${view.crews.filter(c=>view.leaderIds.includes(c.team.id)).map(c=>c.team.name).join(', ')}`);
      return {id:`checkpoint-${index}`,index,at,phase:'exchange',facts:`At ${at.toFixed(1)} seconds: ${details.join('; ')}.`};
    });
    const crew=tape.teams?.find(t=>t.storeIds.length===4&&t.storeIds.every(id=>tape.winnerIds.includes(id)));
    const names=tape.winnerIds.map(id=>tape.fighters.find(f=>f.id===id)?.botName??id);
    segments.push({id:'closing',index:segments.length,at:tape.duration,phase:'closing',facts:`Result: ${crew?.name??'The recorded crew'}: ${names.join(', ')}. Prize: Rumble entry slots 9–12, with the four members' relative order agreed through the Desk.${tape.tieBreak?' An exact sporting tie was settled by the recorded seeded draw.':''}`});
    return segments;
  }
  const segments: EventSegment[] = times.map((at,index) => {
    const visible = tape.runs.flatMap(run => {
      const frame = run.frames.filter(f => f.at <= at).at(-1);
      const fighter = tape.fighters.find(f => f.id === run.storeId);
      return frame && fighter ? [{frame, name:fighter.botName}] : [];
    });
    const details = visible.map(({frame,name}) => {
      const stage = tape.course.stages[frame.stage] ?? 'on course';
      const progress = Math.round(frame.progress * 1000) / 10;
      if (tape.eventId === 'tank-pull') return `${name}: ${progress} metres pulled; stage ${stage}`;
      if (tape.eventId === 'specialist-rescue') return `${name}: ${frame.cargo} cores delivered; stage ${stage}; progress ${progress}%`;
      return `${name}: stage ${stage}; progress ${progress}%`;
    });
    if (tape.eventId === 'striker-race' && visible.length) {
      const lead = Math.max(...visible.map(v=>v.frame.progress));
      details.push(`Current race leader(s): ${visible.filter(v=>v.frame.progress===lead).map(v=>v.name).join(', ')}`);
    }
    return { id: `checkpoint-${index}`, index, at, phase: 'exchange', facts: `At ${at.toFixed(1)} seconds: ${details.join('; ') || 'the event begins'}.` };
  });
  const index = segments.length;
  const winners = tape.winnerIds.map(id => tape.fighters.find(f=>f.id===id)?.botName ?? id);
  segments.push({id:'closing',index,at:tape.duration,phase:'closing',facts:`Result: ${winners.join(', ')}. Prize: ${tape.prize ?? 'none'}.`});
  return segments;
}
export function mayReadSegment(input: { segment: EventSegment; preview: boolean; commissioner: boolean; startedAt: number | null; revealedAt: number | null; gateAt: number; now: number }): boolean {
  if (input.preview && !input.commissioner) return false;
  if (input.segment.phase === 'closing') return !!input.revealedAt;
  if (input.preview) return true;
  if (input.revealedAt) return true;
  return !!input.startedAt && input.now >= input.gateAt && input.segment.at <= (input.now - input.startedAt) / 1000;
}
export type CacheRow = {status:string; body:string|null} | undefined;
export async function readPrepared(deps: {readText:()=>Promise<CacheRow>; readAudio:()=>Promise<CacheRow>}) {
  const row = await deps.readText();
  if (row?.status !== 'ready' || !row.body) return {status: row?.status === 'pending' ? 'pending' as const : 'unavailable' as const};
  const audio = await deps.readAudio();
  return {status:'ready' as const, body:row.body, ...(audio?.status === 'ready' && audio.body ? {audio:audio.body} : {})};
}
export async function warmPrepared(deps: {read:()=>Promise<CacheRow>; reserve:()=>Promise<'claimed'|'existing'|'capped'>; claim:()=>Promise<boolean>; generate:()=>Promise<string>; finish:(result:{body:string}|{error:string})=>Promise<void>; voice:(body:string)=>Promise<{audio?:string;voicePending?:boolean}>}) {
  let row = await deps.read();
  let claimed = false;
  if (!row) {
    const slot = await deps.reserve();
    if (slot === 'capped') return {status:'capped' as const,audioReady:false};
    claimed = slot === 'claimed';
    if (!claimed) row = await deps.read();
  }
  // Existing rows retain their original daily reservation. The update-only claim atomically
  // permits only stale pending or eligible failed rows, with bounded retries.
  if (!claimed && (row?.status === 'pending' || row?.status === 'failed')) {
    claimed = await deps.claim();
    if (!claimed) row = await deps.read();
  }
  if (claimed) {
    try { const body = (await deps.generate()).trim().replace(/\s+/g,' ').slice(0,240); if (!body) throw new Error('empty'); await deps.finish({body}); row = {status:'ready',body}; }
    catch { await deps.finish({error:'Commentary unavailable.'}); return {status:'unavailable' as const,audioReady:false}; }
  }
  if (row?.status !== 'ready' || !row.body) return {status:row?.status === 'pending' ? 'pending' as const : 'unavailable' as const,audioReady:false};
  const audio = await deps.voice(row.body);
  return {status:audio.voicePending ? 'pending' as const : 'ready' as const,audioReady:!!audio.audio};
}
