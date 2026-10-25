/** Storage for Claude-written copy: claim once, write once, never rewrite a ready row. */
import type { Sql } from "@/lib/db";
import { central } from "./time";

/** A claim is stale after this long, so a crashed writer does not block the copy forever. */
const PENDING_STALE = "3 minutes";
/** A failed attempt waits this long before anyone may try again, and gives up after five. */
const FAILED_RETRY = "10 minutes";
const MAX_ATTEMPTS = 5;

/** True when this caller now owns writing the copy. A ready row is never re-claimed. */
export async function claimCopy(sql: Sql, kind: string, key: string, model: string) {
  const rows = await sql<{ attempts: number }>`
    insert into pit_claude_text (kind, key, model, status)
    values (${kind}, ${key}, ${model}, 'pending')
    on conflict (kind, key) do update
      set status = 'pending', attempts = pit_claude_text.attempts + 1, claimed_at = now(), model = excluded.model, error = null
      where (pit_claude_text.status = 'pending' and pit_claude_text.claimed_at < now() - ${PENDING_STALE}::interval)
         or (pit_claude_text.status = 'failed' and pit_claude_text.claimed_at < now() - ${FAILED_RETRY}::interval
             and pit_claude_text.attempts < ${MAX_ATTEMPTS})
    returning attempts`;
  return Boolean(rows[0]);
}

export async function readCopy(sql: Sql, kind: string, key: string) {
  return (
    await sql<{ status: string; body: string | null }>`select status, body from pit_claude_text where kind = ${kind} and key = ${key}`
  )[0];
}

/**
 * Chicago midnight through the next midnight, as instants.
 * `created_at >= start and created_at < end` can use the (kind, created_at) index.
 */
function chicagoDayBounds(day: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  return { start: central(y, m, d, 0, 0), end: central(y, m, d + 1, 0, 0) };
}

/**
 * Rows of this kind first claimed on a Chicago calendar day (`YYYY-MM-DD`).
 * `created_at` stays on the original insert, so a retry does not count twice.
 * The predicate is a created_at range so `pit_claude_text_kind_created` can serve it.
 */
export async function countClaimedOnDay(sql: Sql, kind: string, day: string) {
  const bounds = chicagoDayBounds(day);
  if (!bounds) return 0;
  const rows = await sql<{ n: number }>`
    select count(*)::int as n
    from pit_claude_text
    where kind = ${kind}
      and created_at >= ${bounds.start.toISOString()}::timestamptz
      and created_at < ${bounds.end.toISOString()}::timestamptz`;
  return Number(rows[0]?.n ?? 0);
}

/**
 * Insert the row, then count. Over the daily cap, the new pending row is removed
 * so two requests cannot both pass a count-then-insert check. An existing key
 * does not take another slot.
 */
export async function reserveCopy(
  sql: Sql,
  kind: string,
  key: string,
  model: string,
  limit: number,
  day: string,
): Promise<"claimed" | "existing" | "capped"> {
  if (await readCopy(sql, kind, key)) return "existing";
  if (!(await claimCopy(sql, kind, key, model))) return "existing";
  if ((await countClaimedOnDay(sql, kind, day)) > limit) {
    await sql`delete from pit_claude_text where kind = ${kind} and key = ${key} and status = 'pending' and body is null`;
    return "capped";
  }
  return "claimed";
}

export async function finishCopy(sql: Sql, kind: string, key: string, result: { body: string } | { error: string }) {
  if ("body" in result)
    await sql`update pit_claude_text set status = 'ready', body = ${result.body}, error = null where kind = ${kind} and key = ${key} and status = 'pending'`;
  else
    await sql`update pit_claude_text set status = 'failed', error = ${result.error.slice(0, 300)} where kind = ${kind} and key = ${key} and status = 'pending'`;
}
