/**
 * The Gazette writer's one server call. The Anthropic key is read here, on
 * the server only, and never appears in a response or a client bundle.
 * No key is a normal state, not an error: the writer reports "no-key" and
 * the Gazette keeps running on the template writer, untouched.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildAnthropicRequest, parseGazetteEntries, type GazetteDraft, type GazetteMode } from "./gazette-ai";

export type GenerateGazetteResult =
  | { ok: true; entries: GazetteDraft[] }
  | { ok: false; reason: "no-key" | "api-error" | "bad-response" };

export const generateGazette = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        brief: z.record(z.string(), z.unknown()),
        mode: z.enum(["daily", "recap"]),
      })
      .strict(),
  )
  .handler(async ({ data: input }): Promise<GenerateGazetteResult> => {
    const { env } = await import("@/lib/env.server");
    const key = env("ANTHROPIC_API_KEY") ?? env("CLAUDE_API_KEY");
    if (!key) return { ok: false, reason: "no-key" };
    const model = env("GAZETTE_MODEL") ?? "claude-sonnet-5";
    const mode: GazetteMode = input.mode;
    let response: Response;
    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify(buildAnthropicRequest(input.brief, mode, model)),
      });
    } catch {
      return { ok: false, reason: "api-error" };
    }
    if (!response.ok) return { ok: false, reason: "api-error" };
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { ok: false, reason: "bad-response" };
    }
    const blocks = (payload as { content?: { type?: string; text?: string }[] }).content ?? [];
    const text = blocks
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!text) return { ok: false, reason: "bad-response" };
    const entries = parseGazetteEntries(text, mode);
    if (!entries.length) return { ok: false, reason: "bad-response" };
    return { ok: true, entries };
  });
