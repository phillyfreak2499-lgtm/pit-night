import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type CopyResult =
  | { status: "ready"; body: string }
  | { status: "pending" }
  | { status: "unavailable"; reason: string };

async function writeOnce(
  kind: string,
  key: string,
  model: string,
  generate: () => Promise<string>,
): Promise<CopyResult> {
  const [{ getSql }, copyStore] = await Promise.all([import("@/lib/db"), import("./claude-store")]);
  const sql = await getSql();
  // Only a new key, a stale claim or a failed one past its wait is claimed; a ready row
  // is never rewritten, so a posted card keeps the copy it first got.
  if (!(await copyStore.claimCopy(sql, kind, key, model))) {
    const row = await copyStore.readCopy(sql, kind, key);
    if (row?.status === "ready" && row.body) return { status: "ready", body: row.body };
    if (row?.status === "pending") return { status: "pending" };
    return { status: "unavailable", reason: "The commentary booth is dark for this one." };
  }
  try {
    const body = await generate();
    await copyStore.finishCopy(sql, kind, key, { body });
    return { status: "ready", body };
  } catch (err) {
    await copyStore.finishCopy(sql, kind, key, { error: err instanceof Error ? err.message : "Claude failed." });
    return { status: "unavailable", reason: "The commentary booth is dark right now. Check back soon." };
  }
}

/** Ask once; if numbers slip in that the facts do not hold, ask once more, then give up rather than post them. */
async function guardedCopy(
  feature: "bout" | "recap" | "hype",
  system: string,
  prompt: string,
  maxTokens: number,
  facts: unknown,
) {
  const { askClaude } = await import("./claude.server");
  const { unsupportedNumbers } = await import("./claude-copy");
  let { text } = await askClaude({ feature, system, prompt, maxTokens });
  let bad = unsupportedNumbers(text, facts);
  if (bad.length) {
    ({ text } = await askClaude({
      feature,
      system,
      prompt: `${prompt}\n\nYour last draft used numbers that are not in the facts: ${bad.join(", ")}. Rewrite it using only numbers that appear in the facts.`,
      maxTokens,
    }));
    bad = unsupportedNumbers(text, facts);
    if (bad.length) throw new Error(`Unsupported numbers after retry: ${bad.join(", ")}`);
  }
  return text;
}

/**
 * Stored Claude copy for a posted bout, a finished week, or an upcoming matchup.
 * The first viewer after a subject becomes eligible triggers the one write; everyone
 * after reads the stored text. Ineligible subjects never call the API.
 */
export const getClaudeCopy = createServerFn({ method: "POST" })
  .validator(
    z
      .object({ kind: z.enum(["bout", "recap", "hype"]), id: z.string().min(1).max(160) })
      .strict(),
  )
  .handler(async ({ data: input }): Promise<CopyResult> => {
    const [{ loadSeason }, copy, { FEATURE_MODEL }] = await Promise.all([
      import("./authoritative"),
      import("./claude-copy"),
      import("./claude.server"),
    ]);
    const { data } = await loadSeason();
    const subject =
      input.kind === "bout"
        ? copy.boutSubject(data, input.id)
        : input.kind === "recap"
          ? copy.recapSubject(data, Number(input.id))
          : copy.hypeSubject(data, input.id);
    if (!subject) return { status: "unavailable", reason: "Nothing to call yet." };
    const { system, prompt, maxTokens } = copy.promptFor(subject);
    return writeOnce(subject.kind, subject.key, FEATURE_MODEL[subject.kind], () =>
      guardedCopy(subject.kind, system, prompt, maxTokens, subject.facts),
    );
  });

function centralDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(now);
}

async function rulesAsker() {
  const [{ loadSeason }, auth] = await Promise.all([import("./authoritative"), import("./session.server")]);
  const { data } = await loadSeason();
  const session = await auth.session(data);
  if (session.role === "captain" && session.storeId) return { auth, asker: `captain:${session.storeId}` };
  if (session.role === "commissioner") return { auth, asker: "desk" };
  return { auth, asker: null };
}

/** How many rulebook questions this captain has left today. */
export const rulebookQuota = createServerFn({ method: "POST" }).handler(async () => {
  const { RULES_LIMIT_PER_DAY } = await import("./claude-copy");
  const { asker } = await rulesAsker();
  if (!asker) return { allowed: false, left: 0, limit: RULES_LIMIT_PER_DAY };
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const used = Number(
    (await sql<{ n: number }>`select count(*)::int as n from pit_claude_questions where asker = ${asker} and day = ${centralDate()}`)[0]?.n ?? 0,
  );
  return { allowed: true, left: Math.max(0, RULES_LIMIT_PER_DAY - used), limit: RULES_LIMIT_PER_DAY };
});

/** Captains ask how scoring, locks or Tune-Ups work. Answers come only from the rulebook text. */
export const askRulebook = createServerFn({ method: "POST" })
  .validator(z.object({ question: z.string().trim().min(3).max(300) }).strict())
  .handler(async ({ data: input }) => {
    const [{ RULES_LIMIT_PER_DAY, rulesPrompt, unsupportedNumbers, RULES_NOT_COVERED }, { askClaude, FEATURE_MODEL }] =
      await Promise.all([import("./claude-copy"), import("./claude.server")]);
    const { auth, asker } = await rulesAsker();
    auth.sameOrigin();
    if (!asker) throw new Error("Rules questions are for signed-in captains.");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const day = centralDate();
    const id = crypto.randomUUID();
    // Reserve the slot first, then count, so two quick taps cannot both slip past the cap.
    await sql`insert into pit_claude_questions (id, asker, day, question, model) values (${id}, ${asker}, ${day}, ${input.question}, ${FEATURE_MODEL.rules})`;
    const used = Number(
      (await sql<{ n: number }>`select count(*)::int as n from pit_claude_questions where asker = ${asker} and day = ${day}`)[0]?.n ?? 0,
    );
    if (used > RULES_LIMIT_PER_DAY) {
      await sql`delete from pit_claude_questions where id = ${id}`;
      throw new Error(`That's ${RULES_LIMIT_PER_DAY} questions today. The rulebook reopens tomorrow, or ask the Desk.`);
    }
    const rulebook = await rulebookText();
    const { system, prompt, maxTokens } = rulesPrompt(rulebook, input.question);
    let answer: string;
    try {
      answer = (await askClaude({ feature: "rules", system, prompt, maxTokens })).text;
    } catch (err) {
      await sql`delete from pit_claude_questions where id = ${id}`;
      throw new Error(err instanceof Error && err.name === "ClaudeUnavailable" ? "The rulebook helper is offline right now." : "The rulebook helper is busy. Try again in a minute.");
    }
    // A number the rulebook does not contain means the answer drifted. Say so instead of guessing.
    if (unsupportedNumbers(answer, rulebook + input.question).length) answer = RULES_NOT_COVERED;
    await sql`update pit_claude_questions set answer = ${answer} where id = ${id}`;
    return { answer, left: Math.max(0, RULES_LIMIT_PER_DAY - used) };
  });

/** The Rules page and FAQ as plain text: the only source the rules Q&A may use. */
async function rulebookText() {
  const [{ RULES }, { GROUPS }] = await Promise.all([
    import("@/components/pit/rules-page"),
    import("@/components/pit/faq-page"),
  ]);
  const rules = RULES.map((r) => `## ${r.title}\n${r.text}`).join("\n\n");
  const faq = GROUPS.map((g) => `## FAQ: ${g.title}\n${g.items.map((f) => `Q: ${f.q}\nA: ${f.text}`).join("\n")}`).join("\n\n");
  return `${rules}\n\n${faq}`;
}
