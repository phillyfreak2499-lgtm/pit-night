import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("session migration strips exposed credentials without discarding the league", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      readFileSync(new URL("../migrations/0002_pit_season.sql", import.meta.url), "utf8"),
    );
    const legacy = {
      pin: "LEAKED",
      week: 2,
      stores: [{ id: "plano", name: "Plano", passcode: "EXPOSED" }],
      crew: [{ id: "crew-1" }],
      bots: [{ coins: { chassis: 7 } }],
    };
    await db.query("insert into pit_season(id,rev,doc) values ('main',8,$1)", [
      JSON.stringify(legacy),
    ]);
    const migration = readFileSync(
      new URL("../migrations/0003_pit_sessions.sql", import.meta.url),
      "utf8",
    );
    await db.exec(migration);
    const row = (await db.query("select rev, doc from pit_season")).rows[0];
    const next = JSON.parse(row.doc);
    assert.equal(row.rev, 9);
    assert.equal(next.week, 2);
    assert.deepEqual(next.crew, legacy.crew);
    assert.deepEqual(next.bots, legacy.bots);
    assert.deepEqual(next.stores, [{ id: "plano", name: "Plano" }]);
    assert.ok(!("pin" in next));
    await db.exec(migration);
    assert.equal((await db.query("select rev from pit_season")).rows[0].rev, 9);
    assert.equal((await db.query("select * from pit_sessions")).rows.length, 0);
  } finally {
    await db.close();
  }
});
