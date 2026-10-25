/**
 * The one place the league calls Claude. Server-only: import it dynamically from
 * server-function handlers so the SDK and the key never reach a browser.
 *
 * Every feature uses the lowest-cost model by the owner's choice. A feature moves
 * up to Sonnet only after Haiku measurably fails it; see FEATURE_MODEL.
 */
export const HAIKU = "claude-haiku-5-5";
export type ClaudeFeature = "bout" | "recap" | "hype" | "rules" | "live";
export const FEATURE_MODEL: Record<ClaudeFeature, string> = {
  bout: HAIKU,
  recap: HAIKU,
  hype: HAIKU,
  rules: HAIKU,
  live: HAIKU,
};

const KEY_NAMES = ["ANTHROPIC_API_KEY", "CLAUDE_API_KEY", "ANTHROPIC_KEY"];

export class ClaudeUnavailable extends Error {
  name = "ClaudeUnavailable";
}

/** The key from the deployment's environment (Vercel → Settings → Environment Variables). */
export function readApiKey(): string {
  for (const name of KEY_NAMES) {
    const v = process.env[name]?.trim();
    if (v) return v;
  }
  throw new ClaudeUnavailable(
    "The Claude API key isn't reaching the server. Add ANTHROPIC_API_KEY in Vercel and redeploy.",
  );
}

/** Asks Claude once and returns its text, with plain-language errors. The key never appears in them. */
export async function askClaude(opts: {
  feature: ClaudeFeature;
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<{ text: string; model: string }> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const model = FEATURE_MODEL[opts.feature];
  const client = new Anthropic({ apiKey: readApiKey(), timeout: 45_000, maxRetries: 1 });
  try {
    const response = await client.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 4000,
      output_config: { effort: "medium" },
      system: opts.system,
      messages: [{ role: "user", content: opts.prompt }],
    });
    if (response.stop_reason === "refusal") throw new Error("Claude declined this request.");
    if (response.stop_reason === "max_tokens") throw new Error("Claude ran out of room. Try again.");
    const text = response.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("\n")
      .trim();
    if (!text) throw new Error("Claude returned an empty answer.");
    return { text, model };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError)
      throw new ClaudeUnavailable("The Claude API key was rejected. Check ANTHROPIC_API_KEY in Vercel.");
    if (err instanceof Anthropic.PermissionDeniedError)
      throw new ClaudeUnavailable("The Claude API key isn't allowed to use this model.");
    if (err instanceof Anthropic.RateLimitError) throw new Error("Claude is busy right now. Try again in a minute.");
    if (err instanceof Anthropic.APIError) throw new Error(`Claude API error (${err.status ?? "network"}).`);
    throw err;
  }
}
