import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Square } from "lucide-react";
import { getBoothSegment } from "@/lib/pit/booth-server";
import { playBooth } from "@/lib/pit/booth-playback";
import { armSound, live, soundMuted, subscribeSound } from "@/lib/pit/sound";
import type { BoothScene } from "@/lib/pit/booth";

export function BoothSegment({ scene, id, label, automatic = false, onComplete }: {
  scene: BoothScene; id?: string; label: string; automatic?: boolean; onComplete?: () => void;
}) {
  const complete = useRef(onComplete);
  complete.current = onComplete;
  const active = useRef<AbortController | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "partial" | "unavailable">("idle");
  const [caption, setCaption] = useState("");
  const muted = useSyncExternalStore(subscribeSound, soundMuted, () => false);
  const stop = useCallback(() => {
    active.current?.abort();
    active.current = null;
    setState("idle");
    setCaption("");
  }, []);
  const start = useCallback(async () => {
    if (soundMuted() || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setState("loading");
    // Give a stalled walkout request a deadline, then let a playing message finish.
    const loadingTimer = automatic && scene === "walkout" ? window.setTimeout(() => {
      if (controller.signal.aborted) return;
      controller.abort();
      complete.current?.();
    }, 45000) : undefined;
    try {
      armSound();
      const context = live();
      if (!context) throw Error();
      await context.resume();
      let result = await getBoothSegment({ data: { scene, id } });
      for (let i = 0; result.pending && i < 4 && !controller.signal.aborted; i++) {
        await new Promise(resolve => setTimeout(resolve, 1200));
        if (controller.signal.aborted) return;
        result = await getBoothSegment({ data: { scene, id } });
      }
      if (controller.signal.aborted) return;
      if (!result.clips.length) {
        setCaption(result.lines.map(l => l.text).join(" "));
        throw Error();
      }
      await playBooth(context, result.clips, controller.signal, line => {
        window.clearTimeout(loadingTimer);
        setState("playing");
        setCaption(line.speaker + " · " + line.text);
      });
      if (!controller.signal.aborted) {
        if (result.clips.length < result.lines.length) {
          setCaption(result.lines.map(l => l.speaker + " · " + l.text).join(" "));
          setState("partial");
        } else setState("idle");
      }
    } catch {
      if (!controller.signal.aborted) setState("unavailable");
    } finally {
      window.clearTimeout(loadingTimer);
      if (active.current === controller) active.current = null;
      if (!controller.signal.aborted) complete.current?.();
    }
  }, [automatic, scene, id]);
  useEffect(() => {
    stop();
    if (automatic && !muted) void start();
    return stop;
  }, [automatic, muted, start, stop]);
  const busy = state === "loading" || state === "playing";
  return <div className="my-2">
    {!automatic && <button type="button" disabled={muted} onClick={busy ? stop : () => void start()}
      className="inline-flex min-h-11 items-center gap-2 border border-line bg-deep px-3 font-display text-sm text-amber disabled:text-muted">
      {busy ? <Square size={14} /> : <Mic size={16} />}
      {muted ? "Booth audio muted" : state === "loading" ? "Cancel · loading audio" : busy ? "Stop audio" : label}
    </button>}
    <p aria-live="polite" className="text-sm text-muted">{state === "unavailable" ? "Audio unavailable. " : state === "partial" ? "One recording is unavailable. " : ""}{caption}</p>
  </div>;
}
