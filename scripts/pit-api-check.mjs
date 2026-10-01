// Destructive QA fixture setup is restricted to an explicitly opted-in loopback server.
import assert from "node:assert/strict";
import { toJSONAsync, fromCrossJSON } from "seroval";
const base = process.env.PIT_QA_URL ?? "http://127.0.0.1:8080";
if (
  !new Set(["127.0.0.1", "localhost"]).has(new URL(base).hostname) ||
  process.env.PIT_QA_ALLOW_MUTATIONS !== "1"
)
  throw new Error("Use a disposable local server and PIT_QA_ALLOW_MUTATIONS=1.");
const codes = {
  desk: process.env.PIT_DESK_PIN,
  captain: JSON.parse(process.env.PIT_CAPTAIN_CODES ?? "{}").plano,
  crew: JSON.parse(process.env.PIT_BAY_CODES ?? "{}").plano,
};
if (Object.values(codes).some((c) => !c))
  throw new Error("Configure temporary local QA codes first.");
process.env.TSS_SERVER_FN_BASE = `${base}/_serverFn/`;
const module = await (await fetch(`${base}/src/lib/pit/authoritative.ts`)).text();
const ids = Object.fromEntries(
  [...module.matchAll(/export const (\w+) = [^\n]*createClientRpc\("([^"]+)"\)/g)].map((m) => [
    m[1],
    m[2],
  ]),
);
assert.ok(ids.signIn && ids.mutateSeason && !module.includes("pushSeason"));
function client() {
  let cookie = "";
  let lastCookie = "";
  return {
    get lastCookie() {
      return lastCookie;
    },
    async call(name, data, origin = base) {
      const headers = new Headers({
        "content-type": "application/json",
        accept: "application/json",
        "x-tsr-serverFn": "true",
      });
      headers.set("origin", origin);
      if (cookie) headers.set("cookie", cookie);
      const response = await fetch(`${process.env.TSS_SERVER_FN_BASE}${ids[name]}`, {
        method: "POST",
        body: JSON.stringify(await toJSONAsync({ data })),
        headers,
      });
      const set = response.headers.get("set-cookie");
      if (set) {
        lastCookie = set;
        cookie = set.split(";")[0];
      }
      const value = fromCrossJSON(await response.json(), { refs: new Map() });
      if (!response.ok || value.error || value instanceof Error) throw value.error ?? value;
      return value.result;
    },
    command(name, args, origin = base) {
      return this.call("mutateSeason", { name, args }, origin);
    },
  };
}
const anon = client(),
  desk = client(),
  crew = client(),
  captain = client();
let pulled = await anon.call("pullSeason", { rev: 0 });
assert.equal(pulled.session.role, "public");
assert.ok(!pulled.doc.includes('"pin"') && !pulled.doc.includes('"passcode"'));
await assert.rejects(anon.command("resetSeason", []));
await assert.rejects(anon.command("force", [{ doc: "{}" }]));
await assert.rejects(
  anon.call("signIn", { role: "commissioner", storeId: null, crewId: null, code: "00000000" }),
);
await desk.call("signIn", { role: "commissioner", storeId: null, crewId: null, code: codes.desk });
assert.match(desk.lastCookie, /HttpOnly/i);
assert.match(desk.lastCookie, /SameSite=Strict/i);
await desk.command("resetSeason", []);
await desk.command("setTrainingOpenAll", [true]);
pulled = await anon.call("pullSeason", { rev: 0 });
const member = JSON.parse(pulled.doc).crew.find(
  (c) => c.storeId === "plano" && c.role === "specialist",
);
await crew.call("signIn", { role: "crew", storeId: "plano", crewId: member.id, code: codes.crew });
await assert.rejects(crew.command("lockStore", ["plano"]));
await assert.rejects(
  crew.call("signIn", { role: "captain", storeId: "plano", crewId: null, code: codes.crew }),
);
// Switch roles on the same device/session, then return to the crew identity.
await crew.call("signIn", { role: "captain", storeId: "plano", crewId: null, code: codes.captain });
assert.equal((await crew.call("pullSeason", { rev: 0 })).session.role, "captain");
await crew.call("signIn", { role: "crew", storeId: "plano", crewId: member.id, code: codes.crew });
assert.equal((await crew.call("pullSeason", { rev: 0 })).session.crewId, member.id);
await captain.call("signIn", {
  role: "captain",
  storeId: "plano",
  crewId: null,
  code: codes.captain,
});
await assert.rejects(captain.command("lockStore", ["allen"]));
await assert.rejects(captain.command("runSaturday", []));
await assert.rejects(captain.call("setAccessCode", { id: "desk", code: "192837" }));
await assert.rejects(crew.command("submitSpark", [1, "tue", 3, 3]));
await assert.rejects(desk.command("houseCall", ["Cross-origin write"], "https://example.com"));
// Independent sessions race from the same server revision. Both changes must survive CAS retries.
await Promise.all([
  desk.command("setTagline", ["QA concurrent league message"]),
  captain.command("renameBot", ["plano", "QA RIVET"]),
]);
await Promise.all([
  crew.command("completeJob", [1, "w1-tue-culture", "QA proof"]),
  crew.command("completeJob", [1, "w1-tue-culture", "QA proof"]),
]);
pulled = await anon.call("pullSeason", { rev: 0 });
let data = JSON.parse(pulled.doc);
assert.equal(data.tagline, "QA concurrent league message");
assert.equal(data.bots.find((b) => b.storeId === "plano").name, "QA RIVET");
assert.equal(data.jobLog.length, 1);
await Promise.all([
  captain.command("approveJob", [data.jobLog[0].id]),
  captain.command("approveJob", [data.jobLog[0].id]),
]);
await captain.command("setCrewOff", [member.id, 1, true]);
data = JSON.parse((await anon.call("pullSeason", { rev: 0 })).doc);
assert.ok(!data.crew.find((c) => c.id === member.id).offWeeks.includes(1));
// Server calculates answers and rejects a duplicate day claim.
await crew.command("submitSpark", [1, "tue", [1, 0, 0]]);
await crew.command("submitSpark", [1, "tue", [1, 0, 0]]);
data = JSON.parse((await anon.call("pullSeason", { rev: 0 })).doc);
assert.equal(data.sparkLog.length, 1);
assert.equal(data.sparkLog[0].total, 3);
assert.equal(data.sparkLog[0].correct, 2);
await crew.command("completeJob", [1, "w1-crate", "QA helped a neighbor"]);
data = JSON.parse((await anon.call("pullSeason", { rev: 0 })).doc);
await captain.command("approveJob", [data.jobLog.find((e) => e.jobId === "w1-crate").id]);
await Promise.all([
  captain.command("buyLocker", ["plano", "paint-neon"]),
  captain.command("buyLocker", ["plano", "paint-neon"]),
]);
data = JSON.parse((await anon.call("pullSeason", { rev: 0 })).doc);
assert.equal(data.stores.find((s) => s.id === "plano").boltsSpent, 6);
assert.equal(
  data.stores.find((s) => s.id === "plano").unlocks.filter((id) => id === "paint-neon").length,
  1,
);
await desk.command("lockFriday", []);
await crew.command("submitSpark", [1, "wed", [0, 0, 0]]);
await captain.command("setDraftPart", ["plano", "utility", null]);
data = JSON.parse((await anon.call("pullSeason", { rev: 0 })).doc);
assert.equal(data.sparkLog.length, 1);
assert.equal(data.phase, "locked");
// Rotation revokes existing sessions and the old code; it never enters league JSON.
const replacement = "392847";
await desk.call("setAccessCode", { id: "captain:plano", code: replacement });
await assert.rejects(captain.command("renameBot", ["plano", "REVOKED"]));
await assert.rejects(
  captain.call("signIn", { role: "captain", storeId: "plano", crewId: null, code: codes.captain }),
);
await captain.call("signIn", {
  role: "captain",
  storeId: "plano",
  crewId: null,
  code: replacement,
});
await desk.call("setAccessCode", { id: "captain:plano", code: codes.captain });
await desk.command("resetSeason", []);
if (process.env.PIT_QA_SETUP_FIGHTS === "1") {
  data = JSON.parse((await anon.call("pullSeason", { rev: 0 })).doc);
  const keys = ["nsnu", "conv", "demoRate", "demoClose", "arch", "ticket"];
  for (const store of data.stores) {
    for (const key of keys) await desk.command("setKickoffGrade", [store.id, key, "green"]);
  }
  await desk.command("applyKickoff", []);
  for (const store of data.stores) {
    await desk.command("setOfficialNsnu", [store.id, 1000 + store.seed * 25]);
    for (const key of keys) await desk.command("setGrade", [store.id, key, "green"]);
  }
  await desk.command("lockFriday", []);
  await desk.command("runSaturday", []);
  data = JSON.parse((await anon.call("pullSeason", { rev: 0 })).doc);
  assert.equal(data.phase, "fought");
  console.log(
    "Local fight fixtures:",
    data.bouts
      .filter((b) => b.kind === "bout")
      .map((b) => ({ id: b.id, stores: b.storeIds, method: b.result.method })),
  );
}
console.log(
  "PASS: anonymous rejection, secret-free reads, HTTP-only sessions, role/store checks, server Spark scoring, concurrent writes, duplicate claims, eligibility freeze, post-lock restrictions, and credential revocation.",
);
