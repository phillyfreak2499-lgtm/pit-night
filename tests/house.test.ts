/** Home-screen house fights: random builds and looks, repeatable per seed, never championship iron. */
import test from "node:test";
import assert from "node:assert/strict";
import { randomHouseTape } from "../src/lib/pit/engine.ts";
import { partById } from "../src/lib/pit/catalog.ts";

test("a seed always draws the same fight; different seeds draw different bots", () => {
  const a = randomHouseTape(42).result!;
  const b = randomHouseTape(42).result!;
  assert.deepEqual(a, b);
  assert.equal(a.fighters.length, 2);
  assert.ok(a.exchanges.length > 0);

  const looks = new Set<string>();
  for (let seed = 1; seed <= 30; seed++) {
    for (const f of randomHouseTape(seed).result!.fighters)
      looks.add(JSON.stringify([f.classId, f.weaponName, f.driveName, f.armorName, f.chassisName, f.paint, f.style?.finish, f.style?.topper]));
  }
  assert.ok(looks.size > 40, `expected variety, got ${looks.size} distinct bots`);
});

test("random house bots carry real cosmetics and buyable parts only", () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (const f of randomHouseTape(seed).result!.fighters) {
      assert.ok(f.style?.body && f.style.finish && f.style.stickers, "every bot is decorated");
      assert.notEqual(f.style!.finish, "gold", "Champion Gold stays the champion's");
      for (const name of [f.weaponName, f.driveName, f.armorName, f.chassisName]) assert.doesNotMatch(name, /championship/i);
    }
  }
  assert.ok(partById("weapon-saw-sport"));
});

test("fight streaks count consecutive wins or losses, newest first", async () => {
  const { createStore } = await import("zustand/vanilla");
  const { pitCreator } = await import("../src/lib/pit/store.ts");
  const { fightStreak } = await import("../src/lib/pit/engine.ts");
  const store = createStore(pitCreator);
  store.setState({ session: { role: "commissioner", storeId: null, crewId: null } });
  const s = store.getState();
  for (const st of s.stores) for (const m of ["nsnu", "conv", "demoRate", "demoClose", "arch", "ticket"] as const) s.setKickoffGrade(st.id, m, "blue");
  store.getState().applyKickoff();
  assert.equal(fightStreak(store.getState(), "plano"), null, "no fights yet");
  for (const st of store.getState().stores) store.getState().setOfficialNsnu(st.id, 950);
  store.getState().lockFriday();
  store.getState().runSaturday();
  const data = store.getState();
  const bout = data.bouts.find((b) => b.week === 1 && b.kind === "bout")!;
  const [w] = bout.result!.winnerIds;
  const [l] = bout.result!.loserIds;
  assert.deepEqual(fightStreak(data, w!), { kind: "W", n: 1 });
  assert.deepEqual(fightStreak(data, l!), { kind: "L", n: 1 });
  // A second straight win extends the run.
  const extra = { ...bout, id: "w2-extra", week: 2 };
  assert.deepEqual(fightStreak({ ...data, bouts: [...data.bouts, extra] }, w!), { kind: "W", n: 2 });
});

test("hits sound like the weapon that landed them", async () => {
  const { hitVoice } = await import("../src/lib/pit/sound.ts");
  assert.equal(hitVoice("saw"), "whine");
  assert.equal(hitVoice("disc"), "whine");
  assert.equal(hitVoice("hammer"), "clang");
  assert.equal(hitVoice("axe"), "chop");
  assert.equal(hitVoice("wedge"), "scrape");
  assert.equal(hitVoice("claw"), "crunch");
  assert.equal(hitVoice("flame"), "whoosh");
  assert.equal(hitVoice("tesla"), "zap");
  assert.equal(hitVoice("flail"), "thud");
  assert.equal(hitVoice("launcher"), "boom");
  assert.equal(hitVoice("mystery"), "punch");
});

test("Playground fights any two builds, respects the rounds, and allows every part", async () => {
  const { playgroundTape } = await import("../src/lib/pit/engine.ts");
  const { PARTS, stockPart } = await import("../src/lib/pit/catalog.ts");
  const build = (classId: "striker" | "tank" | "specialist", weapon: string) => ({
    name: classId.toUpperCase(),
    classId,
    loadout: { chassis: stockPart("chassis", classId).id, drive: stockPart("drive", classId).id, weapon, armor: stockPart("armor", classId).id, utility: null, brain: stockPart("brain", classId).id },
    style: { finish: "chrome" as const, decal: "none" as const, trim: "steel", eye: "green", flag: false },
    paint: "amber",
    look: "plain" as const,
    number: "7",
    week: "blue" as const,
  });
  const champ = PARTS.find((p) => p.slot === "weapon" && p.tier === "championship")!;
  const axe = PARTS.find((p) => p.id === "weapon-axe-super")!;
  const pair: [ReturnType<typeof build>, ReturnType<typeof build>] = [build("striker", champ.id), build("tank", axe.id)];
  for (const rounds of [1, 5, 10]) {
    const r = playgroundTape(pair, rounds, "t").result!;
    assert.ok(r.exchanges.length <= rounds + 1, `${rounds} rounds ran ${r.exchanges.length} exchanges`);
    assert.equal(r.fighters.length, 2);
  }
  const ko = playgroundTape(pair, "ko", "t").result!;
  assert.equal(ko.method, "ko", "until knockout always ends in a knockout");
  assert.equal(ko.fighters[0]!.weaponName, champ.name, "championship iron is unlocked here");
  assert.equal(ko.fighters[1]!.weaponName, axe.name);
  assert.deepEqual(ko.wear, {}, "Playground fights never damage anything");
});

test("each week has its arena, and hazard hits are recorded per bot with arena names", async () => {
  const { arenaForWeek, hazardCallout } = await import("../src/components/pit/arena-scenes.ts");
  assert.deepEqual([1, 2, 3, 4, 5].map(arenaForWeek), ["pit", "ring", "warehouse", "junkyard", "grand"]);
  assert.deepEqual(hazardCallout("ring", "water", 0), { text: "OIL SLICK: SLOWED", hit: true });
  assert.deepEqual(hazardCallout("junkyard", "pit", 7), { text: "THE CRUSHER -7", hit: true });
  assert.equal(hazardCallout("grand", "hover", 0)!.hit, false, "a dodge is not a hit");

  // A Hunter brain charges into the saws; the mark names the bot that took it.
  const { playgroundTape } = await import("../src/lib/pit/engine.ts");
  const { stockPart, PARTS } = await import("../src/lib/pit/catalog.ts");
  const hunter = PARTS.find((p) => p.slot === "brain" && p.family === "hunter")!;
  const build = (brain: string) => ({
    name: "B",
    classId: "striker" as const,
    loadout: { chassis: stockPart("chassis", "striker").id, drive: stockPart("drive", "striker").id, weapon: stockPart("weapon", "striker").id, armor: stockPart("armor", "striker").id, utility: null, brain },
    style: { finish: "factory" as const, decal: "none" as const, trim: "steel", eye: "green", flag: false },
    paint: "amber",
    look: "plain" as const,
    number: "1",
    week: "blue" as const,
  });
  const r = playgroundTape([build(hunter.id), build(stockPart("brain", "striker").id)], 3, "h").result!;
  const marks = r.exchanges.flatMap((e) => e.tags.filter((t) => t.startsWith("haz:")));
  assert.ok(marks.some((m) => m.startsWith(`haz:${r.fighters[0]!.id}:saw:`)), `hunter hit a saw: ${marks.join(", ")}`);
});
