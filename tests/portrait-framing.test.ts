import test from "node:test";
import assert from "node:assert/strict";
import { fitSidePortrait } from "../src/components/pit/portrait-framing.ts";
import { botFrameOf } from "../src/components/pit/bot-frame.ts";
import { sawPoseOf } from "../src/components/pit/bot-weapons.ts";

const look = {
  classId: "tank" as const,
  weapon: "saw",
  style: { body: "colossus" as const, flag: true, topper: "janelle-pink" as const },
};

test("the tall saw and full team pennant fit phone and desktop portraits through a complete swing and turn", () => {
  const frame = botFrameOf(look.classId, look.style.body);
  for (const [width, height, zoom] of [
    [160, 144, 0.9],
    [286, 288, 0.74],
    [668, 288, 0.74],
    [160, 144, 1.4],
  ]) {
    for (const turntable of [false, true])
      for (const facing of [-1, 1] as const) {
        const view = fitSidePortrait(width, height, look, zoom, turntable, facing, 0.8);
        const point = (x: number, y: number, yaw: number, pitch: number) => {
          const cy = -frame.height / 2;
          const px = x * Math.cos(pitch) + (y - cy) * Math.sin(pitch);
          const py = -x * Math.sin(pitch) + (y - cy) * Math.cos(pitch) + cy;
          const sx = view.gx + px * 1.06 * view.u * yaw;
          const sy = view.gy + py * 1.06 * view.u;
          assert.ok(
            sx >= width * 0.02 && sx <= width * 0.98 && sy >= height * 0.02 && sy <= height * 0.98,
            `${width}×${height}: equipment clipped at ${sx},${sy}`,
          );
        };
        for (const yaw of turntable ? [-1, -0.16, 0.16, 1] : [facing])
          for (const pitch of [-0.012, 0, 0.012]) {
            // Check the full circumference at every stroke, independent of the fitting extrema.
            for (let stroke = 0; stroke <= 1.001; stroke += 0.05) {
              const saw = sawPoseOf(frame, stroke);
              for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12)
                point(
                  saw.bladeX + Math.cos(angle) * saw.tipRadius,
                  saw.bladeY + Math.sin(angle) * saw.tipRadius,
                  yaw,
                  pitch,
                );
            }
            // Rearmost pennant tip at full idle sway, plus the heart's upper control points.
            point(-0.36 - 0.05 - 0.03 - 0.8, frame.deck - 0.5 + 0.06, yaw, pitch);
            point(0.15 - 0.35 * 0.42, frame.deck - 0.34 - 0.48 * 0.42, yaw, pitch);
            point(0.15 + 0.35 * 0.42, frame.deck - 0.34 - 0.48 * 0.42, yaw, pitch);
          }
      }
  }
});

test("raised hammer corners stay on screen throughout the hover animation", () => {
  const hammer = { ...look, weapon: "hammer" };
  const frame = botFrameOf(hammer.classId, hammer.style.body);
  const view = fitSidePortrait(668, 288, hammer, 0.74, true, 1, 0.8);
  for (let stroke = 0; stroke <= 0.801; stroke += 0.025) {
    const angle = -2.3 + 2.48 * stroke;
    for (const [x, y] of [
      [0.58, -0.1],
      [0.7, -0.1],
      [0.72, 0.07],
      [0.58, 0.1],
    ]) {
      const py = frame.deck - 0.02 + x * Math.sin(angle) + y * Math.cos(angle);
      assert.ok(view.gy + py * 1.06 * view.u >= 288 * 0.02, "Raised hammer is clipped");
    }
  }
});

test("a requested wider view stays at its requested zoom when equipment already fits", () => {
  const view = fitSidePortrait(668, 288, look, 0.3, true, 1, 0.8);
  assert.equal(view.u, Math.min(668 * 0.62, 288 * 1.25) * 0.3);
  assert.equal(view.gx, 668 / 2);
  assert.equal(view.gy, 288 * 0.82);
});
