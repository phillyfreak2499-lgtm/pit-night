import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createStore } from "zustand/vanilla";
import { pitCreator, sharedDoc, clientDoc, applyLeague14, applyDueLock, pruneRemovePlaceholders } from "../src/lib/pit/store.ts";
import { makeData } from "../src/lib/pit/seed.ts";
import { nsnuOf, rankedStores, simulateDuel, simulateChampionshipDuel, buildCard, conferenceStandings, championshipFinalists, coinMath, coinsByJar, type GradeSet } from "../src/lib/pit/engine.ts";
import { weekProgress, boltsOf, lockerItem } from "../src/lib/pit/week.ts";
import { programWeek, allJobs, crateFor } from "../src/lib/pit/training.ts";
import { eligibilityClosed } from "../src/lib/pit/eligibility.ts";
import { cosmeticUnlocked, cosmeticProgress, bannerVerdict } from "../src/lib/pit/cosmetics.ts";
import { checkedCosmeticLoadout } from "../src/lib/pit/cosmetic-loadout.ts";
import { PRODUCT_QUIZ, productQuestion } from "../src/lib/pit/product-quiz.ts";
import { authorize, commandArgs, CAPTAIN_BUILD_COMMANDS, captainBuildRejection, type Command } from "../src/lib/pit/commands.ts";
import { central, nextLockAt, weekDeadline, deadlineDue } from "../src/lib/pit/time.ts";
import { buildBeats, fightDrive } from "../src/components/pit/cage-motion.ts";
import { Fx } from "../src/components/pit/cage-draw.ts";
import type { Bout, FightResult, Grade, KeyName, Session, StatKey, StoreCard } from "../src/lib/pit/types.ts";
import { STICKER_ART } from "../src/lib/pit/types.ts";
import { DECALS, styleOf, GRADE_COINS, METRICS } from "../src/lib/pit/catalog.ts";
import { createFrameLoop } from "../src/lib/pit/frame-loop.ts";
import { leagueArgs, sameSession, singleFlight } from "../src/lib/pit/sync-policy.ts";
import { memoSnapshot, snapshotStorage } from "../src/lib/pit/snapshot-storage.ts";
test("one-time placeholder cleanup removes only exact specialist names and preserves history", () => {
  const seed = makeData();
  const specialist = seed.crew.find((member) => member.role === "specialist")!;
  const captain = seed.crew.find((member) => member.role === "captain")!;
  const target = { ...specialist, id: "temporary-remove", name: "  ReMoVe  " };
  const other = { ...specialist, id: "not-a-placeholder", name: "Remove Thompson" };
  const data = {
    ...seed,
    crew: [...seed.crew, target, other, { ...captain, id: "captain-not-deleted", name: "remove" }],
    proposals: [
      ...seed.proposals,
      { id: "placeholder-proposal", storeId: target.storeId, crewId: target.id, crewName: target.name, partId: "stock", note: "test" },
    ],
    mvps: [...seed.mvps, { week: 1, storeId: target.storeId, crewId: target.id, name: target.name }],
  };
  const cleaned = pruneRemovePlaceholders(data);
  assert.ok(!cleaned.crew.some((member) => member.id === target.id));
  assert.ok(cleaned.crew.some((member) => member.id === other.id));
  assert.ok(cleaned.crew.some((member) => member.id === "captain-not-deleted"));
  assert.ok(!cleaned.proposals.some((proposal) => proposal.crewId === target.id));
  assert.equal(cleaned.mvps.length, data.mvps.length);
  assert.strictEqual(cleaned.jobLog, data.jobLog);
  assert.strictEqual(cleaned.sparkLog, data.sparkLog);
  assert.strictEqual(pruneRemovePlaceholders(cleaned), cleaned);
});

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
test("Desk buttons never send their click event as a league command argument", () => {
  // A React click event cannot be sent to the server ("Seroval Error (step: 1)").
  const click = { nativeEvent: {}, type: "click", preventDefault() {} };
  assert.deepEqual(leagueArgs([click]), []);
  assert.deepEqual(leagueArgs(["plano", "nsnu", "green"]), ["plano", "nsnu", "green"]);
  assert.deepEqual(leagueArgs(["plano", { paint: "amber" }, null, 3]), ["plano", { paint: "amber" }, null, 3]);
});
beforeEach((t) => t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-01T12:00:00Z") }));

test("Locker identity names persist without changing the store, bot build, wear or result history", () => {
  const league=state();const before=league.getState();
  const bot=before.bots.find(b=>b.storeId==='plano')!;
  const official=before.stores.find(s=>s.id==='plano')!.name;
  league.getState().renameIdentity('plano','  Steel Fang  ','  Plano Pit Crew  ');
  const after=league.getState();const changed=after.bots.find(b=>b.storeId==='plano')!;
  assert.equal(changed.name,'STEEL FANG');assert.deepEqual({...changed,name:bot.name},bot);
  assert.equal(after.stores.find(s=>s.id==='plano')!.name,official);
  assert.equal(sharedDoc(after).stores.find(s=>s.id==='plano')!.teamName,'Plano Pit Crew');
  assert.deepEqual(after.bouts,before.bouts);
  const session=after.session;
  assert.doesNotThrow(()=>authorize(after,session,'renameIdentity',['plano','X','Y']));
  assert.throws(()=>authorize(after,session,'renameIdentity',['allen','X','Y']));
  assert.throws(()=>authorize(after,{...session,role:'crew',crewId:after.crew.find(c=>c.storeId==='plano'&&c.role==='specialist')!.id},'renameIdentity',['plano','X','Y']));
  assert.equal(commandArgs.renameIdentity.safeParse(['plano','','Team']).success,false);
  assert.equal(commandArgs.renameIdentity.safeParse(['plano','X'.repeat(23),'Team']).success,false);
  const crew=state('crew');crew.getState().renameIdentity('plano','Forbidden','Forbidden');
  assert.notEqual(crew.getState().bots.find(b=>b.storeId==='plano')!.name,'FORBIDDEN');
  const named = league.getState().bots.find(b=>b.storeId==='plano')!.name;
  const team = league.getState().stores.find(s=>s.id==='plano')!.teamName;
  league.getState().renameBot('plano','Ghostbusters');
  assert.equal(league.getState().bots.find(b=>b.storeId==='plano')!.name, named);
  assert.match(league.getState().flash, /isn't allowed/);
  league.getState().renameIdentity('plano','Ecto','Plano Pit Crew');
  assert.equal(league.getState().bots.find(b=>b.storeId==='plano')!.name, named);
  league.getState().renameIdentity('plano','Steel Fang','Ghostbusters');
  assert.equal(league.getState().stores.find(s=>s.id==='plano')!.teamName, team);
  assert.match(league.getState().flash, /isn't allowed/);
});

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

const OCT31_LOCK = "2026-10-31T23:00:00.000Z";
const NOV27_LOCK = "2026-11-28T00:00:00.000Z";

function otherBrain(current: string | null) {
  return current === "brain-logic-stock" ? "brain-hunter-stock" : "brain-logic-stock";
}

function brainOf(store: ReturnType<typeof state>, storeId = "plano") {
  return store.getState().bots.find((b) => b.storeId === storeId)!.draft.brain;
}

test("automatic locks use 6:00 PM Central, including the CDT and CST offsets", () => {
  assert.equal(weekDeadline(1)!.at.toISOString(), OCT31_LOCK);
  assert.equal(weekDeadline(1)!.label, "Saturday, Oct 31, 6:00 PM CT");
  assert.equal(central(2026, 10, 31, 18).toISOString(), OCT31_LOCK);
  assert.equal(weekDeadline(5)!.at.toISOString(), NOV27_LOCK);
  assert.equal(weekDeadline(5)!.label, "Friday, Nov 27, 6:00 PM CT");
  assert.equal(central(2026, 11, 27, 18).toISOString(), NOV27_LOCK);
  assert.equal(deadlineDue(1, new Date("2026-10-31T22:59:59.999Z")), false);
  assert.equal(deadlineDue(1, new Date(OCT31_LOCK)), true);
  assert.equal(deadlineDue(5, new Date("2026-11-27T23:59:59.999Z")), false);
  assert.equal(deadlineDue(5, new Date(NOV27_LOCK)), true);
  for (const week of [2, 3, 4]) {
    assert.equal(weekDeadline(week), undefined);
    assert.equal(deadlineDue(week, new Date("2026-12-01T00:00:00.000Z")), false);
  }
});

test("week 1 and week 5 countdowns hit their deadlines; weeks 2–4 still count to Saturday 6:00 PM CT", () => {
  const opening = new Date("2026-10-25T17:00:00.000Z");
  assert.equal(nextLockAt(opening, 1).toISOString(), OCT31_LOCK);
  const afterOct31 = new Date("2026-10-31T23:00:01.000Z");
  assert.equal(nextLockAt(afterOct31, 1).toISOString(), OCT31_LOCK);
  assert.notEqual(nextLockAt(afterOct31).toISOString(), OCT31_LOCK);
  const championshipTuesday = new Date("2026-11-24T18:00:00.000Z");
  assert.equal(nextLockAt(championshipTuesday, 5).toISOString(), NOV27_LOCK);
  assert.equal(nextLockAt(new Date("2026-11-28T00:00:01.000Z"), 5).toISOString(), NOV27_LOCK);
  assert.equal(nextLockAt(championshipTuesday).toISOString(), central(2026, 11, 28, 18).toISOString());
  const weekTwo = new Date("2026-11-04T18:00:00.000Z");
  const saturday = central(2026, 11, 7, 18).toISOString();
  assert.equal(nextLockAt(weekTwo, 2).toISOString(), saturday);
  assert.equal(nextLockAt(weekTwo, 3).toISOString(), saturday);
  assert.equal(nextLockAt(weekTwo, 4).toISOString(), nextLockAt(weekTwo).toISOString());
});

test("captain build commands are rejected at the Oct 31 and Nov 27 instants and not before", (t) => {
  const beforeOct = new Date("2026-10-31T22:59:59.999Z");
  const atOct = new Date(OCT31_LOCK);
  const beforeNov = new Date("2026-11-27T23:59:59.999Z");
  const atNov = new Date(NOV27_LOCK);
  for (const name of CAPTAIN_BUILD_COMMANDS) {
    assert.equal(captainBuildRejection(name, "captain", 1, beforeOct), null);
    assert.match(captainBuildRejection(name, "captain", 1, atOct)!, /Oct 31/);
    assert.equal(captainBuildRejection(name, "commissioner", 1, atOct), null);
    assert.equal(captainBuildRejection(name, "captain", 5, beforeNov), null);
    assert.match(
      captainBuildRejection(name, "captain", 5, atNov, { data: makeData(), args: ["plano"] })!,
      /conference champions/,
    );
    assert.equal(captainBuildRejection(name, "commissioner", 5, atNov), null);
    assert.equal(captainBuildRejection(name, "captain", 2, atOct), null);
    assert.equal(captainBuildRejection(name, "captain", 4, atNov), null);
  }
  for (const name of ["completeJob", "submitSpark", "lockFriday", "runSaturday", "dropDamage", "advanceWeek"] as Command[]) {
    assert.equal(captainBuildRejection(name, "captain", 1, atOct), null);
    assert.equal(captainBuildRejection(name, "captain", 5, atNov), null);
  }
  t.mock.timers.setTime(beforeOct.getTime());
  const early = state();
  const lockedOut = state();
  const earlyBrain = brainOf(early);
  early.getState().setDraftPart("plano", "brain", otherBrain(earlyBrain));
  assert.equal(brainOf(early), otherBrain(earlyBrain));
  assert.equal(early.getState().phase, "open");
  t.mock.timers.setTime(atOct.getTime());
  const kept = brainOf(lockedOut);
  lockedOut.getState().setDraftPart("plano", "brain", otherBrain(kept));
  lockedOut.getState().setDraftLoadout("plano", { ...lockedOut.getState().bots.find((b) => b.storeId === "plano")!.draft, brain: otherBrain(kept) });
  lockedOut.getState().lockStore("plano");
  assert.equal(brainOf(lockedOut), kept);
  assert.equal(lockedOut.getState().bots.find((b) => b.storeId === "plano")!.locked, null);
  assert.match(lockedOut.getState().flash, /Oct 31/);
  assert.equal(lockedOut.getState().phase, "open");
  const desk = state("commissioner");
  const switched = otherBrain(brainOf(desk));
  desk.getState().setDraftPart("plano", "brain", switched);
  assert.equal(brainOf(desk), switched);
  assert.equal(desk.getState().phase, "open");
});

test("Oct 31 automatic lock freezes captains and still lets the Desk run, damage, and advance", (t) => {
  t.mock.timers.setTime(Date.parse("2026-10-31T22:59:59.999Z"));
  const store = state("commissioner");
  assert.equal(applyDueLock(store.getState(), new Date()), null);
  t.mock.timers.setTime(Date.parse(OCT31_LOCK));
  const due = applyDueLock(store.getState(), new Date());
  assert.ok(due);
  assert.equal(due!.phase, "locked");
  assert.equal(due!.weeks.find((w) => w.number === 1)!.lockedAt, Date.parse(OCT31_LOCK));
  assert.ok(due!.bots.every((b) => b.locked));
  const logLength = due!.log.length;
  store.setState({ phase: due!.phase, weeks: due!.weeks, bots: due!.bots, log: due!.log, flash: due!.flash });
  const cap = store.getState().crew.find((c) => c.storeId === "plano" && c.role === "captain")!;
  const frozenBrain = brainOf(store);
  store.setState({ session: { role: "captain", storeId: "plano", crewId: cap.id } });
  store.getState().setDraftPart("plano", "brain", otherBrain(frozenBrain));
  assert.equal(brainOf(store), frozenBrain);
  store.setState({ session: state("commissioner").getState().session });
  store.getState().lockFriday();
  assert.equal(store.getState().phase, "locked");
  assert.equal(store.getState().log.length, logLength);
  assert.equal(store.getState().weeks.find((w) => w.number === 1)!.lockedAt, Date.parse(OCT31_LOCK));
  assert.match(store.getState().flash, /Already locked/);
  for (const row of store.getState().stores) store.getState().setOfficialNsnu(row.id, 1100);
  store.getState().runSaturday();
  assert.equal(store.getState().phase, "fought");
  assert.equal(store.getState().bouts.filter((b) => b.week === 1 && b.kind === "bout").length, 7);
  store.getState().dropDamage();
  assert.equal(store.getState().phase, "inspected");
  store.getState().advanceWeek();
  assert.equal(store.getState().week, 2);
  assert.equal(store.getState().phase, "open");
  store.setState({ session: { role: "captain", storeId: "plano", crewId: cap.id } });
  const weekTwoBrain = brainOf(store);
  store.getState().setDraftPart("plano", "brain", otherBrain(weekTwoBrain));
  assert.equal(brainOf(store), otherBrain(weekTwoBrain));
});

test("week 5 title builds lock at Friday Nov 27 6:00 PM CT and the championship still runs", (t) => {
  const store = championshipState();
  const finalist = championshipFinalists(store.getState())[0]!;
  const cap = store.getState().crew.find((c) => c.storeId === finalist && c.role === "captain")!;
  store.setState({ session: { role: "captain", storeId: finalist, crewId: cap.id } });
  t.mock.timers.setTime(Date.parse("2026-11-27T23:59:59.999Z"));
  assert.equal(applyDueLock(store.getState(), new Date()), null);
  const before = brainOf(store, finalist);
  store.getState().setDraftPart(finalist, "brain", otherBrain(before));
  assert.equal(brainOf(store, finalist), otherBrain(before));
  t.mock.timers.setTime(Date.parse(NOV27_LOCK));
  const kept = brainOf(store, finalist);
  store.getState().setDraftPart(finalist, "brain", otherBrain(kept));
  assert.equal(brainOf(store, finalist), kept);
  assert.match(store.getState().flash, /Nov 27/);
  assert.equal(store.getState().phase, "open");
  store.setState({ session: state("commissioner").getState().session });
  const due = applyDueLock(store.getState(), new Date());
  assert.ok(due);
  assert.equal(due!.phase, "locked");
  assert.equal(due!.weeks.find((w) => w.number === 5)!.lockedAt, Date.parse(NOV27_LOCK));
  const finalists = championshipFinalists(due!);
  assert.ok(finalists.every((id) => due!.bots.find((b) => b.storeId === id)!.locked));
  assert.ok(due!.bots.filter((b) => !finalists.includes(b.storeId)).every((b) => b.locked == null));
  const logLength = due!.log.length;
  store.setState({ phase: due!.phase, weeks: due!.weeks, bots: due!.bots, log: due!.log, flash: due!.flash });
  store.setState({ session: { role: "captain", storeId: finalist, crewId: cap.id } });
  const frozen = brainOf(store, finalist);
  store.getState().setDraftPart(finalist, "brain", otherBrain(frozen));
  assert.equal(brainOf(store, finalist), frozen);
  store.setState({ session: state("commissioner").getState().session });
  store.getState().lockFriday();
  assert.equal(store.getState().log.length, logLength);
  assert.equal(store.getState().weeks.find((w) => w.number === 5)!.lockedAt, Date.parse(NOV27_LOCK));
  assert.match(store.getState().flash, /Already locked/);
  const finalistsNow = championshipFinalists(store.getState());
  const outsider = store.getState().stores.find((row) => !finalistsNow.includes(row.id))!;
  assert.match(
    captainBuildRejection("buyPart", "captain", 5, new Date(NOV27_LOCK), { data: store.getState(), args: [finalist] })!,
    /Nov 27/,
  );
  assert.match(
    captainBuildRejection("buyShow", "captain", 5, new Date(NOV27_LOCK), { data: store.getState(), args: [outsider.id] })!,
    /conference champions/,
  );
  assert.equal(
    captainBuildRejection("buyPart", "captain", 5, new Date("2026-11-27T23:59:59.999Z"), {
      data: store.getState(),
      args: [outsider.id],
    }),
    null,
  );
  store.getState().runSaturday();
  assert.equal(store.getState().phase, "fought");
  const championship = store.getState().bouts.find((bout) => bout.week === 5 && bout.title === "Waterman Championship");
  assert.ok(championship?.result);
  assert.equal(store.getState().bouts.some((bout) => bout.week === 5 && bout.result == null), false);
  store.getState().dropDamage();
  assert.equal(store.getState().phase, "inspected");
  store.getState().advanceWeek();
  assert.equal(store.getState().phase, "complete");
});

test("pressing Lock again does not add another log line once every eligible build is frozen", () => {
  for (const week of [2, 3, 4]) {
    const store = state("commissioner");
    store.setState({ week });
    store.getState().lockFriday();
    assert.equal(store.getState().phase, "locked");
    assert.equal(store.getState().log.filter((line) => line === `Week ${week} locked.`).length, 1);
    const log = store.getState().log;
    store.getState().lockFriday();
    assert.deepEqual(store.getState().log, log);
    assert.match(store.getState().flash, /Already locked/);
  }
});

test("buyShow is refused with the build lock, and a week-5 non-finalist is not told the builds locked", (t) => {
  const store = championshipState();
  const finalists = championshipFinalists(store.getState());
  const finalist = finalists[0]!;
  const outsider = store.getState().stores.find((row) => !finalists.includes(row.id))!;
  const outsiderCap = store.getState().crew.find((c) => c.storeId === outsider.id && c.role === "captain")!;
  const finalistCap = store.getState().crew.find((c) => c.storeId === finalist && c.role === "captain")!;
  t.mock.timers.setTime(Date.parse(NOV27_LOCK));
  store.setState({ session: { role: "captain", storeId: outsider.id, crewId: outsiderCap.id } });
  const outsiderShows = store.getState().bots.find((b) => b.storeId === outsider.id)!.shows ?? [];
  store.getState().buyShow(outsider.id, "fog");
  assert.match(store.getState().flash, /conference champions/);
  assert.deepEqual(store.getState().bots.find((b) => b.storeId === outsider.id)!.shows ?? [], outsiderShows);
  store.setState({ session: { role: "captain", storeId: finalist, crewId: finalistCap.id } });
  const finalistShows = store.getState().bots.find((b) => b.storeId === finalist)!.shows ?? [];
  store.getState().buyShow(finalist, "fog");
  assert.match(store.getState().flash, /Nov 27/);
  assert.deepEqual(store.getState().bots.find((b) => b.storeId === finalist)!.shows ?? [], finalistShows);
});

test("season load retries a bounded number of times and skips closed-week deadline work on an unchanged poll", () => {
  const source = readFileSync(new URL("../src/lib/pit/authoritative.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /else return load\(\)/);
  assert.match(source, /for \(let attempt = 0; attempt < 8; attempt\+\+\)/);
  assert.match(source, /deadlines: !closed/);
  assert.match(source, /doc::json->>'phase'/);
});

test("KO fixtures always contain a replay and particle budgets stay bounded", () => {
  const data = makeData();
  const result = simulateChampionshipDuel(data, "plano", "allen", "title");
  assert.equal(result.method, "ko");
  assert.ok(buildBeats(result).some((b) => b.kind === "replay"));
  const fx = new Fx();
  for (let i = 0; i < 1000; i++) fx.dust(0, 0, 1, 1);
  fx.step(1 / 60);
  assert.ok(fx.side.length <= 360 && fx.top.length <= 200);
});

function gradesWithGreens(greens: number, rest: Grade = "red"): GradeSet {
  const grades = {} as GradeSet;
  METRICS.forEach((metric, index) => {
    grades[metric.stat] = index < greens ? "green" : rest;
  });
  return grades;
}

function jarSum(coins: Record<KeyName, number>) {
  return Object.values(coins).reduce((sum, n) => sum + n, 0);
}

test("pair bonus is one coin per green after the first and a sweep pays 23", () => {
  assert.deepEqual(GRADE_COINS, { green: 3, blue: 2, orange: 1, red: 0 });
  const cases = [
    { greens: 0, bonus: 0, total: 0 },
    { greens: 1, bonus: 0, total: 3 },
    { greens: 2, bonus: 1, total: 7 },
    { greens: 3, bonus: 2, total: 11 },
    { greens: 6, bonus: 5, total: 23 },
  ];
  for (const row of cases) {
    const grades = gradesWithGreens(row.greens);
    const math = coinMath(grades);
    assert.equal(math.greens, row.greens, `${row.greens} greens`);
    assert.equal(math.bonus, row.bonus, `${row.greens} greens bonus`);
    assert.equal(math.total, row.total, `${row.greens} greens total`);
    for (const metric of METRICS) {
      assert.equal(math.bySlot[metric.slot], GRADE_COINS[grades[metric.stat]]);
    }
    const jars = coinsByJar(grades);
    assert.equal(jarSum(jars), math.total);
    METRICS.forEach((metric, index) => {
      const extra = index > 0 && index < row.greens ? 1 : 0;
      assert.equal(jars[metric.slot], math.bySlot[metric.slot] + extra);
    });
  }
  const late = Object.fromEntries(
    METRICS.map((metric) => [metric.stat, metric.stat === "arch" || metric.stat === "ticket" ? "green" : "red"]),
  ) as GradeSet;
  const lateMath = coinMath(late);
  assert.equal(lateMath.greens, 2);
  assert.equal(lateMath.bonus, 1);
  assert.equal(lateMath.total, 7);
  assert.equal(lateMath.bySlot.utility, 3);
  assert.equal(lateMath.bySlot.brain, 3);
  const lateJars = coinsByJar(late);
  assert.equal(lateJars.utility, 3);
  assert.equal(lateJars.brain, 4);
  assert.equal(jarSum(lateJars), 7);
});

test("kickoff and Monday payouts deposit the pair bonus, and a kickoff re-run pays the difference", () => {
  const store = state("commissioner", false);
  const paintKickoff = (storeId: string, grades: GradeSet) => {
    for (const metric of METRICS) store.getState().setKickoffGrade(storeId, metric.stat, grades[metric.stat]);
  };
  for (const row of store.getState().stores) paintKickoff(row.id, gradesWithGreens(0));
  paintKickoff("plano", gradesWithGreens(6));
  paintKickoff("allen", gradesWithGreens(2));
  store.getState().applyKickoff();

  const coinsOf = (id: string) => store.getState().bots.find((bot) => bot.storeId === id)!.coins;
  assert.deepEqual(coinsOf("plano"), coinsByJar(gradesWithGreens(6)));
  assert.equal(jarSum(coinsOf("plano")), 23);
  assert.deepEqual(coinsOf("allen"), coinsByJar(gradesWithGreens(2)));
  assert.equal(jarSum(coinsOf("allen")), 7);
  for (const row of store.getState().stores) {
    if (row.id === "plano" || row.id === "allen") continue;
    assert.equal(jarSum(coinsOf(row.id)), 0, row.id);
  }

  const spent = { ...coinsOf("plano"), chassis: coinsOf("plano").chassis - 1 };
  store.setState({
    bots: store.getState().bots.map((bot) => (bot.storeId === "plano" ? { ...bot, coins: spent } : bot)),
  });
  store.getState().applyKickoff();
  assert.deepEqual(coinsOf("plano"), spent);
  assert.deepEqual(coinsOf("allen"), coinsByJar(gradesWithGreens(2)));

  store.getState().setKickoffGrade("plano", "ticket", "blue");
  store.getState().applyKickoff();
  const fiveGreens = gradesWithGreens(6);
  fiveGreens.ticket = "blue";
  const afterBlue = {
    ...coinsByJar(fiveGreens),
    chassis: coinsByJar(fiveGreens).chassis - 1,
  };
  assert.deepEqual(coinsOf("plano"), afterBlue);
  assert.equal(jarSum(coinsOf("plano")), 20);
  assert.deepEqual(coinsOf("allen"), coinsByJar(gradesWithGreens(2)));
  store.getState().applyKickoff();
  assert.deepEqual(coinsOf("plano"), afterBlue);

  store.getState().setKickoffGrade("plano", "nsnu", "red");
  store.getState().applyKickoff();
  const shifted = { ...fiveGreens, nsnu: "red" as const };
  const owed = coinsByJar(shifted);
  assert.equal(coinMath(shifted).total, 17);
  assert.equal(coinMath(shifted).bonus, 3);
  assert.deepEqual(coinsOf("plano"), owed);
  assert.equal(jarSum(coinsOf("plano")), 17);
  const held = { ...coinsOf("plano") };
  store.getState().applyKickoff();
  assert.deepEqual(coinsOf("plano"), held);
  assert.deepEqual(store.getState().kickoff.paid.plano, owed);

  const monday = state("commissioner", false);
  for (const row of monday.getState().stores) {
    for (const metric of METRICS) monday.getState().setGrade(row.id, metric.stat, "red");
  }
  for (const metric of METRICS) monday.getState().setGrade("plano", metric.stat, gradesWithGreens(3)[metric.stat]);
  monday.setState({ phase: "inspected" });
  monday.getState().advanceWeek();
  const mondayCoins = (id: string) => monday.getState().bots.find((bot) => bot.storeId === id)!.coins;
  assert.equal(monday.getState().week, 2);
  assert.deepEqual(mondayCoins("plano"), coinsByJar(gradesWithGreens(3)));
  assert.equal(jarSum(mondayCoins("plano")), 11);
  for (const row of monday.getState().stores) {
    if (row.id === "plano") continue;
    assert.equal(jarSum(mondayCoins(row.id)), 0, row.id);
  }
});

const STATS = ["nsnu", "conv", "demoRate", "demoClose", "arch", "ticket"] as const satisfies readonly StatKey[];

function planoCoins(store: ReturnType<typeof state>) {
  return JSON.stringify(store.getState().bots.find((bot) => bot.storeId === "plano")!.coins);
}

test("projected scorecards do not unlock grade cosmetics", () => {
  const store = state();
  gradeCards(store, [1, 2, 3], "all");
  const progress = (id: string) => cosmeticProgress(store.getState(), "plano").find((row) => row.reward.id === id)!;
  assert.equal(progress("reward-led-nsnu").current, 3);
  assert.equal(progress("reward-led-nsnu").earned, true);
  assert.equal(progress("reward-foil").current, 3);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "leds", "nsnu"), true);
  store.setState({
    storeCards: store.getState().storeCards.map((card) => (card.storeId === "plano" ? { ...card, projected: true } : card)),
  });
  assert.equal(progress("reward-led-nsnu").current, 0);
  assert.equal(progress("reward-led-nsnu").earned, false);
  assert.equal(progress("reward-foil").current, 0);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "leds", "nsnu"), false);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "decal", "gear"), false);
});

function gradeCards(store: ReturnType<typeof state>, weeks: number[], green: StatKey | StatKey[] | "all") {
  const sample = store.getState().storeCards.find((card) => card.storeId === "plano");
  assert.ok(sample);
  const on = green === "all" ? new Set<StatKey>(STATS) : new Set<StatKey>(Array.isArray(green) ? green : [green]);
  const grades = Object.fromEntries(STATS.map((stat) => [stat, on.has(stat) ? "green" : "red"])) as StoreCard["grades"];
  const others = store.getState().storeCards.filter((card) => card.storeId !== "plano");
  const mine = weeks.map((week) => ({ ...sample, id: `plano-w${week}-test`, week, grades, projected: false }));
  store.setState({ storeCards: [...others, ...mine] });
}

function fightResult(winner: string, loser: string, method: FightResult["method"]): FightResult {
  const bye = method === "bye";
  return {
    winnerIds: [winner],
    loserIds: bye ? [] : [loser],
    method,
    blowout: false,
    exchanges: [],
    finisher: null,
    hp: {},
    fighters: [],
    wear: {},
    seed: `${method}:${winner}`,
  };
}

function bout(id: string, week: number, slot: number, winner: string, loser: string, method: FightResult["method"]): Bout {
  const bye = method === "bye";
  return {
    id,
    week,
    slot,
    kind: bye ? "bye" : "bout",
    title: id,
    storeIds: bye ? [winner] : [winner, loser],
    teamA: [winner],
    teamB: bye ? [] : [loser],
    result: fightResult(winner, loser, method),
  };
}

function grantApprovedJobs(store: ReturnType<typeof state>, count: number) {
  store.setState({
    jobLog: Array.from({ length: count }, (_, index) => ({
      id: `bolt-${index}`,
      week: 1,
      jobId: `bolt-job-${index}`,
      storeId: "plano",
      crewId: "plano-captain",
      crewName: "Captain",
      note: "Bolts for the locker",
      status: "approved" as const,
      at: index + 1,
    })),
  });
}

function markTuned(store: ReturnType<typeof state>, week: number) {
  const data = store.getState();
  const plan = programWeek(week);
  assert.ok(plan);
  const specialists = data.crew.filter((crew) => crew.storeId === "plano" && crew.role === "specialist");
  const captain = data.crew.find((crew) => crew.storeId === "plano" && crew.role === "captain");
  assert.ok(captain);
  const jobs = allJobs(plan).flatMap((job) =>
    specialists.map((crew) => ({
      id: `${week}:${job.id}:${crew.id}`,
      week,
      jobId: job.id,
      storeId: "plano",
      crewId: crew.id,
      crewName: crew.name,
      note: "Tuned",
      status: "approved" as const,
      at: week,
    })),
  );
  jobs.push({
    id: `${week}:${plan.care.id}:${captain.id}`,
    week,
    jobId: plan.care.id,
    storeId: "plano",
    crewId: captain.id,
    crewName: captain.name,
    note: "CARE",
    status: "approved",
    at: week,
  });
  const sparks = plan.days.flatMap((day) =>
    specialists.map((crew) => ({
      id: `${week}:${day.day}:${crew.id}`,
      week,
      day: day.day,
      storeId: "plano",
      crewId: crew.id,
      correct: 0,
      total: 3,
      at: week,
    })),
  );
  store.setState({ jobLog: [...data.jobLog, ...jobs], sparkLog: [...data.sparkLog, ...sparks] });
}

test("old saves default the new cosmetic fields and drop a banner the filter rejects", () => {
  const legacy = styleOf({ style: { decal: "flames" } });
  assert.equal(legacy.leds, "none");
  assert.equal(legacy.smoke, "");
  assert.equal(legacy.banner, "");
  assert.equal(styleOf({ style: { banner: "fuck" } }).banner, "");
  assert.equal(styleOf({ style: { banner: "  PIT   NIGHT  " } }).banner, "PIT NIGHT");
  const store = state();
  store.setState({
    bots: store.getState().bots.map((bot) =>
      bot.storeId === "plano" ? { ...bot, style: { ...styleOf(bot), banner: "fuck" } } : bot,
    ),
  });
  const before = planoCoins(store);
  store.getState().setStyle("plano", { trim: "white" });
  const bot = store.getState().bots.find((row) => row.storeId === "plano")!;
  assert.equal(bot.style?.trim, "white");
  assert.equal(bot.style?.banner, "");
  assert.equal(planoCoins(store), before);
});

test("new sticker art stays in the four slots and foil is a suffix, not a fifth slot", () => {
  for (const row of DECALS) commandArgs.setSticker.parse(["plano", "hood", row.id]);
  assert.equal(commandArgs.setSticker.safeParse(["plano", "left", "nike"]).success, false);
  assert.equal(commandArgs.setSticker.safeParse(["plano", "left", "roundel-foil"]).success, true);
  for (const id of STICKER_ART) {
    const foil = DECALS.some((row) => row.id === `${id}-foil`);
    assert.equal(foil, id !== "none");
  }
  const store = state();
  gradeCards(store, [1], []);
  const before = structuredClone(store.getState().bots.find((bot) => bot.storeId === "plano")!);
  const fightBefore = simulateDuel(store.getState(), "plano", "allen", "roundel").exchanges;
  store.getState().setSticker("plano", "left", "roundel");
  const after = store.getState().bots.find((bot) => bot.storeId === "plano")!;
  assert.equal(after.style?.stickers?.left, "roundel");
  assert.equal(after.style?.stickers?.right, "none");
  assert.deepEqual({ ...after, style: before.style }, before);
  assert.deepEqual(simulateDuel(store.getState(), "plano", "allen", "roundel").exchanges, fightBefore);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "decal", "gear"), false);
  store.getState().setSticker("plano", "hood", "gear");
  assert.equal(store.getState().bots.find((bot) => bot.storeId === "plano")!.style?.stickers?.hood, "none");
});

test("metric stickers, LEDs and foil follow green grades without spending part coins", () => {
  const store = state();
  const before = planoCoins(store);
  gradeCards(store, [1], "nsnu");
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "decal", "gear"), true);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "decal", "gearhead"), true);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "decal", "turbo"), false);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "decal", "archlabs"), false);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "leds", "nsnu"), false);
  gradeCards(store, [1], "conv");
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "decal", "plate"), true);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "decal", "brace"), true);
  gradeCards(store, [1], "demoRate");
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "decal", "fuel"), true);
  gradeCards(store, [1], "demoClose");
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "decal", "bullseye"), true);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "decal", "tonic"), true);
  gradeCards(store, [1], "arch");
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "decal", "archlabs"), true);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "decal", "turbo"), false);
  gradeCards(store, [1], "ticket");
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "decal", "turbo"), true);
  gradeCards(store, [1, 2, 5], "nsnu");
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "leds", "nsnu"), false);
  gradeCards(store, [1, 2, 3], "ticket");
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "leds", "ticket"), true);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "leds", "arch"), false);
  gradeCards(store, [1, 2, 3], "all");
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "decal", "roundel-foil"), true);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "decal", "gear-foil"), true);
  store.getState().setStyle("plano", { leds: "ticket", stickers: { left: "turbo-foil", right: "none", hood: "none", rear: "none" } });
  const bot = store.getState().bots.find((row) => row.storeId === "plano")!;
  assert.equal(bot.style?.leds, "ticket");
  assert.equal(bot.style?.stickers?.left, "turbo-foil");
  assert.equal(planoCoins(store), before);
  assert.equal(bot.repairSpent, 0);
});

test("foil, holographic finish and locker smoke spend Bolts and leave part coins alone", () => {
  const foil = state();
  gradeCards(foil, [1], []);
  const foilCoins = planoCoins(foil);
  grantApprovedJobs(foil, 2);
  assert.equal(boltsOf(foil.getState(), "plano").balance, 4);
  foil.getState().buyLocker("plano", "sticker-foil");
  assert.equal(boltsOf(foil.getState(), "plano").spent, 4);
  assert.equal(cosmeticUnlocked(foil.getState(), "plano", "decal", "roundel-foil"), true);
  assert.equal(cosmeticUnlocked(foil.getState(), "plano", "decal", "gear-foil"), false);
  assert.equal(cosmeticProgress(foil.getState(), "plano").find((row) => row.reward.id === "reward-foil")?.earned, true);
  foil.getState().setSticker("plano", "rear", "roundel-foil");
  assert.equal(foil.getState().bots.find((bot) => bot.storeId === "plano")!.style?.stickers?.rear, "roundel-foil");
  assert.equal(planoCoins(foil), foilCoins);

  const smoke = state();
  const smokeCoins = planoCoins(smoke);
  grantApprovedJobs(smoke, 5);
  assert.equal(boltsOf(smoke.getState(), "plano").balance, 10);
  smoke.getState().buyLocker("plano", "smoke-neon");
  smoke.getState().buyLocker("plano", "smoke-black");
  assert.equal(lockerItem("smoke-black"), undefined);
  assert.equal(cosmeticUnlocked(smoke.getState(), "plano", "smoke", "neon"), true);
  assert.equal(cosmeticUnlocked(smoke.getState(), "plano", "smoke", "candy"), false);
  assert.equal(cosmeticUnlocked(smoke.getState(), "plano", "smoke", "black"), false);
  smoke.getState().setStyle("plano", { smoke: "neon" });
  assert.equal(smoke.getState().bots.find((bot) => bot.storeId === "plano")!.style?.smoke, "neon");
  assert.equal(planoCoins(smoke), smokeCoins);
  assert.equal(boltsOf(smoke.getState(), "plano").spent, 10);

  const holo = state();
  const holoCoins = planoCoins(holo);
  grantApprovedJobs(holo, 7);
  assert.equal(boltsOf(holo.getState(), "plano").balance, 14);
  assert.equal(cosmeticUnlocked(holo.getState(), "plano", "finish", "holographic"), false);
  holo.getState().buyLocker("plano", "finish-holographic");
  assert.equal(cosmeticUnlocked(holo.getState(), "plano", "finish", "holographic"), true);
  holo.getState().setStyle("plano", { finish: "holographic" });
  assert.equal(holo.getState().bots.find((bot) => bot.storeId === "plano")!.style?.finish, "holographic");
  assert.equal(planoCoins(holo), holoCoins);
});

test("three Full Tune-Ups unlock the holographic finish without a Bolt purchase", () => {
  const store = state();
  store.setState({ week: 3 });
  markTuned(store, 1);
  markTuned(store, 2);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "finish", "holographic"), false);
  markTuned(store, 3);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "finish", "holographic"), true);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "topper", "dish"), false);
  const before = planoCoins(store);
  store.getState().setStyle("plano", { finish: "holographic" });
  assert.equal(store.getState().bots.find((bot) => bot.storeId === "plano")!.style?.finish, "holographic");
  assert.equal(planoCoins(store), before);
});

test("a voucher repair or emergency weld unlocks the wrench and does not spend part coins", () => {
  const store = state();
  const bot = store.getState().bots.find((row) => row.storeId === "plano")!;
  store.setState({
    bots: store.getState().bots.map((row) =>
      row.storeId === "plano"
        ? {
            ...row,
            voucher: 2,
            repairSpent: 0,
            coins: { chassis: 0, drive: 0, weapon: 0, armor: 0, utility: 0, brain: 0 },
            partWear: { ...row.partWear, [row.equipped.weapon]: "scratched", [row.equipped.armor]: "disabled" },
          }
        : row,
    ),
  });
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "decal", "wrench"), false);
  store.getState().repairSlot("plano", "weapon", "salvage");
  assert.equal(store.getState().bots.find((row) => row.storeId === "plano")!.services ?? 0, 0);
  store.getState().repairSlot("plano", "weapon", "full");
  let next = store.getState().bots.find((row) => row.storeId === "plano")!;
  assert.equal(next.services, 1);
  assert.equal(next.repairSpent, 0);
  assert.equal(next.voucher, 1);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "decal", "wrench"), true);
  store.getState().repairSlot("plano", "armor", "weld");
  next = store.getState().bots.find((row) => row.storeId === "plano")!;
  assert.equal(next.services, 2);
  assert.equal(next.repairSpent, 0);
  assert.equal(next.voucher, 0);
  assert.deepEqual(next.coins, { chassis: 0, drive: 0, weapon: 0, armor: 0, utility: 0, brain: 0 });
  assert.equal(bot.owned.length, next.owned.length);

  const legacy = state();
  legacy.setState({
    bots: legacy.getState().bots.map((row) => (row.storeId === "plano" ? { ...row, repairSpent: 1, services: 0 } : row)),
  });
  assert.equal(cosmeticUnlocked(legacy.getState(), "plano", "decal", "wrench"), true);
  legacy.setState({
    bots: legacy.getState().bots.map((row) =>
      row.storeId === "plano" ? { ...row, repairSpent: 0, services: 0, weldForWeek: { weapon: 1 } } : row,
    ),
  });
  assert.equal(cosmeticUnlocked(legacy.getState(), "plano", "decal", "wrench"), true);
});

test("knockouts, win streaks, perfect Sparks and pick streaks unlock toppers, skull and black smoke", () => {
  const store = state();
  const before = planoCoins(store);
  store.setState({
    bouts: [
      bout("w1", 1, 0, "plano", "allen", "decision"),
      bout("w2", 2, 0, "plano", "allen", "decision"),
      bout("scrim", 2, 1, "plano", "allen", "scrimmage"),
    ],
  });
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "banner", "PIT NIGHT"), true);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "decal", "skull"), false);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "smoke", "black"), false);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "topper", "beacon"), false);
  store.setState({ bouts: [...store.getState().bouts, bout("w3", 3, 0, "plano", "allen", "ko")] });
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "decal", "skull"), true);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "smoke", "black"), true);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "topper", "beacon"), true);
  store.setState({ bouts: [bout("late", 5, 0, "plano", "allen", "ko")] });
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "decal", "skull"), false);
  store.setState({
    bouts: [
      bout("a", 1, 0, "plano", "allen", "decision"),
      bout("b", 1, 1, "allen", "plano", "decision"),
      bout("c", 2, 0, "plano", "allen", "decision"),
    ],
  });
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "topper", "beacon"), false);

  store.setState({
    sparkLog: [1, 2, 3].map((index) => ({
      id: `spark-${index}`,
      week: 1,
      day: "tue",
      storeId: "plano",
      crewId: `crew-${index}`,
      correct: 3,
      total: 3,
      at: index,
    })),
  });
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "topper", "dish"), true);

  const won = bout("pick-win", 1, 0, "allen", "waco", "decision");
  const lost = bout("pick-loss", 1, 1, "waco", "allen", "decision");
  const open = { ...bout("pick-open", 1, 2, "allen", "waco", "decision"), result: null };
  store.setState({
    bouts: [won, lost, open],
    picks: [
      { id: "p1", week: 1, boutId: won.id, storeId: "plano", crewId: "a", pick: "allen", at: 1 },
      { id: "p2", week: 1, boutId: lost.id, storeId: "plano", crewId: "a", pick: "allen", at: 2 },
      { id: "p3", week: 1, boutId: open.id, storeId: "plano", crewId: "a", pick: "allen", at: 3 },
      { id: "p4", week: 1, boutId: won.id, storeId: "plano", crewId: "b", pick: "allen", at: 4 },
      { id: "p5", week: 1, boutId: won.id, storeId: "plano", crewId: "c", pick: "allen", at: 5 },
    ],
  });
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "decal", "optics"), true);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "topper", "horns"), true);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "topper", "flagpole"), false);
  store.setState({
    picks: [
      ...store.getState().picks,
      { id: "p6", week: 1, boutId: won.id, storeId: "plano", crewId: "d", pick: "allen", at: 6 },
    ],
  });
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "topper", "flagpole"), true);
  store.getState().setStyle("plano", { topper: "flagpole", smoke: "black", banner: "PIT NIGHT" });
  const dressed = store.getState().bots.find((row) => row.storeId === "plano")!;
  assert.equal(dressed.style?.topper, "none");
  assert.equal(dressed.style?.smoke ?? "", "");
  store.setState({ bouts: [bout("banner-win", 1, 0, "plano", "allen", "ko"), won, lost, open] });
  store.getState().setStyle("plano", { topper: "flagpole", smoke: "black", banner: "PIT NIGHT" });
  const unlocked = store.getState().bots.find((row) => row.storeId === "plano")!;
  assert.equal(unlocked.style?.topper, "flagpole");
  assert.equal(unlocked.style?.smoke, "black");
  assert.equal(unlocked.style?.banner, "PIT NIGHT");
  assert.equal(planoCoins(store), before);
});

test("the pit banner stays locked until a win and rejects profanity and trademarks", () => {
  const store = state();
  const before = planoCoins(store);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "banner", ""), true);
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "banner", "PIT NIGHT"), false);
  store.getState().setStyle("plano", { banner: "PIT NIGHT" });
  assert.equal(store.getState().bots.find((bot) => bot.storeId === "plano")!.style?.banner ?? "", "");
  store.setState({ bouts: [bout("scrim", 1, 0, "plano", "allen", "scrimmage")] });
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "banner", "PIT NIGHT"), false);
  store.setState({ bouts: [bout("bye", 1, 0, "plano", "allen", "bye")] });
  assert.equal(cosmeticUnlocked(store.getState(), "plano", "banner", "PIT NIGHT"), true);
  store.getState().setStyle("plano", { banner: "PIT NIGHT" });
  assert.equal(store.getState().bots.find((bot) => bot.storeId === "plano")!.style?.banner, "PIT NIGHT");
  for (const bad of ["fuck", "f.u.c.k", "Snap-on", "1234567890123"]) {
    assert.equal(bannerVerdict(bad).ok, false);
    store.getState().setStyle("plano", { banner: bad });
    assert.equal(store.getState().bots.find((bot) => bot.storeId === "plano")!.style?.banner, "PIT NIGHT");
  }
  const look = {
    paint: "amber",
    look: "plain" as const,
    number: "1",
    style: { ...styleOf(store.getState().bots.find((bot) => bot.storeId === "plano")), banner: "fuck" },
  };
  assert.equal(checkedCosmeticLoadout(store.getState(), "plano", look)?.style.banner, "");
  assert.equal(commandArgs.proposeCosmetic.safeParse(["plano", { ...look, style: { ...look.style, banner: "x".repeat(13) } }]).success, false);
  assert.equal(planoCoins(store), before);});

test("free heart topper can be equipped with a previously equipped locked cosmetic", () => {
 const league=state();
 league.setState({ bots: league.getState().bots.map(b=>b.storeId==='plano'?{...b,style:{...styleOf(b),eye:'blue'}}:b) });
 league.getState().setStyle('plano',{topper:'janelle-purple'});
 assert.equal(league.getState().bots.find(b=>b.storeId==='plano')!.style?.topper,'janelle-purple');
 league.getState().setStyle('plano',{topper:'crown'});
 assert.equal(league.getState().bots.find(b=>b.storeId==='plano')!.style?.topper,'janelle-purple');
});

test("every store can equip every free Team Janelle color", () => {
 const league=state('commissioner');
 league.setState({bots:league.getState().bots.map(b=>({...b,style:styleOf(b)}))});
 for(const row of league.getState().stores) {
  for(const color of ['pink','red','purple','blue','teal','gold'] as const) {
   const topper=`janelle-${color}` as const;
   assert.equal(commandArgs.setStyle.safeParse([row.id,{topper}]).success,true);
   league.getState().setStyle(row.id,{topper});
   assert.equal(league.getState().bots.find(b=>b.storeId===row.id)!.style?.topper,topper,row.id);
  }
 }
});
