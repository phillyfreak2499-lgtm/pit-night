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
