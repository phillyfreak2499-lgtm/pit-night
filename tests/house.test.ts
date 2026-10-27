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
