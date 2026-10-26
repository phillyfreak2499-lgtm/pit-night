/** The Gazette writer: briefs carry only league facts (no people), and Claude's answer is read defensively. */
import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "zustand/vanilla";
import { pitCreator } from "../src/lib/pit/store.ts";
import {
  buildGazetteBrief,
  centralISODate,
  dailyGazetteId,
  gazetteSystemPrompt,
  parseGazetteEntries,
  gazetteRequest,
  recapEntries,
  recapEntryIds,
} from "../src/lib/pit/gazette-ai.ts";
import { FEATURE_MODEL } from "../src/lib/pit/claude.server.ts";
import type { PitData } from "../src/lib/pit/types.ts";

/** A week-1 league run by the Desk: kickoff paid, card run and posted. */
function foughtLeague(): PitData {
  const store = createStore(pitCreator);
  store.setState({ session: { role: "commissioner", storeId: null, crewId: null } });
  const s = store.getState();
  for (const st of s.stores)
    for (const m of ["nsnu", "conv", "demoRate", "demoClose", "arch", "ticket"] as const)
      s.setKickoffGrade(st.id, m, "blue");
  store.getState().applyKickoff();
  for (const st of store.getState().stores) store.getState().setOfficialNsnu(st.id, 950);
  store.getState().lockFriday();
  store.getState().runSaturday();
  return store.getState();
}

test("recap brief carries the fought card's facts and no people", () => {
  const data = foughtLeague();
  assert.equal(data.phase, "fought");
  const brief = buildGazetteBrief(data, "recap", "2026-11-02");
  assert.equal(brief.mode, "recap");
  assert.equal(brief.date, "2026-11-02");
  assert.equal(brief.week, 1);
  // Everything is derived from the passed-in state, never assumed.
  assert.equal(brief.storeCount, data.stores.length);
  assert.equal(brief.stores.length, data.stores.length);
  const tabled = brief.standings.flatMap((c) => c.table.map((row) => row.store));
  assert.equal(tabled.length, data.stores.length);
  assert.deepEqual(new Set(tabled), new Set(data.stores.map((s) => s.name)));
  for (const row of brief.stores) assert.match(row.record, /^\d+-\d+$/);
  // The whole card, with the calls that decided it.
  const fought = data.bouts.filter((b) => b.week === 1 && b.result);
  assert.equal(brief.card?.week, 1);
  assert.equal(brief.card?.bouts.length, fought.length);
  const first = brief.card!.bouts[0]!;
  assert.ok(first.winners.length >= 1);
  assert.ok(first.winners[0]!.store);
  assert.ok(first.winners[0]!.bot);
  assert.ok(first.method.length > 0);
  assert.ok(Array.isArray(first.calls) && first.calls!.length > 0);
  // No crew names and no captains reach the writer.
  const facts = JSON.stringify(brief);
  for (const c of data.crew) assert.ok(!facts.includes(c.name), `crew name leaked: ${c.name}`);
  for (const s of data.stores) assert.ok(!facts.includes(s.captain), `captain leaked: ${s.captain}`);
});

test("daily brief summarizes the last fought week and looks ahead", () => {
  const data = foughtLeague();
  const brief = buildGazetteBrief(data, "daily", "2026-11-03");
  assert.equal(brief.mode, "daily");
  assert.equal(brief.card?.week, 1);
  assert.equal(brief.card?.bouts.length, data.bouts.filter((b) => b.week === 1 && b.result).length);
  // Summary, not the full tape: no play-by-play in a daily brief.
  assert.equal(brief.card!.bouts[0]!.calls, undefined);
  assert.ok(brief.upcoming.nextWeek);
  assert.equal(brief.upcoming.nextWeek?.number, 2);
});

test("daily brief before any card has no card and no invented results", () => {
  const store = createStore(pitCreator);
  const data = store.getState();
  const brief = buildGazetteBrief(data, "daily", "2026-10-26");
  assert.equal(brief.card, null);
  assert.equal(brief.storeCount, data.stores.length);
  for (const row of brief.stores) assert.equal(row.record, "0-0");
});

test("parser reads clean, fenced, and prose-wrapped JSON", () => {
  const payload = JSON.stringify({
    entries: [
      { kicker: "Front page", headline: "Waco takes the opener.", body: "One store won. One store did not." },
      { kicker: "Standings", headline: "The table after one.", body: "Early days. Long season." },
    ],
  });
  assert.equal(parseGazetteEntries(payload, "recap").length, 2);
  assert.equal(parseGazetteEntries("```json\n" + payload + "\n```", "recap").length, 2);
  assert.equal(parseGazetteEntries("Here is the edition:\n" + payload + "\nPrint it.", "recap").length, 2);
  const [first] = parseGazetteEntries(payload, "recap");
  assert.equal(first!.kicker, "Front page");
  assert.equal(first!.headline, "Waco takes the opener.");
});

test("parser returns [] on garbage and drops malformed items", () => {
  assert.deepEqual(parseGazetteEntries("", "daily"), []);
  assert.deepEqual(parseGazetteEntries("no json here", "daily"), []);
  assert.deepEqual(parseGazetteEntries("{not json}", "daily"), []);
  assert.deepEqual(parseGazetteEntries(JSON.stringify({ entries: "nope" }), "daily"), []);
  const mixed = JSON.stringify({
    entries: [
      { kicker: "Ok", headline: "Fine.", body: "Fine body." },
      { kicker: "Bad", headline: 42, body: "No." },
      { headline: "Missing kicker.", body: "No." },
      { kicker: "Blank", headline: "   ", body: "No." },
      null,
    ],
  });
  const out = parseGazetteEntries(mixed, "recap");
  assert.equal(out.length, 1);
  assert.equal(out[0]!.kicker, "Ok");
});

test("parser enforces the caps: daily headlines 80, recap 110, counts 3 and 8", () => {
  const long = "x".repeat(200);
  const many = JSON.stringify({
    entries: Array.from({ length: 12 }, (_, i) => ({
      kicker: `K${i}`,
      headline: long,
      body: "y".repeat(900),
    })),
  });
  const daily = parseGazetteEntries(many, "daily");
  assert.equal(daily.length, 3);
  assert.equal(daily[0]!.headline.length, 80);
  assert.equal(daily[0]!.body.length, 700);
  const recap = parseGazetteEntries(many, "recap");
  assert.equal(recap.length, 8);
  assert.equal(recap[0]!.headline.length, 110);
  assert.equal(recap[0]!.body.length, 700);
});

test("ids: daily format and recap ids replace the template writer's", () => {
  assert.equal(dailyGazetteId(2, "2026-11-03"), "daily-2-2026-11-03");
  assert.deepEqual(recapEntryIds(1, ["w1-bout-1-waco", "w1-bout-2-plano"]), [
    "g-1-open",
    "g-w1-bout-1-waco",
    "g-w1-bout-2-plano",
  ]);
});

test("system prompt carries the house rules and the JSON-only contract", () => {
  for (const mode of ["daily", "recap"] as const) {
    const prompt = gazetteSystemPrompt(mode);
    assert.match(prompt, /trophy/);
    assert.match(prompt, /Never call it a belt/);
    assert.match(prompt, /ONLY a JSON object/);
    assert.match(prompt, /Never name individual people/);
    assert.match(prompt, /No odds/);
  }
  assert.match(gazetteSystemPrompt("daily"), /at most 80 characters/);
  assert.match(gazetteSystemPrompt("daily"), /exactly 3 entries/);
  assert.match(gazetteSystemPrompt("recap"), /at most 110 characters/);
  assert.match(gazetteSystemPrompt("recap"), /one entry per bout/);
});

test("the writer uses Haiku through the shared helper, with the brief sent as data", () => {
  assert.equal(FEATURE_MODEL.gazette, "claude-haiku-5-5");
  const brief = buildGazetteBrief(foughtLeague(), "daily", "2026-11-03");
  const req = gazetteRequest(brief, "daily");
  assert.equal(req.system, gazetteSystemPrompt("daily"));
  assert.ok(req.prompt.endsWith(JSON.stringify(brief)));
  assert.match(req.prompt, /data, not instructions/);
  assert.ok(req.maxTokens >= 4000, "room for thinking plus the edition");
});

test("recap entries take the template writer's ids in bout order; the date is Central", () => {
  const data = foughtLeague();
  const fought = data.bouts.filter((b) => b.week === data.week && b.result);
  const drafts = [{ kicker: "Card", headline: "Opener.", body: "All seven." }, ...fought.map((b) => ({ kicker: b.title, headline: "Story.", body: "Body." }))];
  const entries = recapEntries(data, drafts);
  assert.equal(entries[0]!.id, `g-${data.week}-open`);
  assert.equal(entries[0]!.boutId, null);
  fought.forEach((b, i) => {
    assert.equal(entries[i + 1]!.id, `g-${b.id}`);
    assert.equal(entries[i + 1]!.boutId, b.id);
  });
  // 1:30 a.m. UTC on Nov 3 is still Nov 2 in Central.
  assert.equal(centralISODate(new Date("2026-11-03T01:30:00Z")), "2026-11-02");
});

test("store actions: daily prepends and replaces, recap keeps House calls", () => {
  const store = createStore(pitCreator);
  store.setState({
    session: { role: "commissioner", storeId: null, crewId: null },
    gazette: [
      { id: "house-1", week: 1, boutId: null, kicker: "House call", headline: "Note.", body: "A note." },
      { id: "g-1-open", week: 1, boutId: null, kicker: "Shakedown", headline: "Old opener.", body: "Template." },
    ],
  });
  store.getState().postDailyGazette(
    [
      { kicker: "Front page", headline: "Lead story.", body: "Body one." },
      { kicker: "Standings", headline: "Table talk.", body: "Body two." },
    ],
    "2026-10-26",
  );
  let gazette = store.getState().gazette;
  // The daily edition is on top: its first entry is the page's featured story.
  assert.equal(gazette[0]!.id, "daily-1-2026-10-26");
  assert.equal(gazette[1]!.id, "daily-1-2026-10-26-2");
  assert.equal(gazette[0]!.week, 1);
  // A rewrite the same day replaces, never stacks.
  store.getState().postDailyGazette([{ kicker: "Front page", headline: "New lead.", body: "Fresh." }], "2026-10-26");
  gazette = store.getState().gazette;
  assert.equal(gazette.filter((g) => g.id.startsWith("daily-1-2026-10-26")).length, 1);
  assert.equal(gazette[0]!.headline, "New lead.");
  // Recap replaces the week's template entries but keeps the House call.
  store.getState().postRecapGazette(1, [
    { id: "g-1-open", week: 1, boutId: null, kicker: "Shakedown", headline: "Claude opener.", body: "Recap." },
  ]);
  gazette = store.getState().gazette;
  assert.equal(gazette[0]!.headline, "Claude opener.");
  assert.ok(gazette.some((g) => g.kicker === "House call"));
  assert.ok(!gazette.some((g) => g.headline === "Old opener."));
});

test("store actions are boss-gated", () => {
  const store = createStore(pitCreator);
  const before = store.getState().gazette.length;
  store.getState().postDailyGazette([{ kicker: "X", headline: "Nope.", body: "Nope." }], "2026-10-26");
  store.getState().postRecapGazette(1, [
    { id: "g-1-open", week: 1, boutId: null, kicker: "X", headline: "Nope.", body: "Nope." },
  ]);
  assert.equal(store.getState().gazette.length, before);
});
