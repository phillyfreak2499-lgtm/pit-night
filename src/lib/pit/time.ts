/** League clock. Everything opens and locks on Central time, whatever the device is set to. */
const ZONE = "America/Chicago";

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
});

function parts(ms: number) {
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(ms))) out[p.type] = p.value;
  return out;
}

/** Hours Central is behind UTC at this instant (5 in summer, 6 in winter). */
function offsetHours(ms: number) {
  const p = parts(ms);
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return Math.round((ms - asUtc) / 3600000);
}

/** A wall-clock time in Central as a real Date. */
export function central(y: number, m: number, d: number, h = 0, min = 0): Date {
  const guess = Date.UTC(y, m - 1, d, h, min);
  return new Date(guess + offsetHours(guess + 6 * 3600000) * 3600000);
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Central calendar date and weekday (0 = Sunday) for an instant. */
export function centralDay(now: Date) {
  const p = parts(now.getTime());
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), weekday: DAYS.indexOf(p.weekday ?? "Sun") };
}

/**
 * Automatic build-lock deadlines. The lock hour is 6:00 PM America/Chicago,
 * the same Saturday-close convention the countdown already uses.
 *
 * Week 1: Saturday, Oct 31, 2026, 6:00 PM CDT = 2026-10-31T23:00:00.000Z.
 * Week 5: Friday, Nov 27, 2026, 6:00 PM CST = 2026-11-28T00:00:00.000Z.
 *
 * Weeks 2–4 are intentionally absent. They still lock only when the Desk presses Lock.
 */
export type WeekDeadline = {
  week: number;
  at: Date;
  label: string;
};

export const WEEK_DEADLINES: readonly WeekDeadline[] = [
  { week: 1, at: central(2026, 10, 31, 18), label: "Saturday, Oct 31, 6:00 PM CT" },
  { week: 5, at: central(2026, 11, 27, 18), label: "Friday, Nov 27, 6:00 PM CT" },
];

export function weekDeadline(week: number): WeekDeadline | undefined {
  return WEEK_DEADLINES.find((row) => row.week === week);
}

/** True at the lock instant and after. Weeks with no deadline never come due. */
export function deadlineDue(week: number, now: Date): boolean {
  const row = weekDeadline(week);
  return row != null && now.getTime() >= row.at.getTime();
}

/** True once the earliest automatic deadline is behind us. Later weeks still consult their own row. */
export function anyDeadlineDue(now: Date): boolean {
  return WEEK_DEADLINES.some((row) => now.getTime() >= row.at.getTime());
}

export function buildLockMessage(week: number): string {
  const when = weekDeadline(week)?.label ?? "the weekly lock";
  return `Builds locked ${when}. Captains cannot change iron after that.`;
}

/**
 * Countdown target. A week with an automatic deadline counts to that instant
 * (even after it has passed, so the clock sits at zero instead of skipping ahead).
 * Every other week still counts to the next Saturday at 6:00 PM CT.
 */
export function nextLockAt(now: Date, week?: number): Date {
  if (week != null) {
    const scheduled = weekDeadline(week);
    if (scheduled) return scheduled.at;
  }
  const today = centralDay(now);
  const add = (6 - today.weekday + 7) % 7;
  let target = central(today.y, today.m, today.d + add, 18);
  if (target.getTime() <= now.getTime()) target = central(today.y, today.m, today.d + add + 7, 18);
  return target;
}
