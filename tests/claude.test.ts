/** Claude copy on disposable data: what Claude may see, the number guard, and write-once storage. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createStore } from "zustand/vanilla";
import { PGlite } from "@electric-sql/pglite";
import { pitCreator } from "../src/lib/pit/store.ts";
import {
  boutSubject,
  hypeSubject,
  LIVE_LIMIT_PER_DAY,
  liveCapReached,
  liveExchangeIndexes,
  liveRequest,
  liveSubjects,
  promptFor,
  recapSubject,
  unsupportedNumbers,
  upcomingMatchups,
} from "../src/lib/pit/claude-copy.ts";
import { claimCopy, countClaimedOnDay, finishCopy, readCopy } from "../src/lib/pit/claude-store.ts";
import { FEATURE_MODEL, HAIKU } from "../src/lib/pit/claude.server.ts";
import type { Sql } from "../src/lib/db.ts";
import type { FightResult } from "../src/lib/pit/types.ts";

/** A week-1 league run by the Desk: kickoff paid, Sunday NSNU recorded, card run. */
function league(run: boolean) {
  const store = createStore(pitCreator);
  store.setState({ session: { role: "commissioner", storeId: null, crewId: null } });
  const s = store.getState();
  for (const st of s.stores) for (const m of ["nsnu", "conv", "demoRate", "demoClose", "arch", "ticket"] as const) s.setKickoffGrade(st.id, m, "blue");
  store.getState().applyKickoff();
  if (run) {
    for (const st of store.getState().stores) store.getState().setOfficialNsnu(st.id, 950);
    store.getState().lockFriday();
    store.getState().runSaturday();
  }
  return store.getState();
}

test("commentary and recap come only from posted results, without codes or crew names", () => {
  const d = league(true);
  assert.equal(d.phase, "fought");
  const bout = d.bouts.find((b) => b.week === 1 && b.kind === "bout")!;
  const subject = boutSubject(d, bout.id)!;
  assert.ok(subject.key.startsWith(bout.id));
  assert.equal(boutSubject(d, "w1-bout-99-nobody"), null);
  assert.equal(boutSubject(league(false), bout.id), null, "no commentary before the card runs");
  const recap = recapSubject(d, 1)!;
  assert.equal((recap.facts.results as unknown[]).length, 7);
  assert.equal(recapSubject(d, 2), null);
  const facts = JSON.stringify([subject.facts, recap.facts]);
  assert.doesNotMatch(facts, /passcode|"pin"|code/i);
  for (const c of d.crew) assert.ok(!facts.includes(`"${c.name}"`), "no crew names reach Claude");
  assert.match(facts, /"officialNsnuDollars":950/);
});

test("the number guard rejects stats the facts do not contain", () => {
  const facts = { damage: 12, record: "2-1", nsnu: 1032.05 };
  assert.deepEqual(unsupportedNumbers("Hit for 12 to go 2-1 on $1,032.05", facts), []);
  assert.deepEqual(unsupportedNumbers("Hit for 999", facts), ["999"]);
});

test("hype covers the upcoming card before it runs, hides builds, and stops after", () => {
  const d = league(false);
  const matchups = upcomingMatchups(d);
  assert.equal(matchups.length, 7);
  const h = hypeSubject(d, matchups[0]!.id)!;
  assert.doesNotMatch(JSON.stringify(h.facts), /weapon"|chassis"|armor"/);
  assert.equal(upcomingMatchups(league(true)).length, 0);
});

test("copy is claimed once, written once, and a ready row is never rewritten", async () => {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const run = async <T>(text: string, params: unknown[]) => (await pg.query<T>(text, params)).rows;
  const sql = (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0]!;
    values.forEach((_, i) => (text += `$${i + 1}${strings[i + 1]}`));
    return run<T>(text, values);
  }) as unknown as Sql;
  sql.query = (text: string, params: unknown[] = []) => run(text, params);

  assert.equal(await claimCopy(sql, "bout", "b1", "claude-haiku-5-5"), true);
  assert.equal(await claimCopy(sql, "bout", "b1", "claude-haiku-5-5"), false, "a second viewer waits");
  await finishCopy(sql, "bout", "b1", { body: "Steel on steel." });
  await pg.query("update pit_claude_text set claimed_at = now() - interval '1 day'");
  assert.equal(await claimCopy(sql, "bout", "b1", "claude-haiku-5-5"), false);
  assert.deepEqual(await readCopy(sql, "bout", "b1"), { status: "ready", body: "Steel on steel." });
  assert.equal(await claimCopy(sql, "hype", "m1", "claude-haiku-5-5"), true);
  await finishCopy(sql, "hype", "m1", { error: "API down" });
  assert.equal(await claimCopy(sql, "hype", "m1", "claude-haiku-5-5"), false, "a failure waits before retrying");
  await pg.query("update pit_claude_text set claimed_at = now() - interval '11 minutes' where kind = 'hype'");
  assert.equal(await claimCopy(sql, "hype", "m1", "claude-haiku-5-5"), true);

  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  assert.equal(await countClaimedOnDay(sql, "live", day), 0);
  assert.equal(await claimCopy(sql, "live", "b1:walkout", "claude-haiku-5-5"), true);
  await finishCopy(sql, "live", "b1:walkout", { body: "They walk out." });
  assert.equal(await countClaimedOnDay(sql, "live", day), 1);
  assert.equal(await claimCopy(sql, "live", "b1:walkout", "claude-haiku-5-5"), false);
  assert.deepEqual(await readCopy(sql, "live", "b1:walkout"), { status: "ready", body: "They walk out." });
  await pg.query("update pit_claude_text set created_at = now() - interval '2 days' where kind = 'live'");
  assert.equal(await countClaimedOnDay(sql, "live", day), 0);
});

test("live calls follow the resolved tape and hide the ending until the decision", () => {
  const d = league(true);
  const bout = d.bouts.find((b) => b.week === 1 && b.kind === "bout")!;
  assert.equal(liveSubjects(league(false), bout.id), null, "no live call before the card runs");
  const beats = liveSubjects(d, bout.id)!;
  assert.equal(beats[0]!.phase, "walkout");
  assert.equal(beats.at(-1)!.phase, "decision");
  assert.ok(beats[0]!.key.startsWith(`${boutSubject(d, bout.id)!.key}:`));
  assert.equal(new Set(beats.map((b) => b.key)).size, beats.length);
  assert.equal("winners" in beats[0]!.facts, false);
  assert.equal("method" in beats[0]!.facts, false);
  const exchanges = beats.filter((b) => b.phase === "exchange");
  const picked = liveExchangeIndexes(bout.result!.exchanges.map((e) => e.damage));
  assert.deepEqual(
    exchanges.map((b) => b.facts.exchangeNumber),
    picked.map((i) => bout.result!.exchanges[i]!.index),
  );
  for (const beat of exchanges) assert.equal("winners" in beat.facts, false);
  assert.ok(Array.isArray(beats.at(-1)!.facts.winners));
  const bye = { ...bout, id: "w1-bye-9-house", kind: "bye" as const };
  assert.equal(liveSubjects({ ...d, bouts: [...d.bouts, bye] }, bye.id), null);
  const facts = JSON.stringify(beats.map((b) => b.facts));
  assert.doesNotMatch(facts, /passcode|"pin"|code/i);
  for (const c of d.crew) assert.equal(facts.includes(`"${c.name}"`), false);
});

test("a long resolved fight becomes a few beats, and a copied finisher is not a second blow", () => {
  assert.deepEqual(liveExchangeIndexes([3, 1, 2]), [0, 1, 2]);
  assert.deepEqual(liveExchangeIndexes([10, 4, 9, 3, 8, 12, 5]), [0, 5, 6]);
  assert.deepEqual(liveExchangeIndexes([]), []);

  const d = league(true);
  const bout = d.bouts.find((b) => b.week === 1 && b.kind === "bout")!;
  const result = bout.result!;
  const proto = result.exchanges[0]!;
  const exchanges = Array.from({ length: 12 }, (_, i) => ({
    ...proto,
    index: i + 1,
    damage: i === 7 ? 40 : 10 + i,
    call: `Swing ${i + 1} only`,
    attackerHp: 80,
    defenderHp: i === 11 ? 0 : 40,
  }));
  const copied: FightResult = {
    ...result,
    exchanges,
    finisher: {
      by: proto.attackerId,
      against: proto.defenderId,
      damage: exchanges[11]!.damage,
      call: exchanges[11]!.call,
    },
  };
  const long = {
    ...d,
    bouts: d.bouts.map((b) => (b.id === bout.id ? { ...b, result: copied } : b)),
  };
  const beats = liveSubjects(long, bout.id)!;
  const phases = beats.map((b) => b.phase);
  assert.deepEqual(phases, ["walkout", "exchange", "exchange", "exchange", "decision"]);
  const calls = beats.filter((b) => b.phase === "exchange");
  assert.equal(JSON.stringify(calls[0]!.facts).includes("Swing 1 only"), true);
  assert.equal(JSON.stringify(calls[0]!.facts).includes("Swing 8 only"), false);
  assert.equal(JSON.stringify(calls[0]!.facts).includes("Swing 12 only"), false);
  assert.equal(calls[1]!.facts.damage, 40);
  assert.equal(calls[1]!.facts.exchangeNumber, 8);
  assert.equal(calls[2]!.facts.fightOver, true);
  assert.equal("winners" in calls[2]!.facts, false);
  assert.equal(JSON.stringify(beats[0]!.facts).includes("Swing 1 only"), false);

  const last = result.exchanges.at(-1)!;
  const distinct = {
    ...d,
    bouts: d.bouts.map((b) =>
      b.id === bout.id
        ? {
            ...b,
            result: {
              ...result,
              finisher: {
                by: last.attackerId,
                against: last.defenderId,
                damage: last.damage + 5,
                call: `${last.call} Heat on top.`,
              },
            },
          }
        : b,
    ),
  };
  const withHeat = liveSubjects(distinct, bout.id)!;
  const heat = withHeat.find((b) => b.phase === "finisher");
  assert.ok(heat);
  assert.equal(heat!.facts.damage, last.damage + 5);
  assert.equal("winners" in heat!.facts, false);
  assert.equal(withHeat.at(-1)!.phase, "decision");
  assert.ok(withHeat.indexOf(heat!) < withHeat.length - 1);
  const walk = promptFor(beats[0]!);
  const decision = promptFor(beats.at(-1)!);
  assert.match(walk.system, /has not started/);
  assert.match(walk.prompt, /<facts>/);
  assert.equal(walk.prompt.includes("Swing 12 only"), false);
  assert.match(decision.system, /winner/);
  assert.equal(decision.prompt.includes('"winners"'), true);
  assert.deepEqual(unsupportedNumbers(`Landed ${calls[1]!.facts.damage}`, calls[1]!.facts), []);
  assert.deepEqual(unsupportedNumbers("Landed 9999", calls[1]!.facts), ["9999"]);
});

test("the live booth generates in order, under a daily cap, and keeps the key on the server", () => {
  assert.equal(LIVE_LIMIT_PER_DAY, 64);
  assert.equal(liveCapReached(LIVE_LIMIT_PER_DAY - 1), false);
  assert.equal(liveCapReached(LIVE_LIMIT_PER_DAY), true);
  assert.equal(liveRequest(0, 5, false, false, 0), "claim");
  assert.equal(liveRequest(2, 5, false, false, 0), "wait");
  assert.equal(liveRequest(2, 5, true, false, LIVE_LIMIT_PER_DAY), "unavailable");
  assert.equal(liveRequest(2, 5, true, true, LIVE_LIMIT_PER_DAY), "claim");
  assert.equal(liveRequest(5, 5, true, false, 0), "unavailable");
  assert.equal(liveRequest(-1, 5, true, false, 0), "unavailable");
  assert.deepEqual(Object.keys(FEATURE_MODEL).sort(), ["bout", "hype", "live", "recap", "rules"]);
  for (const model of Object.values(FEATURE_MODEL)) assert.equal(model, HAIKU);

  const widget = readFileSync(new URL("../src/components/pit/claude-copy.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../src/components/pit/bout-page.tsx", import.meta.url), "utf8");
  const server = readFileSync(new URL("../src/lib/pit/claude-server.ts", import.meta.url), "utf8");
  assert.match(widget, /function LiveCall/);
  assert.match(widget, /getLiveCall/);
  assert.doesNotMatch(widget, /claude\.server|readApiKey|ANTHROPIC_API_KEY|askClaude/);
  assert.match(page, /Ringside call/);
  assert.match(page, /<LiveCall /);
  assert.doesNotMatch(page, /ANTHROPIC|readApiKey|askClaude/);
  assert.match(server, /getLiveCall/);
  assert.match(server, /guardedCopy\("live"/);
  assert.match(server, /countClaimedOnDay/);
  assert.match(server, /import\("\.\/claude\.server"\)/);
  assert.doesNotMatch(server, /ANTHROPIC_API_KEY|readApiKey\(/);
});
