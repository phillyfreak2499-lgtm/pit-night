import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { partById } from "../src/lib/pit/catalog.ts";
import { previewSaturday, recordOf } from "../src/lib/pit/engine.ts";
import {
  PROGRAM_HOLD_MS,
  PROGRAM_SLOTS,
  cornerStoreIds,
  programRecords,
  programSegments,
  programSides,
  programSlots,
  recordEntering,
} from "../src/lib/pit/fight-card.ts";
import { makeData } from "../src/lib/pit/seed.ts";
import {
  GARAGE_SPIN_SECONDS,
  garagePlateMix,
  garagePose,
  garageSpinStartsPlaying,
  garageYaw,
  garageYawStep,
} from "../src/lib/pit/turntable.ts";
import type { FighterSnap } from "../src/lib/pit/types.ts";

test("garage preview yaws one full turn in 11 seconds and loops", () => {
  assert.equal(GARAGE_SPIN_SECONDS, 11);
  assert.equal(garageYaw(0), 0);
  assert.equal(garageYaw(11), 0);
  assert.equal(garageYaw(22), 0);
  assert.ok(Math.abs(garageYaw(5.5) - Math.PI) < 1e-9);
  assert.ok(Math.abs(garageYawStep(11) - Math.PI * 2) < 1e-9);
  assert.equal(garageYawStep(0), 0);
  assert.equal(garageYawStep(-1), 0);

  let yaw = 0.55;
  const dt = 1 / 60;
  const frames = Math.round(GARAGE_SPIN_SECONDS / dt);
  for (let i = 0; i < frames; i++) yaw += garageYawStep(dt);
  const turns = (yaw - 0.55) / (Math.PI * 2);
  assert.ok(Math.abs(turns - 1) < 0.02, `expected one revolution, got ${turns}`);
});

test("turntable pose is smooth and shows every side of the bot", () => {
  let prevWidth = garagePose(0).side;
  let sawRight = false;
  let sawLeft = false;
  let sawFront = false;
  let sawRear = false;
  const samples = 720;
  for (let i = 0; i <= samples; i++) {
    const yaw = (i / samples) * Math.PI * 2;
    const pose = garagePose(yaw);
    assert.ok(Math.abs(pose.facing) >= 0.16);
    assert.ok(Math.abs(pose.facing) <= 1);
    assert.ok(pose.side >= 0 && pose.side <= 1);
    assert.ok(pose.end >= 0 && pose.end <= 1);
    assert.ok(Math.abs(pose.side - prevWidth) < 0.02, `width jumped at ${yaw}`);
    prevWidth = pose.side;
    if (pose.facing > 0.95) sawRight = true;
    if (pose.facing < -0.95) sawLeft = true;
    if (pose.end > 0.95 && !pose.rear) sawFront = true;
    if (pose.end > 0.95 && pose.rear) sawRear = true;
  }
  assert.ok(sawRight && sawLeft && sawFront && sawRear);
  assert.equal(garagePlateMix(0), 0);
  assert.equal(garagePlateMix(0.5), 0);
  assert.equal(garagePlateMix(1), 1);
  assert.ok(garagePlateMix(0.85) > garagePlateMix(0.7));
  assert.ok(garagePlateMix(0.7) > garagePlateMix(0.62));
});

test("reduced motion starts the garage spin paused", () => {
  assert.equal(garageSpinStartsPlaying(true), false);
  assert.equal(garageSpinStartsPlaying(false), true);
});

test("classic garage portrait retains its pause and resume controls", () => {
  const garage = readFileSync(new URL("../src/components/pit/garage-page.tsx", import.meta.url), "utf8");
  const portrait = readFileSync(new URL("../src/components/pit/bot-portrait.tsx", import.meta.url), "utf8");
  assert.match(garage, /Pause rotation/);
  assert.match(garage, /Resume rotation/);
  assert.match(garage, /garageSpinStartsPlaying/);
  assert.doesNotMatch(garage, /onPointerDown|onPointerMove|onWheel|ArrowLeft|ArrowRight|ArrowUp|ArrowDown|setCamera/);
  assert.doesNotMatch(portrait, /onPointerDown|onWheel|ArrowLeft|ArrowRight/);
});

test("pre-match program lists all six slots and the record going in", () => {
  const data = makeData();
  const bout = previewSaturday(data).find((row) => row.kind === "bout" && row.result?.fighters.length === 2);
  assert.ok(bout?.result);
  const sides = programSides(bout);
  assert.equal(sides.left.length, 1);
  assert.equal(sides.right.length, 1);
  assert.deepEqual(PROGRAM_SLOTS, ["chassis", "armor", "drive", "weapon", "utility", "brain"]);

  for (const fighter of [sides.left[0]!, sides.right[0]!]) {
    const slots = programSlots(fighter);
    assert.deepEqual(
      slots.map((row) => row.slot),
      [...PROGRAM_SLOTS],
    );
    for (const row of slots) {
      assert.ok(row.label.length > 0, row.slot);
      assert.ok(row.name.trim().length > 0, row.slot);
      assert.ok(row.tier.length > 0, row.slot);
    }
    assert.deepEqual(cornerStoreIds(fighter, [fighter.id]), [fighter.id]);
  }

  const empty = programSlots({ ...sides.left[0]!, utilityName: null, tiers: { ...sides.left[0]!.tiers, utility: undefined } });
  const utility = empty.find((row) => row.slot === "utility");
  assert.equal(utility?.name, "Empty");
  assert.match(utility?.job ?? "", /empty/i);

  const posted = { ...data, bouts: [...data.bouts, bout] };
  const id = bout.teamA[0]!;
  const before = recordOf(data, id);
  const entering = recordEntering(posted, id, bout.id);
  assert.deepEqual(entering, before);
  assert.deepEqual(programRecords(posted, bout)[id], before);
  if (bout.result.winnerIds.includes(id) || bout.result.loserIds.includes(id)) {
    assert.notDeepEqual(recordOf(posted, id), before);
  }

  const sky: FighterSnap = {
    ...sides.left[0]!,
    brainName: "Skynet",
    brainFamily: "skynet",
    tiers: { ...sides.left[0]!.tiers, brain: "super" },
  };
  const brain = programSlots(sky).find((row) => row.slot === "brain");
  assert.equal(brain?.name, "Skynet");
  assert.equal(brain?.tier, "Super");
  assert.match(brain?.job ?? "", /4 straight green Demo Ticket weeks/);

  const card = readFileSync(new URL("../src/components/pit/fight-program.tsx", import.meta.url), "utf8");
  assert.match(card, /data-testid="fight-program"/);
  assert.match(card, /Official program/);
  assert.match(card, /data-testid=\{id \? `record-\$\{id\}` : undefined\}/);
  assert.match(card, /grid-cols-1/);
  assert.match(card, /md:grid-cols-\[minmax\(0,1fr\)_auto_minmax\(0,1fr\)\]/);
  assert.match(card, /programSlots\(fighter\)/);
  for (const label of ["Chassis", "Armor", "Drive", "Weapon", "Utility", "Brain"]) {
    assert.match(readFileSync(new URL("../src/lib/pit/catalog.ts", import.meta.url), "utf8"), new RegExp(`${label}`));
  }
  const watch = readFileSync(new URL("../src/components/pit/watch-page.tsx", import.meta.url), "utf8");
  const show = readFileSync(new URL("../src/components/pit/show-page.tsx", import.meta.url), "utf8");
  const boutPage = readFileSync(new URL("../src/components/pit/bout-page.tsx", import.meta.url), "utf8");
  assert.match(watch, /FightProgram/);
  assert.match(watch, /programRecords\(seen, bout\)/);
  assert.match(show, /kind === "card"/);
  assert.match(boutPage, /FightProgram/);
});

test("every match on a tape is preceded by its program card", () => {
  const segments = programSegments([{ id: "a" }, { id: "b" }]);
  assert.deepEqual(
    segments.map((row) => row.kind),
    ["open", "card", "fight", "sting", "card", "fight", "sting", "close"],
  );
  assert.equal(PROGRAM_HOLD_MS, 11000);
  const card = segments.find((row) => row.kind === "card");
  const fight = segments.find((row) => row.kind === "fight");
  assert.equal(card && "bout" in card ? card.bout.id : "", "a");
  assert.ok(segments.findIndex((row) => row.kind === "card" && row.bout.id === "a") < segments.findIndex((row) => row.kind === "fight" && row.bout.id === "a"));
  assert.equal(fight && "bout" in fight ? fight.bout.id : "", "a");
});

test("Skynet keeps its name and has no rename flag", () => {
  const part = partById("brain-skynet-super");
  assert.ok(part);
  assert.equal(part.name, "Skynet");
  assert.equal(part.family, "skynet");
  assert.equal(part.slot, "brain");
  assert.equal(part.tier, "super");
  assert.equal(part.price, 8);
  assert.equal(part.greenWeeks, 4);
  assert.equal(part.straight, true);
  assert.deepEqual(part.nudge, { power: 0, speed: 0, armor: 0, heat: 0 });
  assert.deepEqual(part.tags, ["smart", "aggro"]);
  assert.match(part.job, /4 straight green Demo Ticket weeks/);

  const flag = /TODO|FIXME|rename me|should be renamed|temporary name|placeholder name|RENAME_SKYNET/i;
  const files = [
    "src/lib/pit/roster.ts",
    "src/lib/pit/engine.ts",
    "src/lib/pit/combat.ts",
    "src/lib/pit/catalog.ts",
    "src/components/pit/faq-page.tsx",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    for (const line of text.split("\n")) {
      if (/skynet/i.test(line)) assert.equal(flag.test(line), false, `${file}: ${line}`);
    }
  }
});
