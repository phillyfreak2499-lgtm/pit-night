import { createFileRoute } from "@tanstack/react-router";

/**
 * Vercel Cron entry for the Monday job. vercel.json calls it at 10:00 and 11:00 UTC
 * every Monday; whichever lands at or after 5:00 a.m. Central does the work (CDT or
 * CST, no seasonal edits) and the job key turns any second call into a no-op.
 *
 * Only Vercel's cron, carrying CRON_SECRET, gets in. Until the owner sets
 * MONDAY_JOB_ENABLED=1 it only validates and reports; it writes nothing.
 * The full report goes to the Desk, never into this response.
 */
async function handle(request: Request) {
  const { timingSafeEqual } = await import("node:crypto");
  const secret = process.env.CRON_SECRET?.trim();
  const got = request.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  if (!secret || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want)))
    return new Response("Unauthorized", { status: 401, headers: { "cache-control": "no-store" } });

  const [{ productionIO, recordDryRun }, job] = await Promise.all([import("@/lib/pit/monday-job.server"), import("@/lib/pit/monday-import")]);
  const io = await productionIO();
  let outcome: string;
  let jobKey: string | null = null;
  if (process.env.MONDAY_JOB_ENABLED === "1") {
    const res = await job.runMondayJob(io);
    outcome = res.outcome;
    jobKey = res.jobKey;
  } else {
    const { date } = job.centralParts(io.now());
    const fight = job.FIGHT_WEEKS.find((f) => f.monday === date);
    if (!fight) outcome = "noop";
    else {
      const res = await job.dryRun(io, fight);
      outcome = res.ok ? "dry-run-passed" : "dry-run-blocked";
      jobKey = `dry-${job.jobKeyFor(fight.week, fight.end)}`;
      await recordDryRun(jobKey, res.ok ? "noop" : "blocked", res.report);
    }
  }
  return Response.json({ outcome, jobKey }, { headers: { "cache-control": "no-store" } });
}

export const Route = createFileRoute("/api/cron/monday")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
    },
  },
});
