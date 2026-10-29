import test from "node:test";
import assert from "node:assert/strict";
import { drawSide, drawSideBot, drawTop, Fx } from "../src/components/pit/cage-draw.ts";
import { ARENA_IDS } from "../src/components/pit/arena-scenes.ts";
import type { BotState, Drive } from "../src/components/pit/cage-motion.ts";

type TextMark = { text: string; x: number; y: number; determinant: number };
/** Canvas command recorder: preserves affine transforms, including mirrored text. */
function canvasRecorder(marks: TextMark[] = []) {
  let m = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  const multiply = (n: number[]) => {
    const [a, b, c, d, e, f] = m;
    m = [
      a * n[0] + c * n[1],
      b * n[0] + d * n[1],
      a * n[2] + c * n[3],
      b * n[2] + d * n[3],
      a * n[4] + c * n[5] + e,
      b * n[4] + d * n[5] + f,
    ];
  };
  const methods = {
    save: () => stack.push([...m]),
    restore: () => {
      m = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    },
    translate: (x: number, y: number) => multiply([1, 0, 0, 1, x, y]),
    scale: (x: number, y: number) => multiply([x, 0, 0, y, 0, 0]),
    rotate: (angle: number) =>
      multiply([Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0]),
    transform: (...args: number[]) => multiply(args),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: (text: string) => ({ width: text.length * 6 }),
    fillText: (text: string, x: number, y: number) =>
      marks.push({
        text,
        x: m[0] * x + m[2] * y + m[4],
        y: m[1] * x + m[3] * y + m[5],
        determinant: m[0] * m[3] - m[1] * m[2],
      }),
  };
  return new Proxy(methods, {
    get(target, key) {
      return key in target ? target[key as keyof typeof methods] : () => {};
    },
  }) as unknown as CanvasRenderingContext2D;
}

const drive: Drive = {
  bots: [],
  impact: null,
  power: 0,
  hitKey: null,
  hitAt: 0,
  weapon: "none",
  victim: null,
  focus: { x: 0.5, y: 0.5 },
  tight: 0,
};

test("every arena renders Team Janelle signage in the shared side and overhead paths", () => {
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  try {
    for (const arena of ARENA_IDS) {
      for (const camera of ["side", "top"]) {
        const marks: TextMark[] = [];
        Object.defineProperty(globalThis, "document", {
          configurable: true,
          value: {
            createElement: () => ({
              width: 1200,
              height: 720,
              getContext: () => canvasRecorder(marks),
            }),
          },
        });
        const ctx = canvasRecorder(marks);
        if (camera === "side")
          drawSide(ctx, 1200, 720, drive, new Fx(), 0, 0, {
            arena,
            reduced: true,
            shake: 0,
            hype: 0,
          });
        else drawTop(ctx, 1200, 720, drive, new Fx(), new Map(), 0, 0, true, arena);
        const label = marks.find((mark) => mark.text === "TEAM JANELLE");
        assert.ok(label, `${arena}/${camera} is missing its banner`);
        assert.ok(
          label.x > 0 && label.x < 1200 && label.y > 0 && label.y < 720,
          `${arena}/${camera} banner is off screen`,
        );
        assert.ok(label.determinant > 0, `${arena}/${camera} banner is mirrored`);
        if (camera === "top")
          assert.ok(label.y < 720 * 0.07, "Overhead banner must stay outside the fighting floor");
      }
    }
  } finally {
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});

test("Team Janelle heart lettering stays readable when a bot turns left", () => {
  const bot = {
    bot: {
      id: "southlake",
      storeName: "Southlake",
      paint: "lime",
      classId: "tank",
      weaponFamily: "none",
      look: "plain",
      number: "4",
      style: {
        body: "keystone",
        finish: "factory",
        trim: "steel",
        eye: "green",
        topper: "janelle-pink",
      },
    },
    spot: { x: 0.5, y: 0.5 },
    heading: 0,
    lift: 0,
    pitch: 0,
    flipped: false,
    stroke: 0,
    rev: 0,
    gone: 0,
    dead: false,
    roll: 0,
    hp: 100,
    charging: false,
    spotlight: false,
    flame: 0,
  } as BotState;
  for (const facing of [-1, -0.3, 0.3, 1]) {
    const marks: TextMark[] = [];
    drawSideBot(canvasRecorder(marks), bot, 400, 300, 220, 0, 0, facing);
    const labels = marks.filter((mark) => mark.text === "TEAM" || mark.text === "JANELLE");
    assert.equal(labels.length, 2);
    assert.ok(
      labels.every((mark) => mark.determinant > 0),
      `Heart text is mirrored at facing ${facing}`,
    );
  }
});
