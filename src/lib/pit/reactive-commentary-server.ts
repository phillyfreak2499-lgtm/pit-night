import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ReactivePhase } from "./reactive-commentary";

export type ReactiveCommentaryResponse =
  | { status: "ready"; body: string }
  | { status: "pending" }
  | { status: "unavailable" };

/** Claimed once across every Watch Party viewer, keyed to the published fight seed. */
export const getReactiveCommentary = createServerFn({ method: "POST" })
  .validator(z.object({
    boutId: z.string().min(1).max(160),
    phase: z.enum(["exchange", "finisher"]),
    index: z.number().int().min(0).max(500),
  }).strict())
  .handler(async ({ data: input }): Promise<ReactiveCommentaryResponse> => {
    const [
      { loadSeason },
      { reactiveMoment, reactivePrompt, shortReactiveLine },
      { hashString },
      { askClaude, FEATURE_MODEL },
      { getSql },
      store,
      { unsupportedNumbers },
    ] = await Promise.all([
      import("./authoritative"),
      import("./reactive-commentary"),
      import("./engine"),
      import("./claude.server"),
      import("@/lib/db"),
      import("./claude-store"),
      import("./claude-copy"),
    ]);
    const { data } = await loadSeason();
    const bout = data.bouts.find((b) => b.id === input.boutId);
    // House previews and unposted matches must never spend API calls.
    if (!bout?.result || bout.kind === "bye" ||
        !(data.week > bout.week || ["fought", "inspected", "complete"].includes(data.phase)))
      return { status: "unavailable" };

    const moment = reactiveMoment(bout.result, { phase: input.phase as ReactivePhase, index: input.index });
    if (!moment) return { status: "unavailable" };

    const kind = "reactive";
    const key = bout.id + ":" + hashString(bout.result.seed) + ":reactive:" + moment.beatId;
    const sql = await getSql();
    const existing = await store.readCopy(sql, kind, key);
    if (existing?.status === "ready" && existing.body) return { status: "ready", body: existing.body };
    if (existing?.status === "pending") return { status: "pending" };
    if (existing) return { status: "unavailable" };

    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
    const slot = await store.reserveCopy(sql, kind, key, FEATURE_MODEL.live, 80, day);
    if (slot !== "claimed") {
      if (slot === "existing") {
        const row = await store.readCopy(sql, kind, key);
        if (row?.status === "ready" && row.body) return { status: "ready", body: row.body };
        if (row?.status === "pending") return { status: "pending" };
      }
      return { status: "unavailable" };
    }

    try {
      const request = reactivePrompt(moment);
      const generated = await askClaude({
        feature: "live",
        system: request.system,
        prompt: request.prompt,
        maxTokens: request.maxTokens,
      });
      const body = shortReactiveLine(generated.text);
      if (!body || unsupportedNumbers(body, moment).length)
        throw new Error("Claude returned an unsupported reactive line.");
      await store.finishCopy(sql, kind, key, { body });
      return { status: "ready", body };
    } catch {
      // The fight and the original ringside captions continue without AI.
      await store.finishCopy(sql, kind, key, { error: "Reactive commentary unavailable." });
      return { status: "unavailable" };
    }
  });
