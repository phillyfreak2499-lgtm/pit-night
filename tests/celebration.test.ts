import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeData } from "../src/lib/pit/seed.ts";
import { celebrationCast, celebrationMessage } from "../src/lib/pit/celebration-cast.ts";
import { CHAMPIONSHIP_OPENING_MS, championshipProgramSegments, createCelebrationClock, firstPlaybackIndex, hasChampionshipOpening } from "../src/lib/pit/championship-opening.ts";
import { programSegments } from "../src/lib/pit/fight-card.ts";
import { paintCelebration } from "../src/components/pit/team-janelle-scene.ts";

test("all fourteen store identities join, weapons stowed, without league mutations", () => {
  const data = makeData();
  const before = structuredClone(data);
  const cast = celebrationCast(data);
  assert.equal(cast.length, 14);
  assert.deepEqual(cast.map((b) => b.id), data.stores.map((s) => s.id));
  assert.ok(cast.every((b) => b.weaponFamily === "none" && b.weaponName === ""));
  assert.deepEqual(data, before);
  for (const bot of cast) {
    const saved = data.bots.find((b) => b.storeId === bot.id)!;
    assert.equal(bot.botName, saved.name);
    if (saved.style) { assert.deepEqual(bot.style, saved.style); assert.notEqual(bot.style, saved.style); }
  }
  const name = cast[0]!.botName;
  data.bots.find((b) => b.storeId === cast[0]!.id)!.name = "changed later";
  assert.equal(cast[0]!.botName, name);
});

test("missing bots and duplicate stores retain one place per store", () => {
  const data = makeData();
  data.bots = [];
  data.stores.push(data.stores[0]!);
  const cast = celebrationCast(data);
  assert.equal(cast.length, 14);
  assert.equal(cast[0]!.botName, data.stores[0]!.name);
});

test("supportive sequence progresses through all four messages", () => {
  assert.equal(celebrationMessage(0), "Every bot. Every store. One team.");
  assert.equal(celebrationMessage(7), "We're rooting for you.");
  assert.equal(celebrationMessage(16), "We're proud of you.");
  assert.equal(celebrationMessage(24), "All of us. With you. Team Janelle.");
});

test("real clock remains thirty seconds at low frame rates and excludes suspended time", () => {
  assert.equal(CHAMPIONSHIP_OPENING_MS, 30_000);
  const clock = createCelebrationClock();
  clock.tick(0);
  for (let now = 100; now <= 10_000; now += 100) clock.tick(now);
  assert.equal(clock.elapsed, 10_000);
  clock.suspend(); // Paused, hidden tab, or offscreen.
  assert.equal(clock.tick(100_000), 10_000);
  assert.equal(clock.tick(105_000), 15_000); // A long frame isn't capped.
  clock.suspend();
  clock.tick(200_000);
  assert.equal(clock.tick(215_000), 30_000);
  assert.equal(clock.tick(220_000), 30_000);
  assert.equal(createCelebrationClock().elapsed, 0); // Remount/restart.
});

test("only championship cards receive opening and keep original fight snapshots/order", () => {
  const bouts = [{ id: "third" }, { id: "title" }];
  const before = structuredClone(bouts);
  const segments = championshipProgramSegments(bouts, 5);
  assert.deepEqual(segments.map((s) => s.kind), ["open", "opening", "card", "fight", "sting", "card", "fight", "sting", "close"]);
  assert.deepEqual(segments.filter((s) => s.kind !== "opening"), programSegments(bouts));
  assert.equal(firstPlaybackIndex(segments), 1);
  assert.equal(segments[2]!.kind, "card"); // Skip to program; Back revisits opening.
  for (const s of segments) if ("bout" in s) assert.ok(bouts.includes(s.bout));
  assert.deepEqual(bouts, before);
  for (const week of [1, 2, 3, 4, 6, 7, 8, 9]) {
    assert.equal(hasChampionshipOpening(week, 2), false);
    assert.deepEqual(championshipProgramSegments(bouts, week), programSegments(bouts));
  }
  assert.deepEqual(championshipProgramSegments([], 5), programSegments([]));
  assert.equal(firstPlaybackIndex(championshipProgramSegments([], 5)), -1);
});

function recorder(calls: unknown[]) {
  return new Proxy({
    createLinearGradient: (...args: unknown[]) => { calls.push(["linear", ...args]); return { addColorStop: (...stops: unknown[]) => calls.push(stops) }; },
    createRadialGradient: (...args: unknown[]) => { calls.push(["gradient", ...args]); return { addColorStop: (...stops: unknown[]) => calls.push(stops) }; },
    measureText: (text: string) => ({ width: text.length * 6 }),
  }, { get: (target, key) => key in target ? target[key as keyof typeof target] : (...args: unknown[]) => calls.push([key, ...args]),
    set: (_target, key, value) => { calls.push([key, value]); return true; },
  }) as unknown as CanvasRenderingContext2D;
}

test("desktop/mobile scenes show every name and reduced motion renders an identical tableau", () => {
  const cast = celebrationCast(makeData());
  const before = structuredClone(cast);
  for (const [width, height] of [[1280, 460], [390, 384]]) {
    const a: unknown[] = [], b: unknown[] = [];
    paintCelebration(recorder(a), width!, height!, cast, 0, true);
    paintCelebration(recorder(b), width!, height!, cast, 20, true);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
    for (const bot of cast) assert.ok(a.some((call) => Array.isArray(call) && call[0] === "fillText" && call[1] === bot.botName));
    const moving: unknown[] = [];
    paintCelebration(recorder(moving), width!, height!, cast, 12, false);
    assert.notEqual(JSON.stringify(moving), JSON.stringify(a));
  }
  assert.deepEqual(cast, before);
});

test("both broadcast entry points mount opening with playback controls and final rally selection", () => {
  const show = readFileSync(new URL("../src/components/pit/show-page.tsx", import.meta.url), "utf8");
  const watch = readFileSync(new URL("../src/components/pit/watch-page.tsx", import.meta.url), "utf8");
  const opening = readFileSync(new URL("../src/components/pit/team-janelle-opening.tsx", import.meta.url), "utf8");
  assert.match(show, /firstPlaybackIndex\(segments\)/);
  assert.match(show, /TeamJanelleOpening key=\{key\} data=\{data\} playing=\{rolling\}/);
  assert.match(watch, /TeamJanelleOpening data=\{data\} playing=\{!paused\}/);
  assert.match(watch, /tape\.bouts\.find\(\(bout\) => bout\.kind === "final"\)/);
  assert.match(watch, /final\.storeIds\.map/);
  assert.match(opening, /!completed\.current/);
  assert.match(opening, /IntersectionObserver/);
  assert.match(opening, /clock\.suspend\(\)/);
});
