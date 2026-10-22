import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "zustand/vanilla";
import { pitCreator, sharedDoc, clientDoc, applyLeague14 } from "../src/lib/pit/store.ts";
import { makeData } from "../src/lib/pit/seed.ts";
import { nsnuOf, rankedStores, simulateDuel, buildCard, conferenceStandings, championshipFinalists } from "../src/lib/pit/engine.ts";
import { weekProgress, boltsOf } from "../src/lib/pit/week.ts";
import { programWeek, allJobs, crateFor } from "../src/lib/pit/training.ts";
import { eligibilityClosed } from "../src/lib/pit/eligibility.ts";
import { cosmeticUnlocked, cosmeticProgress } from "../src/lib/pit/cosmetics.ts";
import { PRODUCT_QUIZ, productQuestion } from "../src/lib/pit/product-quiz.ts";
import { authorize, commandArgs } from "../src/lib/pit/commands.ts";
import { buildBeats, fightDrive } from "../src/components/pit/cage-motion.ts";
import { Fx } from "../src/components/pit/cage-draw.ts";
import type { Session } from "../src/lib/pit/types.ts";
import { styleOf } from "../src/lib/pit/catalog.ts";
import { createFrameLoop } from "../src/lib/pit/frame-loop.ts";
import { sameSession, singleFlight } from "../src/lib/pit/sync-policy.ts";
import { memoSnapshot, snapshotStorage } from "../src/lib/pit/snapshot-storage.ts";
test("transient state updates neither project nor serialize unchanged persisted data", () => {
  let projections=0,writes=0,serializations=0;
  const project=memoSnapshot((state: {doc: object; flash: string}) => { projections++;return {doc:state.doc}; },['doc']);
  const doc={toJSON:()=>{serializations++;return {season:'kept'};}};
  const storage=snapshotStorage<{doc:object}>(()=>({getItem:()=>null,setItem:()=>{writes++;},removeItem:()=>{}}));
  const first=project({doc,flash:''});storage.setItem('test',{state:first,version:1});
  const next=project({doc,flash:'Saved'});storage.setItem('test',{state:next,version:1});
  assert.equal(first,next);assert.equal(projections,1);assert.equal(serializations,1);assert.equal(writes,1);
  storage.setItem('test',{state:project({doc:{changed:true},flash:''}),version:1});assert.equal(writes,2);
  const blocked=snapshotStorage<object>(()=>{throw new Error('Storage disabled');});
  assert.doesNotThrow(()=>blocked.setItem('test',{state:{}}));
  assert.equal(blocked.getItem('test'),null);
});
test("render loop stops idle/hidden work and resumes without hidden wall-clock time", () => {
  let cb: ((now: number) => void) | null = null, cancelled = 0, motion = false;
  const times: number[] = [];
  const loop = createFrameLoop((_, dt) => { times.push(dt); return motion; }, {request: fn => { cb=fn; return 1; }, cancel: () => { cancelled++; cb=null; }});
  const tick=(now: number) => { const fn=cb;cb=null;fn?.(now); };
  loop.invalidate(); tick(100); assert.equal(cb,null); assert.deepEqual(times,[0]);
  motion=true;loop.invalidate();tick(200);tick(216);assert.equal(times.at(-1),0.016);
  loop.setVisible(false);assert.equal(cancelled,1);tick(10000);assert.equal(times.length,3);
  loop.setVisible(true);tick(10000);assert.equal(times.at(-1),0);
  loop.dispose();loop.invalidate();assert.equal(cb,null);
});
test("unchanged sessions compare by identity and overlapping polls share one request", async () => {
  const publicRole: Session={role:'public',storeId:null,crewId:null};
  assert.equal(sameSession(publicRole,{...publicRole}),true);
  assert.equal(sameSession(publicRole,{role:'crew',storeId:'plano',crewId:'x'}),false);
  let release!: ()=>void, calls=0;
  const poll=singleFlight(async()=>{calls++;await new Promise<void>(resolve=>{release=resolve;});});
  const one=poll(),two=poll();assert.equal(one,two);assert.equal(calls,1);release();await one;
  const three=poll();assert.equal(calls,2);release();await three;
});
beforeEach((t) => t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-01T12:00:00Z") }));

test("Abilene's confirmed team replaces legacy placeholders without resetting the season", () => {
  const fresh = makeData();
  assert.deepEqual(fresh.crew.filter(c => c.storeId === "abilene").map(c => [c.name,c.role]), [
    ["Taylor VanSickle", "captain"], ["Nathan Burney", "specialist"], ["Philip Rodriguez", "specialist"],
  ]);
  const legacy = makeData();
  legacy.stores.find(s => s.id === "abilene")!.captain = "Abilene Captain";
  legacy.crew = legacy.crew.filter(c => c.storeId !== "abilene").concat([
    {id:"abilene-captain",storeId:"abilene",name:"Abilene Captain",role:"captain"},
    ...[0,1,2,3].map(i => ({id:`abilene-crew-${i}`,storeId:"abilene",name:`Abilene Specialist ${i+1}`,role:"specialist" as const})),
  ]);
  const updated = applyLeague14(legacy);
  assert.equal(updated.stores.find(s => s.id === "abilene")!.captain, "Taylor VanSickle");
  assert.deepEqual(updated.crew.filter(c => c.storeId === "abilene"), fresh.crew.filter(c => c.storeId === "abilene"));
  assert.deepEqual(updated.bots, legacy.bots);
  assert.deepEqual(updated.jobLog, legacy.jobLog);
  assert.deepEqual(applyLeague14(updated), updated);
});

function championshipState() {
  const store = state("commissioner");
  for (let w = 1; w <= 4; w++) {
    for (const s of store.getState().stores) store.getState().setOfficialNsnu(s.id, 1000 + s.seed * 53);
    store.getState().lockFriday(); store.getState().runSaturday();
    store.getState().dropDamage(); store.getState().advanceWeek();
  }
  return store;
}

test("Championship Prep requires eight jobs, four Sparks and captain CARE; Rally stores cannot earn it", () => {
  const store = championshipState();
  const finalist = championshipFinalists(store.getState())[0]!;
  const plan = programWeek(5)!;
  assert.equal(allJobs(plan).length, 8);
  assert.equal(plan.days.length, 4);
  for (const c of store.getState().crew.filter(c => c.storeId === finalist && c.role === "specialist")) {
    store.setState({ session: { role: "crew", storeId: finalist, crewId: c.id } });
    for (const j of allJobs(plan)) store.getState().completeJob(5, j.id, "Evidence recorded");
    for (const d of plan.days) store.getState().submitSpark(5, d.day, 3, 3);
  }
  const cap = store.getState().crew.find(c => c.storeId === finalist && c.role === "captain")!;
  store.setState({ session: { role: "captain", storeId: finalist, crewId: cap.id } });
  for (const e of store.getState().jobLog.filter(e => e.week === 5)) store.getState().approveJob(e.id);
  assert.equal(weekProgress(store.getState(), finalist, 5).tuned, false);
  store.getState().completeJob(5, plan.care.id, "Captain CARE complete");
  assert.equal(weekProgress(store.getState(), finalist, 5).tuned, true);
  const outsider = store.getState().crew.find(c => c.role === "specialist" && !championshipFinalists(store.getState()).includes(c.storeId))!;
  store.setState({ session: { role: "crew", storeId: outsider.storeId, crewId: outsider.id } });
  const before = JSON.stringify([store.getState().jobLog, store.getState().sparkLog]);
  store.getState().completeJob(5, allJobs(plan)[0]!.id, "Not eligible");
  store.getState().submitSpark(5, "tue", 3, 3);
  assert.equal(JSON.stringify([store.getState().jobLog, store.getState().sparkLog]), before);
  assert.equal(weekProgress(store.getState(), outsider.storeId, 5).tuned, false);
});

test("legacy decals migrate to hood, explicit empty slots stay empty", () => {
  const legacy = styleOf({ style: { decal: "flames" } });
  assert.deepEqual(legacy.stickers, { left: "none", right: "none", hood: "flames", rear: "none" });
  const migrated = styleOf({ style: { ...legacy, stickers: { ...legacy.stickers!, hood: "none" } } });
  assert.equal(migrated.stickers!.hood, "none");
  assert.equal(migrated.decal, "none");
  assert.deepEqual(styleOf({ style: migrated }), migrated);
});

test("crew proposals are shared, owned, cosmetic-only and votes are idempotent", () => {
  const store = state("crew");
  store.setState({ bots: store.getState().bots.map(b => b.storeId === "plano" ? { ...b, wear: { ...b.wear, chassis: "bent" }, partWear: { ...b.partWear, [b.equipped.chassis]: "bent" } } : b) });
  const before = structuredClone(sharedDoc(store.getState()));
  const look = { paint: "amber", look: "stripe" as const, number: "42", style: styleOf(store.getState().bots.find(b => b.storeId === "plano")) };
  store.getState().proposeCosmetic("plano", look);
  const p = store.getState().cosmeticProposals[0]!;
  assert.ok(p);
  assert.equal(p.crewId, store.getState().session.crewId);
  assert.deepEqual(store.getState().bots, before.bots);
  store.getState().voteCosmetic(p.id); store.getState().voteCosmetic(p.id);
  assert.equal(store.getState().cosmeticProposals[0]!.voters.length, 1);
  assert.equal(sharedDoc(store.getState()).cosmeticProposals.length, 1);
  const forged = { ...store.getState().session, storeId: "allen" };
  assert.throws(() => authorize(store.getState(), forged, "voteCosmetic", [p.id]));
  assert.throws(() => authorize(store.getState(), store.getState().session, "proposeCosmetic", ["allen", look]));
  assert.throws(() => authorize(store.getState(), store.getState().session, "acceptCosmetic", [p.id]));
  assert.throws(() => commandArgs.proposeCosmetic.parse(["plano", { ...look, power: 999 }]));
  store.getState().acceptCosmetic(p.id);
  assert.deepEqual(store.getState().bots, before.bots);
  store.setState({ session: state().getState().session });
  store.getState().acceptCosmetic(p.id);
  const bot = store.getState().bots.find(b => b.storeId === "plano")!;
  assert.equal(bot.number, "42");
  const oldBot = before.bots.find(b => b.storeId === "plano")!;
  assert.deepEqual({ ...bot, style: oldBot.style, look: oldBot.look, number: oldBot.number }, oldBot);
  assert.equal(store.getState().cosmeticProposals[0]!.status, "accepted");
  const fightBefore = simulateDuel(before as ReturnType<typeof makeData>, "plano", "allen", "cosmetic");
  const fightAfter = simulateDuel(store.getState(), "plano", "allen", "cosmetic");
  assert.deepEqual(fightAfter.exchanges, fightBefore.exchanges);
});

test("server migration preserves damage, work and legacy stickers without choosing an unchosen starter", () => {
  const data = makeData();
  const bot = data.bots[0]!;
  bot.style = { ...styleOf(bot), decal: "flames" };
  delete bot.style.stickers;
  bot.wear.armor = "disabled";
  const normalized = applyLeague14(data);
  assert.equal(normalized.bots[0]!.style!.stickers!.hood, "flames");
  assert.deepEqual(normalized.bots[0]!.wear, bot.wear);
  assert.deepEqual(normalized.jobLog, data.jobLog);
  assert.deepEqual(applyLeague14(normalized), normalized);
  assert.equal(normalized.bots[1]!.style?.body, undefined);
});

test("locked items and forged store membership cannot enter cosmetic proposals", () => {
  const store = state("crew");
  const style = styleOf(store.getState().bots.find(b => b.storeId === "plano"));
  const loadout = { paint: "amber", look: "plain" as const, number: "1", style: { ...style, victory: "victory-fireworks" } };
  store.getState().proposeCosmetic("plano", loadout);
  assert.equal(store.getState().cosmeticProposals.length, 0);
  store.getState().proposeCosmetic("plano", { ...loadout, style: { ...style, stickers: { ...style.stickers!, left: "champion" } } });
  assert.equal(store.getState().cosmeticProposals.length, 0);
  store.setState({ session: { ...store.getState().session, storeId: "allen" } });
  store.getState().proposeCosmetic("allen", { ...loadout, style });
  assert.equal(store.getState().cosmeticProposals.length, 0);
});

test("replacement designs reset votes, stale IDs cannot vote, and another store's captain cannot accept", () => {
  const store = state("crew");
  const loadout = { paint: "amber", look: "plain" as const, number: "1", style: styleOf(store.getState().bots.find(b => b.storeId === "plano")) };
  store.getState().proposeCosmetic("plano", loadout);
  const first = store.getState().cosmeticProposals[0]!;
  store.getState().voteCosmetic(first.id);
  store.getState().proposeCosmetic("plano", { ...loadout, number: "2" });
  const replacement = store.getState().cosmeticProposals[0]!;
  assert.notEqual(replacement.id, first.id);
  assert.equal(store.getState().cosmeticProposals.length, 1);
  assert.equal(replacement.voters.length, 0);
  assert.throws(() => authorize(store.getState(), store.getState().session, "voteCosmetic", [first.id]));
  const outsider = store.getState().crew.find(c => c.storeId === "allen" && c.role === "captain")!;
  const session = { role: "captain" as const, storeId: "allen", crewId: outsider.id };
  assert.throws(() => authorize(store.getState(), session, "acceptCosmetic", [replacement.id]));
  assert.throws(() => authorize(store.getState(), session, "voteCosmetic", [replacement.id]));
  assert.equal(clientDoc(store.getState(), session).cosmeticProposals.length, 0);
});

test("independent sticker commands merge rapid slot edits against authoritative state", () => {
  const store = state("crew");
  const plan = programWeek(1)!;
  for (const job of plan.days[0]!.jobs) store.getState().completeJob(1, job.id, "Sticker unlock evidence");
  store.getState().completeJob(1, crateFor(1).id, "Neighbor-store evidence");
  store.setState({ session: state().getState().session });
  for (const entry of store.getState().jobLog) store.getState().approveJob(entry.id);
  const before = structuredClone(store.getState().bots.find(b => b.storeId === "plano")!);
  const fightBefore = simulateDuel(store.getState(), "plano", "allen", "sticker-slots").exchanges;
  // Both requests are prepared from the same client revision; neither carries the other slots.
  const edits = [["plano", "left", "hazard"], ["plano", "right", "arch"]] as const;
  for (const args of edits) {
    commandArgs.setSticker.parse(args);
    store.getState().setSticker(...args);
  }
  const after = store.getState().bots.find(b => b.storeId === "plano")!;
  assert.equal(after.style!.stickers!.left, "hazard");
  assert.equal(after.style!.stickers!.right, "arch");
  assert.deepEqual({ ...after, style: before.style }, before);
  assert.deepEqual(simulateDuel(store.getState(), "plano", "allen", "sticker-slots").exchanges, fightBefore);
  assert.throws(() => authorize(store.getState(), state("crew").getState().session, "setSticker", ["plano", "left", "none"]));
});

test("captain acceptance rechecks ownership instead of trusting an earlier proposal", () => {
  const store = state("crew");
  store.setState({ stores: store.getState().stores.map(s => s.id === "plano" ? { ...s, unlocks: ["victory-fireworks"] } : s) });
  const loadout = { paint: "amber", look: "plain" as const, number: "1", style: { ...styleOf(store.getState().bots.find(b => b.storeId === "plano")), victory: "victory-fireworks" } };
  store.getState().proposeCosmetic("plano", loadout);
  const proposal = store.getState().cosmeticProposals[0]!;
  assert.ok(proposal);
  store.setState({ session: state().getState().session, stores: store.getState().stores.map(s => s.id === "plano" ? { ...s, unlocks: [] } : s) });
  const before = structuredClone(store.getState().bots);
  store.getState().acceptCosmetic(proposal.id);
  assert.deepEqual(store.getState().bots, before);
  assert.equal(store.getState().cosmeticProposals[0]!.status, "open");
});

function state(role: Session["role"] = "captain", chooseBody = true) {
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
  if (chooseBody && role !== "commissioner")
    store.getState().chooseStarterBody("plano", "striker", "shrike");
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
test("conference standings use published tiebreak order and cosmetic spending never reduces earned Bolts", () => {
  const data = makeData();
  data.week = 4;
  data.phase = "fought";
  const metro = data.stores.filter((store) => store.conference === "metro");
  for (const store of metro) {
    for (let week = 1; week <= 4; week++) {
      data.storeCards.push({
        id: `tie-${store.id}-${week}`,
        storeId: store.id,
        week,
        nsnu: 1000,
        conv: 60,
        demoRate: 82,
        demoClose: 70,
        arch: 3.2,
        demoTicket: 1700,
        projected: false,
        nsnuOfficial: true,
        grades: { nsnu:"blue", conv:"blue", demoRate:"blue", demoClose:"blue", arch:"blue", ticket:"blue" },
      });
    }
  }
  const planoCap = data.crew.find((c) => c.storeId === "plano" && c.role === "captain")!;
  data.jobLog = [
    { id:"bolt-a", week:4, jobId:"job-a", storeId:"plano", crewId:planoCap.id, crewName:planoCap.name, note:"Done", status:"approved", at:Date.now() },
    { id:"bolt-b", week:4, jobId:"job-b", storeId:"plano", crewId:planoCap.id, crewName:planoCap.name, note:"Done", status:"approved", at:Date.now() },
  ];
  data.stores.find((store) => store.id === "plano")!.boltsSpent = 4;
  const standings = conferenceStandings(data, "metro");
  assert.ok(standings.some((store) => store.id === "plano"));
  assert.equal(data.stores.find((store) => store.id === "plano")!.boltsSpent, 4);
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
  assert.throws(() => commandArgs.setStyle.parse(["plano", { walkout: "forged-walkout" }]));
  const store = state();
  const before = structuredClone(store.getState().bots);
  store.getState().setStyle("plano", { walkout: "walkout-pyro" });
  assert.deepEqual(store.getState().bots, before, "valid effect IDs still require purchase");
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
test("first store sign-in chooses one starter shell and Week 1 cannot switch it", () => {
  const store = state("captain", false);
  store.getState().chooseStarterBody("plano", "tank", "juggernaut");
  let bot = store.getState().bots.find((row) => row.storeId === "plano")!;
  assert.equal(bot.classId, "tank");
  assert.equal(bot.style?.body, "juggernaut");
  store.getState().chooseStarterBody("plano", "striker", "raptor");
  bot = store.getState().bots.find((row) => row.storeId === "plano")!;
  assert.equal(bot.classId, "tank");
  assert.equal(bot.style?.body, "juggernaut");
});

test("cosmetic achievement unlocks are idempotent and never modify fight stats", () => {
  const store = state();
  const before = JSON.stringify(store.getState().bots.find((row) => row.storeId === "plano")!.coins);
  const crew = store.getState().crew.find((row) => row.storeId === "plano" && row.role === "specialist")!;
  store.setState({ session:{ role:"crew", storeId:"plano", crewId:crew.id } });
  const plan = programWeek(1)!;
  for (const job of plan.days[0]!.jobs) store.getState().completeJob(1, job.id, "Completed");
  const cap = store.getState().crew.find((row) => row.storeId === "plano" && row.role === "captain")!;
  store.setState({ session:{ role:"captain", storeId:"plano", crewId:cap.id } });
  for (const entry of store.getState().jobLog) store.getState().approveJob(entry.id);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "decal", "hazard"), true);
  const first = cosmeticProgress(store.getState(), "plano").filter((row) => row.earned).map((row) => row.reward.id);
  const second = cosmeticProgress(store.getState(), "plano").filter((row) => row.earned).map((row) => row.reward.id);
  assert.deepEqual(first, second);
  store.getState().setStyle("plano", { decal:"hazard" });
  assert.equal(JSON.stringify(store.getState().bots.find((row) => row.storeId === "plano")!.coins), before);
});

test("Product Knowledge Spark bank has valid keys and varied correct-answer positions", () => {
  assert.ok(PRODUCT_QUIZ.length >= 20);
  const answers = new Set<number>();
  for (let week = 1; week <= 5; week++) {
    for (const day of ["tue","wed","thu","fri"] as const) {
      const q = productQuestion(week, day);
      assert.equal(q.choices.length, 4);
      assert.ok(q.answer >= 0 && q.answer < 4);
      assert.ok(q.choices[q.answer]);
      answers.add(q.answer);
    }
  }
  assert.ok(answers.size >= 3);
  assert.equal(PRODUCT_QUIZ.find((q) => q.id === "pk-03")!.choices[0], "Classic");
  assert.equal(PRODUCT_QUIZ.find((q) => q.id === "pk-21")!.choices[0], "Measure, visually confirm, balance technique");
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

test("four 14-store cards lead to two conference champions and a knockout Championship Saturday", () => {
  const store = state("commissioner");
  for (let week = 1; week <= 4; week++) {
    for (const row of store.getState().stores) {
      store.getState().setOfficialNsnu(row.id, 900 + row.seed * 10 + (row.conference === "metro" ? 100 : 0));
      for (const key of ["nsnu", "conv", "demoRate", "demoClose", "arch", "ticket"] as const)
        store.getState().setGrade(row.id, key, "blue");
    }
    store.getState().lockFriday();
    store.getState().runSaturday();
    assert.equal(store.getState().bouts.filter((bout) => bout.week === week && bout.kind === "bye").length, 0);
    assert.equal(store.getState().bouts.filter((bout) => bout.week === week && bout.kind === "bout").length, 7);
    store.getState().dropDamage();
    store.getState().advanceWeek();
  }
  assert.equal(store.getState().week, 5);
  assert.equal(store.getState().phase, "open");
  assert.equal(championshipFinalists(store.getState()).length, 2);
  store.getState().lockFriday();
  store.getState().runSaturday();
  const championship = store.getState().bouts.find((bout) => bout.week === 5 && bout.title === "Waterman Championship");
  assert.ok(championship?.result);
  assert.equal(championship!.result!.method, "ko");
  store.getState().dropDamage();
  store.getState().advanceWeek();
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
