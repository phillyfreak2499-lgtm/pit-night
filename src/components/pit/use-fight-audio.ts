import { useCallback, useEffect, useRef } from "react";
import { startArenaMix } from "@/lib/pit/arena-mix";
import { live } from "@/lib/pit/sound";
import type { Bout } from "@/lib/pit/types";
import type { ReactiveCue } from "@/lib/pit/reactive-commentary";
import { useReactiveCommentary } from "./use-reactive-commentary";

export function useFightAudio(bout: Bout | null, playing: boolean, track: number, mic: boolean, muted: boolean, preview: boolean) {
  const mix = useRef<ReturnType<typeof startArenaMix> | null>(null);
  useEffect(() => {
    const audio = live();
    if (!audio || !playing || muted) return;
    mix.current = startArenaMix(audio, track);
    return () => { mix.current?.stop(); mix.current = null; };
  }, [bout?.id, playing, muted, track]);
  const duck = useCallback((speaking: boolean) => mix.current?.duck(speaking), []);
  const { onBeat, line } = useReactiveCommentary(bout, playing && mic && !muted, duck, preview);
  return { line, onNotableBeat(cue: ReactiveCue) { mix.current?.cheer(); onBeat(cue); } };
}
