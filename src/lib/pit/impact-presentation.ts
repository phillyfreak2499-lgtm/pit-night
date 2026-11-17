import type {Exchange,FightResult} from './types';

export const IMPACT_AT=.42;
export const DUEL_STRIKE_AT=(7+IMPACT_AT*13)/25;
export const FINISH_VISIBLE_AT=IMPACT_AT;
export function usesDuelPresentation(result:FightResult) {
  return result.fighters.length===2 && result.method!=='melee' && result.method!=='bye' && result.exchanges.length>0;
}
export function chipDamage(ex:Exchange) {return ex.damage>=6?Math.round(ex.damage*.35):0;}
export function scoringDamage(result:FightResult,ex:Exchange) {return ex.damage-(usesDuelPresentation(result)?chipDamage(ex):0);}
export function isHeatFinisher(result:FightResult) {
  return result.method!=='dump' && !!result.finisher && /spends the Heat|burn/i.test(result.finisher.call);
}
