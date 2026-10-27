import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "zustand/vanilla";
import { PGlite } from "@electric-sql/pglite";
import { pitCreator, sharedDoc } from "../src/lib/pit/store.ts";
import { authorize, commandArgs } from "../src/lib/pit/commands.ts";
import { simulateDuel } from "../src/lib/pit/engine.ts";
import { METRICS, partById } from "../src/lib/pit/catalog.ts";
import { allJobs, programWeek, TUNE_UP_BONUS } from "../src/lib/pit/training.ts";
import type { PitData } from "../src/lib/pit/types.ts";

function league() {
  const state = createStore(pitCreator);
  state.setState({ session: { role: "commissioner", storeId: null, crewId: null } });
  for (const store of state.getState().stores) {
    for (const metric of METRICS) {
      state.getState().setKickoffGrade(store.id, metric.stat, "green");
      state.getState().setGrade(store.id, metric.stat, "green");
    }
    state.getState().setOfficialNsnu(store.id, 1000 + store.seed);
  }
  state.getState().applyKickoff();
  return state;
}

test("a purchased, locked upgrade changes the server battle and survives database/replay reload", async () => {
  const state = league();
  const before = simulateDuel(state.getState(), "plano", "allen", "purchase");
  const part = partById("weapon-saw-sport")!;
  const args = commandArgs.buyPart.parse(["plano", part.id]);
  authorize(state.getState(), state.getState().session, "buyPart", args);
  state.getState().buyPart(...args);
  assert.ok(
    state
      .getState()
      .bots.find((b) => b.storeId === "plano")!
      .owned.includes(part.id),
  );
  state.getState().lockFriday();
  const locked = state.getState().bots.find((b) => b.storeId === "plano")!.locked!;
  assert.equal(locked.weapon, part.id);
  const upgraded = simulateDuel(state.getState(), "plano", "allen", "purchase");
  assert.notDeepEqual(upgraded.hp, before.hp, "the purchase must change numerical combat");
  assert.equal(upgraded.fighters[0]!.parts?.weapon, part.id);
  assert.ok(upgraded.exchanges.every((ex) => ex.combat?.plano && ex.combat?.allen));

  // This is the same store action and JSON projection used by mutateSeason.
  // Use a disposable Postgres database so the test never touches the live league.
  state.getState().runSaturday();
  assert.equal(state.getState().phase, "fought", state.getState().flash);
  const document = JSON.stringify(sharedDoc(state.getState()));
  const db = new PGlite();
  try {
    await db.exec("CREATE TABLE pit_season (id text PRIMARY KEY, rev integer, doc text)");
    await db.query("INSERT INTO pit_season VALUES ('main', 1, $1)", [document]);
    const saved = await db.query<{ doc: string }>("SELECT doc FROM pit_season WHERE id = 'main'");
    const restored = JSON.parse(saved.rows[0]!.doc) as PitData;
    assert.deepEqual(restored.bouts, JSON.parse(document).bouts);
    const bout = restored.bouts.find((b) => b.result?.fighters.some((f) => f.id === "plano"))!;
    const fighter = bout.result!.fighters.find((f) => f.id === "plano")!;
    assert.equal(fighter.parts?.weapon, part.id);
    assert.equal(fighter.tiers?.weapon, "sport");
    assert.ok(bout.result!.exchanges.some((ex) => ex.combat?.plano));
    assert.deepEqual(simulateDuel(restored, "plano", "allen", "purchase"), upgraded);

    const receiving = createStore(pitCreator);
    receiving.setState({ ...restored, session: state.getState().session });
    const history = JSON.stringify(receiving.getState().bouts);
    receiving.getState().setPaint("plano", "amber");
    assert.equal(
      JSON.stringify(receiving.getState().bouts),
      history,
      "later choices cannot rewrite old fights",
    );
  } finally {
    await db.close();
  }
});

test("unowned upgrades cannot enter a server loadout", () => {
  const state = league();
  const bot = state.getState().bots.find((b) => b.storeId === "plano")!;
  const before = simulateDuel(state.getState(), "plano", "allen", "ownership");
  state.getState().setDraftPart("plano", "weapon", "weapon-saw-super");
  assert.equal(
    state.getState().bots.find((b) => b.storeId === "plano")!.draft.weapon,
    bot.draft.weapon,
  );
  assert.deepEqual(simulateDuel(state.getState(), "plano", "allen", "ownership"), before);
});

test("approved Full Tune-Up progression adds its promised stats and changes the fight", () => {
  const data = league().getState();
  const before = simulateDuel(data, "plano", "allen", "tune-up");
  const plan = programWeek(data.week)!;
  const crew = data.crew.filter((c) => c.storeId === "plano");
  const jobLog = crew.flatMap((c) =>
    (c.role === "captain" ? [plan.care] : allJobs(plan)).map((job) => ({
      id: `${data.week}:${job.id}:${c.id}`,
      week: data.week,
      jobId: job.id,
      storeId: c.storeId,
      crewId: c.id,
      crewName: c.name,
      note: "Completed",
      status: "approved" as const,
      at: 1,
    })),
  );
  const sparkLog = crew
    .filter((c) => c.role === "specialist")
    .flatMap((c) =>
      plan.days.map((day) => ({
        id: `${data.week}:${day.day}:${c.id}`,
        week: data.week,
        day: day.day,
        storeId: c.storeId,
        crewId: c.id,
        correct: 3,
        total: 3,
        at: 1,
      })),
    );
  const tuned = simulateDuel({ ...data, jobLog, sparkLog }, "plano", "allen", "tune-up");
  assert.equal(tuned.fighters[0]!.tuned, true);
  for (const key of ["power", "speed", "armor", "heat"] as const) {
    assert.equal(tuned.fighters[0]!.stats[key], before.fighters[0]!.stats[key] + TUNE_UP_BONUS);
  }
  assert.notDeepEqual(tuned.hp, before.hp);
  const pending = simulateDuel(
    { ...data, jobLog: jobLog.map((job) => ({ ...job, status: "pending" as const })), sparkLog },
    "plano",
    "allen",
    "tune-up",
  );
  assert.equal(pending.fighters[0]!.tuned, false);
  assert.deepEqual(pending.hp, before.hp);
});

test("presentation-only choices leave all battle numbers and combat traces unchanged", () => {
  const state = league();
  const original = state.getState();
  const changed = {
    ...original,
    stores: original.stores.map((s) => ({ ...s, paint: "neon", garage: "night" as const })),
    bots: original.bots.map((b) => ({
      ...b,
      look: "stripe" as const,
      number: "99",
      shows: ["fog", "blacklight", "leaves"] as ("fog" | "blacklight" | "leaves")[],
      style: { ...b.style!, finish: "holographic" as const, smoke: "confetti" as const },
    })),
  };
  const a = simulateDuel(original, "plano", "allen", "cosmetics");
  const b = simulateDuel(changed, "plano", "allen", "cosmetics");
  assert.deepEqual(b.hp, a.hp);
  assert.deepEqual(b.exchanges, a.exchanges);
  assert.deepEqual(b.winnerIds, a.winnerIds);
  assert.deepEqual(b.wear, a.wear);
  assert.deepEqual(
    b.fighters.map((f) => f.stats),
    a.fighters.map((f) => f.stats),
  );
});
