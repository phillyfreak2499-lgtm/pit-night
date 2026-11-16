import { cardFor, snapshot } from './engine';
import { central } from './time';
import { buildShowcaseTeams, simulateShowcaseEvent } from './showcase-engine.server.ts';
import { SHOWCASE_EVENTS, SHOWCASE_LOCK_AT, SHOWCASE_WATCH_AT, showcaseField } from './showcase-model';
import type { ShowcaseEventId, ShowcaseState, ShowcaseTape } from './showcase-model';
import type { Bot, PitData, StoreCard } from './types';

const clone = <T>(value: T): T => structuredClone(value);
const orderLock = central(2026, 11, 27, 18).getTime();
const meta = (event: ShowcaseEventId) => {
  const index = SHOWCASE_EVENTS.findIndex(row => row.id === event);
  if (index < 0) throw new Error('Unknown showcase event');
  return index;
};
function fieldOf(data: PitData): string[] {
  const field = showcaseField(data);
  if (field.length !== 12 || new Set(field).size !== 12) throw new Error('Showcase requires twelve distinct nonfinalists and two confirmed finalists');
  return field;
}
function stateOf(data: PitData): ShowcaseState {
  if (!data.showcase?.lockedAt || !data.showcase.frozenBots) throw new Error('Showcase builds are not frozen');
  return data.showcase;
}
const started = (s: ShowcaseState) => SHOWCASE_EVENTS.some(e => s.events[e.id]?.startedAt != null);
function frozenBot(bot: Bot): Bot {
  const copy = clone(bot);
  copy.locked = clone(copy.draft);
  copy.equipped = clone(copy.draft);
  return copy;
}
function initialCards(data: PitData, field: string[]): StoreCard[] {
  return field.map(id => {
    const card = cardFor(data, id, 4);
    if (!card) throw new Error(`Missing week 4 card for ${id}`);
    return { ...clone(card), id: `showcase-${id}`, week: 4, nsnuOfficial: false };
  });
}
function fightersFor(data: PitData, field: string[], bots: Bot[], cards: StoreCard[]) {
  const isolated = clone(data);
  isolated.week = 4;
  isolated.phase = 'locked';
  isolated.bots = isolated.bots.map(bot => clone(bots.find(b => b.storeId === bot.storeId) ?? bot));
  isolated.storeCards = isolated.storeCards.filter(c => c.week !== 4 || !field.includes(c.storeId));
  isolated.storeCards.push(...cards.map(c => ({ ...clone(c), week: 4 })));
  // The exhibition is a separate weekend, so old Week 4 tune-ups do not carry over.
  isolated.jobLog = [];
  return field.map(id => snapshot(isolated, id));
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
function seedFor(bots: Bot[], cards: StoreCard[]): string {
  const input = stable({ bots, cards }); let h = 2166136261;
  for (const c of input) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return `showcase:${(h >>> 0).toString(16)}`;
}
function shuffled(ids: string[], seed: string): string[] {
  return ids.slice().sort((a,b) => {
    const hash = (s:string) => { let h=2166136261; for (const c of s) { h ^= c.charCodeAt(0); h=Math.imul(h,16777619); } return h>>>0; };
    return hash(seed + ':' + a) - hash(seed + ':' + b) || a.localeCompare(b);
  });
}
export function freezeShowcase(data: PitData, now: number): PitData {
  if (data.showcase?.lockedAt && data.showcase.frozenBots) return clone(data);
  if (now < SHOWCASE_LOCK_AT) throw new Error('Showcase builds cannot freeze before the lock');
  const field = fieldOf(data);
  const bots = field.map(id => { const bot=data.bots.find(b=>b.storeId===id); if (!bot) throw new Error(`Missing bot for ${id}`); return frozenBot(bot); });
  const cards = initialCards(data, field);
  const seed = seedFor(bots, cards);
  const teams = buildShowcaseTeams(fightersFor(data, field, bots, cards), seed);
  const result = clone(data);
  result.showcase = { field, teams, createdAt: now, lockedAt: SHOWCASE_LOCK_AT, frozenBots: bots, cards, events: {} };
  return result;
}
export function saveShowcaseCard(data: PitData, card: StoreCard, _now: number): PitData {
  const s=stateOf(data);
  if (!s.field.includes(card.storeId)) throw new Error('Store is not in the showcase field');
  if (started(s)) throw new Error('Cannot change showcase cards after an event starts');
  const limits: [keyof StoreCard,number][] = [['nsnu',1000000],['conv',100],['demoRate',100],['demoClose',100],['arch',100],['demoTicket',100000]];
  for (const [key,max] of limits) { const n=card[key]; if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > max) throw new Error(`Invalid showcase card metric: ${key}`); }
  if (!s.cards || s.cards.filter(c=>c.storeId===card.storeId).length !== 1) throw new Error('Showcase card is missing or duplicated');
  const result=clone(data), out=result.showcase!;
  out.cards=out.cards!.map(c=>c.storeId===card.storeId ? { ...clone(card), id:c.id, week:4 } : c);
  out.preparedAt=undefined; out.events={}; out.teams=[]; out.entryOrder=undefined;
  return result;
}
export function prepareShowcase(data: PitData, now: number): PitData {
  const s=stateOf(data);
  if (now < SHOWCASE_LOCK_AT) throw new Error('Showcase builds have not locked');
  if (started(s)) throw new Error('Cannot prepare after an event starts');
  if (!s.cards || s.cards.length!==12 || new Set(s.cards.map(c=>c.storeId)).size!==12 || s.field.some(id=>!s.cards!.some(c=>c.storeId===id && c.nsnuOfficial))) throw new Error('All twelve showcase cards must be official');
  if (s.preparedAt != null && SHOWCASE_EVENTS.every(e=>s.events[e.id]?.tape)) return clone(data);
  const fighters=fightersFor(data,s.field,s.frozenBots!,s.cards), seed=seedFor(s.frozenBots!,s.cards);
  const teams=buildShowcaseTeams(fighters,seed), result=clone(data), out=result.showcase!;
  out.teams=teams; out.preparedAt=now;
  out.events=Object.fromEntries(SHOWCASE_EVENTS.map(e=>[e.id,{startedAt:null,revealedAt:null,tape:simulateShowcaseEvent(fighters,e.id,teams,`${seed}:${e.id}`)}]));
  return result;
}
export function startShowcaseEvent(data: PitData, event: ShowcaseEventId, now: number): PitData {
  const i=meta(event), s=stateOf(data), e=s.events[event];
  if (!e?.tape || s.preparedAt == null) throw new Error('Showcase event is not prepared');
  if (e.startedAt != null) return clone(data);
  if (now < SHOWCASE_WATCH_AT) throw new Error('Showcase watch has not opened');
  if (SHOWCASE_EVENTS.slice(0,i).some(row=>s.events[row.id]?.revealedAt == null)) throw new Error('Reveal prior showcase events first');
  const result=clone(data); result.showcase!.events[event]!.startedAt=now; return result;
}
export function revealShowcaseEvent(data: PitData, event: ShowcaseEventId, now: number): PitData {
  meta(event); const s=stateOf(data), e=s.events[event];
  if (!e?.tape || e.startedAt == null) throw new Error('Start the showcase event before revealing it');
  if (e.revealedAt != null) return clone(data);
  const result=clone(data), out=result.showcase!, tape=out.events[event]!.tape!;
  out.events[event]!.revealedAt=now;
  if (tape.prize) for (const id of tape.winnerIds) {
    const store=result.stores.find(row=>row.id===id); if (!store) throw new Error('Showcase winner is missing');
    store.unlocks=[...new Set([...(store.unlocks??[]),`showcase-prize:${tape.prize}`])];
  }
  if (event==='team-gauntlet') {
    const winners=tape.winnerIds;
    if (winners.length!==4 || new Set(winners).size!==4 || !out.teams.some(t=>t.storeIds.length===4 && t.storeIds.every(id=>winners.includes(id)))) throw new Error('Showcase winning crew is invalid');
    out.entryOrder=[...shuffled(out.field.filter(id=>!winners.includes(id)),tape.seed+':prefix'),...shuffled(winners,tape.seed+':winners')];
  }
  return result;
}
export function setShowcaseEntryOrder(data: PitData, order: string[], now: number): PitData {
  const s=stateOf(data), e=s.events['team-gauntlet'];
  if (!e?.revealedAt || !e.tape || !s.entryOrder) throw new Error('Reveal the winning crew first');
  if (now>=orderLock || data.saturdayWatch || data.saturdayBaseline || data.bouts.some(b=>b.week===5 && b.result) || data.replays?.some(r=>r.week===5 && r.bouts.some(b=>b.result)) || (data.week===5 && data.phase==='fought')) throw new Error('Rumble entry order is locked');
  if (order.length!==4 || new Set(order).size!==4 || order.some(id=>!e.tape!.winnerIds.includes(id))) throw new Error('Order must contain exactly the four winning crew members');
  const result=clone(data); result.showcase!.entryOrder=[...s.entryOrder.slice(0,8),...order]; return result;
}
export function sealShowcase(data: PitData): PitData {
  const result=clone(data), s=result.showcase; if (!s) return result;
  delete s.frozenBots; delete s.cards;
  for (const event of SHOWCASE_EVENTS) { const e=s.events[event.id]; if (e && e.revealedAt == null) e.tape=null; }
  if (s.events['team-gauntlet']?.revealedAt == null) delete s.entryOrder;
  return result;
}
export function previewShowcase(data: PitData, event: ShowcaseEventId, source: 'rehearsal'|'prepared'): ShowcaseTape {
  meta(event);
  if (source==='prepared') { const tape=data.showcase?.events[event]?.tape; if (!tape) throw new Error('Showcase event is not prepared'); return clone(tape); }
  if (source!=='rehearsal') throw new Error('Unknown showcase preview source');
  const field=fieldOf(data), bots=field.map(id=>{ const bot=data.bots.find(b=>b.storeId===id); if (!bot) throw new Error(`Missing bot for ${id}`); return frozenBot(bot); });
  const initial=initialCards(data,field), cards=field.map(id=>clone(data.showcase?.cards?.find(c=>c.storeId===id) ?? initial.find(c=>c.storeId===id)!));
  const fighters=fightersFor(data,field,bots,cards), seed=seedFor(bots,cards), teams=buildShowcaseTeams(fighters,seed);
  return simulateShowcaseEvent(fighters,event,teams,`${seed}:${event}`);
}
export function showcaseBuildLocked(data: PitData, storeId: string, now: number): boolean {
  if (now<SHOWCASE_LOCK_AT) return false;
  const s=data.showcase, field=s?.lockedAt ? s.field : showcaseField(data);
  return field.includes(storeId) && !SHOWCASE_EVENTS.every(e=>s?.events[e.id]?.revealedAt != null);
}


