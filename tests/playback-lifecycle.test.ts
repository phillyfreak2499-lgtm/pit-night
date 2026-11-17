import test from "node:test";
import assert from "node:assert/strict";
import { keepDirectSaturdayGate, showcaseFinishVisible } from "../src/components/pit/playback-lifecycle.ts";

test("finish visibility and closing eligibility follow the current frame, including a stopped seek", () => {
  const duration = 30;
  assert.equal(showcaseFinishVisible(0, duration), false);
  assert.equal(showcaseFinishVisible(duration, duration), true);
  assert.equal(showcaseFinishVisible(duration - 0.1, duration), false);
  assert.equal(showcaseFinishVisible(duration, duration), true);
});

test("direct route retains only its started player through reveal until Next fight", () => {
  const id = "rumble";
  assert.equal(keepDirectSaturdayGate(id, 1, null), true);
  assert.equal(keepDirectSaturdayGate(id, 0, id), true);
  assert.equal(keepDirectSaturdayGate("championship", 0, id), false);
  assert.equal(keepDirectSaturdayGate(id, 0, null), false);
});
