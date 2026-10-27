/**
 * Sending the daily store reminders. Server-only. Email goes out through Resend's HTTP API
 * with a key from the deployment's environment:
 *
 *   RESEND_API_KEY  the sending key
 *   NUDGE_FROM      the sender, e.g. "Battle Bot League <league@thewatermangames.live>"
 *
 * Nothing here logs or returns the key or the store addresses beyond the Desk.
 */
import type { Sql } from "@/lib/db";
import type { PitData } from "./types";

export function emailConfigured() {
  const missing = ["RESEND_API_KEY", "NUDGE_FROM"].filter((k) => !process.env[k]?.trim());
  return { ok: missing.length === 0, missing };
}

export function centralDate(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(now);
}

export function centralHour(now: Date) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }).format(now));
}

const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
export function validEmail(email: string) {
  return EMAIL.test(email.trim()) && email.trim().length <= 200;
}

export async function sendEmail(to: string, subject: string, text: string, html: string) {
  const cfg = emailConfigured();
  if (!cfg.ok) throw new Error(`Email is not set up yet (missing ${cfg.missing.join(", ")}).`);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.NUDGE_FROM!.trim(), to: [to], subject, text, html }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(`The email service refused the message (HTTP ${res.status}${body.message ? `: ${body.message.slice(0, 120)}` : ""}).`);
  }
}

export async function contacts(sql: Sql) {
  return sql<{ store_id: string; email: string }>`select store_id, email from pit_store_contacts`;
}

export async function paused(sql: Sql) {
  return Boolean((await sql<{ paused: boolean }>`select paused from pit_nudge_settings where id = 'main'`)[0]?.paused);
}

/**
 * Today's reminders: one per store with an address and something to do. A store already
 * logged for this Central day is skipped, so a second cron call never sends twice.
 */
export async function sendDailyNudges(sql: Sql, data: PitData, now: Date) {
  const { nudgeFor } = await import("./nudge");
  const day = centralDate(now);
  if (await paused(sql)) return { day, sent: 0, skipped: 0, failed: 0, note: "Reminders are paused on the Desk." };
  const list = await contacts(sql);
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const { store_id, email } of list) {
    const nudge = nudgeFor(data, store_id, now);
    if (!nudge) {
      skipped += 1;
      continue;
    }
    // Claim the day first; only the claimer sends.
    const claim = await sql<{ day: string }>`
      insert into pit_nudge_log (day, store_id, status) values (${day}, ${store_id}, 'sending')
      on conflict (day, store_id) do update set status = 'sending', sent_at = now()
        where pit_nudge_log.status = 'failed'
      returning day`;
    if (!claim[0]) {
      skipped += 1;
      continue;
    }
    try {
      await sendEmail(email, nudge.subject, nudge.text, nudge.html);
      await sql`update pit_nudge_log set status = 'sent', detail = ${nudge.subject} where day = ${day} and store_id = ${store_id}`;
      sent += 1;
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Send failed.";
      await sql`update pit_nudge_log set status = 'failed', detail = ${detail.slice(0, 300)} where day = ${day} and store_id = ${store_id}`;
      failed += 1;
    }
  }
  return { day, sent, skipped, failed, note: "" };
}
