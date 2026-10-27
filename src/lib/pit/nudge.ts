/**
 * The daily store reminder: what a store still has to do today, built only from the saved
 * season. One email per store per Pit Week day. No codes, no crew names, nothing private.
 */
import { shopOpen } from "./engine";
import { centralDay, deadlineDue, weekDeadline } from "./time";
import { DAY_LABEL, dayDate, programWeek } from "./training";
import { captainOf, countedCrew, weekProgress } from "./week";
import type { PitData } from "./types";

export const SITE = "https://thewatermangames.live";

export type Nudge = { subject: string; lines: string[]; text: string; html: string };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The Pit Week day it is right now in Central time, if today is one. */
export function pitWeekDay(data: PitData, now: Date) {
  const plan = programWeek(data.week);
  if (!plan) return null;
  const today = centralDay(now);
  const day = plan.days.find((d) => {
    const at = centralDay(dayDate(plan, d.day));
    return at.y === today.y && at.m === today.m && at.d === today.d;
  });
  return day ? { plan, day } : null;
}

/** What one store has left today, or null when there is nothing to remind it about. */
export function nudgeFor(data: PitData, storeId: string, now: Date): Nudge | null {
  const store = data.stores.find((s) => s.id === storeId);
  if (!store || data.phase !== "open" || deadlineDue(data.week, now)) return null;
  const today = pitWeekDay(data, now);
  if (!today) return null;
  const progress = weekProgress(data, storeId, data.week);
  if (!progress.crew.length) return null; // Championship Week: finalists only.
  const crew = countedCrew(data, storeId, data.week);
  const { day } = today;

  const jobsLeft = crew.reduce(
    (n, c) => n + day.jobs.filter((j) => !data.jobLog.some((e) => e.week === data.week && e.jobId === j.id && e.crewId === c.id)).length,
    0,
  );
  const toApprove = data.jobLog.filter((e) => e.week === data.week && e.storeId === storeId && e.status === "pending").length;
  const sparksLeft = crew.filter(
    (c) => !data.sparkLog.some((e) => e.week === data.week && e.day === day.day && e.crewId === c.id),
  ).length;
  const cap = captainOf(data, storeId);
  const careLeft = cap && !progress.careDone && !progress.carePending;
  const bot = data.bots.find((b) => b.storeId === storeId);
  const coins = bot && shopOpen(data) ? Object.values(bot.coins).reduce((sum, n) => sum + (n ?? 0), 0) : 0;
  const lock = weekDeadline(data.week);

  const lines: string[] = [];
  if (jobsLeft) lines.push(`${plural(jobsLeft, "Pit Week job")} left today (${DAY_LABEL[day.day]}).`);
  if (sparksLeft) lines.push(`The Daily Spark is open: ${plural(sparksLeft, "crew member")} still to answer today's three questions.`);
  if (toApprove) lines.push(`${plural(toApprove, "job")} waiting for the captain's thumbs-up.`);
  if (careLeft) lines.push("The captain's CARE job for the week is still open.");
  if (coins) lines.push(`${plural(coins, "coin")} waiting in your Shop. Spend them before the bots lock.`);
  if (day.day === "sat") lines.push(lock ? `Builds lock today: ${lock.label}. Lock in your parts.` : "Builds lock tonight at close. Lock in your parts.");
  if (!lines.length) return null;

  const subject =
    jobsLeft || sparksLeft
      ? `${store.name}: ${[jobsLeft ? plural(jobsLeft, "job") : "", sparksLeft ? "Daily Spark" : ""].filter(Boolean).join(" + ")} open today`
      : `${store.name}: ${lines[0]!.replace(/\.$/, "")}`;
  const shop = `${SITE}/shop/${storeId}`;
  const week = `${SITE}/week`;
  const text = [
    `Good morning, ${store.name}!`,
    "",
    ...lines.map((l) => `• ${l}`),
    "",
    `Pit Week: ${week}`,
    coins ? `Your Shop: ${shop}` : "",
    "",
    "— The Waterman Battle Bot League",
  ]
    .filter((l, i, all) => l !== "" || all[i - 1] !== "")
    .join("\n");
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1d1a14">
<p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#b07a10;margin:0">The Waterman Battle Bot League</p>
<h1 style="font-size:22px;margin:6px 0 12px">Good morning, ${escape(store.name)}!</h1>
<ul style="padding-left:18px;font-size:15px;line-height:1.5">${lines.map((l) => `<li>${escape(l)}</li>`).join("")}</ul>
<p style="margin:18px 0 8px"><a href="${week}" style="background:#f0a202;color:#15110b;padding:10px 16px;text-decoration:none;font-weight:bold;display:inline-block">Open Pit Week</a>
${coins ? ` <a href="${shop}" style="border:2px solid #f0a202;color:#8a5a00;padding:8px 14px;text-decoration:none;font-weight:bold;display:inline-block">Open the Shop</a>` : ""}</p>
<p style="font-size:12px;color:#7a7266">Sign in on the Clipboard with your store code. Reminders go out at 8 a.m. Central on Pit Week days.</p>
</div>`;
  return { subject, lines, text, html };
}
