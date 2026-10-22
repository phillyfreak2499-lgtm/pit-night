import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function requireDesk() {
  const [{ loadSeason }, auth] = await Promise.all([import("./authoritative"), import("./session.server")]);
  const { data } = await loadSeason();
  if ((await auth.session(data)).role !== "commissioner") throw new Error("Only the Desk can see the Monday job.");
  return auth;
}

/** Private Monday job reports and setup status, for the Desk only. */
export const mondayStatus = createServerFn({ method: "POST" }).handler(async () => {
  await requireDesk();
  const [{ recentReports }, { snowflakeConfigured }, { RULE_VERSION, FIGHT_WEEKS }] = await Promise.all([
    import("./monday-job.server"),
    import("./snowflake.server"),
    import("./monday-import"),
  ]);
  return {
    enabled: process.env.MONDAY_JOB_ENABLED === "1",
    cronSecret: Boolean(process.env.CRON_SECRET?.trim()),
    snowflake: snowflakeConfigured(),
    claudeKey: ["ANTHROPIC_API_KEY", "CLAUDE_API_KEY", "ANTHROPIC_KEY"].some((k) => Boolean(process.env[k]?.trim())),
    ruleVersion: RULE_VERSION,
    fightWeeks: FIGHT_WEEKS,
    reports: await recentReports(),
  };
});

/** Read, validate and grade a Sunday–Saturday week from Snowflake without writing anything. */
export const mondayDryRun = createServerFn({ method: "POST" })
  .validator(
    z
      .object({ start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
      .strict()
      .refine((p) => {
        const days = (Date.parse(p.end) - Date.parse(p.start)) / 86_400_000;
        return days === 6 && new Date(`${p.start}T12:00:00Z`).getUTCDay() === 0;
      }, "Pick a Sunday-to-Saturday week."),
  )
  .handler(async ({ data: period }) => {
    const auth = await requireDesk();
    auth.sameOrigin();
    const [{ productionIO, recordDryRun }, { dryRun }] = await Promise.all([import("./monday-job.server"), import("./monday-import")]);
    const res = await dryRun(await productionIO(), period);
    await recordDryRun(`dry-desk-${period.end}`, res.ok ? "noop" : "blocked", res.report);
    return res;
  });

/** Claude check, Desk only: one tiny real call through the site's own server path, never echoing the key. */
export const claudeHealth = createServerFn({ method: "POST" }).handler(async () => {
  const auth = await requireDesk();
  auth.sameOrigin();
  const { askClaude, HAIKU } = await import("./claude.server");
  const started = Date.now();
  try {
    const { text, model } = await askClaude({
      feature: "rules",
      system: "Reply with exactly the word READY and nothing else.",
      prompt: "Status check.",
      maxTokens: 400,
    });
    return { ok: text.trim().toUpperCase().startsWith("READY"), model, ms: Date.now() - started, reply: text.slice(0, 40) };
  } catch (err) {
    return { ok: false, model: HAIKU, ms: Date.now() - started, reply: err instanceof Error ? err.message : "Claude call failed." };
  }
});
