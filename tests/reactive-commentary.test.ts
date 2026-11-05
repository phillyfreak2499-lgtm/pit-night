import assert from "node:assert/strict";
import test from "node:test";
import { reactiveMoment, reactivePrompt, shortReactiveLine } from "../src/lib/pit/reactive-commentary";
import type { Exchange, FightResult, FighterSnap } from "../src/lib/pit/types";

const fighters = [
  { id: "a", botName: "Iron Jaw" } as FighterSnap,
  { id: "b", botName: "Road Rage" } as FighterSnap,
];

function exchange(index: number, attackerId: string, defenderId: string, damage: number, attackerHp: number, defenderHp: number): Exchange {
  return { index, attackerId, defenderId, damage, attackerHp, defenderHp, call: "Impact!", tags: [] };
}

function fight(exchanges: Exchange[], finisher: FightResult["finisher"] = null): FightResult {
  return {
    seed: "fixed-seed",
    fighters,
    exchanges,
    finisher,
    hp: { a: exchanges.at(-1)?.attackerHp ?? 100, b: exchanges.at(-1)?.defenderHp ?? 100 },
    winnerIds: ["a"],
    loserIds: ["b"],
    method: "ko",
    blowout: false,
    wear: {},
  };
}

test("ignores routine hits but recognizes one big impact", () => {
  assert.equal(reactiveMoment(fight([exchange(0, "a", "b", 8, 100, 92)]), { phase: "exchange", index: 0 }), null);
  const event = reactiveMoment(fight([exchange(0, "a", "b", 22, 100, 78)]), { phase: "exchange", index: 0 });
  assert.equal(event?.kind, "big-hit");
  assert.equal(event?.round, 1);
  assert.deepEqual(event?.fighters.map((f) => f.health), [100, 78]);
});

test("half-health and near-knockout events are based on crossing thresholds", () => {
  assert.equal(reactiveMoment(fight([exchange(0, "a", "b", 51, 100, 49)]), { phase: "exchange", index: 0 })?.kind, "half-health");
  assert.equal(reactiveMoment(fight([exchange(0, "a", "b", 88, 100, 12)]), { phase: "exchange", index: 0 })?.kind, "near-knockout");
  assert.equal(reactiveMoment(fight([exchange(0, "a", "b", 100, 100, 0)]), { phase: "exchange", index: 0 })?.kind, "knockout");
});

test("momentum shift requires a real change of health leader", () => {
  const result = fight([
    exchange(0, "b", "a", 35, 100, 65),
    exchange(1, "a", "b", 46, 65, 54),
  ]);
  const event = reactiveMoment(result, { phase: "exchange", index: 1 });
  assert.equal(event?.kind, "momentum-shift");
  assert.equal(event?.round, 2);
  assert.equal(event?.attacker, "Iron Jaw");
  assert.deepEqual(event?.fighters.map((f) => f.health), [65, 54]);
});

test("the prompt includes only current-round facts, not the fight's final winner", () => {
  const result = fight([
    exchange(0, "a", "b", 20, 100, 80),
    exchange(1, "b", "a", 40, 80, 60),
  ]);
  const moment = reactiveMoment(result, { phase: "exchange", index: 0 });
  assert.ok(moment);
  assert.equal(moment.fighters[0]?.health, 100);
  assert.equal(moment.fighters[1]?.health, 80);
  const prompt = reactivePrompt(moment);
  assert.match(prompt.prompt, /Iron Jaw/);
  assert.match(prompt.system, /2 to 14 words/);
  assert.doesNotMatch(prompt.prompt, /winnerIds|loserIds|finalHp/);
});

test("finisher replay does not create a second commentary call", () => {
  const ex = exchange(0, "a", "b", 100, 100, 0);
  assert.equal(reactiveMoment(fight([ex], { by: "a", against: "b", damage: 100, call: ex.call }), { phase: "finisher", index: 1 }), null);
  const separate = fight([exchange(0, "a", "b", 80, 100, 20)], { by: "a", against: "b", damage: 20, call: "Final blow!" });
  separate.hp.b = 0;
  assert.equal(reactiveMoment(separate, { phase: "finisher", index: 1 })?.kind, "knockout");
});

test("model output is one sentence and at most fourteen spoken words", () => {
  assert.equal(shortReactiveLine("What a hit! This second sentence should never be spoken."), "What a hit!");
  assert.equal(shortReactiveLine("A"), "");
  assert.equal(shortReactiveLine("One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen").split(" ").length, 14);
});
