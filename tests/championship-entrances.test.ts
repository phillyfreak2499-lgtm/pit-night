import test from "node:test";
import assert from "node:assert/strict";
import { makeData } from "../src/lib/pit/seed.ts";
import { simulateChampionshipDuel } from "../src/lib/pit/engine.ts";
import { buildBeats, fightDrive } from "../src/components/pit/cage-motion.ts";
import { broadcastBeats, championshipFinishPhase, FINALIST_ENTRANCE_SECONDS, hasFinalistEntrances, replayFinishLabel } from "../src/components/pit/championship-entrance.ts";
import { paintFinalistEntrance } from "../src/components/pit/championship-entrance-scene.ts";
import { finishScreenPoint, paintChampionshipFinish } from "../src/components/pit/championship-finish-scene.ts";
import { drawSide, Fx, project } from "../src/components/pit/cage-draw.ts";
import { resizeBroadcastCanvas } from "../src/components/pit/broadcast-canvas.ts";

function resultForTest() {
  const data = makeData();
  data.week = 5;
  return simulateChampionshipDuel(data, data.stores[0]!.id, data.stores[1]!.id, "title-show");
}
function recorder(text: string[] = [], moves: number[][] = []) {
  return new Proxy({
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: (text: string) => ({ width: text.length * 6 }),
    fillText: (value: string) => text.push(value),
    strokeText: (value: string) => text.push(value),
    translate: (x: number, y: number) => moves.push([x, y]),
  }, { get: (target, key) => key in target ? target[key as keyof typeof target] : () => {} }) as unknown as CanvasRenderingContext2D;
}

test("only the Week 5 two-bot title fight gets two full-length finalist entrances", () => {
  const result = resultForTest();
  const before = structuredClone(result);
  const base = buildBeats(result);
  const beats = broadcastBeats({ week: 5, kind: "final" }, result);
  assert.equal(FINALIST_ENTRANCE_SECONDS, 12);
  assert.deepEqual(beats.filter((b) => b.kind === "intro").map((b) => b.dur), [12, 12]);
  for (let i = 0; i < beats.length; i++) {
    assert.equal(beats[i]!.kind, base[i]!.kind);
    if (beats[i]!.kind !== "intro") assert.equal(beats[i]!.dur, base[i]!.dur);
    if (i) assert.equal(beats[i]!.t, beats[i - 1]!.t + beats[i - 1]!.dur);
  }
  for (const bout of [{ week: 4, kind: "final" as const }, { week: 5, kind: "melee" as const }, { week: 2, kind: "bout" as const }]) {
    assert.equal(hasFinalistEntrances(bout, result), false);
    assert.deepEqual(broadcastBeats(bout, result), base);
  }
  assert.deepEqual(result, before);
});

test("finalist stage uses public identities, pauses effects, and makes reduced motion static", () => {
  const result = resultForTest();
  const before = structuredClone(result);
  for (const [w, h] of [[1280, 720], [390, 330]]) {
    for (const side of [0, 1] as const) {
      const text: string[] = [];
      const fx = new Fx();
      paintFinalistEntrance(recorder(text), w!, h!, result.fighters[side]!, side, 0.5, 6, 0.1, fx, true);
      assert.ok(text.includes(result.fighters[side]!.botName));
      assert.ok(text.includes(result.fighters[side]!.storeName));
      assert.ok(!text.includes("WATERMAN CHAMPION"));
      assert.equal(fx.side.length, 0);
      paintFinalistEntrance(recorder(), w!, h!, result.fighters[side]!, side, 0.5, 6, 0.1, fx, false);
      assert.ok(fx.side.length > 0);
      const particles = structuredClone(fx.side);
      paintFinalistEntrance(recorder(), w!, h!, result.fighters[side]!, side, 0.5, 6, 0, fx, false);
      assert.deepEqual(fx.side, particles);
    }
  }
  assert.deepEqual(result, before);
});

test("the winner reveal waits for the decision and pit effects wait for the actual fall", () => {
  const result = resultForTest();
  const before = structuredClone(result);
  const bout = { week: 5, kind: "final" as const };
  const beats = broadcastBeats(bout, result);
  for (const beat of beats) {
    const phase = championshipFinishPhase(bout, result, beat);
    if (beat.kind === "decision") assert.equal(phase, "reveal");
    else if (beat.kind === "replay" || (beat.kind === "exchange" && beat.index === result.exchanges.length - 1)) assert.equal(phase, "throw");
    else assert.equal(phase, null);
  }
  const last = beats.filter((b) => b.kind === "exchange").at(-1)!;
  const drive = fightDrive(result, last, 0, last.t);
  const fx = new Fx();
  const camera = { x: 640, y: 360, z: 1, ready: true };
  paintChampionshipFinish(recorder(), 1280, 720, result, drive, "throw", 0.1, fx, false, camera);
  assert.equal(fx.side.length, 0);
  drive.bots.find((b) => result.loserIds.includes(b.bot.id))!.gone = 0.5;
  for (let i = 0; i < 5; i++) paintChampionshipFinish(recorder(), 1280, 720, result, drive, "throw", 0.1, fx, false, camera);
  assert.ok(fx.side.length > 0);
  assert.ok(fx.wreck.length > 0, "the pit throw emits armor debris");
  const debris = structuredClone(fx.wreck);
  const moves: number[][] = [];
  paintChampionshipFinish(recorder([], moves), 1280, 720, result, drive, "throw", 0, fx, false, camera);
  assert.deepEqual(fx.wreck, debris, "pausing freezes the armor debris");
  for (const piece of debris) assert.ok(moves.some(([x, y]) => x === piece.x && y === piece.y), "each piece is drawn, not merely simulated");
  const decision = beats.at(-1)!;
  const winnerDrive = fightDrive(result, decision, 0.5, decision.t + decision.dur * 0.5);
  const text: string[] = [];
  const reducedFx = new Fx();
  paintChampionshipFinish(recorder(text), 1280, 720, result, winnerDrive, "reveal", 0.1, reducedFx, true, camera);
  assert.ok(text.includes("WATERMAN CHAMPION"));
  assert.ok(text.includes(result.fighters.find((f) => result.winnerIds.includes(f.id))!.botName));
  assert.equal(reducedFx.side.length, 0);
  assert.deepEqual(result, before);
});

test("playback effect restarts do not resize an unchanged canvas or discard its particles", () => {
  let width = 1280;
  let height = 720;
  let resets = 0;
  const canvas = {
    get width() { return width; }, set width(value: number) { width = value; resets++; },
    get height() { return height; }, set height(value: number) { height = value; resets++; },
    getBoundingClientRect: () => ({ width: 640, height: 360 }),
  } as HTMLCanvasElement;
  const fx = new Fx();
  fx.stageSmoke(640, 500, 100);
  const particles = structuredClone(fx.side);
  for (let i = 0; i < 3; i++) if (resizeBroadcastCanvas(canvas, 2)) fx.clear();
  assert.equal(resets, 0, "pause, resume and speed updates must not reset the bitmap");
  assert.deepEqual(fx.side, particles);
  assert.equal(resizeBroadcastCanvas(canvas, 1), true);
  assert.equal(resets, 2, "a real size change still refreshes the bitmap");
});

test("pit finish particles use the same zoom and framing as the side camera", () => {
  const spot = { x: 0.5, y: 0.64 };
  const p = project(spot, 1280, 720);
  assert.deepEqual(finishScreenPoint(spot, 1280, 720, { x: 640, y: 360, z: 1, ready: true }), p);
  const zoomed = finishScreenPoint(spot, 1280, 720, { x: 640, y: 360, z: 1.4, ready: true });
  assert.equal(zoomed.x, 640 + (p.x - 640) * 1.4);
  assert.equal(zoomed.y, 360 + (p.y - 360) * 1.4);
});

test("the actual replay stamp says IN THE PIT for dumps and preserves ordinary K.O.", () => {
  const result = resultForTest();
  const beat = buildBeats(result).find((b) => b.kind === "replay")!;
  const drive = fightDrive(result, beat, 0.95, beat.t + beat.dur * 0.95);
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  try {
    Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => ({ width: 1280, height: 720, getContext: () => recorder() }) } });
    for (const method of ["dump", "ko"] as const) {
      const text: string[] = [];
      const label = replayFinishLabel({ method });
      drawSide(recorder(text), 1280, 720, drive, new Fx(), 0, 0, { title: null, word: "", hype: 0, reduced: true, shake: 0, replay: true, ko: 0.8, finishLabel: label, arena: "grand" });
      assert.ok(text.includes(method === "dump" ? "IN THE PIT" : "K.O."));
      assert.ok(!text.includes(method === "dump" ? "K.O." : "IN THE PIT"));
    }
  } finally {
    if (original) Object.defineProperty(globalThis, "document", original);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
