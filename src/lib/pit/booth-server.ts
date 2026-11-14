import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { BoothClip, BoothLine } from "./booth";

export const getBoothSegment = createServerFn({ method: "POST" })
  .validator(z.object({ scene: z.enum(["welcome", "card", "store", "gazette", "walkout", "pregame"]), id: z.string().max(160).optional() }).strict())
  .handler(async ({ data: input }): Promise<{ lines: BoothLine[]; clips: BoothClip[]; pending: boolean }> => {
    const [{ loadSeason }, { boothScript }, { ringsideVoice }, { createHash }] = await Promise.all([
      import("./authoritative"), import("./booth"), import("./ringside-voice.server"), import("node:crypto"),
    ]);
    const { data, sql } = await loadSeason();
    const lines = boothScript(data, input.scene, input.id);
    const clips = await Promise.all(lines.map(async line => {
      const key = createHash("sha256").update(line.text).digest("hex");
      return { ...line, ...await ringsideVoice(sql, key, line.text, line.speaker, "league-booth") };
    }));
    return { lines, clips: clips.flatMap(c => c.audio ? [{ speaker: c.speaker, text: c.text, audio: c.audio }] : []),
      pending: clips.some(c => c.voicePending) };
  });
