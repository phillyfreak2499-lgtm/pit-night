import type { Bout, FightResult } from "@/lib/pit/types";
import { buildBeats, type Beat } from "./cage-motion";

export const FINALIST_ENTRANCE_SECONDS = 12;

export function hasFinalistEntrances(bout: Pick<Bout, "week" | "kind">, result: FightResult): boolean {
  return bout.week === 5 && bout.kind === "final" && result.fighters.length === 2;
}

/** Longer finalist walk-outs are presentation only; every combat beat is retained. */
export function broadcastBeats(bout: Pick<Bout, "week" | "kind">, result: FightResult): Beat[] {
  const beats = buildBeats(result);
  if (!hasFinalistEntrances(bout, result)) return beats;
  let at = 0;
  return beats.map((beat) => {
    const dur = beat.kind === "intro" ? FINALIST_ENTRANCE_SECONDS : beat.dur;
    const next = { ...beat, t: at, dur };
    at += dur;
    return next;
  });
}

/** A pit replay must never announce an HP knockout. */
export function replayFinishLabel(result: Pick<FightResult, "method">): "IN THE PIT" | "K.O." {
  return result.method === "dump" ? "IN THE PIT" : "K.O.";
}

export function championshipFinishPhase(bout: Pick<Bout, "week" | "kind">, result: FightResult, beat: Beat): "throw" | "reveal" | null {
  if (!hasFinalistEntrances(bout, result) || result.method !== "dump") return null;
  if (beat.kind === "decision") return "reveal";
  if (beat.kind === "replay" || (beat.kind === "exchange" && beat.index === result.exchanges.length - 1)) return "throw";
  return null;
}
