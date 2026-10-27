import { createFileRoute } from "@tanstack/react-router";

/**
 * Vercel Cron entry for the 8 a.m. store reminders. vercel.json calls it at 13:00 and
 * 14:00 UTC Tuesday through Saturday; only the call that lands in the 8 o'clock hour
 * Central does anything (CDT or CST, no seasonal edits), and the daily log means a store
 * is never emailed twice in a day. Only Vercel's cron, carrying CRON_SECRET, gets in.
 */
async function handle(request: Request) {
  const { timingSafeEqual } = await import("node:crypto");
  const secret = process.env.CRON_SECRET?.trim();
  const got = request.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  if (!secret || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want)))
    return new Response("Unauthorized", { status: 401, headers: { "cache-control": "no-store" } });

  const [{ loadSeason }, nudges, { getSql }] = await Promise.all([
    import("@/lib/pit/authoritative"),
    import("@/lib/pit/nudge.server"),
    import("@/lib/db"),
  ]);
  const now = new Date();
  if (nudges.centralHour(now) !== 8) return Response.json({ outcome: "not-8am" }, { headers: { "cache-control": "no-store" } });
  if (!nudges.emailConfigured().ok) return Response.json({ outcome: "email-not-set-up" }, { headers: { "cache-control": "no-store" } });
  const { data } = await loadSeason();
  const result = await nudges.sendDailyNudges(await getSql(), data, now);
  return Response.json({ outcome: "ran", ...result }, { headers: { "cache-control": "no-store" } });
}

export const Route = createFileRoute("/api/cron/nudges")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
    },
  },
});
