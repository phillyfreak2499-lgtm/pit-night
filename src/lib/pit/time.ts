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
