import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "zustand/vanilla";
import { pitCreator, sharedDoc, clientDoc } from "../src/lib/pit/store.ts";
import { makeData } from "../src/lib/pit/seed.ts";
import { nsnuOf, rankedStores, simulateDuel, buildCard } from "../src/lib/pit/engine.ts";
import { weekProgress, boltsOf } from "../src/lib/pit/week.ts";
import { programWeek, allJobs, crateFor } from "../src/lib/pit/training.ts";
import { eligibilityClosed } from "../src/lib/pit/eligibility.ts";
import { authorize, commandArgs } from "../src/lib/pit/commands.ts";
import { buildBeats, fightDrive } from "../src/components/pit/cage-motion.ts";
import { Fx } from "../src/components/pit/cage-draw.ts";
import type { Session } from "../src/lib/pit/types.ts";
beforeEach((t) => t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-01T12:00:00Z") }));

function state(role: Session["role"] = "captain") {
  const store = createStore(pitCreator);
  const crew = store
    .getState()
    .crew.find(
      (c) => c.storeId === "plano" && c.role === (role === "crew" ? "specialist" : "captain"),
    )!;
  store.setState({
    trainingOpenAll: true,
    session: {
      role,
      storeId: role === "commissioner" ? null : "plano",
      crewId: role === "commissioner" ? null : crew.id,
    },
  });
  return store;
}
test("shared league projection strips legacy PIN and all store credentials", () => {
  const data = makeData();
  Object.assign(data, { pin: "SECRET" });
  Object.assign(data.stores[0]!, { passcode: "PRIVATE" });
  const json = JSON.stringify(sharedDoc(data));
  assert.ok(!json.includes('"pin"') && !json.includes('"passcode"'));
  assert.ok(!json.includes("SECRET") && !json.includes("PRIVATE"));
});
test("all-Off plus CARE cannot earn a Tune-Up", () => {
  const store = state();
  const data = store.getState();
  store.setState({
    crew: data.crew.map((c) =>
      c.storeId === "plano" && c.role === "specialist" ? { ...c, offWeeks: [1] } : c,
    ),
  });
  store.getState().completeJob(1, programWeek(1)!.care.id, "Completed CARE");
  assert.equal(weekProgress(store.getState(), "plano", 1).careDone, true);
  assert.equal(weekProgress(store.getState(), "plano", 1).tuned, false);
});

test("opponent drafts and scouting notes remain private until the fight posts", () => {
  const store = state();
  const data = store.getState();
  data.bots.find((b) => b.storeId === "allen")!.draft.weapon = "weapon-disc-super";
  const publicDoc = clientDoc(data, { role: "public", storeId: null, crewId: null });
  assert.notEqual(
    publicDoc.bots.find((b) => b.storeId === "allen")!.draft.weapon,
    "weapon-disc-super",
  );
  const captainDoc = clientDoc(data, data.session);
  assert.deepEqual(
    captainDoc.bots.find((b) => b.storeId === "plano")!.draft,
    data.bots.find((b) => b.storeId === "plano")!.draft,
  );
  assert.notEqual(
    captainDoc.bots.find((b) => b.storeId === "allen")!.draft.weapon,
    "weapon-disc-super",
  );
  assert.equal(
    clientDoc(
      { ...data, phase: "fought" },
      { role: "public", storeId: null, crewId: null },
    ).bots.find((b) => b.storeId === "allen")!.draft.weapon,
    "weapon-disc-super",
  );
});
test("availability freezes at Tuesday midnight Central and on first practice submission", () => {
  const data = makeData();
  assert.equal(eligibilityClosed(data, 1, new Date("2026-10-27T04:59:59Z")), null);
  assert.ok(eligibilityClosed(data, 1, new Date("2026-10-27T05:00:00Z")));
  const store = state("crew");
  const member = store
    .getState()
    .crew.find(
      (c) =>
        c.storeId === "plano" &&
        c.role === "specialist" &&
        c.id !== store.getState().session.crewId,
    )!;
  store.getState().completeJob(1, programWeek(1)!.days[0].jobs[0].id, "Did the work");
  const cap = store.getState().crew.find((c) => c.storeId === "plano" && c.role === "captain")!;
  store.setState({ session: { role: "captain", storeId: "plano", crewId: cap.id } });
  store.getState().setCrewOff(member.id, 1, true);
  assert.ok(
    !store
      .getState()
      .crew.find((c) => c.id === member.id)
      ?.offWeeks?.includes(1),
  );
  store.getState().removeCrew("plano", member.id);
  assert.ok(store.getState().crew.some((c) => c.id === member.id));
  store.setState({ session: { role: "commissioner", storeId: null, crewId: null } });
  store.getState().setCrewOff(member.id, 1, true);
  assert.ok(
    store
      .getState()
      .crew.find((c) => c.id === member.id)
      ?.offWeeks?.includes(1),
  );
  assert.match(store.getState().log.at(-1)!, /commissioner.*Off week 1/);
});
test("legitimate planned vacation before Pit Week is allowed", () => {
  const store = state();
  const member = store
    .getState()
    .crew.find((c) => c.storeId === "plano" && c.role === "specialist")!;
  store.getState().setCrewOff(member.id, 1, true);
  assert.ok(
    store
      .getState()
      .crew.find((c) => c.id === member.id)
      ?.offWeeks?.includes(1),
  );
});
test("standings use current posted actual NSNU, never other colors", () => {
  const data = makeData();
  data.week = 3;
  data.phase = "fought";
  data.storeCards = data.storeCards.map((c) => ({ ...c, week: 3 }));
  for (const card of data.storeCards)
    if (card.week === 3) {
      card.nsnuOfficial = true;
      card.nsnu = card.storeId === "plano" ? 1500 : 900;
      card.grades = {
        nsnu: card.storeId === "plano" ? "red" : "green",
        conv: "green",
        demoRate: "green",
        demoClose: "green",
        arch: "green",
        ticket: "green",
      };
    }
  assert.equal(nsnuOf(data, "plano", 3), 1500);
  assert.equal(rankedStores(data)[0]!.id, "plano");
});
test("Week 4 uses earned Bolts before NSNU, regardless of cosmetic spending", () => {
  const data = makeData();
  data.week = 4;
  data.phase = "fought";
  data.storeCards = data.storeCards.map((c) => ({ ...c, week: 4 }));
  data.storeCards.forEach((c) => {
    if (c.week === 4) {
      c.nsnuOfficial = true;
      c.nsnu = c.storeId === "plano" ? 1500 : 900;
    }
  });
  const cap = data.crew.find((c) => c.storeId === "allen" && c.role === "captain")!;
  data.jobLog = [
    {
      id: "x",
      week: 4,
      jobId: "job",
      storeId: "allen",
      crewId: cap.id,
      crewName: cap.name,
      note: "Done",
      status: "approved",
      at: Date.now(),
    },
  ];
  data.stores.find((s) => s.id === "allen")!.boltsSpent = 2;
  assert.equal(rankedStores(data)[0]!.id, "allen");
});
test("anonymous, crew, other-store captains and forged roster roles are rejected", () => {
  const store = state("crew");
  const data = store.getState();
  assert.throws(() =>
    authorize(data, { role: "public", storeId: null, crewId: null }, "resetSeason", []),
  );
  assert.throws(() => authorize(data, data.session, "lockStore", ["plano"]));
  assert.throws(() =>
    authorize(data, { ...data.session, role: "captain" }, "lockStore", ["plano"]),
  );
  const cap = state().getState().session;
  assert.throws(() => authorize(data, cap, "lockStore", ["allen"]));
  assert.throws(() => authorize(data, cap, "runSaturday", []));
  assert.doesNotThrow(() => authorize(data, cap, "lockStore", ["plano"]));
  assert.doesNotThrow(() => authorize(data, data.session, "postShout", ["Team", "Well done"]));
});
test("commands reject extra data, forged Spark scores and non-finite sales numbers", () => {
  assert.throws(() => commandArgs.submitSpark.parse([1, "tue", 3, 3]));
  assert.throws(() =>
    commandArgs.setDraftLoadout.parse(["plano", { ...makeData().bots[0]!.draft, coins: 999 }]),
  );
  assert.throws(() => commandArgs.updateCard.parse(["plano", { nsnu: Infinity }]));
  assert.throws(() => commandArgs.updateCard.parse(["plano", { week: 4 }]));
  assert.throws(() => commandArgs.setStyle.parse(["plano", { walkout: "walkout-pyro" }]));
});
test("job approvals, Spark claims, crate claims, picks and locker purchases are idempotent", () => {
  const store = state("crew");
  const plan = programWeek(1)!;
  const job = plan.days[0].jobs[0].id;
  store.getState().completeJob(1, job, "Good proof");
  store.getState().completeJob(1, job, "Good proof again");
  assert.equal(store.getState().jobLog.length, 1);
  const entry = store.getState().jobLog[0]!;
  const cap = state().getState().session;
  store.setState({ session: cap });
  store.getState().approveJob(entry.id);
  store.getState().approveJob(entry.id);
  assert.equal(boltsOf(store.getState(), "plano").earned, 2);
  store.getState().submitSpark(1, "tue", 3, 3);
  store.getState().submitSpark(1, "tue", 3, 3);
  assert.equal(store.getState().sparkLog.length, 1);
  const card = buildCard(store.getState()).find((b) => b.kind === "bout")!;
  store.getState().makePick(card.id, card.storeIds[0]!);
  store.getState().makePick(card.id, card.storeIds[1]!);
  assert.equal(store.getState().picks.length, 1);
  for (const day of plan.days.slice(1)) store.getState().submitSpark(1, day.day, 3, 3);
  store.getState().completeJob(1, "w1-crate", "Crate proof");
  store.getState().completeJob(1, "w1-crate", "Crate proof");
  store.getState().buyLocker("plano", "paint-neon");
  const spent = boltsOf(store.getState(), "plano").spent;
  assert.equal(spent, 6);
  store.getState().buyLocker("plano", "paint-neon");
  assert.equal(boltsOf(store.getState(), "plano").spent, spent);
});
test("post-lock actions freeze builds/picks/training but allow timely pending approval", () => {
  const store = state("crew");
  store.getState().completeJob(1, programWeek(1)!.days[0].jobs[0].id, "Before lock");
  const entry = store.getState().jobLog[0]!;
  store.setState({ session: state("commissioner").getState().session });
  store.getState().lockFriday();
  store.setState({ session: state().getState().session });
  const before = JSON.stringify(sharedDoc(store.getState()));
  store.getState().setDraftPart("plano", "utility", null);
  store.getState().submitSpark(1, "tue", 3, 3);
  assert.equal(JSON.stringify(sharedDoc(store.getState())), before);
  store.getState().approveJob(entry.id);
  assert.equal(store.getState().jobLog[0]!.status, "approved");
});

test("an early captain lock cannot be bypassed with a part purchase", () => {
  const store = state();
  const bot = store.getState().bots.find((b) => b.storeId === "plano")!;
  store.setState({
    kickoff: { ...store.getState().kickoff, appliedAt: Date.now() },
    bots: store
      .getState()
      .bots.map((b) => (b.storeId === "plano" ? { ...b, coins: { ...b.coins, weapon: 20 } } : b)),
  });
  store.getState().lockStore("plano");
  assert.ok(store.getState().bots.find((b) => b.storeId === "plano")!.locked);
  store.getState().buyPart("plano", "weapon-disc-sport");
  assert.equal(
    store.getState().bots.find((b) => b.storeId === "plano")!.draft.weapon,
    bot.draft.weapon,
  );
  assert.ok(store.getState().bots.find((b) => b.storeId === "plano")!.locked);
});
test("two full fight timelines are finite, preserve results and include KO replay", () => {
  const data = makeData();
  for (const [a, b] of [
    ["plano", "allen"],
    ["waco", "temple"],
  ]) {
    const result = simulateDuel(data, a!, b!, "test-" + a);
    const before = JSON.stringify(result);
    const beats = buildBeats(result);
    for (const beat of beats)
      for (let t = 0; t <= 1; t += 0.025) {
        const drive = fightDrive(result, beat, t, beat.t + t * beat.dur);
        for (const bot of drive.bots)
          for (const n of [bot.spot.x, bot.spot.y, bot.pitch, bot.lift, bot.hp])
            assert.ok(Number.isFinite(n));
      }
    assert.equal(JSON.stringify(result), before);
    if (result.method === "ko") assert.ok(beats.some((b) => b.kind === "replay"));
  }
});

test("authoritative hydration keeps actions bound to the receiving store", () => {
  const source = createStore(pitCreator);
  const receiving = state("commissioner");
  receiving.setState({ ...sharedDoc(source.getState()), session: receiving.getState().session });
  receiving.getState().setOfficialNsnu("plano", 1234);
  assert.equal(nsnuOf(receiving.getState(), "plano", 1), 1234);
  assert.equal(nsnuOf(source.getState(), "plano", 1), 0);
  receiving.getState().setGrade("plano", "nsnu", "red");
  assert.equal(nsnuOf(receiving.getState(), "plano", 1), 1234);
});

test("unrecorded house NSNU never breaks standings ties or runs the card", () => {
  const store = state("commissioner");
  assert.equal(nsnuOf(store.getState(), "plano", 1), 0);
  store.getState().runSaturday();
  assert.equal(store.getState().bouts.length, 0);
  assert.match(store.getState().flash, /official Sunday NSNU/);
});

test("approved Wednesday crate earns five exactly once and paid paint cannot be bypassed", () => {
  const store = state("crew");
  store.getState().completeJob(1, crateFor(1).id, "Helped the neighbor store");
  const entry = store.getState().jobLog[0]!;
  store.setState({ session: state().getState().session });
  store.getState().approveJob(entry.id);
  store.getState().approveJob(entry.id);
  assert.equal(boltsOf(store.getState(), "plano").earned, 5);
  const paint = store.getState().stores.find((s) => s.id === "plano")!.paint;
  store.getState().setPaint("plano", "neon");
  assert.equal(store.getState().stores.find((s) => s.id === "plano")!.paint, paint);
});

test("every eligible specialist completing all ten jobs and five Sparks plus CARE earns Tune-Up", () => {
  const store = state("crew");
  const plan = programWeek(1)!;
  const crew = store
    .getState()
    .crew.filter((c) => c.storeId === "plano" && c.role === "specialist");
  for (const c of crew) {
    store.setState({ session: { role: "crew", storeId: "plano", crewId: c.id } });
    for (const job of allJobs(plan))
      store.getState().completeJob(1, job.id, "Completed with evidence");
    for (const day of plan.days) store.getState().submitSpark(1, day.day, 0, 3);
  }
  store.setState({ session: state().getState().session });
  store.getState().completeJob(1, plan.care.id, "CARE complete");
  store.getState().lockFriday();
  for (const entry of store.getState().jobLog) store.getState().approveJob(entry.id);
  assert.equal(weekProgress(store.getState(), "plano", 1).tuned, true);
});

test("four complete weekly cards pay coins, preserve official totals and finish the season", () => {
  const store = state("commissioner");
  for (let week = 1; week <= 4; week++) {
    for (const s of store.getState().stores) {
      store.getState().setOfficialNsnu(s.id, 900 + s.seed * 10);
      for (const key of ["nsnu", "conv", "demoRate", "demoClose", "arch", "ticket"] as const)
        store.getState().setGrade(s.id, key, "blue");
    }
    store.getState().lockFriday();
    store.getState().runSaturday();
    assert.equal(
      store.getState().bouts.filter((b) => b.week === week && b.kind === "bye").length,
      1,
    );
    assert.equal(
      store.getState().bouts.filter((b) => b.week === week && b.kind === "bout").length,
      5,
    );
    store.getState().dropDamage();
    store.getState().advanceWeek();
    if (week < 4) assert.equal(nsnuOf(store.getState(), "plano", week + 1), 0);
  }
  assert.equal(store.getState().phase, "complete");
  assert.ok(store.getState().honors.pitBelt);
});

test("KO fixtures always contain a replay and particle budgets stay bounded", () => {
  const data = makeData();
  let ko = false;
  for (let seed = 0; seed < 50; seed++) {
    const result = simulateDuel(data, "plano", "allen", `ko-${seed}`);
    if (result.method !== "ko") continue;
    ko = true;
    assert.ok(buildBeats(result).some((b) => b.kind === "replay"));
    break;
  }
  assert.ok(ko, "Seeded fixtures must actually exercise KO replay");
  const fx = new Fx();
  for (let i = 0; i < 1000; i++) fx.dust(0, 0, 1, 1);
  fx.step(1 / 60);
  assert.ok(fx.side.length <= 360 && fx.top.length <= 200);
});
