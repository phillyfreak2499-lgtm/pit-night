import type { fightStaggeredRumble } from './rumble.server';
import type { FighterSnap, FightResult } from './types';

export const RUMBLE_BLOWOUT_HP = 60;

/** Convert the server's compact resolution into a self-contained replay. */
export function adaptRumbleResult(
  resolution: ReturnType<typeof fightStaggeredRumble>,
  context: { fighters: FighterSnap[]; seed: string; pitTarget: { x: number; y: number } },
): FightResult {
  const ids = context.fighters.map(fighter => fighter.id);
  const idSet = new Set(ids);
  const sameIds = (values: string[]) => values.length === 12 && new Set(values).size === 12 && values.every(id => idSet.has(id));
  if (ids.length !== 12 || idSet.size !== 12 || ids.some(id => !id)) throw new Error('Rumble requires twelve distinct fighter IDs.');
  if (!sameIds(resolution.order) || !sameIds(resolution.entries.map(entry => entry.fighterId)) ||
      !sameIds(Object.keys(resolution.hp)) || !sameIds(Object.keys(resolution.bell))) throw new Error('Rumble fighter IDs do not match.');
  if (resolution.entries.some((entry, index) => entry.at !== Math.max(0, (index - 1) * 3))) throw new Error('Invalid Rumble entry clock.');
  const winner = resolution.order[0]!;
  if (resolution.order.some((id, index) => !Number.isFinite(resolution.hp[id]) || (index === 0 ? resolution.hp[id]! <= 0 || resolution.hp[id]! > 100 : resolution.hp[id] !== 0))) {
    throw new Error('Invalid Rumble survivor HP.');
  }
  let previousAt = -Infinity;
  for (const exchange of resolution.exchanges) {
    if (!Number.isFinite(exchange.at) || exchange.at! < 0 || exchange.at! < previousAt ||
        !idSet.has(exchange.attackerId) || !idSet.has(exchange.defenderId) || exchange.attackerId === exchange.defenderId ||
        Object.keys(exchange.combat ?? {}).some(id => !idSet.has(id)) || Object.keys(exchange.vitals ?? {}).some(id => !idSet.has(id))) {
      throw new Error('Invalid Rumble exchange.');
    }
    previousAt = exchange.at!;
  }
  const last = resolution.exchanges.at(-1);
  const loser = resolution.order[1]!;
  const strike = last?.combat?.[winner];
  const victim = last?.combat?.[loser];
  const pairMatches = last && ((last.attackerId === winner && last.defenderId === loser) || (last.attackerId === loser && last.defenderId === winner));
  // Direct damage must independently account for the knockout after prior environmental damage.
  const remaining = victim ? victim.before.hp - victim.burnDamage - victim.hazardDamage : 0;
  const finisher = pairMatches && strike && victim && victim.after.hp === 0 && !victim.revived &&
    !last.tags.includes('pit-elimination') && remaining > 0 && strike.hitCount > 0 && strike.damageDealt >= remaining
    ? { by: winner, against: loser, damage: strike.damageDealt, call: last.call, combat: last.combat }
    : null;
  const wear: FightResult['wear'] = {};
  for (const id of ids) {
    wear[id] = { chassis: 'clean', drive: id === winner ? 'clean' : 'scratched', weapon: id === winner ? 'clean' : 'bent', armor: id === winner ? 'scratched' : 'clean', utility: 'clean', brain: 'clean' };
  }
  return structuredClone({
    rumbleEntries: resolution.entries,
    winnerIds: [winner], loserIds: resolution.order.slice(1), method: 'melee',
    blowout: resolution.hp[winner]! >= RUMBLE_BLOWOUT_HP,
    exchanges: resolution.exchanges.map(exchange => ({ ...exchange, tags: [...new Set([...exchange.tags, 'melee'])] })),
    finisher, hp: resolution.hp, fighters: context.fighters, wear, seed: context.seed,
    meleeOrder: resolution.order, pitTarget: context.pitTarget, bell: resolution.bell,
  });
}

