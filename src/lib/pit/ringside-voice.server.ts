import type { Sql } from "@/lib/db";
import { claimCopy, finishCopy, readCopy, reserveCopy } from "./claude-store";

// David – Sports Arena Announcer, the voice used for the Watch Party audition.
const VOICE = "DduhIyyKkOosbP8VefhP";
const MODEL = "eleven_v4";
const KIND = "ringside-audio";

export async function ringsideVoice(sql: Sql, beat: string, body: string, speaker: "Jim" | "Kathy" = "Jim", kind = KIND) {
  const voice = speaker === "Jim" ? VOICE : "Cvv0EXhC1Zv7b4a2QfWl";
  const key = [voice, MODEL, beat].join(":");
  const row = await readCopy(sql, kind, key);
  if (row?.status === "ready" && row.body) return { audio: row.body };

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return {};
  if (row) {
    if (!(await claimCopy(sql, kind, key, MODEL))) return { voicePending: row.status === "pending" };
  } else {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
    const slot = await reserveCopy(sql, kind, key, MODEL, 80, day);
    if (slot !== "claimed") return { voicePending: slot === "existing" };
  }

  try {
    const direction = speaker === "Jim" ? "[excited]" : "[conversational]";
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ model_id: MODEL, text: direction + " " + body.replace(/[\[\]]/g, "") }),
      signal: AbortSignal.timeout(6500),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null);
      const reason = String(failure?.detail?.status ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60);
      console.warn("[ringside] Voice request failed", response.status, reason, speaker);
      throw new Error("Voice unavailable");
    }
    if (!response.headers.get("content-type")?.startsWith("audio/"))
      throw new Error("Voice unavailable");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 400_000) throw new Error("Invalid ringside clip");
    const audio = bytes.toString("base64");
    await finishCopy(sql, kind, key, { body: audio });
    return { audio };
  } catch {
    await finishCopy(sql, kind, key, { error: "Ringside recording unavailable." });
    return {};
  }
}
