import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adaptRumbleResult } from '../src/lib/pit/rumble-result.server.ts';
import {buildBeats,fightDrive} from '../src/components/pit/cage-motion.ts';
import type { FighterSnap, CombatTrace } from '../src/lib/pit/types';

const ids = Array.from({ length: 12 }, (_, i) => `f${i}`);
const fighters: FighterSnap[] = ids.map((id, i) => ({ id, name: `Name ${i}`, storeName: `Store ${i}`, classId: 'striker', paint: 'red', botName: `Bot ${i}`, stats: { power: 10, speed: 10, armor: 10, heat: 10 }, rating: 40, fit: 1, weekQ: 1, weaponFamily: 'blade', weaponName: 'Blade', driveName: 'Drive', armorName: 'Armor', utilityName: null, chassisName: 'Chassis', look: 'plain', number: String(i), shows: ['fog'] }));
const state = (hp: number) => ({ hp, battery: 50, heat: 0, burn: 0, stun: 1, slow: 1, phoenixUsed: false });
const trace = (before: number, after: number, damageDealt = 0, hitCount = 0): CombatTrace => ({ before: state(before), after: state(after), damageDealt, hitCount, reflectedDamageTaken: 0, hazardDamage: 0, burnDamage: 0, healing: 0, revived: false });
function fixture() {
  const order = [ids[3]!, ...ids.filter(id => id !== ids[3])];
  const hp = Object.fromEntries(ids.map(id => [id, id === order[0] ? 60 : 0]));
  const bell = Object.fromEntries(ids.map(id => [id, { battery: 100, batteryMax: 100, stamina: 100, staminaMax: 100, power: 10 }]));
  const entries = ids.map((fighterId, i) => ({ fighterId, at: Math.max(0, (i - 1) * 3) }));
  const combat = { [order[0]!]: trace(65, 60, 15, 1), [order[1]!]: trace(12, 0, 5, 1) };
  const exchanges = [{ at: 34, index: 1, attackerId: order[0]!, defenderId: order[1]!, damage: 15, attackerHp: 60, defenderHp: 0, call: 'A decisive hit.', tags: ['knockout'], combat, vitals: { [order[0]!]: { battery: 50, stamina: 70, staminaLow: 60, power: 8 } } }];
  return { resolution: { hp, bell, entries, order, exchanges }, context: { fighters: structuredClone(fighters), seed: 'seed', pitTarget: { x: 0.5, y: 0.64 } } };
}

test('adapts the complete saved record without aliasing', () => {
  const { resolution, context } = fixture();
  const saved = adaptRumbleResult(resolution, context);
  const wear = Object.fromEntries(ids.map(id => [id, { chassis: 'clean', drive: id === 'f3' ? 'clean' : 'scratched', weapon: id === 'f3' ? 'clean' : 'bent', armor: id === 'f3' ? 'scratched' : 'clean', utility: 'clean', brain: 'clean' }]));
  const expected = structuredClone({ rumbleEntries: resolution.entries, winnerIds: ['f3'], loserIds: resolution.order.slice(1), method: 'melee', blowout: true, exchanges: [{ ...resolution.exchanges[0]!, tags: ['knockout', 'melee'] }], finisher: { by: 'f3', against: 'f0', damage: 15, call: 'A decisive hit.', combat: resolution.exchanges[0]!.combat }, hp: resolution.hp, fighters: context.fighters, wear, seed: 'seed', meleeOrder: resolution.order, pitTarget: { x: 0.5, y: 0.64 }, bell: resolution.bell });
  assert.deepEqual(saved, expected);
  resolution.exchanges[0]!.combat.f3!.before.hp = 1;
  resolution.entries[0]!.at = 99;
  context.fighters[0]!.shows!.push('laser');
  context.pitTarget.x = 1;
  assert.deepEqual(saved, expected);
});

test('uses 60 HP as the blowout threshold', () => {
  const { resolution, context } = fixture();
  resolution.hp.f3 = 59.999;
  assert.equal(adaptRumbleResult(resolution, context).blowout, false);
  resolution.hp.f3 = 60;
  assert.equal(adaptRumbleResult(resolution, context).blowout, true);
});

test('does not credit a hazard or pit elimination as a weapon finish', () => {
  const { resolution, context } = fixture();
  const ex = resolution.exchanges[0]!;
  ex.combat.f3 = trace(65, 60);
  ex.combat.f0 = { ...trace(12, 0), hazardDamage: 12 };
  ex.tags = ['hazard'];
  assert.equal(adaptRumbleResult(resolution, context).finisher, null);
});

test('credits the winner when the recorded display direction is reciprocal', () => {
  const { resolution, context } = fixture();
  const ex = resolution.exchanges[0]!;
  ex.attackerId = 'f0'; ex.defenderId = 'f3'; ex.damage = 5;
  assert.deepEqual(adaptRumbleResult(resolution, context).finisher, { by: 'f3', against: 'f0', damage: 15, call: ex.call, combat: ex.combat });
});

test('rejects inconsistent IDs and clocks', () => {
  const { resolution, context } = fixture();
  resolution.entries[0]!.fighterId = 'unknown';
  assert.throws(() => adaptRumbleResult(resolution, context));
  resolution.entries[0]!.fighterId = 'f0';
  resolution.exchanges[0]!.at = NaN;
  assert.throws(() => adaptRumbleResult(resolution, context));
});


test('ordered real combat credits direct lethal damage but not lethal reflection',async()=>{
 const {makeData}=await import('../src/lib/pit/seed.ts'); const {snapshot}=await import('../src/lib/pit/engine.ts'); const {fightStaggeredRumble}=await import('../src/lib/pit/rumble.server.ts');
 const data=makeData(); const field=data.stores.slice(0,12).map(s=>({...snapshot(data,s.id),armorFamily:'spike',utilityFamily:'mirror'}));
 for(const [seed,cause] of [['review-35','weapon'],['reflect-5','reflection']] as const){
  const resolution=fightStaggeredRumble(field,seed), last=resolution.exchanges.at(-1)!;
  assert.equal(last.lethal?.cause,cause);
  const result=adaptRumbleResult(resolution,{fighters:field,seed,pitTarget:{x:.5,y:.64}});
  if(cause==='weapon') {const victim=last.combat![resolution.order[1]!]!, strike=last.combat![resolution.order[0]!]!; assert.equal(victim.before.hp,10); assert.equal(victim.reflectedDamageTaken,2); assert.equal(strike.damageDealt,8); assert.equal(result.finisher?.by,resolution.order[0]); assert.equal(result.finisher?.against,resolution.order[1]);}
  else {
   assert.equal(result.finisher,null);
   const survivor=resolution.order[0]!,doomed=resolution.order[1]!;
   assert.equal(last.combat![survivor]!.hitCount,0);
   assert.equal(last.combat![doomed]!.hitCount,1);
   const beat=buildBeats(result)[0]!;
   const drive=fightDrive(result,beat,last.at!/beat.dur,last.at!);
   assert.equal(drive.victim,survivor,'show the recorded attack on the reflector');
   assert.equal(drive.attacker,doomed,'the zero-hit survivor never swings');
   assert.equal(drive.weapon,field.find(f=>f.id===doomed)!.weaponFamily);
   assert.equal(drive.bots.find(b=>b.bot.id===doomed)!.hp,0);
  }
 }
});
