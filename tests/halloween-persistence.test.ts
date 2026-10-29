import test from "node:test";
import assert from "node:assert/strict";
import { makeData } from "../src/lib/pit/seed.ts";
import { applyLeague14, clientDoc, sharedDoc } from "../src/lib/pit/store.ts";
import type { PitData, Session } from "../src/lib/pit/types.ts";

// Persistence treats records as opaque JSON; this also catches accidental leakage
// of fields added to the private record in a later version.
const privateRecords = [
  { storeId: "rockwall", date: "2026-10-29", answer: [2], privateMarker: "arcade-private" },
];
const records = (data: unknown) => (data as { halloweenArcade?: unknown[] }).halloweenArcade;

test("an older season gains an empty arcade ledger without resetting coins or unlocks", () => {
  const data = makeData();
  data.bots[0]!.coins.weapon = 17;
  data.stores[0]!.unlocks = ["finish-holographic"];
  delete (data as Partial<PitData> & { halloweenArcade?: unknown[] }).halloweenArcade;
  const normalized = applyLeague14(data);
  assert.deepEqual(records(normalized), []);
  assert.equal(normalized.bots[0]!.coins.weapon, 17);
  assert.deepEqual(normalized.stores[0]!.unlocks, ["finish-holographic"]);
});

test("shared serialization and season normalization retain private game records", () => {
  const data = { ...makeData(), halloweenArcade: privateRecords } as unknown as PitData;
  const saved = JSON.parse(JSON.stringify(sharedDoc(data)));
  assert.deepEqual(records(saved), privateRecords);
  assert.deepEqual(records(applyLeague14(saved)), privateRecords);
});

test("no client projection leaks private game records in any league phase or role", () => {
  const data = { ...makeData(), halloweenArcade: privateRecords } as unknown as PitData;
  const sessions: Session[] = [
    { role: "public", storeId: null, crewId: null },
    { role: "crew", storeId: "rockwall", crewId: "crew" },
    { role: "captain", storeId: "rockwall", crewId: "captain" },
    { role: "captain", storeId: "plano", crewId: "other-captain" },
    { role: "commissioner", storeId: null, crewId: null },
  ];
  for (const phase of ["open", "locked", "fought", "inspected", "complete"] as const) {
    for (const session of sessions) {
      const projected = clientDoc({ ...data, phase }, session);
      assert.ok(!JSON.stringify(projected).includes("arcade-private"), `${phase}/${session.role}`);
      assert.deepEqual(records(projected) ?? [], []);
    }
  }
  assert.deepEqual(records(data), privateRecords, "projection must not erase the saved ledger");
});
