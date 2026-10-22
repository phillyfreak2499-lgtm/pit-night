/**
 * Monday 5:00 a.m. official scorecard import and card run.
 *
 * Deterministic code decides every official number, color and fight. Claude is not
 * involved here. The job reads finalized Snowflake results for the week the site's
 * own card is waiting on, validates all 14 stores × 6 metrics, snapshots the season,
 * writes the whole scorecard in one atomic statement, reads it back, and only then
 * locks remaining builds and runs the card once through the Desk's own actions.
 *
 * All I/O is injected (JobIO), so tests run the full flow on disposable data.
 */
import { METRICS, type Metric } from "./catalog";
import { gradeMetric, hashString } from "./engine";
import type { Grade, PitData, StatKey, StoreCard } from "./types";

// ---------------------------------------------------------------------------
// Approved configuration. Owner approved the store map and Sunday-Saturday weeks on 2026-10-22.
// ---------------------------------------------------------------------------

export const SEASON = "Period 12";
export const ZONE = "America/Chicago";

/** Regular-season fight Mondays and the Sunday–Saturday weeks they grade (site week blurbs). */
export const FIGHT_WEEKS = [
  { week: 1, monday: "2026-11-02", start: "2026-10-25", end: "2026-10-31" },
  { week: 2, monday: "2026-11-09", start: "2026-11-01", end: "2026-11-07" },
  { week: 3, monday: "2026-11-16", start: "2026-11-08", end: "2026-11-14" },
  { week: 4, monday: "2026-11-23", start: "2026-11-15", end: "2026-11-21" },
] as const;
/** Week 5 is Championship Saturday (Nov 28). The Monday job never runs it. */

/** Site store → Snowflake store, matched by store number (store names are not unique: Shreveport has two records). */
export const STORE_MAP = [
  { storeId: "waco", number: "468", franchise: "WATERMAN", name: "WACO, TX" },
  { storeId: "arlington", number: "480", franchise: "WATERMAN", name: "ARLINGTON, TX" },
  { storeId: "rockwall", number: "610", franchise: "WATERMAN", name: "ROCKWALL, TX" },
  { storeId: "southlake", number: "453", franchise: "WATERMAN", name: "SOUTHLAKE, TX" },
  { storeId: "college", number: "639", franchise: "WATERMAN", name: "COLLEGE STATION, TX" },
  { storeId: "hulen", number: "421", franchise: "WATERMAN", name: "FORT WORTH (BRYANT IRVIN RD), TX" },
  { storeId: "allen", number: "488", franchise: "WATERMAN", name: "ALLEN, TX" },
  { storeId: "plano", number: "428", franchise: "WATERMAN", name: "PLANO, TX" },
  { storeId: "temple", number: "573", franchise: "WATERMAN", name: "TEMPLE, TX" },
  { storeId: "alliance", number: "533", franchise: "WATERMAN", name: "ALLIANCE (FORT WORTH), TX" },
  { storeId: "waxahachie", number: "694", franchise: "WATERMAN", name: "WAXAHACHIE, TX" },
  // These three report under franchise MCDONALD in Snowflake; the owner confirmed they are the league stores.
  { storeId: "tyler", number: "608", franchise: "MCDONALD", name: "TYLER, TX" },
  { storeId: "abilene", number: "700", franchise: "MCDONALD", name: "ABILENE, TX" },
  { storeId: "shreveport", number: "1492", franchise: "MCDONALD", name: "SHREVEPORT, LA" },
] as const;

/** Grading rules are the site's own METRICS bands (green/blue/orange, `>=` after rounding to cents; below orange is red). */
export const RULE_VERSION = `metrics-bands-${hashString(JSON.stringify(METRICS.map((m) => [m.stat, m.bands])))}`;

/** Block anything outside these. A real week can be bad; it cannot be impossible. */
const PLAUSIBLE: Record<StatKey, [number, number]> = {
  nsnu: [0, 10000],
  conv: [0, 100],
  demoRate: [0, 100],
  demoClose: [0, 100],
  arch: [0, 10],
  ticket: [0, 20000],
};

/** Run window: from 5:00 a.m. Central on the fight Monday until that day ends. */
export const RUN_FROM_HOUR = 5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One Snowflake row, raw sums for the store over the reporting week. Strings as the SQL API returns them. */
export type RawRow = {
  store: string | null;
  store_number: string | null;
  franchise: string | null;
  net_sales: string | null;
  new_ups: string | null;
  walkouts: string | null;
  demos_seen: string | null;
  demos_sold: string | null;
  demo_sales: string | null;
  arch_supports_sold: string | null;
  arch_supports_returned: string | null;
};

export type SnowflakeRead = { rows: RawRow[]; latestDate: string | null; queryIds: string[] };

export type StagedStore = {
  storeId: string;
  storeName: string;
  values: Record<StatKey, number>;
  grades: Record<StatKey, Grade>;
};

export type Outcome = "success" | "noop" | "blocked" | "failed";

export type JobRow = {
  jobKey: string;
  status: "running" | Outcome;
  stage: "claimed" | "staged" | "applied" | "verified" | "published";
  staged: StagedStore[] | null;
  queryIds: string[];
  report: string | null;
};

export interface JobIO {
  now(): Date;
  readSeason(): Promise<{ rev: number; data: PitData }>;
  /** One atomic statement: snapshot the current doc, then replace it only if rev still matches. Returns the new rev or null. */
  writeSeason(expectedRev: number, next: PitData, snapshot: { jobKey: string; step: string }): Promise<number | null>;
  /** Claim the job (or resume an abandoned one). Returns null when another run holds it or it already finished. */
  claim(jobKey: string): Promise<JobRow | null>;
  existing(jobKey: string): Promise<JobRow | null>;
  save(jobKey: string, patch: Partial<JobRow>): Promise<void>;
  fetchWeek(start: string, end: string): Promise<SnowflakeRead>;
  sleep(ms: number): Promise<void>;
  /** Run the Desk's lock + Run the card actions on the given data as the commissioner. */
  runCard(data: PitData): PitData;
}

// ---------------------------------------------------------------------------
// Pure steps
// ---------------------------------------------------------------------------

export function centralParts(now: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
}

export function jobKeyFor(week: number, end: string) {
  return `p12-w${week}-${end}`;
}

/** Which card this run may prepare, or why it must do nothing. Never advances the league to fit the dates. */
export function eligibility(
  now: Date,
  data: PitData,
): { ok: true; fight: (typeof FIGHT_WEEKS)[number] } | { ok: false; outcome: "noop" | "blocked"; why: string } {
  const { date, hour } = centralParts(now);
  const fight = FIGHT_WEEKS.find((f) => f.monday === date);
  if (!fight) return { ok: false, outcome: "noop", why: `No regular-season fight card is scheduled for ${date}.` };
  if (hour < RUN_FROM_HOUR) return { ok: false, outcome: "noop", why: `Before ${RUN_FROM_HOUR}:00 a.m. Central on ${date}.` };
  if (data.seasonName !== SEASON) return { ok: false, outcome: "blocked", why: `The site season is "${data.seasonName}", not ${SEASON}.` };
  if (data.week !== fight.week)
    return {
      ok: false,
      outcome: "blocked",
      why: `The site is on league week ${data.week} (${data.phase}); the ${date} card is week ${fight.week}. The job does not advance the league to make dates fit.`,
    };
  if (!["open", "locked"].includes(data.phase))
    return { ok: false, outcome: "noop", why: `Week ${fight.week}'s card is already ${data.phase}. Posted cards are never rerun.` };
  return { ok: true, fight };
}

function num(v: string | null | undefined): number | null {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Validate every store and every metric. Any problem blocks the whole card; nothing is guessed or carried over. */
export function stage(
  read: SnowflakeRead,
  second: SnowflakeRead,
  fight: { start: string; end: string },
  data: PitData,
): { ok: true; staged: StagedStore[]; checks: string[] } | { ok: false; problems: string[]; checks: string[] } {
  const problems: string[] = [];
  const checks: string[] = [];
  // Finalization: the source must have loaded days after the week closed, and two reads must agree.
  if (!read.latestDate || read.latestDate <= fight.end)
    problems.push(`Snowflake has no data after ${fight.end} (latest ${read.latestDate ?? "none"}); the week may not be final.`);
  else checks.push(`Freshness: data loaded through ${read.latestDate}, after the ${fight.end} close.`);
  const key = (r: SnowflakeRead) => JSON.stringify([...r.rows].sort((a, b) => String(a.store_number).localeCompare(String(b.store_number))));
  if (key(read) !== key(second)) problems.push("Two reads of the same week disagreed; the source is still changing.");
  else checks.push("Stability: two reads returned identical rows.");

  const staged: StagedStore[] = [];
  for (const m of STORE_MAP) {
    const store = data.stores.find((s) => s.id === m.storeId);
    if (!store) {
      problems.push(`Site store ${m.storeId} is missing from the league.`);
      continue;
    }
    const rows = read.rows.filter((r) => String(r.store_number ?? "").trim() === m.number);
    if (rows.length === 0) {
      problems.push(`${store.name}: no Snowflake row for store #${m.number}.`);
      continue;
    }
    if (rows.length > 1) {
      problems.push(`${store.name}: ${rows.length} rows for store #${m.number} (duplicate).`);
      continue;
    }
    const r = rows[0]!;
    if ((r.franchise ?? "").toUpperCase() !== m.franchise || (r.store ?? "").toUpperCase() !== m.name)
      problems.push(`${store.name}: store #${m.number} came back as "${r.store}" / ${r.franchise}, expected "${m.name}" / ${m.franchise}.`);
    const f = {
      net: num(r.net_sales),
      ups: num(r.new_ups),
      walk: num(r.walkouts),
      seen: num(r.demos_seen),
      sold: num(r.demos_sold),
      demoSales: num(r.demo_sales),
      archSold: num(r.arch_supports_sold),
      archRet: num(r.arch_supports_returned),
    };
    const missing = Object.entries(f).filter(([, v]) => v === null).map(([k]) => k);
    // A null arch-returns count means none were returned; every other field must be present.
    const hardMissing = missing.filter((k) => k !== "archRet");
    if (hardMissing.length) {
      problems.push(`${store.name}: missing ${hardMissing.join(", ")}.`);
      continue;
    }
    const traffic = f.ups! + f.walk!;
    if (traffic <= 0) {
      problems.push(`${store.name}: no new ups or walkouts recorded; NSNU, Conv % and Demo Rate cannot be computed.`);
      continue;
    }
    if (f.seen! <= 0) {
      problems.push(`${store.name}: no demos seen; Demo Close % cannot be computed.`);
      continue;
    }
    if (f.sold! <= 0) {
      problems.push(`${store.name}: no demos sold; Arch Supports per sale and Demo Ticket cannot be computed.`);
      continue;
    }
    const values: Record<StatKey, number> = {
      nsnu: round2(f.net! / traffic),
      conv: round2((f.sold! / traffic) * 100),
      demoRate: round2((f.seen! / traffic) * 100),
      demoClose: round2((f.sold! / f.seen!) * 100),
      arch: round2((f.archSold! - (f.archRet ?? 0)) / f.sold!),
      ticket: round2(f.demoSales! / f.sold!),
    };
    for (const m2 of METRICS) {
      const [lo, hi] = PLAUSIBLE[m2.stat];
      const v = values[m2.stat];
      if (!Number.isFinite(v) || v < lo || v > hi) problems.push(`${store.name}: ${m2.label} ${v} is outside ${lo}–${hi}.`);
    }
    const grades = Object.fromEntries(METRICS.map((m2) => [m2.stat, gradeMetric(m2.stat, values[m2.stat])])) as Record<StatKey, Grade>;
    staged.push({ storeId: m.storeId, storeName: store.name, values, grades });
  }
  const mapped = new Set<string>(STORE_MAP.map((m) => m.number));
  const extra = read.rows.filter((r) => !mapped.has(String(r.store_number ?? "").trim()));
  if (extra.length) checks.push(`Ignored ${extra.length} unmapped Snowflake row(s): ${extra.map((r) => r.store).join(", ")}.`);
  if (data.stores.length !== STORE_MAP.length) problems.push(`The league has ${data.stores.length} stores; the approved map has ${STORE_MAP.length}.`);
  for (const s of data.stores)
    if (!data.storeCards.some((c) => c.storeId === s.id && c.week === data.week)) problems.push(`${s.name}: no week ${data.week} scorecard on the site.`);
  const metricCount = staged.length * METRICS.length;
  if (!problems.length) checks.push(`Completeness: ${staged.length} stores × ${METRICS.length} metrics = ${metricCount} values staged and graded.`);
  return problems.length ? { ok: false, problems, checks } : { ok: true, staged, checks };
}

const FIELD: Record<StatKey, keyof StoreCard> = {
  nsnu: "nsnu",
  conv: "conv",
  demoRate: "demoRate",
  demoClose: "demoClose",
  arch: "arch",
  ticket: "demoTicket",
};

/**
 * The official scorecard on this week's cards: actual values, official NSNU dollars, and the
 * graded colors recorded alongside them. Nothing else in the season changes: locks, parts,
 * coins, wear, training, unlocks, crews and the Period 11 kickoff are left exactly as they are.
 */
export function applyScorecard(data: PitData, staged: StagedStore[]): PitData {
  const byStore = new Map(staged.map((s) => [s.storeId, s]));
  return {
    ...data,
    storeCards: data.storeCards.map((card) => {
      const s = card.week === data.week ? byStore.get(card.storeId) : undefined;
      if (!s) return card;
      const next: StoreCard = { ...card, projected: false, nsnuOfficial: true, grades: { ...s.grades } };
      for (const m of METRICS) (next as Record<string, unknown>)[FIELD[m.stat]] = s.values[m.stat];
      return next;
    }),
  };
}

/** Every staged value and color as saved. Empty means the read-back matches. */
export function readbackMismatches(data: PitData, staged: StagedStore[], week: number): string[] {
  const out: string[] = [];
  for (const s of staged) {
    const card = data.storeCards.find((c) => c.storeId === s.storeId && c.week === week);
    if (!card) {
      out.push(`${s.storeName}: card missing after write.`);
      continue;
    }
    if (!card.nsnuOfficial) out.push(`${s.storeName}: NSNU not marked official.`);
    for (const m of METRICS) {
      const saved = card[FIELD[m.stat]] as number;
      if (saved !== s.values[m.stat]) out.push(`${s.storeName}: ${m.label} saved ${saved}, staged ${s.values[m.stat]}.`);
      if (card.grades?.[m.stat] !== s.grades[m.stat])
        out.push(`${s.storeName}: ${m.label} color saved ${card.grades?.[m.stat] ?? "none"}, staged ${s.grades[m.stat]}.`);
    }
  }
  return out;
}

/** After the card runs: one result per regular bout, every bot locked, and the scorecard untouched. */
export function publishMismatches(data: PitData, staged: StagedStore[], week: number): string[] {
  const out = readbackMismatches(data, staged, week);
  if (data.week !== week) out.push(`League moved to week ${data.week}.`);
  if (data.phase !== "fought") out.push(`Phase is ${data.phase}, expected fought.`);
  const bouts = data.bouts.filter((b) => b.week === week && b.kind === "bout");
  if (bouts.length !== data.stores.length / 2) out.push(`${bouts.length} bouts posted, expected ${data.stores.length / 2}.`);
  if (bouts.some((b) => !b.result)) out.push("A posted bout has no result.");
  const fighters = new Set(bouts.flatMap((b) => b.storeIds));
  if (fighters.size !== data.stores.length) out.push(`${fighters.size} stores fought, expected ${data.stores.length} (no byes).`);
  const unlocked = data.bots.filter((b) => !b.locked);
  if (unlocked.length) out.push(`${unlocked.length} bot(s) not locked.`);
  return out;
}

function metricLabel(m: Metric) {
  return m.short;
}

export function formatReport(r: {
  outcome: Outcome;
  now: Date;
  jobKey: string | null;
  fight: { week: number; start: string; end: string; monday: string } | null;
  why?: string[];
  checks?: string[];
  staged?: StagedStore[] | null;
  queryIds?: string[];
  card?: string;
}) {
  const local = new Intl.DateTimeFormat("en-US", { timeZone: ZONE, dateStyle: "medium", timeStyle: "short" }).format(r.now);
  const lines = [
    `Waterman Battle Bot League — Monday job: ${r.outcome.toUpperCase()}`,
    `Run: ${local} Central (${r.now.toISOString()} UTC)`,
  ];
  if (r.fight)
    lines.push(`Card: ${SEASON} week ${r.fight.week}, fight Monday ${r.fight.monday}. Reporting period ${r.fight.start} to ${r.fight.end} (Sun–Sat, Central).`);
  if (r.jobKey) lines.push(`Job: ${r.jobKey} · grading rules ${RULE_VERSION}`);
  if (r.queryIds?.length) lines.push(`Snowflake query IDs: ${r.queryIds.join(", ")}`);
  if (r.why?.length) lines.push("", "Why:", ...r.why.map((w) => `- ${w}`));
  if (r.checks?.length) lines.push("", "Checks:", ...r.checks.map((c) => `- ${c}`));
  if (r.staged?.length) {
    lines.push("", `Store | NSNU $ | ${METRICS.map(metricLabel).join(" | ")}`);
    for (const s of r.staged)
      lines.push(`${s.storeName} | ${s.values.nsnu.toFixed(2)} | ${METRICS.map((m) => s.grades[m.stat]).join(" | ")}`);
  }
  if (r.card) lines.push("", r.card);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// The job
// ---------------------------------------------------------------------------

/**
 * Read, validate and grade a week without writing anything. Used by the Desk's preview
 * and by the scheduler until the owner turns on writes (MONDAY_JOB_ENABLED=1).
 */
export async function dryRun(io: JobIO, period: { start: string; end: string; week?: number }) {
  const now = io.now();
  const { data } = await io.readSeason();
  const a = await io.fetchWeek(period.start, period.end);
  await io.sleep(STABILITY_GAP_MS);
  const b = await io.fetchWeek(period.start, period.end);
  const queryIds = [...a.queryIds, ...b.queryIds];
  const result = stage(a, b, period, data);
  const fight = { week: period.week ?? data.week, monday: "(dry run)", start: period.start, end: period.end };
  const outcome: Outcome = result.ok ? "noop" : "blocked";
  const report = formatReport({
    outcome,
    now,
    jobKey: null,
    fight,
    why: result.ok ? ["Dry run: validated and graded, nothing written."] : result.problems,
    checks: result.checks,
    staged: result.ok ? result.staged : null,
    queryIds,
  });
  return { ok: result.ok, report };
}

/** Reads twice this far apart; a source still loading shows up as a mismatch. */
export const STABILITY_GAP_MS = 20_000;

export async function runMondayJob(io: JobIO): Promise<{ outcome: Outcome; report: string; jobKey: string | null }> {
  const now = io.now();
  const first = await io.readSeason();
  const gate = eligibility(now, first.data);
  if (!gate.ok) {
    // A finished job for today explains a posted card better than a bare no-op.
    const today = FIGHT_WEEKS.find((f) => f.monday === centralParts(now).date);
    const done = today ? await io.existing(jobKeyFor(today.week, today.end)) : null;
    if (done?.report && done.status === "success") return { outcome: "noop", report: `Already completed.\n\n${done.report}`, jobKey: done.jobKey };
    return { outcome: gate.outcome, report: formatReport({ outcome: gate.outcome, now, jobKey: null, fight: today ?? null, why: [gate.why] }), jobKey: null };
  }
  const fight = gate.fight;
  const jobKey = jobKeyFor(fight.week, fight.end);
  const job = await io.claim(jobKey);
  if (!job) {
    const row = await io.existing(jobKey);
    const report = row?.report ?? formatReport({ outcome: "noop", now, jobKey, fight, why: ["Another run holds this job right now."] });
    return { outcome: "noop", report, jobKey };
  }

  const finish = async (outcome: Outcome, parts: Omit<Parameters<typeof formatReport>[0], "outcome" | "now" | "jobKey" | "fight">) => {
    const report = formatReport({ outcome, now, jobKey, fight, ...parts });
    await io.save(jobKey, { status: outcome, report });
    return { outcome, report, jobKey };
  };

  try {
    let staged = job.staged;
    let queryIds = job.queryIds;
    let checks: string[] = [];
    // 1. Stage (fresh run, or a retry that never staged).
    if (!staged || job.stage === "claimed") {
      const a = await io.fetchWeek(fight.start, fight.end);
      await io.sleep(STABILITY_GAP_MS);
      const b = await io.fetchWeek(fight.start, fight.end);
      queryIds = [...a.queryIds, ...b.queryIds];
      const result = stage(a, b, fight, first.data);
      checks = result.checks;
      if (!result.ok) return await finish("blocked", { why: result.problems, checks, queryIds });
      staged = result.staged;
      await io.save(jobKey, { stage: "staged", staged, queryIds });
    } else {
      checks.push(`Resumed job at stage "${job.stage}" with the staged values saved by the earlier attempt.`);
    }

    // 2. Apply atomically, unless an earlier attempt already did and the read-back still matches.
    let current = await io.readSeason();
    // An earlier attempt may have posted the card and died before recording it: verify, never rerun.
    const postedByUs = ["verified", "published"].includes(job.stage) && current.data.week === fight.week && current.data.phase === "fought";
    if (postedByUs) return await verifyPosted(current.data);
    const recheck = eligibility(now, current.data);
    if (!recheck.ok) return await finish(recheck.outcome === "noop" ? "noop" : "blocked", { why: [recheck.why], checks, staged, queryIds });
    if (readbackMismatches(current.data, staged, fight.week).length) {
      const rev = await io.writeSeason(current.rev, applyScorecard(current.data, staged), { jobKey, step: "scorecard" });
      if (rev === null) throw new Error("The league changed while the scorecard was being written. Nothing was saved; retry will re-check.");
      await io.save(jobKey, { stage: "applied" });
      current = await io.readSeason();
    }
    const scoreMiss = readbackMismatches(current.data, staged, fight.week);
    if (scoreMiss.length) return await finish("failed", { why: ["Read-back did not match the staged scorecard. The card was not run.", ...scoreMiss], checks, staged, queryIds });
    checks.push(`Read-back: all ${staged.length * METRICS.length} saved values and colors match the staged set.`);
    await io.save(jobKey, { stage: "verified" });

    // 3. Lock remaining builds and run the card once, atomically, through the Desk's own actions.
    const ran = io.runCard(current.data);
    if (ran.phase !== "fought") return await finish("failed", { why: [`Run the card refused: ${(ran as { flash?: string }).flash ?? ran.phase}.`], checks, staged, queryIds });
    const rev = await io.writeSeason(current.rev, ran, { jobKey, step: "card" });
    if (rev === null) throw new Error("The league changed while the card was being posted. Nothing was posted; retry will re-check.");
    await io.save(jobKey, { stage: "published" });

    // 4. Verify what is actually saved.
    return await verifyPosted((await io.readSeason()).data);

    async function verifyPosted(after: PitData) {
      const miss = publishMismatches(after, staged!, fight.week);
      if (miss.length) return await finish("failed", { why: ["The posted card did not verify.", ...miss], checks, staged, queryIds });
      const bouts = after.bouts.filter((b) => b.week === fight.week && b.kind === "bout");
      checks.push(`Card posted and verified: ${bouts.length} bouts with saved results, ${after.bots.length} bots locked, scorecard unchanged.`);
      return await finish("success", {
        checks,
        staged,
        queryIds,
        card: `Card ${SEASON} W${fight.week} (${bouts.map((b) => b.id).join(", ")}) is posted and ready for Monday playback. Damage, payouts and the next week stay with the Desk.`,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return await finish("failed", { why: [message], checks: [], staged: job.staged, queryIds: job.queryIds });
  }
}
