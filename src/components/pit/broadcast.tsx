import { useEffect, useRef, useState } from "react";
import { PAINT } from "@/lib/pit/catalog";
import { methodLabel } from "@/lib/pit/engine";
import { armSound, playBell, playClank, playCount, playCrit, playDecision, playFinisher, playHit } from "@/lib/pit/sound";
import type { Bout, Exchange, FightResult } from "@/lib/pit/types";
import { Fx, drawSide, drawTop, impactPoints, stepBots } from "./cage-draw";
import { beatAt, buildBeats, fightDrive, lerp, type Beat, type Spot } from "./cage-motion";

const ROUND_SHOW = 0.22;

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
  const [round, setRound] = useState<string>("");
  const timeRef = useRef(0);
  const cueRef = useRef("");
  const hitRef = useRef("");
  const fxRef = useRef(new Fx());
  const trailsRef = useRef(new Map<string, Spot[]>());
  const onCompleteRef = useRef(onComplete);
  const doneRef = useRef(false);
  // Only a change in `seek` after mount jumps the tape (not a remount in dev).
  const lastSeek = useRef(seek);
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
    // Same bot landing again and again.
    let combo = { id: "", n: 0, at: -99, color: "#f0a202" };
    let countSaid = -1;
    const mainEvent = bout.title === "Main event" || bout.kind === "final";
    const hazards = bout.week === 3 && bout.kind !== "bye";

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 600 ? 1.5 : 2);
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
        combo = { id: "", n: 0, at: -99, color: combo.color };
      }
      const beat = beatAt(beats, time);
      const local = (time - beat.t) / beat.dur;
      if (playing) {
        const cue =
          beat.kind === "exchange" ? `ex-${beat.index}` : beat.kind === "clash" ? `cl-${beat.index}` : beat.kind === "intro" ? `in-${beat.side}` : beat.kind;
        if (cueRef.current !== cue) {
          cueRef.current = cue;
          if (beat.kind === "bumper") playBell();
          if (beat.kind === "finisher") playFinisher();
          if (beat.kind === "decision") playDecision();
        }
      }
      const drive = fightDrive(result, beat, local, time, { mainEvent });
      // Melee bouts get the count too.
      if (beat.kind === "countdown" && drive.countdown == null) drive.countdown = Math.max(0, 3 - Math.floor(local * 4));
      if (playing && drive.countdown != null && drive.countdown !== countSaid) {
        countSaid = drive.countdown;
        playCount(drive.countdown);
      }
      if (drive.countdown == null) countSaid = -1;
      if (playing && drive.hitKey && local >= drive.hitAt && local < drive.hitAt + 0.2 && hitRef.current !== drive.hitKey) {
        hitRef.current = drive.hitKey;
        const at = impactPoints(drive, canvas.width, canvas.height, top.width, top.height);
        const blocked = Boolean(drive.blocked);
        const crit = Boolean(drive.crit) && !blocked;
        if (at) {
          const victim = drive.bots.find((row) => row.bot.id === drive.victim) ?? drive.bots[0];
          const attacker = drive.bots.find((row) => row.bot.id === drive.attacker);
          const paint = PAINT[victim?.bot.paint ?? ""] ?? "#e2a21a";
          fx.burst(at.side.x, at.side.y, at.side.ground, at.side.scale, blocked ? 0.25 : drive.power, paint, drive.weapon, reduced);
          fx.topBurst(at.top.x, at.top.y, at.top.scale, drive.power, reduced);
          shook = reduced ? 0 : (blocked ? 3 : 6 + drive.power * 14 + (crit ? 10 : 0)) * (canvas.width / 1200);
          freeze = reduced ? 0 : blocked ? 0.04 : crit ? 0.28 : 0.06 + drive.power * 0.08;
          fx.punch = reduced ? 0 : blocked ? 0.15 : crit ? 1 : 0.45;
          const s = at.side.scale;
          if (!drive.replay) {
            if (blocked) fx.popText(at.side.x, at.side.y - s * 0.35, "BLOCKED", "#8eafc9", s * 0.2, 1.1);
            else if (drive.dmg) {
              fx.popText(at.side.x, at.side.y - s * 0.3, `-${drive.dmg}`, crit ? "#ffd166" : "#f3efe6", s * (crit ? 0.34 : 0.24));
              if (crit) fx.popText(at.side.x, at.side.y - s * 0.75, drive.weapon === "burn" ? "BURN!" : "CRITICAL!", "#ff5a1f", s * 0.2, 1.5);
            }
          }
          // Plates and wheels come off on the heavy ones.
          if (!blocked && !drive.replay && (crit || (drive.dmg ?? 0) >= 10)) {
            fx.shed(at.side.x, at.side.y, at.side.ground, s, paint, crit ? 2 + Math.round(Math.random()) : 1, crit && (drive.dmg ?? 0) >= 22);
          }
          if (!blocked && !drive.replay && drive.attacker) {
            combo = combo.id === drive.attacker && time - combo.at < 30 ? { ...combo, n: combo.n + 1, at: time } : { id: drive.attacker, n: 1, at: time, color: PAINT[attacker?.bot.paint ?? ""] ?? "#f0a202" };
          } else if (blocked) combo = { ...combo, id: "", n: 0 };
        }
        if (blocked) playClank();
        else if (crit) playCrit();
        else playHit();
      }
      if (shook > 0) shook *= Math.exp(-dt * 9);
      stepBots(drive, fx, trails, playing ? dt * speed : 0, reduced);
      fx.step(dt * (freeze > 0 ? 0.15 : drive.replay ? 0.4 : 1) * Math.min(speed, 2));
      const fighting = beat.kind === "exchange" || beat.kind === "clash" || beat.kind === "finisher";
      const hype = fighting ? (local > 0.4 && local < 0.75 ? 1 : 0.4) : beat.kind === "decision" || beat.kind === "replay" ? 0.8 : 0.15;
      const lowest = Math.min(...drive.bots.filter((b) => !b.dead && b.bot.id !== "house").map((b) => b.hp), 100);
      const heroSide = beat.kind === "intro" ? result.fighters[beat.side] : undefined;
      drawSide(ctx, canvas.width, canvas.height, drive, fx, time, dt, {
        title: beat.kind === "bumper" ? "bumper" : beat.kind === "decision" ? "decision" : null,
        word: decisionWord(result),
        hype,
        reduced,
        shake: shook,
        countdown: drive.countdown != null ? { n: drive.countdown, t: (local * 4) % 1 } : null,
        replay: Boolean(drive.replay),
        ko: beat.kind === "replay" && local > 0.68 ? (local - 0.68) / 0.32 : null,
        alarm: fighting && lowest < 25 ? (25 - lowest) / 25 : 0,
        round: beat.kind === "clash" && local < ROUND_SHOW ? { n: beat.index + 1, t: local / ROUND_SHOW } : null,
        combo: combo.n >= 2 && time - combo.at < 2.5 ? { n: combo.n, t: (time - combo.at) / 2.5, color: combo.color } : null,
        hazards,
        beams: heroSide ? (PAINT[heroSide.paint] ?? null) : beat.kind === "bumper" && mainEvent ? "#f0a202" : null,
      });
      drawTop(topCtx, top.width, top.height, drive, fx, trails, time, dt, reduced);
      setCaption(captionFor(result, bout, beat, noDamage));
      // The bars follow the bots on screen; the replay shows where the fight ended.
      const bars = hpFor(result, beat, local);
      if (beat.kind === "replay") for (const f of result.fighters) bars[f.id] = result.hp[f.id] ?? bars[f.id] ?? 100;
      else for (const b of drive.bots) bars[b.bot.id] = Math.round(b.hp);
      setHp(bars);
      setRound(drive.round ? `Round ${drive.round}` : beat.kind === "countdown" ? "Get ready" : beat.kind === "replay" ? "Replay" : "");
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
    if (lastSeek.current === seek) return;
    lastSeek.current = seek;
    const beats = buildBeats(result);
    const total = beats.reduce((m, b) => Math.max(m, b.t + b.dur), 0);
    timeRef.current = endingAt(beats, total);
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
          <canvas ref={canvasRef} aria-label="Battle arena animation" className="aspect-[4/3] w-full bg-deep sm:aspect-video" />
          <div className="pointer-events-none absolute inset-x-0 top-0 grid grid-cols-[1fr_auto_1fr] items-start gap-2 p-2 pb-6 md:gap-3 md:p-3 md:pb-8" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.78), rgba(0,0,0,0))" }}>
            {left ? <Health name={left.botName} store={left.storeName} hp={hp[left.id] ?? 100} paint={left.paint} align="left" tuned={left.tuned} /> : <span />}
            <div className="flex min-w-[3.5rem] flex-col items-center pt-0.5 md:min-w-[5rem]">
              <span className="font-display text-base leading-none text-amber tabular-nums md:text-2xl">{clock}</span>
              {round ? <span className="mt-0.5 text-[9px] tracking-[0.2em] text-fg uppercase md:text-[11px]">{round}</span> : null}
            </div>
            {right ? <Health name={right.botName} store={right.storeName} hp={hp[right.id] ?? 100} paint={right.paint} align="right" tuned={right.tuned} /> : <span />}
          </div>
          <p className="absolute inset-x-0 bottom-0 bg-deep/95 px-3 py-1.5 text-xs leading-relaxed md:py-3 md:text-base">{caption}</p>
        </div>
        <div className="relative min-w-0 bg-deep lg:min-h-full">
          <canvas ref={topRef} aria-label="Overhead arena camera" className="aspect-square w-full bg-deep lg:absolute lg:inset-0 lg:h-full lg:w-full" />
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
            timeRef.current = endingAt(beats, total);
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
  const color = PAINT[paint] ?? "#f0a202";
  const low = hp > 0 && hp < 25;
  const right = align === "right";
  return (
    <div className={`min-w-0 ${right ? "text-right" : ""}`}>
      <div className={`flex items-end gap-2 ${right ? "flex-row-reverse" : ""}`}>
        <span className="h-6 w-1.5 shrink-0 md:h-9 md:w-2" style={{ background: color }} aria-hidden />
        <div className="min-w-0">
          <p className="truncate font-display text-sm leading-none md:text-2xl">{name}</p>
          <p className="truncate text-[10px] tracking-widest text-muted uppercase md:text-xs">
            {store}
            {tuned ? <span className="ml-1 text-amber">· Tuned +4</span> : null}
          </p>
        </div>
      </div>
      <div className={`relative mt-1 h-2 w-full max-w-sm skew-x-[-18deg] border border-black/60 bg-black/60 md:h-3 ${right ? "ml-auto" : ""}`}>
        {/* Chip damage: the white part hangs on, then drains. */}
        <div
          className={`absolute inset-y-0 bg-white/85 transition-[width] delay-500 duration-700 ease-out ${right ? "right-0" : "left-0"}`}
          style={{ width: `${hp}%` }}
        />
        <div
          className={`absolute inset-y-0 transition-[width] duration-150 ${right ? "right-0" : "left-0"} ${low ? "hp-low" : ""}`}
          style={{ width: `${hp}%`, background: low ? "#e0402a" : color }}
        />
      </div>
      <p className={`mt-0.5 font-display text-[10px] leading-none tabular-nums md:text-sm ${low ? "text-bad" : "text-muted"}`}>{Math.round(hp)}</p>
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
  if (beat.kind === "countdown") return "Drivers ready. Three. Two. One.";
  if (beat.kind === "clash") {
    const ex = result.exchanges[beat.index];
    const atk = result.fighters.find((f) => f.id === ex?.attackerId);
    const def = result.fighters.find((f) => f.id === ex?.defenderId);
    return `Round ${beat.index + 1}. They circle. ${def?.botName ?? "The defender"} swings first and bounces off. ${atk?.botName ?? "The attacker"} answers.`;
  }
  if (beat.kind === "replay") return "One more time, slower. That is the blow that ended it.";
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

/** Where "skip to the end" lands: the slow-motion replay when there is one, else the decision. */
function endingAt(beats: Beat[], total: number) {
  const replay = beats.find((b) => b.kind === "replay");
  return replay ? replay.t : Math.max(0, total - 8);
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
