import { useCallback, useEffect, useRef, useState } from "react";
import { getReactiveCommentary } from "@/lib/pit/reactive-commentary-server";
import { announcerDelivery, reactiveMoment, type ReactiveCue } from "@/lib/pit/reactive-commentary";
import { live, soundMuted, subscribeSound } from "@/lib/pit/sound";
import type { Bout } from "@/lib/pit/types";

const MIN_GAP_MS = 6000;
const MAX_LATENCY_MS = 12000;

/**
 * Local speech and display follow the broadcast. One request at a time;
 * no backlog, no per-frame polling, and no stale line after pause or skip.
 */
export function useReactiveCommentary(bout: Bout | null, active: boolean, duck: (speaking: boolean) => void) {
  const boutKey = bout?.result ? bout.id + ":" + bout.result.seed : "";
  const [lastLine, setLastLine] = useState<{ key: string; body: string } | null>(null);
  const current = useRef({ boutKey, active });
  current.current = { boutKey, active };
  const seen = useRef(new Set<string>());
  const lastRequest = useRef(0);
  const busy = useRef(false);
  const generation = useRef(0);
  const speech = useRef<SpeechSynthesisUtterance | null>(null);
  const recorded = useRef<AudioBufferSourceNode | null>(null);
  const releaseTimer = useRef<number | undefined>(undefined);
  const release = useCallback(() => {
    window.clearTimeout(releaseTimer.current);
    if (recorded.current) {
      recorded.current.onended = null;
      recorded.current.stop();
      recorded.current.disconnect();
      recorded.current = null;
    }
    speech.current = null;
    duck(false);
  }, [duck]);

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
    // A new playback may reuse the same published bout and its cached lines.
    seen.current.clear();
    setLastLine(null);
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, [active]);

  useEffect(() => {
    // Prime the voice list. Some browsers populate it asynchronously.
    window.speechSynthesis?.getVoices();
    const unsubscribe = subscribeSound(() => {
      if (soundMuted()) {
        generation.current++;
        busy.current = false;
        release();
        window.speechSynthesis?.cancel();
      }
    });
    return () => {
      unsubscribe();
      generation.current++;
      release();
      window.speechSynthesis?.cancel();
    };
  }, [release]);

  useEffect(() => release, [active, boutKey, release]);

  const onBeat = useCallback((cue: ReactiveCue) => {
    if (!active || !boutKey || busy.current || recorded.current || soundMuted()) return;
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
      for (let retry = 0; (reply.status === "pending" || (reply.status === "ready" && reply.voicePending)) && retry < 4; retry++) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 1500));
        if (!valid() || Date.now() - started >= MAX_LATENCY_MS) return;
        reply = await getReactiveCommentary({ data: {
          boutId: bout!.id,
          phase: cue.phase,
          index: cue.index,
        } });
      }
      if (!valid() || soundMuted() || reply.status !== "ready" || Date.now() - started >= MAX_LATENCY_MS) return;
      setLastLine({ key: boutKey, body: reply.body });
      const context = live();
      if (reply.audio && context?.state === "running") {
        try {
          const bytes = Uint8Array.from(atob(reply.audio), char => char.charCodeAt(0));
          const buffer = await context.decodeAudioData(bytes.buffer);
          if (!valid() || Date.now() - started >= MAX_LATENCY_MS) return;
          if (speech.current) return;
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.connect(context.destination);
          source.onended = () => {
            if (recorded.current === source) {
              recorded.current = null;
              source.disconnect();
              duck(false);
            }
          };
          source.start();
          recorded.current = source;
          duck(true);
          return;
        } catch {
          if (!valid() || Date.now() - started >= MAX_LATENCY_MS) return;
        }
      }
      if (typeof window === "undefined" || typeof SpeechSynthesisUtterance === "undefined" ||
          !window.speechSynthesis) return;
      const utterance = new SpeechSynthesisUtterance(reply.body);
      const synth = window.speechSynthesis;
      // Let the announcer finish the previous thought.
      if (synth.speaking || synth.pending) return;
      const english = synth.getVoices().filter(voice => /^en(?:[-_]|$)/i.test(voice.lang));
      const voice = english.find(v => /natural|premium|enhanced|neural/i.test(v.name))
        ?? english.find(v => v.default) ?? english.find(v => /^en-US$/i.test(v.lang)) ?? english[0];
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? "en-US";
      const moment = bout?.result && reactiveMoment(bout.result, cue);
      const delivery = announcerDelivery[moment?.kind ?? "big-hit"];
      utterance.rate = delivery.rate;
      utterance.pitch = delivery.pitch;
      speech.current = utterance;
      utterance.onstart = () => {
        if (speech.current !== utterance) return;
        duck(true);
        releaseTimer.current = window.setTimeout(release, 15000);
      };
      utterance.onend = utterance.onerror = () => {
        if (speech.current === utterance) release();
      };
      synth.speak(utterance);
    })().catch(() => {
      // Browser voice, networking or Claude failing never holds the fight.
    }).finally(() => {
      if (generation.current === requestId) busy.current = false;
    });
  }, [active, bout, boutKey, duck, release]);

  return {
    line: lastLine?.key === boutKey ? lastLine.body : "",
    onBeat,
  };
}
