import { boutSeed, pitTargetForWeek, ROYAL_RUMBLE_TITLE, runSaturday, simulateBout, snapshot } from './engine';
import { equippedShowcaseBonus } from './showcase-prizes';
import { adaptRumbleResult } from './rumble-result.server.ts';
import { fightStaggeredRumble } from './rumble.server.ts';
import type { PitData } from './types';

/** Resolve first; the store then derives honors, wear, news and archives from this card. */
export function runServerCard(data: PitData) {
  return runSaturday(data, (season, bout) => {
    if (bout.week !== 5 || bout.title !== ROYAL_RUMBLE_TITLE) return simulateBout(season, bout);
    const fighters = bout.storeIds.map(id => {
      const fighter = snapshot(season, id);
      const bonus = equippedShowcaseBonus(season, id);
      return { ...fighter, stats: {
        power: fighter.stats.power + (bonus.power ?? 0),
        speed: fighter.stats.speed + (bonus.speed ?? 0),
        armor: fighter.stats.armor + (bonus.armor ?? 0),
        heat: fighter.stats.heat + (bonus.heat ?? 0),
      } };
    });
    const order = season.showcase?.entryOrder;
    const seed = `${boutSeed(season, bout)}|staggered-v1|${fighters.map(f => `${f.id}:${Object.values(f.stats).join(',')}`).join('|')}|${order?.join(',') ?? 'draw'}`;
    const resolution = fightStaggeredRumble(fighters, seed, order);
    return adaptRumbleResult(resolution, { fighters, seed, pitTarget: pitTargetForWeek(5) });
  });
}
