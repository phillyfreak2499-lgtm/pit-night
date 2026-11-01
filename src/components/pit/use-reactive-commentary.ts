import { useCallback, useEffect, useRef, useState } from "react";
import { getReactiveCommentary } from "@/lib/pit/reactive-commentary-server";
import type { ReactiveCue } from "@/lib/pit/reactive-commentary";
import { soundMuted, subscribeSound } from "@/lib/pit/sound";
import type { Bout } from "@/lib/pit/types";

const MIN_GAP_MS = 6000;
const MAX_LATENCY_MS = 12000;

/**
 * Local speech and display follow the broadcast. One request at a time;
 * no backlog, no per-frame polling, and no stale line after pause or skip.
 */
export function useReactiveCommentary(bout: Bout | null, active: boolean) {
  const boutKey = bout?.result ? bout.id + ":" + bout.result.seed : "";
  const [lastLine, setLastLine] = useState<{ key: string; body: string } | null>(null);
  const current = useRef({ boutKey, active });
  current.current = { boutKey, active };
  const seen = useRef(new Set<string>());
  const lastRequest = useRef(0);
  const busy = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    generation.current++;
    seen.current.clear();
    busy.current = false;
    lastRequest.current = 0;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, [boutKey]);

  useEffect(() => {
    if (active) return;
    generation.current++;
    busy.current = false;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, [active]);

  useEffect(() => {
    const unsubscribe = subscribeSound(() => {
      if (soundMuted()) window.speechSynthesis?.cancel();
    });
    return () => {
      unsubscribe();
      generation.current++;
      window.speechSynthesis?.cancel();
    };
  }, []);

  const onBeat = useCallback((cue: ReactiveCue) => {
    if (!active || !boutKey || busy.current || soundMuted()) return;
    const beatKey = boutKey + "|" + cue.phase + "|" + cue.index;
    if (seen.current.has(beatKey)) return;
    const started = Date.now();
    if (started - lastRequest.current < MIN_GAP_MS) return;
    seen.current.add(beatKey);
    lastRequest.current = started;
    busy.current = true;
    const requestId = ++generation.current;
    const valid = () => generation.current === requestId &&
      current.current.active && current.current.boutKey === boutKey && !soundMuted();

    void (async () => {
      let reply = await getReactiveCommentary({ data: {
        boutId: bout!.id,
        phase: cue.phase,
        index: cue.index,
      } });
      // Another screen may own the server's write-once claim.
      for (let retry = 0; reply.status === "pending" && retry < 4; retry++) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 1500));
        if (!valid() || Date.now() - started >= MAX_LATENCY_MS) return;
        reply = await getReactiveCommentary({ data: {
          boutId: bout!.id,
          phase: cue.phase,
          index: cue.index,
        } });
      }
      if (!valid() || reply.status !== "ready" || Date.now() - started >= MAX_LATENCY_MS) return;
      setLastLine({ key: boutKey, body: reply.body });
      if (typeof window === "undefined" || typeof SpeechSynthesisUtterance === "undefined" ||
          !window.speechSynthesis) return;
      const utterance = new SpeechSynthesisUtterance(reply.body);
      utterance.rate = 1.12;
      utterance.pitch = 0.95;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    })().catch(() => {
      // Browser voice, networking or Claude failing never holds the fight.
    }).finally(() => {
      if (generation.current === requestId) busy.current = false;
    });
  }, [active, bout, boutKey]);

  return {
    line: lastLine?.key === boutKey ? lastLine.body : "",
    onBeat,
  };
}
