import { useEffect, useRef, useState } from "react";
import { PAINT } from "@/lib/pit/catalog";
import { methodLabel } from "@/lib/pit/engine";
import { armSound, playBell, playDecision, playFinisher, playHit } from "@/lib/pit/sound";
import type { Bout, Exchange, FightResult } from "@/lib/pit/types";
import { Fx, drawSide, drawTop, impactPoints, stepBots } from "./cage-draw";
import { beatAt, buildBeats, fightDrive, lerp, type Beat, type Spot } from "./cage-motion";

export function Broadcast({
  bout: boutProp,
  playing: playingProp,
  speed: speedProp,
  onPlayingChange,
  onComplete,
  seek = 0,
  chromeless = false,
  kicker,
  noDamage = false,
}: {
  bout: Bout;
  playing?: boolean;
  speed?: number;
  onPlayingChange?: (playing: boolean) => void;
  onComplete?: () => void;
  /** Changes after mount jump the tape to the decision. */
  seek?: number;
  chromeless?: boolean;
  kicker?: string;
  /** Scrimmage tape. The decision line must not invent a damage quote. */
  noDamage?: boolean;
}) {
  // Sync hands us fresh copies of the same bout; keep one object per tape so playback never restarts.
  const tapeKey = `${boutProp.id}|${boutProp.result?.seed ?? ""}|${boutProp.result ? "r" : ""}`;
  const keep = useRef<{ key: string; bout: Bout } | null>(null);
  if (!keep.current || keep.current.key !== tapeKey) keep.current = { key: tapeKey, bout: boutProp };
  const bout = keep.current.bout;
  const result = bout.result;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const topRef = useRef<HTMLCanvasElement | null>(null);
  const [playingState, setPlayingState] = useState(false);
  const [speedState, setSpeedState] = useState(1);
  const playing = playingProp ?? playingState;
  const speed = speedProp ?? speedState;
  const setPlaying = (next: boolean | ((current: boolean) => boolean)) => {
    const value = typeof next === "function" ? next(playing) : next;
    if (playingProp === undefined) setPlayingState(value);
    onPlayingChange?.(value);
  };
  const setSpeed = (next: number) => {
    if (speedProp === undefined) setSpeedState(next);
  };
  const [caption, setCaption] = useState("Lights down.");
  const [hp, setHp] = useState<Record<string, number>>({});
  const [clock, setClock] = useState("0:00");
  const timeRef = useRef(0);
  const cueRef = useRef("");
  const hitRef = useRef("");
  const fxRef = useRef(new Fx());
  const trailsRef = useRef(new Map<string, Spot[]>());
  const onCompleteRef = useRef(onComplete);
  const doneRef = useRef(false);
  const seekArmed = useRef(false);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!result) return;
    const canvas = canvasRef.current;
    const top = topRef.current;
    if (!canvas || !top) return;
    const ctx = canvas.getContext("2d");
    const topCtx = top.getContext("2d");
    if (!ctx || !topCtx) return;
    const beats = buildBeats(result);
    const total = beats.reduce((m, b) => Math.max(m, b.t + b.dur), 0);
    const fx = fxRef.current;
    const trails = trailsRef.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();
    let shook = 0;
    // Hit-stop: the tape holds for a beat when steel meets steel.
    let freeze = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (const node of [canvas, top]) {
        const rect = node.getBoundingClientRect();
        node.width = Math.max(1, Math.floor(rect.width * dpr));
        node.height = Math.max(1, Math.floor(rect.height * dpr));
      }
      fx.clear();
      fx.cam.ready = false;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    observer.observe(top);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const before = timeRef.current;
      if (playing && freeze <= 0) timeRef.current = Math.min(total, timeRef.current + dt * speed);
      if (freeze > 0) freeze -= dt;
      const time = timeRef.current;
      const jumped = Math.abs(time - before) > 1;
      if (jumped) {
        fx.clear();
        trails.clear();
      }
      const beat = beatAt(beats, time);
      const local = (time - beat.t) / beat.dur;
      if (playing) {
        const cue = beat.kind === "exchange" ? `ex-${beat.index}` : beat.kind === "intro" ? `in-${beat.side}` : beat.kind;
        if (cueRef.current !== cue) {
          cueRef.current = cue;
          if (beat.kind === "bumper") playBell();
          if (beat.kind === "finisher") playFinisher();
          if (beat.kind === "decision") playDecision();
        }
      }
      const drive = fightDrive(result, beat, local, time);
      if (playing && drive.hitKey && local >= drive.hitAt && local < drive.hitAt + 0.2 && hitRef.current !== drive.hitKey) {
        hitRef.current = drive.hitKey;
        const at = impactPoints(drive, canvas.width, canvas.height, top.width, top.height);
        if (at) {
          const victim = drive.bots.find((row) => row.bot.id === drive.victim) ?? drive.bots[0];
          const paint = PAINT[victim?.bot.paint ?? ""] ?? "#e2a21a";
          fx.burst(at.side.x, at.side.y, at.side.ground, at.side.scale, drive.power, paint, drive.weapon, reduced);
          fx.topBurst(at.top.x, at.top.y, at.top.scale, drive.power, reduced);
          shook = reduced ? 0 : (6 + drive.power * 14) * (canvas.width / 1200);
          freeze = reduced ? 0 : 0.05 + drive.power * 0.07;
        }
        playHit();
      }
      if (shook > 0) shook *= Math.exp(-dt * 9);
      stepBots(drive, fx, trails, playing ? dt * speed : 0, reduced);
      fx.step(dt * (freeze > 0 ? 0.15 : 1) * Math.min(speed, 2));
      const hype = beat.kind === "exchange" || beat.kind === "finisher" ? (local > 0.4 && local < 0.75 ? 1 : 0.4) : beat.kind === "decision" ? 0.8 : 0.15;
      drawSide(ctx, canvas.width, canvas.height, drive, fx, time, dt, {
        title: beat.kind === "bumper" ? "bumper" : beat.kind === "decision" ? "decision" : null,
        word: decisionWord(result),
        hype,
        reduced,
        shake: shook,
      });
      drawTop(topCtx, top.width, top.height, drive, fx, trails, time, dt, reduced);
      setCaption(captionFor(result, bout, beat, noDamage));
      setHp(hpFor(result, beat, local));
      const secs = Math.floor(time);
      setClock(`${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}`);
      if (playing && time >= total - 0.02 && !doneRef.current) {
        doneRef.current = true;
        onCompleteRef.current?.();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [bout, playing, result, speed, noDamage]);

  useEffect(() => {
    if (!result) return;
    if (!seekArmed.current) {
      seekArmed.current = true;
      return;
    }
    const beats = buildBeats(result);
    const total = beats.reduce((m, b) => Math.max(m, b.t + b.dur), 0);
    timeRef.current = Math.max(0, total - 8);
    doneRef.current = false;
  }, [result, seek]);

  if (!result) return null;
  const left = result.fighters[0];
  const right = result.fighters[1];
  const beats = buildBeats(result);
  const total = beats.reduce((m, b) => Math.max(m, b.t + b.dur), 0);

  return (
    <div className="overflow-hidden border border-line bg-deep" data-testid="broadcast">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <p className="font-display text-sm tracking-[0.18em] text-amber uppercase">{kicker ?? "Live cage"}</p>
        <p className="font-display text-sm text-muted">{clock} / {Math.round(total)}s</p>
      </div>
      <div className="grid gap-px bg-line lg:grid-cols-[minmax(0,1.55fr)_minmax(190px,0.72fr)]">
        <div className="relative min-w-0 bg-deep">
          <canvas ref={canvasRef} className="aspect-video w-full bg-deep" />
          <div className="pointer-events-none absolute inset-x-0 top-0 grid grid-cols-2 gap-3 p-2 pb-6 md:p-3 md:pb-8" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.78), rgba(0,0,0,0))" }}>
            {left ? <Health name={left.botName} store={left.storeName} hp={hp[left.id] ?? 100} paint={left.paint} align="left" tuned={left.tuned} /> : null}
            {right ? <Health name={right.botName} store={right.storeName} hp={hp[right.id] ?? 100} paint={right.paint} align="right" tuned={right.tuned} /> : null}
          </div>
          <p className="absolute inset-x-0 bottom-0 bg-deep/80 px-3 py-1.5 text-xs md:py-3 md:text-base">{caption}</p>
        </div>
        <div className="relative min-w-0 bg-deep lg:min-h-full">
          <canvas ref={topRef} className="aspect-square w-full bg-deep lg:absolute lg:inset-0 lg:h-full lg:w-full" />
        </div>
      </div>
      {chromeless ? null : (
      <div className="flex flex-wrap gap-2 border-t border-line p-3">
        <button
          type="button"
          className="min-h-11 bg-amber px-4 font-display tracking-wide text-deep uppercase"
          onClick={() => {
            armSound();
            if (timeRef.current >= total - 0.05) {
              timeRef.current = 0;
              cueRef.current = "";
              hitRef.current = "";
              doneRef.current = false;
            }
            setPlaying((p) => !p);
          }}
        >
          {playing ? "Pause" : "Play broadcast"}
        </button>
        {[1, 2, 4].map((n) => (
          <button
            key={n}
            type="button"
            className={`min-h-11 border px-3 font-display ${speed === n ? "border-amber text-amber" : "border-line text-muted"}`}
            onClick={() => setSpeed(n)}
          >
            {n}×
          </button>
        ))}
        <button
          type="button"
          className="min-h-11 border border-line px-3 font-display text-muted"
          onClick={() => {
            timeRef.current = Math.max(0, total - 8);
            setPlaying(true);
          }}
        >
          Decision
        </button>
      </div>
      )}
    </div>
  );
}

function Health({
  name,
  store,
  hp,
  paint,
  align,
  tuned,
}: {
  name: string;
  store: string;
  hp: number;
  paint: string;
  align: "left" | "right";
  tuned?: boolean;
}) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <p className="truncate font-display text-sm leading-none md:text-2xl">{name}</p>
      <p className="truncate text-[10px] tracking-widest text-muted uppercase md:text-xs">
        {store}
        {tuned ? <span className="ml-1 text-amber">· Tuned +4</span> : null}
      </p>
      <div className={`mt-1 h-1.5 w-full max-w-xs bg-line md:h-2 ${align === "right" ? "ml-auto" : ""}`}>
        <div className="h-full transition-[width] duration-200" style={{ width: `${hp}%`, background: PAINT[paint] ?? "#f0a202" }} />
      </div>
    </div>
  );
}

function captionFor(result: FightResult, bout: Bout, beat: Beat, noDamage: boolean) {
  if (beat.kind === "bumper" && bout.kind === "bye") return "Bye. It counts as a win. The bot does not take damage.";
  if (beat.kind === "bumper") return noDamage ? "Bay scrimmage. The house drill. Nothing posts." : `${bout.title}. Eleven stores. This cage holds ${bout.kind === "melee" ? "the tie" : "two"}.`;
  if (beat.kind === "intro") {
    const f = result.fighters[beat.side];
    if (!f) return "";
    return `${f.storeName}. ${f.botName}. ${f.classId}. ${f.chassisName}, ${f.weaponName}.`;
  }
  if (beat.kind === "stats") return "Printed before the bell. Power. Speed. Armor. Heat. The week set the range. The lock picked the number.";
  if (beat.kind === "exchange") return result.exchanges[beat.index]?.call ?? "";
  if (beat.kind === "finisher") return result.finisher?.call ?? "";
  if (result.method === "bye" || bout.kind === "bye") {
    const store = result.fighters.find((fighter) => fighter.id !== "house");
    return `${store?.storeName ?? "The store"} draws the bye. It counts as a win.`;
  }
  if (result.method === "scrimmage") return "Scrimmage over. Not a win. The store still got a tape.";
  if (result.method === "melee") {
    const winner = result.fighters.find((f) => f.id === result.winnerIds[0]);
    return winner ? `${winner.storeName} is the last bot moving.` : "The scrum ends.";
  }
  const winner = result.fighters.find((f) => result.winnerIds.includes(f.id));
  const loser = result.fighters.find((f) => result.loserIds.includes(f.id));
  if (noDamage) {
    return `${winner?.storeName ?? "Winner"} by ${methodLabel(result.method).toLowerCase()}${result.blowout ? ", and it was a beating" : ""}. ${loser?.botName ?? "The other bot"} leaves clean. No quote. No wear.`;
  }
  return `${winner?.storeName ?? "Winner"} by ${methodLabel(result.method).toLowerCase()}${result.blowout ? ", and it was a beating" : ""}. ${loser?.botName ?? "The other bot"} goes home with a quote.`;
}

function hpFor(result: FightResult, beat: Beat, local: number) {
  const base: Record<string, number> = {};
  result.fighters.forEach((f) => (base[f.id] = 100));
  if (result.fighters.length === 2 && result.fighters[1]?.id === "house") base.house = 100;
  const apply = (ex: Exchange, t: number) => {
    const shown = Math.round(ex.attackerHp * (1 - t) + ex.attackerHp * t);
    void shown;
    base[ex.defenderId] = Math.round(lerp(beforeHp(result, ex), ex.defenderHp, t));
    base[ex.attackerId] = ex.attackerHp;
  };
  if (beat.kind === "exchange") {
    result.exchanges.slice(0, beat.index).forEach((ex) => apply(ex, 1));
    const current = result.exchanges[beat.index];
    if (current) apply(current, smooth(local));
  } else if (beat.kind === "finisher" || beat.kind === "decision") {
    result.exchanges.forEach((ex) => apply(ex, 1));
    if (result.finisher && (beat.kind === "decision" || local > 0.45)) {
      base[result.finisher.against] = result.hp[result.finisher.against] ?? 0;
    }
  }
  return base;
}

function beforeHp(result: FightResult, ex: Exchange) {
  const prior = [...result.exchanges].reverse().find((item) => item.index < ex.index && item.defenderId === ex.defenderId);
  return prior ? prior.defenderHp : 100;
}

function smooth(local: number) {
  const t = Math.min(1, Math.max(0, (local - 0.35) / 0.2));
  return t * t * (3 - 2 * t);
}

export function armBroadcastAudio() {
  armSound();
}

function decisionWord(result: FightResult) {
  if (result.method === "bye") return "BYE";
  if (result.method === "scrimmage") return "SCRIMMAGE";
  if (result.method === "ko") return "KNOCKOUT";
  if (result.method === "dump") return "INTO THE PIT";
  if (result.method === "melee") return "LAST BOT MOVING";
  return "DECISION";
}
