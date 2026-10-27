import test from "node:test";
import assert from "node:assert/strict";
import { answerMatches, handleFundamentalsRequest } from "./fundamentals-gate.mjs";
import { seal, open, entryAllowed, internalDestination, platformPath } from "./entry-crypto.mjs";
import { buildEntryMiddleware } from "./build-entry-middleware.mjs";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
const secret = "ab".repeat(32);
test("numbered fundamentals tolerate minor mistakes but retain required meaning", () => {
  for (const [n, answer] of [
    [1, "seat every one instantly"],
    [2, "Fitt everyone!"],
    [3, "close three step systems"],
    [4, "followup with each client"],
    [5, "gets referals and reveiws"],
  ])
    assert.equal(answerMatches(n, answer), true, answer);
  for (const [n, answer] of [
    [1, "fit everyone"],
    [2, "everyone"],
    [3, "close systems"],
    [4, "follow up"],
    [5, "referrals"],
    [1, "1"],
    [1, "do not seat everyone instantly"],
    [5, "get no referrals and reviews"],
    [5, "getnoreferralsandreviews"],
    [2, "x".repeat(201)],
  ])
    assert.equal(answerMatches(n, answer), false, answer);
});
test("entry destinations cannot normalize into external redirects", () => {
  for (const value of [
    "/\t/evil.example",
    "/\\evil.example",
    "//evil.example",
    "/\n/evil.example",
    "https://evil.example",
    "/a/..//evil.example",
    "/%2e%2e//evil.example",
  ])
    assert.equal(internalDestination(value), "/");
  assert.equal(internalDestination("/garage/plano?tab=paint"), "/garage/plano?tab=paint");
});
test("purpose-separated encrypted tokens reject tampering and expiry", async () => {
  const token = await seal({ exp: 200, n: 3 }, secret, "challenge");
  assert.deepEqual(await open(token, secret, "challenge", 100), { exp: 200, n: 3 });
  assert.equal(await open(token, secret, "entry", 100), null);
  assert.equal(await open(token, secret, "challenge", 201), null);
  assert.equal(await open(token.slice(0, -3) + "xxx", secret, "challenge", 100), null);
});
test("all pages, assets and API requests require entry; success preserves internal destination", async () => {
  let attempts = 0;
  const opts = { secret, now: 100, countAttempt: async () => ++attempts };
  for (const path of ["/garage/plano", "/assets/app.js", "/_serverFn/test"]) {
    const res = await handleFundamentalsRequest(new Request("https://pit.test" + path), opts);
    assert.ok(res);
    assert.equal(res.headers.get("cache-control"), "no-store");
  }
  const page = await handleFundamentalsRequest(
    new Request("https://pit.test/entry?next=/rules"),
    opts,
  );
  const html = await page.text();
  assert.ok(!html.includes("Seat everyone"));
  const cookie = page.headers.get("set-cookie").split(";")[0];
  const challenge = await open(cookie.split("=")[1], secret, "challenge", 100);
  const answers = [
    "",
    "seat everyone instantly",
    "fit everyone",
    "close 3 step systems",
    "follow up with each client",
    "get referrals and reviews",
  ];
  const req = (origin = "https://pit.test") =>
    new Request("https://pit.test/entry", {
      method: "POST",
      headers: { cookie, origin, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ answer: answers[challenge.n], next: "/rules" }),
    });
  assert.equal((await handleFundamentalsRequest(req("https://evil.test"), opts)).status, 403);
  const good = await handleFundamentalsRequest(req(), opts);
  assert.equal(good.status, 303);
  assert.equal(good.headers.get("location"), "/rules");
  const pass = good.headers
    .getSetCookie()
    .find((x) => x.startsWith("pit_entry="))
    .split(";")[0];
  assert.equal(
    await entryAllowed(
      new Request("https://pit.test/garage/plano", { headers: { cookie: pass } }),
      secret,
      101,
    ),
    true,
  );
  assert.equal(
    await entryAllowed(
      new Request("https://pit.test/", { headers: { cookie: pass } }),
      secret,
      100 + 28801,
    ),
    false,
  );
  assert.equal(
    await handleFundamentalsRequest(
      new Request("https://pit.test/", { headers: { cookie: pass } }),
      opts,
    ),
    null,
  );
  attempts = 20;
  assert.equal((await handleFundamentalsRequest(req(), opts)).status, 429);
});
test("generated Vercel middleware protects CDN files before filesystem lookup", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pit-entry-"));
  const previous = process.env.PIT_CODE_VAULT_KEY;
  process.env.PIT_CODE_VAULT_KEY = secret;
  try {
    await mkdir(dir + "/functions");
    await writeFile(
      dir + "/config.json",
      JSON.stringify({
        version: 3,
        routes: [{ handle: "filesystem" }, { src: "/(.*)", dest: "/__server" }],
      }),
    );
    await buildEntryMiddleware(dir);
    await buildEntryMiddleware(dir);
    const config = JSON.parse(await readFile(dir + "/config.json", "utf8"));
    const edgeConfig = JSON.parse(
      await readFile(dir + "/functions/__entrance.func/.vc-config.json", "utf8"),
    );
    assert.deepEqual(edgeConfig.envVarsInUse, ["PIT_CODE_VAULT_KEY"]);
    assert.equal(config.routes[0].middlewarePath, "__entrance");
    assert.equal(config.routes.filter((r) => r.middlewarePath).length, 1);
    const { default: gate } = await import(
      pathToFileURL(dir + "/functions/__entrance.func/index.mjs").href
    );
    assert.equal((await gate(new Request("https://pit.test/assets/app.js"))).status, 401);
    assert.equal(
      (await gate(new Request("https://pit.test/rules", { headers: { accept: "text/html" } })))
        .status,
      303,
    );
    const pass = await seal(
      { version: 1, exp: Math.floor(Date.now() / 1000) + 60 },
      secret,
      "entry",
    );
    assert.equal(
      (
        await gate(
          new Request("https://pit.test/assets/app.js", {
            headers: { cookie: "pit_entry=" + pass },
          }),
        )
      ).headers.get("x-middleware-next"),
      "1",
    );
  } finally {
    if (previous === undefined) delete process.env.PIT_CODE_VAULT_KEY;
    else process.env.PIT_CODE_VAULT_KEY = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
test("only the reminder cron route skips the entrance; it checks its own secret", async () => {
  assert.equal(platformPath("/api/cron/nudges"), true);
  for (const path of ["/api/cron/nudges/x", "/api/cron/other", "/api/cron", "/desk"]) assert.equal(platformPath(path), false, path);
  const blocked = await handleFundamentalsRequest(new Request("https://thewatermangames.live/api/cron/other"), { secret, now: 1000 });
  assert.equal(blocked?.status, 401);
});
