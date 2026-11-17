import test from "node:test";
import assert from "node:assert/strict";
import { acceptShowcaseTape, keepDirectSaturdayGate, showcaseFinishVisible, updateShowcaseClock } from "../src/components/pit/playback-lifecycle.ts";

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


test("delayed tape acceptance resets the outgoing clock and rejects stale updates", () => {
  let time = 0;
  const oldGeneration = 1;
  const request = 2;
  // The old player continues playing or is scrubbed while the new request waits.
  time = updateShowcaseClock(time, oldGeneration, oldGeneration, () => 30);
  assert.equal(time, 30);
  assert.equal(acceptShowcaseTape(request, oldGeneration, "stale"), null);
  const accepted = acceptShowcaseTape(request, request, "new tape");
  assert.ok(accepted);
  time = accepted.time;
  assert.equal(accepted.tape, "new tape");
  assert.equal(time, 0);
  assert.equal(showcaseFinishVisible(time, 30), false);
  // An already queued animation update from the old player cannot advance it.
  time = updateShowcaseClock(time, oldGeneration, accepted.generation, t => t + 1);
  assert.equal(time, 0);
  time = updateShowcaseClock(time, accepted.generation, accepted.generation, t => t + 1);
  assert.equal(time, 1);
});
