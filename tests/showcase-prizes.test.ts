import test from "node:test";
import assert from "node:assert/strict";
import type { PitData, BotStyle } from "../src/lib/pit/types.ts";
import { DEFAULT_STYLE } from "../src/lib/pit/catalog.ts";
import { equippedShowcaseBonus, showcasePrizeOwned, SHOWCASE_PRIZES } from "../src/lib/pit/showcase-prizes.ts";
import { createGarageBot } from "../src/components/pit/garage-3d/bot-model.ts";
import { drawShowcasePrize } from "../src/components/pit/showcase-prize-draw.ts";

test("showcase bonus requires the matching winner unlock and equipped item", () => {
  for (const row of SHOWCASE_PRIZES) {
    const data = { stores: [{ id: "a", unlocks: [] }], bots: [{ storeId: "a", style: { ...DEFAULT_STYLE, showcasePrize: row.id } }] } as unknown as PitData;
    assert.deepEqual(equippedShowcaseBonus(data, "a"), {});
    data.stores[0]!.unlocks = [`showcase-prize:${row.id}`];
    assert.equal(showcasePrizeOwned(data, "a", row.id), true);
    assert.deepEqual(equippedShowcaseBonus(data, "a"), { [row.stat]: 2 });
    data.bots[0]!.style!.showcasePrize = "none";
    assert.deepEqual(equippedShowcaseBonus(data, "a"), {});
    assert.deepEqual(equippedShowcaseBonus(data, "other"), {});
  }
});

test("3D awards have distinct physical components and preserve the installed weapon", () => {
  const names = (style: Partial<BotStyle>) => {
    const bot = createGarageBot({ id: "a", paint: "violet", classId: "tank", weapon: "wedge", look: "plain", number: "6", hp: 100, storeName: "Test", style: { ...DEFAULT_STYLE, ...style } });
    const all: string[] = []; bot.traverse((node) => all.push(node.name)); return all;
  };
  const baseline = names({});
  for (const [id, parts] of [["rocket-tail", ["Rocket Tail booster", "Rocket Tail nozzle"]], ["battle-tank", ["Battle Tank thick track", "Battle Tank armored hull", "Battle Tank turret", "Battle Tank long cannon"]], ["tesla-rig", ["Tesla Rig glowing reactor", "Tesla Rig coil", "Tesla Rig electrical arc"]]] as const) {
    const result = names({ showcasePrize: id });
    for (const part of parts) assert.ok(result.includes(part), part);
    for (const name of baseline) assert.ok(result.includes(name), `lost ${name}`);
  }
});

test("broadcast awards draw in side and overhead views; rocket exhaust only fires while moving", () => {
  const calls: string[] = [];
  const ctx = new Proxy({}, { get: (_, key) => (..._args: unknown[]) => { calls.push(String(key)); }, set: () => true }) as CanvasRenderingContext2D;
  for (const prize of SHOWCASE_PRIZES) for (const view of ["side", "top"] as const) {
    calls.length = 0; drawShowcasePrize(ctx, prize.id, view, 100, 100, 1, false);
    assert.ok(calls.includes("fillRect")); assert.ok(calls.includes("stroke" ) || calls.includes("strokeRect"));
  }
  calls.length = 0; drawShowcasePrize(ctx, "rocket-tail", "side", 100, 100, 1, false); const idle = calls.length;
  calls.length = 0; drawShowcasePrize(ctx, "rocket-tail", "side", 100, 100, 1, true); assert.ok(calls.length > idle);
});
