import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ReactivePhase } from "./reactive-commentary";
import type { BoothClip } from "./booth";

export type ReactiveCommentaryResponse =
  | { status: "ready"; body: string; audio?: string; replyClip?: BoothClip; voicePending?: boolean }
  | { status: "pending" }
  | { status: "unavailable" };

/** Claimed once across every Watch Party viewer, keyed to the published fight seed. */
export const getReactiveCommentary = createServerFn({ method: "POST" })
  .validator(z.object({
    boutId: z.string().min(1).max(160),
    phase: z.enum(["exchange", "finisher"]),
    index: z.number().int().min(0).max(500),
    preview: z.boolean().optional(),
  }).strict())
  .handler(async ({ data: input }): Promise<ReactiveCommentaryResponse> => {
    const [
      { loadSeason },
      { reactiveMoment, reactivePrompt, shortReactiveLine, repeatsCall, impactLine },
      { hashString, previewSaturday },
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
    const archived = data.replays?.flatMap(replay => replay.bouts).find(b => b.id === input.boutId && b.result);
    const house = input.preview && !data.bouts.some(b => b.week === data.week && b.result);
    const bout = house ? previewSaturday(data).find(b => b.id === input.boutId) : archived ?? data.bouts.find((b) => b.id === input.boutId);
    if (!bout?.result || bout.kind === "bye" || (!house &&
        !(data.week > bout.week || ["fought", "inspected", "complete"].includes(data.phase))))
      return { status: "unavailable" };

    const moment = reactiveMoment(bout.result, { phase: input.phase as ReactivePhase, index: input.index });
    if (!moment) return { status: "unavailable" };

    const kind = "reactive";
    const prefix = (house ? "house:" : "") + bout.id + ":" + hashString(bout.result.seed) + ":ringside-v3:";
    const key = prefix + (house ? hashString(JSON.stringify(moment)) + ":" : "") + moment.beatId;
    const sql = await getSql();
    async function ready(body: string, leadKey = key): Promise<ReactiveCommentaryResponse> {
      try {
        const { ringsideVoice } = await import("./ringside-voice.server");
        const { analystReply } = await import("./booth");
        const { swingMeterCall } = await import("./vitals");
        const reply = analystReply(moment!, input.phase === "exchange" ? swingMeterCall(bout!.result!, input.index) : undefined);
        const [lead, analyst] = await Promise.all([
          ringsideVoice(sql, leadKey, body),
          reply ? ringsideVoice(sql, key + ":analysis:" + hashString(reply), reply, "Cathy", "ringside-analysis") : undefined,
        ]);
        return { status: "ready", body, ...lead,
          voicePending: !!(lead.voicePending || analyst?.voicePending),
          replyClip: reply && analyst?.audio ? { speaker: "Cathy", text: reply, audio: analyst.audio } : undefined };
      } catch {
        return { status: "ready", body };
      }
    }
    // An unavailable writer still leaves a verified impact and its recorded meter readings.
    const callFromTape = () => ready(impactLine(moment), key + ":tape");
    // A house fight uses its simulated event as the script. Keep its clips apart from the official tape.
    if (house) return ready(impactLine(moment));
    const existing = await store.readCopy(sql, kind, key);
    if (existing?.status === "ready" && existing.body) return ready(existing.body);
    if (existing?.status === "pending") return { status: "pending" };
    if (existing) return callFromTape();

    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
    const slot = await store.reserveCopy(sql, kind, key, FEATURE_MODEL.live, 80, day);
    if (slot !== "claimed") {
      if (slot === "existing") {
        const row = await store.readCopy(sql, kind, key);
        if (row?.status === "ready" && row.body) return ready(row.body);
        if (row?.status === "pending") return { status: "pending" };
      }
      return callFromTape();
    }

    try {
      const priorKeys = Array.from({ length: moment.index }, (_, i) => prefix + "x" + i);
      const prior = priorKeys.length ? await sql<{body: string}>`
        select body from pit_claude_text where kind = ${kind} and status = 'ready'
          and key = any(${priorKeys}::text[]) order by array_position(${priorKeys}::text[], key) desc limit 3` : [];
      const recent = prior.map(row => row.body);
      const request = reactivePrompt(moment, recent);
      const generated = await askClaude({
        feature: "live",
        system: request.system,
        prompt: request.prompt,
        maxTokens: request.maxTokens,
      });
      const proposed = shortReactiveLine(generated.text);
      const body = proposed && !unsupportedNumbers(proposed, moment).length && !repeatsCall(proposed, recent)
        ? proposed : impactLine(moment);
      await store.finishCopy(sql, kind, key, { body });
      return ready(body);
    } catch {
      await store.finishCopy(sql, kind, key, { error: "Reactive commentary unavailable." });
      return callFromTape();
    }
  });
