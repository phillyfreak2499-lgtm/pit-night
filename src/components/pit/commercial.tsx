import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { AD_MS, commercialVideoSrc, type Commercial, type CommercialTone } from "@/lib/pit/commercials";
import { soundMuted, subscribeSound } from "@/lib/pit/sound";
import { armBroadcastAudio } from "./broadcast";
import { paintCommercial } from "./commercial-art";

const TONE: Record<CommercialTone, string> = {
  lead: "font-display text-3xl leading-[0.95] md:text-5xl",
  vo: "border-l-2 border-amber pl-3 text-lg leading-snug md:text-2xl",
  end: "font-display text-3xl leading-none text-amber md:text-5xl",
  flash: "ad-flash font-display text-3xl leading-none text-spark md:text-5xl",
  aside: "text-base text-muted md:text-lg",
};

function revealDelay(index: number, count: number): number {
  if (count <= 1) return 0.3;
  if (count === 2) return index === 0 ? 0.4 : 7.2;
  return [0.4, 4.8, 9.4][index] ?? 11;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

/**
 * One house spot. Plays public/ads/<slug>.mp4 full-frame with sound when that
 * file loads. Sound follows the broadcast mute flag, and playback is armed with
 * the same call the fight tape uses. A missing or broken file falls back to the
 * animated text spot, which holds for AD_MS. Pause freezes whichever is on screen.
 */
export function Commercial({ ad, paused, onEnded }: { ad: Commercial; paused: boolean; onEnded: () => void }) {
  const [mode, setMode] = useState<"pending" | "video" | "text">("pending");
  const videoRef = useRef<HTMLVideoElement>(null);
  const endedRef = useRef(false);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  const finish = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    onEndedRef.current();
  }, []);

  useEffect(() => {
    if (mode !== "pending") return;
    const id = window.setTimeout(() => setMode((current) => (current === "pending" ? "text" : current)), 4000);
    return () => window.clearTimeout(id);
  }, [mode, ad.slug]);

  // Video time budget counts only unpaused viewing time. A stalled stream cannot
  // leave the room waiting forever, and repeated Pause/Resume cannot reset the cap.
  const videoWatchLeft = useRef(AD_MS + 8_000);
  const videoWatchStart = useRef(0);
  useEffect(() => {
    if (mode !== "video" || paused) return;
    videoWatchStart.current = performance.now();
    const id = window.setTimeout(finish, Math.max(0, videoWatchLeft.current));
    return () => {
      videoWatchLeft.current = Math.max(0, videoWatchLeft.current - (performance.now() - videoWatchStart.current));
      window.clearTimeout(id);
    };
  }, [mode, paused, finish]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || mode !== "video") return;
    armBroadcastAudio();
    const applyMute = () => {
      el.muted = soundMuted();
    };
    applyMute();
    const unsub = subscribeSound(applyMute);
    if (paused) el.pause();
    else {
      const attempt = el.play();
      if (attempt) attempt.catch(() => setMode("text"));
    }
    return unsub;
  }, [mode, paused, ad.slug]);

  return (
    <section
      className="relative flex h-full min-h-0 flex-col bg-deep"
      data-testid="watch-ad"
      data-ad-slug={ad.slug}
      data-ad-mode={mode}
      aria-label={`${ad.sponsor} commercial`}
    >
      {mode !== "text" ? (
        <video
          ref={videoRef}
          data-testid="watch-ad-video"
          className={mode === "video" ? "absolute inset-0 h-full w-full bg-black object-contain" : "pointer-events-none absolute h-px w-px opacity-0"}
          src={commercialVideoSrc(ad)}
          playsInline
          preload="auto"
          onCanPlay={() => setMode((current) => (current === "pending" ? "video" : current))}
          onError={() => setMode("text")}
          onEnded={finish}
        />
      ) : null}
      {mode === "video" ? <VideoChrome ad={ad} paused={paused} onSkip={finish} videoRef={videoRef} /> : null}
      {mode === "pending" ? <Ident ad={ad} /> : null}
      {mode === "text" ? <TextSpot ad={ad} paused={paused} onSkip={finish} /> : null}
    </section>
  );
}

function Ident({ ad }: { ad: Commercial }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-display text-xs tracking-[0.35em] text-amber uppercase">House commercial</p>
      <p className="font-display text-5xl leading-none md:text-7xl">{ad.sponsor}</p>
    </div>
  );
}

function VideoChrome({
  ad,
  paused,
  onSkip,
  videoRef,
}: {
  ad: Commercial;
  paused: boolean;
  onSkip: () => void;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onTime = () => {
      if (el.duration && Number.isFinite(el.duration)) setProgress(el.currentTime / el.duration);
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [videoRef]);

  return (
    <>
      <p className="pointer-events-none absolute top-4 left-4 z-20 font-display text-xs tracking-[0.28em] text-amber uppercase">Ad · {ad.sponsor}</p>
      {paused ? <PausedBug /> : null}
      <SkipButton onSkip={onSkip} />
      <Progress progress={progress} />
    </>
  );
}

function TextSpot({ ad, paused, onSkip }: { ad: Commercial; paused: boolean; onSkip: () => void }) {
  const reduced = useReducedMotion();
  const progress = useTextClock(paused, onSkip, ad.slug);
  return (
    <div className="watch-in flex min-h-0 flex-1 flex-col" data-testid="watch-ad-fallback">
      <div className="grid min-h-0 flex-1 grid-rows-[14rem_minmax(0,1fr)] md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:grid-rows-1">
        <div className="relative h-full min-h-56">
          <SceneCanvas scene={ad.scene} />
          <div className="ad-scan pointer-events-none absolute inset-0" aria-hidden />
        </div>
        <div className="flex flex-col justify-center gap-4 overflow-y-auto px-4 py-5 md:px-8 md:py-6">
          <p className="font-display text-xs tracking-[0.35em] text-amber uppercase">House commercial</p>
          <h2 className="font-display text-4xl leading-none md:text-6xl">{ad.sponsor}</h2>
          {ad.lines.map((line, index) => (
            <p
              key={line.text}
              className={`ad-line text-pretty ${TONE[line.tone]}`}
              style={reduced ? undefined : { animationDelay: `${revealDelay(index, ad.lines.length)}s` }}
            >
              {line.text}
            </p>
          ))}
          {ad.fine ? <FinePrint text={ad.fine} /> : null}
          <div>
            <SkipButton onSkip={onSkip} inline />
          </div>
        </div>
      </div>
      {paused ? <PausedBug /> : null}
      <Progress progress={progress} />
    </div>
  );
}

function useTextClock(paused: boolean, onEnded: () => void, token: string) {
  const left = useRef(AD_MS);
  const startedAt = useRef(0);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const seen = useRef(token);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (seen.current !== token) {
      seen.current = token;
      left.current = AD_MS;
    }
    if (paused) return;
    startedAt.current = performance.now();
    const id = window.setTimeout(() => onEndedRef.current(), Math.max(0, left.current));
    return () => {
      left.current = Math.max(0, left.current - (performance.now() - startedAt.current));
      window.clearTimeout(id);
    };
  }, [paused, token]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const running = paused ? 0 : performance.now() - startedAt.current;
      const remain = Math.max(0, left.current - running);
      setProgress(Math.min(1, Math.max(0, 1 - remain / AD_MS)));
      if (!paused) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [paused, token]);

  return progress;
}

function SceneCanvas({ scene }: { scene: Commercial["scene"] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let stopped = false;
    const start = performance.now();
    const frame = (now: number) => {
      if (stopped) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const bw = Math.max(1, Math.floor(rect.width * dpr));
      const bh = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintCommercial(ctx, rect.width, rect.height, reduced ? 1.2 : (now - start) / 1000, scene);
      if (!reduced) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [scene, reduced]);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden />;
}

function FinePrint({ text }: { text: string }) {
  const line = `${text}${text}`;
  return (
    <div className="mt-1 h-7 overflow-hidden border-y border-line bg-deep" aria-hidden>
      <p className="ad-fine-track py-1.5 font-mono text-[8px] leading-none tracking-wide text-muted/80 whitespace-nowrap">{line}</p>
    </div>
  );
}

function SkipButton({ onSkip, inline = false }: { onSkip: () => void; inline?: boolean }) {
  return (
    <button
      type="button"
      data-testid="watch-ad-skip"
      onClick={onSkip}
      className={
        inline
          ? "min-h-11 self-start border border-line px-4 font-display tracking-[0.18em] uppercase hover:border-amber"
          : "absolute right-4 bottom-6 z-20 min-h-11 border border-fg/30 bg-deep/85 px-4 font-display tracking-[0.18em] uppercase hover:border-amber"
      }
    >
      Skip
    </button>
  );
}

function PausedBug() {
  return (
    <p className="pointer-events-none absolute inset-x-0 top-4 z-20 text-center font-display text-sm tracking-[0.3em] text-amber uppercase">
      Paused · space to resume
    </p>
  );
}

function Progress({ progress }: { progress: number }) {
  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20 h-1.5 bg-line"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      aria-label="Commercial progress"
    >
      <div className="h-full bg-amber" style={{ width: `${Math.round(progress * 100)}%` }} />
    </div>
  );
}
