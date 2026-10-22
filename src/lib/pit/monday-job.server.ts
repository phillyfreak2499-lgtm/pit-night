/**
 * Production wiring for the Monday job: Neon for the season, the job row and
 * snapshots; Snowflake for the week's results; the Desk's own store actions for
 * locking and running the card. Server-only.
 *
 * The SQL lives in plain functions over a `Sql` so tests run it on PGLite.
 */
import type { Sql } from "@/lib/db";
import type { JobIO, JobRow } from "./monday-import";
import type { PitData } from "./types";

/** How long one run may hold the job before another may take over. */
const LEASE = "10 minutes";

type DbRow = {
  job_key: string;
  status: JobRow["status"];
  stage: JobRow["stage"];
  staged: string | null;
  query_ids: string;
  report: string | null;
};

const toJob = (r: DbRow): JobRow => ({
  jobKey: r.job_key,
  status: r.status,
  stage: r.stage,
  staged: r.staged ? JSON.parse(r.staged) : null,
  queryIds: JSON.parse(r.query_ids || "[]"),
  report: r.report,
});

/**
 * One statement: the snapshot and the update succeed or fail together, and only if
 * nobody changed the season since it was read. Returns the new rev, or null.
 */
export async function writeSeasonDoc(sql: Sql, expectedRev: number, doc: string, snapshot: { jobKey: string; step: string }) {
  const id = `${snapshot.jobKey}:${snapshot.step}:${expectedRev}`;
  const rows = await sql<{ rev: number }>`
    with snap as (
      insert into pit_season_snapshots (id, job_key, step, rev, doc)
      select ${id}, ${snapshot.jobKey}, ${snapshot.step}, rev, doc from pit_season where id = 'main' and rev = ${expectedRev}
      on conflict (id) do nothing
      returning 1
    )
    update pit_season set rev = rev + 1, doc = ${doc}, updated_at = now()
    where id = 'main' and rev = ${expectedRev} and exists (select 1 from snap)
    returning rev`;
  return rows[0] ? Number(rows[0].rev) : null;
}

/** Take the job, or resume one that was blocked, failed or abandoned. Null while another run holds it or after success. */
export async function claimJob(sql: Sql, jobKey: string) {
  const rows = await sql<DbRow>`
    insert into pit_monday_jobs (job_key, status, stage, lease_until)
    values (${jobKey}, 'running', 'claimed', now() + ${LEASE}::interval)
    on conflict (job_key) do update
      set status = 'running', attempts = pit_monday_jobs.attempts + 1,
          lease_until = now() + ${LEASE}::interval, updated_at = now()
      where pit_monday_jobs.status in ('blocked', 'failed')
         or (pit_monday_jobs.status = 'running' and pit_monday_jobs.lease_until < now())
    returning job_key, status, stage, staged, query_ids, report`;
  return rows[0] ? toJob(rows[0]) : null;
}

export async function readJob(sql: Sql, jobKey: string) {
  const rows = await sql<DbRow>`select job_key, status, stage, staged, query_ids, report from pit_monday_jobs where job_key = ${jobKey}`;
  return rows[0] ? toJob(rows[0]) : null;
}

export async function saveJob(sql: Sql, jobKey: string, patch: Partial<JobRow>) {
  const cur = await readJob(sql, jobKey);
  if (!cur) return;
  const next = { ...cur, ...patch };
  await sql`
    update pit_monday_jobs set status = ${next.status}, stage = ${next.stage},
      staged = ${next.staged ? JSON.stringify(next.staged) : null}, query_ids = ${JSON.stringify(next.queryIds)},
      report = ${next.report}, updated_at = now()
    where job_key = ${jobKey}`;
}

/** Keep a dry run's report where the Desk can read it. Dry-run keys never collide with real jobs. */
export async function saveDryRun(sql: Sql, jobKey: string, status: "noop" | "blocked", report: string) {
  await sql`
    insert into pit_monday_jobs (job_key, status, stage, report, lease_until)
    values (${jobKey}, ${status}, 'claimed', ${report}, now())
    on conflict (job_key) do update set status = excluded.status, report = excluded.report,
      attempts = pit_monday_jobs.attempts + 1, updated_at = now()`;
}

export async function productionIO(overrides: Partial<JobIO> = {}): Promise<JobIO> {
  const [{ getSql }, { loadSeason }, store, vanilla, snowflake] = await Promise.all([
    import("@/lib/db"),
    import("./authoritative"),
    import("./store"),
    import("zustand/vanilla"),
    import("./snowflake.server"),
  ]);
  const sql = await getSql();
  return {
    now: () => new Date(),
    async readSeason() {
      const s = await loadSeason();
      return { rev: Number(s.row.rev), data: s.data as PitData };
    },
    writeSeason: (expectedRev, next, snapshot) => writeSeasonDoc(sql, expectedRev, JSON.stringify(store.sharedDoc(next)), snapshot),
    claim: (jobKey) => claimJob(sql, jobKey),
    existing: (jobKey) => readJob(sql, jobKey),
    save: (jobKey, patch) => saveJob(sql, jobKey, patch),
    fetchWeek: snowflake.fetchWeek,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    runCard(data) {
      const state = vanilla.createStore(store.pitCreator);
      // Only the shared season: never another store instance's actions.
      state.setState({ ...store.sharedDoc(data), session: { role: "commissioner", storeId: null, crewId: null }, flash: "" });
      if (state.getState().phase === "open") state.getState().lockFriday();
      state.getState().runSaturday();
      return state.getState();
    },
    ...overrides,
  };
}

export async function recordDryRun(jobKey: string, status: "noop" | "blocked", report: string) {
  const { getSql } = await import("@/lib/db");
  await saveDryRun(await getSql(), jobKey, status, report);
}

/** Recent job reports for the Desk. */
export async function recentReports() {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  return sql<{ job_key: string; status: string; stage: string; report: string | null; attempts: number; updated_at: string }>`
    select job_key, status, stage, report, attempts, updated_at::text as updated_at from pit_monday_jobs order by updated_at desc limit 8`;
}
