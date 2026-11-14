import type { Sql } from "@/lib/db";
import { claimCopy, finishCopy, readCopy, reserveCopy } from "./claude-store";

// David – Sports Arena Announcer, the voice used for the Watch Party audition.
const VOICE = "DduhIyyKkOosbP8VefhP";
const MODEL = "eleven_v4";
const KIND = "ringside-audio";

export async function ringsideVoice(sql: Sql, beat: string, body: string) {
  const key = [VOICE, MODEL, beat].join(":");
  const row = await readCopy(sql, KIND, key);
  if (row?.status === "ready" && row.body) return { audio: row.body };

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return {};
  if (row) {
    if (!(await claimCopy(sql, KIND, key, MODEL))) return { voicePending: row.status === "pending" };
  } else {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
    const slot = await reserveCopy(sql, KIND, key, MODEL, 80, day);
    if (slot !== "claimed") return { voicePending: slot === "existing" };
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ model_id: MODEL, text: "[excited] " + body.replace(/[\[\]]/g, "") }),
      signal: AbortSignal.timeout(6500),
    });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("audio/"))
      throw new Error("Voice unavailable");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 400_000) throw new Error("Invalid ringside clip");
    const audio = bytes.toString("base64");
    await finishCopy(sql, KIND, key, { body: audio });
    return { audio };
  } catch {
    await finishCopy(sql, KIND, key, { error: "Ringside recording unavailable." });
    return {};
  }
}
