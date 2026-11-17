import { battleState, bellFor, stepPitExchange } from './combat';
import type { FighterSnap } from './types';

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Resolve the complete event on the server. Times are seconds from the bell. */
export function fightStaggeredRumble(fighters: FighterSnap[], seed: string, entryOrder?: string[]) {
  if (fighters.length !== 12 || new Set(fighters.map(f => f.id)).size !== 12) throw new Error('Rumble needs twelve distinct fighters.');
  const byId = new Map(fighters.map(f => [f.id, f]));
  const ids = entryOrder ? [...entryOrder] : [...byId.keys()].sort((a,b) => hash(`${seed}|entry|${a}`) - hash(`${seed}|entry|${b}`) || a.localeCompare(b));
  if (ids.length !== 12 || new Set(ids).size !== 12 || ids.some(id => !byId.has(id))) throw new Error('Entry order must contain all twelve fighters exactly once.');
  const entries = ids.map((fighterId,i) => ({fighterId, at: Math.max(0,(i-1)*3)}));
  const state = battleState(fighters);
  const bell = bellFor(fighters);
  const first = new Set(ids.slice(0,2));
  const eliminated: string[] = [];
  let tick = 0;
  // Each engagement is spaced independently of arrivals; waiting for a valid
  // pair leaves the clock running without inventing damage or a winner.
  for (let at = 2; ; at += 4, tick++) {
    const alive = entries.filter(e => e.at <= at && state.hp[e.fighterId]! > 0);
    if (at >= 30 && alive.length === 1) break;
    const oldest = alive[0]?.fighterId;
    const pairs: [string,string][] = [];
    for (let i=0;i<alive.length;i++) for (let j=i+1;j<alive.length;j++) {
      const a=alive[i]!.fighterId, b=alive[j]!.fighterId;
      if (alive.length>2 && ((!first.has(a) && b===oldest) || (!first.has(b) && a===oldest))) continue;
      pairs.push([a,b]);
    }
    if (!pairs.length) continue;
    const [a,b] = pairs[hash(`${seed}|pair|${tick}`)%pairs.length]!;
    const index=state.exchanges.length;
    stepPitExchange(byId.get(a)!, byId.get(b)!, state, index, {overtime:true, pace:0.7});
    const ex=state.exchanges[index]!;
    ex.index=index+1;
    ex.at=at;
    for (const id of [a,b]) {
      if ((ex.combat?.[id]?.hitCount ?? 0)>0) first.add(id);
      if (state.hp[id]===0) eliminated.push(id);
    }
  }
  const winner=ids.find(id => state.hp[id]! > 0)!;
  return {hp:state.hp, exchanges:state.exchanges, order:[winner,...eliminated.reverse()], bell, entries};
}
