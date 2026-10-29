import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createGarageBot } from "../src/components/pit/garage-3d/bot-model.ts";
import { BODY_STYLES, DEFAULT_STYLE } from "../src/lib/pit/catalog.ts";
import { botFrameOf } from "../src/components/pit/bot-frame.ts";
import { sawPoseOf } from "../src/components/pit/bot-weapons.ts";
import { drawSideBot, drawTopBot } from "../src/components/pit/cage-draw.ts";
import type { BotState } from "../src/components/pit/cage-motion.ts";
import type { BotLookProps } from "../src/components/pit/bot-portrait.tsx";

function southlake(overrides: Partial<BotLookProps> = {}): BotLookProps {
  return {
    id: "southlake",
    storeName: "Southlake",
    number: "4",
    paint: "lime",
    classId: "tank",
    weapon: "saw",
    look: "plain",
    hp: 100,
    style: { ...DEFAULT_STYLE, body: "keystone", topper: "janelle-pink" },
    driveFamily: "mag",
    ...overrides,
  };
}

test("Southlake's magnetic drive keeps its five small road wheels per side in both views", () => {
  const model = createGarageBot(southlake());
  const tires = model.getObjectsByProperty("name", "Rubber tire");
  assert.equal(tires.length, 10, "the tank body must not turn into a four-wheel buggy");
  const right = tires
    .filter((wheel) => wheel.position.x > 0)
    .sort((a, b) => a.position.z - b.position.z);
  // Literal side-view Keystone wheel locations, at two scene units per bot length.
  assert.deepEqual(
    right.map((wheel) => Number(wheel.position.z.toFixed(3))),
    [-0.72, -0.36, 0, 0.36, 0.72],
  );
  assert.ok(right.every((wheel) => Math.abs(wheel.scale.x - 0.15) < 1e-6));
  assert.equal(
    model.getObjectsByProperty("name", "Continuous rubber belt").length,
    0,
    "a magnetic drive must not become equipped treads just because its body is a tank",
  );
});

test("concealed tank drives retain the same cosmetic default as the classic view", () => {
  const model = createGarageBot(southlake({ driveFamily: undefined, weapon: "hidden" }));
  assert.equal(model.getObjectsByProperty("name", "Continuous rubber belt").length, 2);
  assert.equal(model.getObjectsByProperty("name", "Road wheel").length, 10);
  assert.equal(model.getObjectByName("Weapon · hidden")?.children.length, 0);
});

test("wheel centers use the classic paint-tinted stock hubs and selected trim on both drive layouts", () => {
  for (const driveFamily of ["mag", "treads"] as const) {
    for (const [trim, expected] of [
      ["steel", "739d15"],
      ["gold", "e8c25a"],
    ] as const) {
      const model = createGarageBot(
        southlake({
          driveFamily,
          style: { ...DEFAULT_STYLE, body: "keystone", trim, finish: "chrome" },
        }),
      );
      const hubs = model.getObjectsByProperty(
        "name",
        driveFamily === "treads" ? "Wheel axle" : "Wheel hub",
      );
      assert.equal(hubs.length, 10);
      for (const hub of hubs) {
        const material = (hub as THREE.Mesh).material as THREE.MeshStandardMaterial;
        assert.equal(material.color.getHexString(), expected, `${driveFamily} / ${trim} hub color`);
      }
    }
  }
});

test("the vertical saw is mounted above the deck while the horizontal disc stays at the nose", () => {
  const saw = createGarageBot(southlake());
  const shell = saw.getObjectByName("Body shell · keystone")!;
  const shellBounds = new THREE.Box3().setFromObject(shell);
  const blade = saw.getObjectByName("Steel spinning blade")!;
  assert.ok(
    blade.position.y > shellBounds.max.y + 0.3,
    "raised saw must match the 2D overhead arm",
  );
  assert.ok(
    saw.getObjectByName("Overhead saw arm"),
    "the saw needs a physical arm connecting it to the deck",
  );
  const disc = createGarageBot(southlake({ weapon: "disc" }));
  const discBlade = disc.getObjectByName("Steel spinning blade")!;
  assert.ok(discBlade.position.y < 0.6);
  assert.ok(discBlade.position.z > 0.92);
});

test("the 3D saw's full blade and teeth reach beyond every body without changing its equipment", () => {
  for (const body of BODY_STYLES) {
    const look = southlake({ classId: body.classId, style: { ...DEFAULT_STYLE, body: body.id } });
    const before = structuredClone(look);
    const model = createGarageBot(look);
    const hull = new THREE.Box3().setFromObject(model.getObjectByName(`Body shell · ${body.id}`)!);
    const cutting = new THREE.Box3().setFromObject(model.getObjectByName("Steel spinning blade")!);
    for (const tooth of model.getObjectsByProperty("name", "Saw tooth"))
      cutting.union(new THREE.Box3().setFromObject(tooth));
    assert.ok(cutting.min.z > hull.max.z + 0.08, `${body.id}: saw cuts through its own nose`);
    assert.ok(model.getObjectByName("Overhead saw arm"));
    assert.deepEqual(look, before, `${body.id}: rendering changed saved equipment`);
  }
});

// Capture transformed tooth vertices at the Canvas boundary. The real side renderer
// still chooses equipment, moves the arm, draws the blade, and applies class scale.
function sawToothRecorder() {
  const teeth: { x: number; y: number }[] = [];
  const rectangles: { fill: unknown; x: number; width: number; height: number }[] = [];
  let path: { x: number; y: number }[] = [];
  let m = [1, 0, 0, 1, 0, 0];
  const state: Record<string, unknown> = {};
  const stack: { m: number[]; fill: unknown }[] = [];
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
  const point = (x: number, y: number) =>
    path.push({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
  const methods = {
    fillRect: (x: number, y: number, width: number, height: number) =>
      rectangles.push({ fill: state.fillStyle, x: m[0] * x + m[2] * y + m[4], width, height }),
    save: () => stack.push({ m: [...m], fill: state.fillStyle }),
    restore: () => {
      const saved = stack.pop()!;
      m = saved.m;
      state.fillStyle = saved.fill;
    },
    translate: (x: number, y: number) => multiply([1, 0, 0, 1, x, y]),
    scale: (x: number, y: number) => multiply([x, 0, 0, y, 0, 0]),
    rotate: (a: number) => multiply([Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]),
    transform: (...n: number[]) => multiply(n),
    beginPath: () => {
      path = [];
    },
    moveTo: point,
    lineTo: point,
    fill: () => {
      if (state.fillStyle === "#d9d5cc") teeth.push(...path);
    },
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: (text: string) => ({ width: text.length * 6 }),
  };
  const ctx = new Proxy(state, {
    get: (target, key: string) =>
      key in methods
        ? methods[key as keyof typeof methods]
        : key in target
          ? target[key]
          : () => {},
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, teeth, rectangles };
}

test("overhead saw reaches beyond the nose while the horizontal disc projection stays unchanged", () => {
  const fronts: Record<string, number> = {
    stinger: 0.56,
    raptor: 0.58,
    warhawk: 0.58,
    bunker: 0.52,
    juggernaut: 0.55,
    colossus: 0.55,
    scorpion: 0.52,
  };
  for (const body of BODY_STYLES)
    for (const stroke of [0, 1])
      for (const weaponFamily of ["saw", "disc"]) {
        const state = {
          bot: {
            ...southlake(),
            classId: body.classId,
            weaponFamily,
            style: { ...DEFAULT_STYLE, body: body.id, topper: "none", flag: false },
          },
          spot: { x: 0, y: 0 },
          heading: 0,
          lift: 0,
          pitch: 0,
          flipped: false,
          stroke,
          rev: 0,
          gone: 0,
          dead: false,
          roll: 0,
          hp: 100,
          charging: false,
          spotlight: false,
          flame: 0,
        } as unknown as BotState;
        const { ctx, rectangles } = sawToothRecorder();
        const len = body.classId === "tank" ? 165 : body.classId === "specialist" ? 135 : 150;
        const wid = body.classId === "tank" ? 125 : body.classId === "specialist" ? 100 : 105;
        drawTopBot(ctx, state, { x: 0, y: 0 }, 1000, 0, 0);
        const blade = rectangles.find(
          (rect) =>
            rect.fill === (stroke > 0.5 ? "#ff8a3a" : "#e2ddd3") &&
            Math.abs(rect.height - wid * 0.07) < 1e-9,
        );
        assert.ok(blade, "must inspect the actual overhead cutting rectangle");
        if (weaponFamily === "saw")
          assert.ok(
            blade.x > len * ((fronts[body.id] ?? 0.5) + 0.04),
            `${body.id}: overhead saw remains over the hull`,
          );
        else {
          assert.ok(Math.abs(blade.x - len * 0.19) < 1e-9);
          assert.ok(Math.abs(blade.width - len * 0.72) < 1e-9);
        }
      }
});

test("the 2D saw teeth clear every nose throughout the complete strike and blade rotation", () => {
  for (const body of BODY_STYLES) {
    const frame = botFrameOf(body.classId, body.id);
    const scale = body.classId === "tank" ? 1.06 : body.classId === "specialist" ? 0.94 : 1;
    for (const stroke of [0, 0.25, 0.5, 0.75, 1])
      for (const spin of [0, 0.15])
        for (const facing of [-1, 1]) {
          const state = {
            bot: {
              ...southlake(),
              classId: body.classId,
              weaponFamily: "saw",
              style: { ...DEFAULT_STYLE, body: body.id, topper: "none", flag: false },
            },
            spot: { x: 0, y: 0 },
            heading: 0,
            lift: 0,
            pitch: 0,
            flipped: false,
            stroke,
            rev: 0,
            gone: 0,
            dead: false,
            roll: 0,
            hp: 100,
            charging: false,
            spotlight: false,
            flame: 0,
          } as unknown as BotState;
          const { ctx, teeth } = sawToothRecorder();
          drawSideBot(ctx, state, 0, 0, 1, 0, spin, facing);
          assert.equal(teeth.length, 42, "must inspect the actual 14-tooth saw path");
          assert.ok(
            teeth.every((point) => point.x * facing > (frame.front + 0.04) * scale),
            `${body.id}: saw teeth overlap the nose at stroke ${stroke}, spin ${spin}`,
          );
        }
  }
});

test("the lowered saw arm clears its own roof and the cutting teeth stay above the floor", () => {
  for (const body of BODY_STYLES) {
    const frame = botFrameOf(body.classId, body.id);
    for (const stroke of [0, 0.25, 0.5, 0.75, 1]) {
      const pose = sawPoseOf(frame, stroke);
      const noseY = pose.pivotY + Math.tan(pose.angle) * (frame.front - pose.pivotX);
      // The rod is 0.07 bot lengths thick; even its lower edge clears the highest armor.
      assert.ok(
        Math.max(pose.pivotY, noseY) + 0.035 < frame.deck - 0.01,
        `${body.id}: arm penetrates its roof`,
      );
      assert.ok(pose.bladeY + pose.tipRadius < 0, `${body.id}: saw strikes the floor`);
      assert.ok(
        pose.mountY >= frame.deck && pose.mountY > pose.pivotY,
        `${body.id}: pedestal must connect to armor`,
      );
    }
  }
});

test("Keystone's 3D armor follows the classic six-point hull instead of a separate approximate shell", () => {
  const model = createGarageBot(southlake({ weapon: "none" }));
  const shell = model.getObjectByName("Body shell · keystone") as THREE.Mesh;
  const positions = shell.geometry.getAttribute("position");
  const expected = [
    [-0.92, 0.4],
    [-0.92, 0.92],
    [-0.6, 1.04],
    [0.6, 1.04],
    [0.92, 0.8],
    [0.92, 0.4],
  ];
  for (const [z, y] of expected) {
    let closest = Infinity;
    for (let i = 0; i < positions.count; i++)
      closest = Math.min(closest, Math.hypot(positions.getZ(i) - z, positions.getY(i) - y));
    assert.ok(closest < 0.025, `missing side-profile corner ${z}, ${y}`);
  }
});

test("overhead hammer and axe retain their classic resting directions instead of sharing a front bumper mount", () => {
  const hammer = createGarageBot(southlake({ weapon: "hammer" }));
  const head = hammer.getObjectByName("Hammer head")!;
  assert.ok(
    head.position.y > 1.5 && head.position.z < 0,
    "hammer must rest raised behind its deck pivot",
  );
  const axe = createGarageBot(southlake({ weapon: "axe" }));
  const bounds = new THREE.Box3().setFromObject(axe.getObjectByName("Axe blade")!);
  assert.ok(
    bounds.max.y > 1.6 && bounds.min.z > 0,
    "axe must rest raised forward from its deck pivot",
  );
});

test("the claw has a floor jaw and raised biting jaw like its classic silhouette", () => {
  const claw = createGarageBot(southlake({ weapon: "claw" }));
  const lower = claw.getObjectByName("Claw lower jaw");
  const upper = claw.getObjectByName("Claw raised biting jaw");
  assert.ok(lower && upper, "claw must not be replaced by sideways pincers");
  assert.ok(new THREE.Box3().setFromObject(lower).max.y < 0.25);
  assert.ok(new THREE.Box3().setFromObject(upper).max.y > 1.05);
});
