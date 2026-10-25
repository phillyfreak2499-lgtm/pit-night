/** Storage for Claude-written copy: claim once, write once, never rewrite a ready row. */
import type { Sql } from "@/lib/db";

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
 * Rows of this kind first claimed on a Chicago calendar day (`YYYY-MM-DD`).
 * `created_at` stays on the original insert, so a retry does not count twice.
 */
export async function countClaimedOnDay(sql: Sql, kind: string, day: string) {
  const rows = await sql<{ n: number }>`
    select count(*)::int as n
    from pit_claude_text
    where kind = ${kind}
      and to_char(created_at at time zone 'America/Chicago', 'YYYY-MM-DD') = ${day}`;
  return Number(rows[0]?.n ?? 0);
}

export async function finishCopy(sql: Sql, kind: string, key: string, result: { body: string } | { error: string }) {
  if ("body" in result)
    await sql`update pit_claude_text set status = 'ready', body = ${result.body}, error = null where kind = ${kind} and key = ${key} and status = 'pending'`;
  else
    await sql`update pit_claude_text set status = 'failed', error = ${result.error.slice(0, 300)} where kind = ${kind} and key = ${key} and status = 'pending'`;
}
