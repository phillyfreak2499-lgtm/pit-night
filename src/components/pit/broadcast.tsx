import { useEffect, useRef, useState } from "react";
import { PAINT } from "@/lib/pit/catalog";
import { methodLabel } from "@/lib/pit/engine";
import { armSound, playBell, playDecision, playFinisher, playHit } from "@/lib/pit/sound";
import type { Bout, ClassId, Exchange, FightResult, FighterSnap } from "@/lib/pit/types";

type Beat =
  | { t: number; dur: number; kind: "bumper" }
  | { t: number; dur: number; kind: "intro"; side: 0 | 1 }
  | { t: number; dur: number; kind: "stats" }
  | { t: number; dur: number; kind: "exchange"; index: number }
  | { t: number; dur: number; kind: "finisher" }
  | { t: number; dur: number; kind: "decision" };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type BeatBody = DistributiveOmit<Beat, "t" | "dur">;

function buildBeats(result: FightResult): Beat[] {
  const beats: Beat[] = [];
  let t = 0;
  const push = (dur: number, beat: BeatBody) => {
    beats.push({ t, dur, ...beat } as Beat);
    t += dur;
  };
  push(5, { kind: "bumper" });
  push(6.5, { kind: "intro", side: 0 });
  if (result.fighters[1]) push(6.5, { kind: "intro", side: 1 });
  push(5.5, { kind: "stats" });
  result.exchanges.forEach((_, index) => push(12, { kind: "exchange", index }));
  if (result.finisher) push(7, { kind: "finisher" });
  push(8, { kind: "decision" });
  return beats;
}

function beatAt(beats: Beat[], time: number) {
  return beats.find((b) => time >= b.t && time < b.t + b.dur) ?? beats[beats.length - 1]!;
}

type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string };

export function Broadcast({
  bout,
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
  const hitRef = useRef(-1);
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
    const sparks: Spark[] = [];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();
    let shook = 0;

    const trails: Spot[][] = [[], []];
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (const node of [canvas, top]) {
        const rect = node.getBoundingClientRect();
        node.width = Math.max(1, Math.floor(rect.width * dpr));
        node.height = Math.max(1, Math.floor(rect.height * dpr));
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    observer.observe(top);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (playing) timeRef.current = Math.min(total, timeRef.current + dt * speed);
      const time = timeRef.current;
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
      if (playing && beat.kind === "exchange" && local > 0.42 && hitRef.current !== beat.index) {
        hitRef.current = beat.index;
        shook = reduced ? 0 : 8;
        const drive = fightDrive(canvas.width, canvas.height, result, beat, local, time);
        spawn(sparks, drive.hitNx, drive.hitNy);
        playHit();
      }
      if (shook > 0) shook *= 0.86;
      drawArena(ctx, canvas.width, canvas.height, result, beat, local, sparks, shook, reduced, time);
      const plan = fightDrive(Math.max(1, top.width), Math.max(1, top.height), result, beat, local, reduced ? 0 : time);
      if (!reduced && result.fighters.length <= 2 && result.method !== "melee") {
        pushTrail(trails[0]!, plan.spotA);
        if (plan.spotB) pushTrail(trails[1]!, plan.spotB);
      }
      drawTop(topCtx, top.width, top.height, result, beat, local, time, trails, reduced);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]!;
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.004;
        s.life -= dt;
        if (s.life <= 0) sparks.splice(i, 1);
      }
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
          <div className="pointer-events-none absolute inset-x-0 top-0 grid gap-2 p-3 md:grid-cols-2">
            {left ? <Health name={left.botName} store={left.storeName} hp={hp[left.id] ?? 100} paint={left.paint} align="left" /> : null}
            {right ? <Health name={right.botName} store={right.storeName} hp={hp[right.id] ?? 100} paint={right.paint} align="right" /> : null}
          </div>
          <p className="absolute inset-x-0 bottom-0 bg-deep/80 px-3 py-3 text-sm md:text-base">{caption}</p>
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
              hitRef.current = -1;
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
}: {
  name: string;
  store: string;
  hp: number;
  paint: string;
  align: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <p className="font-display text-lg leading-none md:text-2xl">{name}</p>
      <p className="text-xs tracking-widest text-muted uppercase">{store}</p>
      <div className={`mt-1 h-2 w-full max-w-xs bg-line ${align === "right" ? "ml-auto" : ""}`}>
        <div className="h-2" style={{ width: `${hp}%`, background: PAINT[paint] ?? "#f0a202" }} />
      </div>
    </div>
  );
}

function captionFor(result: FightResult, bout: Bout, beat: Beat, noDamage: boolean) {
  if (beat.kind === "bumper") return noDamage ? "Bay scrimmage. The house drill. Nothing posts." : `${bout.title}. Ten stores. This cage holds ${bout.kind === "melee" ? "the rest of the card" : "two"}.`;
  if (beat.kind === "intro") {
    const f = result.fighters[beat.side];
    if (!f) return "";
    return `${f.storeName}. ${f.botName}. ${f.classId}. ${f.chassisName}, ${f.weaponName}.`;
  }
  if (beat.kind === "stats") return "Printed before the bell. Power. Speed. Armor. Heat. The week set the range. The lock picked the number.";
  if (beat.kind === "exchange") return result.exchanges[beat.index]?.call ?? "";
  if (beat.kind === "finisher") return result.finisher?.call ?? "";
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

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smooth(local: number) {
  const t = Math.min(1, Math.max(0, (local - 0.35) / 0.2));
  return t * t * (3 - 2 * t);
}

function spawn(sparks: Spark[], x: number, y: number) {
  for (let i = 0; i < 22; i++) {
    const ang = Math.random() * Math.PI * 2;
    const kick = 0.004 + Math.random() * 0.012;
    sparks.push({
      x,
      y,
      vx: Math.cos(ang) * kick,
      vy: Math.sin(ang) * kick - 0.01,
      life: 0.35 + Math.random() * 0.35,
      color: i % 3 === 0 ? "#ff5a1f" : "#f0a202",
    });
  }
}

type Spot = { x: number; y: number };
type Pose = "idle" | "lunge" | "hit" | "recoil" | "down";

function ease(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function mixSpot(a: Spot, b: Spot, t: number): Spot {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

function bend(from: Spot, to: Spot, t: number, amount: number): Spot {
  const mid = mixSpot(from, to, t);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const arc = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI) * amount;
  return { x: mid.x + (-dy / len) * arc, y: mid.y + (dx / len) * arc };
}

function corner(side: 0 | 1, step: number): Spot {
  const xs = side === 0 ? [0.2, 0.32, 0.16, 0.38] : [0.8, 0.68, 0.84, 0.62];
  const ys = [0.74, 0.46, 0.62, 0.4];
  const i = ((step % 4) + 4) % 4;
  return { x: xs[i]!, y: ys[i]! };
}

function sway(amount: number) {
  return amount;
}

function curveOf(classId: ClassId) {
  if (classId === "tank") return 0.03;
  if (classId === "specialist") return 0.14;
  return 0.09;
}

function project(spot: Spot, w: number, h: number) {
  const y = Math.min(0.94, Math.max(0.28, spot.y));
  const sy = h * (0.4 + y * 0.38);
  const half = w * (0.18 + y * 0.28);
  const sx = w * 0.5 + (spot.x - 0.5) * 2 * half;
  const size = w * (0.1 + y * 0.1);
  return { x: sx, y: sy, size };
}

function faceOf(from: Spot, to: Spot, fallback: number) {
  if (to.x - from.x > 0.03) return 1;
  if (from.x - to.x > 0.03) return -1;
  return fallback;
}

function headingOf(from: Spot, to: Spot, fallback: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.hypot(dx, dy) < 0.025) return fallback;
  return Math.atan2(dy, dx);
}

function pushTrail(trail: Spot[], spot: Spot) {
  const last = trail[trail.length - 1];
  if (last && Math.hypot(last.x - spot.x, last.y - spot.y) < 0.012) return;
  trail.push({ x: spot.x, y: spot.y });
  if (trail.length > 16) trail.shift();
}

function shade(hex: string, amt: number) {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) return hex;
  const ch = (shift: number) => Math.min(255, Math.max(0, ((num >> shift) & 255) + amt));
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

function fightDrive(w: number, h: number, result: FightResult, beat: Beat, local: number, time: number) {
  const a = result.fighters[0]!;
  const b = result.fighters[1];
  const step = beat.kind === "exchange" ? beat.index : beat.kind === "finisher" ? result.exchanges.length : 0;
  let spotA = corner(0, step);
  let spotB = b ? corner(1, step) : null;
  let poseA: Pose = "idle";
  let poseB: Pose = "idle";
  let spotlight: 0 | 1 | null = null;
  const endA = corner(0, step + 1);
  const endB = corner(1, step + 1);

  if (beat.kind === "bumper") {
    spotA = bend({ x: -0.2, y: 0.82 }, corner(0, 0), ease(local), curveOf(a.classId));
    if (b) spotB = bend({ x: 1.2, y: 0.82 }, corner(1, 0), ease(local), curveOf(b.classId));
    poseA = "lunge";
    poseB = "lunge";
  } else if (beat.kind === "intro") {
    spotlight = beat.side;
    const lap = local * Math.PI * 2;
    if (beat.side === 0) {
      spotA = bend(corner(0, 0), { x: 0.46, y: 0.78 }, ease(Math.min(1, local / 0.7)), curveOf(a.classId));
      if (b) spotB = { x: corner(1, 0).x + Math.sin(lap) * 0.06, y: corner(1, 0).y + Math.cos(lap) * 0.1 };
    } else {
      spotA = { x: corner(0, 1).x + Math.sin(lap) * 0.06, y: corner(0, 1).y + Math.cos(lap) * 0.08 };
      if (b) spotB = bend(corner(1, 0), { x: 0.54, y: 0.78 }, ease(Math.min(1, local / 0.7)), curveOf(b.classId));
    }
  } else if (beat.kind === "stats") {
    const lap = local * Math.PI * 2;
    spotA = { x: corner(0, 1).x + Math.sin(lap) * sway(0.1), y: 0.5 + Math.cos(lap) * 0.16 };
    if (b) spotB = { x: corner(1, 1).x + Math.sin(lap + Math.PI) * 0.1, y: 0.5 + Math.cos(lap + Math.PI) * 0.16 };
  } else if ((beat.kind === "exchange" || beat.kind === "finisher") && b && spotB) {
    const ex = beat.kind === "exchange" ? result.exchanges[beat.index] : result.exchanges[result.exchanges.length - 1];
    const attackerA = !ex || ex.attackerId === a.id;
    const fromA = corner(0, step);
    const fromB = corner(1, step);
    const impactA = attackerA ? mixSpot(fromA, fromB, 0.78) : fromA;
    const impactB = attackerA ? fromB : mixSpot(fromB, fromA, 0.78);
    const slideA = attackerA ? impactA : { x: Math.min(0.9, fromA.x - 0.12), y: Math.min(0.9, fromA.y + 0.1) };
    const slideB = attackerA ? { x: Math.max(0.1, fromB.x + 0.12), y: Math.min(0.9, fromB.y + 0.1) } : impactB;
    if (local < 0.42) {
      const t = ease(local / 0.42);
      spotA = bend(fromA, attackerA ? impactA : fromA, t, curveOf(a.classId));
      spotB = bend(fromB, attackerA ? fromB : impactB, t, curveOf(b.classId));
      if (attackerA) poseA = "lunge";
      else poseB = "lunge";
    } else if (local < 0.62) {
      const t = ease((local - 0.42) / 0.2);
      spotA = mixSpot(attackerA ? impactA : fromA, slideA, attackerA ? 0 : t);
      spotB = mixSpot(attackerA ? fromB : impactB, slideB, attackerA ? t : 0);
      poseA = attackerA ? "hit" : "recoil";
      poseB = attackerA ? "recoil" : "hit";
    } else {
      const t = ease((local - 0.62) / 0.38);
      spotA = bend(slideA, endA, t, curveOf(a.classId) * 0.6);
      spotB = bend(slideB, endB, t, curveOf(b.classId) * 0.6);
    }
  } else if (beat.kind === "decision" && b && spotB) {
    const aLost = result.loserIds.includes(a.id);
    const bLost = result.loserIds.includes(b.id);
    const lap = local * Math.PI * 2;
    if (aLost) {
      spotA = { x: 0.38, y: 0.86 };
      poseA = "down";
    } else {
      spotA = { x: 0.42 + Math.sin(lap) * 0.1, y: 0.58 + Math.cos(lap) * 0.08 };
    }
    if (bLost) {
      spotB = { x: 0.62, y: 0.86 };
      poseB = "down";
    } else if (spotB) {
      spotB = { x: 0.58 + Math.sin(lap + 1) * 0.1, y: 0.58 + Math.cos(lap + 1) * 0.08 };
    }
  }

  const pa = project(spotA, w, h);
  const pb = spotB ? project(spotB, w, h) : null;
  const hitSpot = spotB ? mixSpot(spotA, spotB, 0.5) : spotA;
  const hit = project(hitSpot, w, h);
  const facingA = faceOf(corner(0, step), spotA, 1);
  const facingB = spotB ? faceOf(corner(1, step), spotB, -1) : -1;
  return {
    a: { ...pa, facing: facingA, pose: poseA, bot: a },
    b: pb && b ? { ...pb, facing: facingB, pose: poseB, bot: b } : null,
    spotA,
    spotB,
    headingA: headingOf(corner(0, step), spotA, 0),
    headingB: spotB ? headingOf(corner(1, step), spotB, Math.PI) : Math.PI,
    hitNx: hit.x / w,
    hitNy: hit.y / h,
    spotlight,
    spin: time,
  };
}

export function armBroadcastAudio() {
  armSound();
}

function drawArena(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  result: FightResult,
  beat: Beat,
  local: number,
  sparks: Spark[],
  shake: number,
  reduced: boolean,
  time: number,
) {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  drawPit(ctx, w, h);

  const a = result.fighters[0];
  if (!a) {
    ctx.restore();
    return;
  }
  if (result.method === "melee" || result.fighters.length > 2) {
    drawMelee(ctx, w, h, result, beat, local, time);
    drawSparks(ctx, w, h, sparks);
    ctx.restore();
    return;
  }

  const drive = fightDrive(w, h, result, beat, local, reduced ? 0 : time);
  const order = [drive.a, drive.b].filter((row) => row != null).sort((p, q) => p.y - q.y);
  for (const bot of order) {
    drawBot(ctx, bot.x, bot.y, bot.size, bot.facing, bot.bot, reduced ? "idle" : bot.pose, drive.spotlight === (bot.bot.id === drive.a.bot.id ? 0 : 1), reduced ? 0 : drive.spin);
  }
  drawSparks(ctx, w, h, sparks);
  if (beat.kind === "bumper" || beat.kind === "decision") {
    ctx.fillStyle = "#f3efe6";
    ctx.textAlign = "center";
    if (beat.kind === "bumper") {
      ctx.font = `700 ${Math.max(16, w / 32)}px Oswald, sans-serif`;
      ctx.fillText("THE WATERMAN", w / 2, h * 0.2);
      ctx.font = `700 ${Math.max(22, w / 18)}px Oswald, sans-serif`;
      ctx.fillText("BATTLE BOT LEAGUE", w / 2, h * 0.3);
    } else {
      ctx.font = `700 ${Math.max(28, w / 18)}px Oswald, sans-serif`;
      ctx.fillText(decisionWord(result), w / 2, h * 0.28);
    }
  }
  ctx.restore();
}

function decisionWord(result: FightResult) {
  if (result.method === "scrimmage") return "SCRIMMAGE";
  if (result.method === "ko") return "KO";
  if (result.method === "dump") return "DUMP";
  return "DECISION";
}

function drawPit(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#080807";
  ctx.fillRect(-20, -20, w + 40, h + 40);
  const wall = ctx.createLinearGradient(0, h * 0.1, 0, h * 0.48);
  wall.addColorStop(0, "#0c0b09");
  wall.addColorStop(1, "#2a231c");
  ctx.fillStyle = wall;
  ctx.fillRect(w * 0.06, h * 0.14, w * 0.88, h * 0.32);
  ctx.fillStyle = "#12100e";
  ctx.beginPath();
  ctx.moveTo(0, h * 0.3);
  ctx.lineTo(w * 0.06, h * 0.14);
  ctx.lineTo(w * 0.06, h * 0.46);
  ctx.lineTo(0, h);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w, h * 0.3);
  ctx.lineTo(w * 0.94, h * 0.14);
  ctx.lineTo(w * 0.94, h * 0.46);
  ctx.lineTo(w, h);
  ctx.fill();
  const floor = ctx.createLinearGradient(0, h * 0.46, 0, h * 0.96);
  floor.addColorStop(0, "#3a3228");
  floor.addColorStop(1, "#100e0b");
  ctx.fillStyle = floor;
  ctx.beginPath();
  ctx.moveTo(w * 0.06, h * 0.46);
  ctx.lineTo(w * 0.94, h * 0.46);
  ctx.lineTo(w * 0.99, h * 0.96);
  ctx.lineTo(w * 0.01, h * 0.96);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#4a4338";
  ctx.lineWidth = Math.max(1, w / 500);
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    ctx.beginPath();
    ctx.moveTo(lerp(w * 0.06, w * 0.94, t), h * 0.46);
    ctx.lineTo(lerp(w * 0.01, w * 0.99, t), h * 0.96);
    ctx.stroke();
  }
  ctx.strokeStyle = "#f0a202";
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = Math.max(2, w / 280);
  ctx.beginPath();
  ctx.moveTo(w * 0.06, h * 0.46);
  ctx.lineTo(w * 0.94, h * 0.46);
  ctx.lineTo(w * 0.99, h * 0.96);
  ctx.lineTo(w * 0.01, h * 0.96);
  ctx.closePath();
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#8a8175";
  ctx.font = `600 ${Math.max(11, w / 46)}px Oswald, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("SIDE", w * 0.03, h * 0.08);
}

function hullPath(ctx: CanvasRenderingContext2D, size: number, classId: ClassId) {
  ctx.beginPath();
  if (classId === "tank") {
    ctx.roundRect(-size * 0.42, -size * 0.48, size * 0.84, size * 0.52, 5);
    return;
  }
  if (classId === "specialist") {
    ctx.roundRect(-size * 0.24, -size * 0.54, size * 0.46, size * 0.58, 3);
    return;
  }
  ctx.moveTo(-size * 0.48, size * 0.02);
  ctx.lineTo(size * 0.16, -size * 0.34);
  ctx.lineTo(size * 0.44, -size * 0.16);
  ctx.lineTo(size * 0.44, size * 0.02);
  ctx.closePath();
}

function drawBot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  facing: number,
  bot: FighterSnap,
  pose: Pose,
  hot: boolean,
  time: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  if (pose === "recoil") ctx.rotate(0.08);
  if (pose === "lunge") ctx.rotate(-0.12);
  if (pose === "down") ctx.rotate(0.9);
  const paint = PAINT[bot.paint] ?? "#e2a21a";
  const dark = shade(paint, -70);
  const lid = shade(paint, 48);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.ellipse(size * 0.06, size * 0.34, size * 0.5, size * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  if (hot) {
    ctx.strokeStyle = paint;
    ctx.globalAlpha = 0.8;
    ctx.strokeRect(-size * 0.55, -size * 0.7, size * 1.1, size);
    ctx.globalAlpha = 1;
  }
  drawWheels(ctx, size, bot.classId, paint, time);
  ctx.save();
  ctx.translate(size * 0.05, size * 0.12);
  ctx.fillStyle = dark;
  hullPath(ctx, size, bot.classId);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = paint;
  hullPath(ctx, size, bot.classId);
  ctx.fill();
  ctx.fillStyle = lid;
  ctx.save();
  ctx.translate(0, -size * 0.08);
  ctx.scale(0.72, 0.55);
  hullPath(ctx, size, bot.classId);
  ctx.fill();
  ctx.restore();
  if (bot.classId === "specialist") {
    ctx.strokeStyle = "#f3efe6";
    ctx.strokeRect(-size * 0.3, -size * 0.58, size * 0.56, size * 0.66);
  }
  drawLook(ctx, size, bot.look ?? "plain");
  drawBayNumber(ctx, size, bot.number ?? "", facing);
  drawWeapon(ctx, size, bot.weaponFamily, pose, time);
  ctx.fillStyle = "#0e0d0b";
  ctx.fillRect(size * 0.05, -size * 0.32, size * 0.12, size * 0.08);
  ctx.restore();
}

function drawLook(ctx: CanvasRenderingContext2D, size: number, look: string) {
  if (look === "stripe") {
    ctx.fillStyle = "#f3efe6";
    ctx.fillRect(-size * 0.4, -size * 0.2, size * 0.78, size * 0.07);
    return;
  }
  if (look === "chevron") {
    ctx.strokeStyle = "#0e0d0b";
    ctx.lineWidth = Math.max(2, size * 0.045);
    ctx.beginPath();
    ctx.moveTo(-size * 0.2, -size * 0.34);
    ctx.lineTo(size * 0.05, -size * 0.16);
    ctx.lineTo(-size * 0.2, size * 0.02);
    ctx.stroke();
    return;
  }
  if (look === "rivets") {
    ctx.fillStyle = "#f3efe6";
    for (const [rx, ry] of [
      [-0.28, -0.32],
      [0.18, -0.32],
      [-0.28, -0.08],
      [0.18, -0.08],
    ] as const) {
      ctx.beginPath();
      ctx.arc(size * rx, size * ry, size * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBayNumber(ctx: CanvasRenderingContext2D, size: number, number: string, facing: number) {
  if (!number) return;
  ctx.save();
  ctx.scale(facing, 1);
  ctx.fillStyle = "#0e0d0b";
  ctx.font = `700 ${Math.max(11, size * 0.18)}px Oswald, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(number, 0, -size * 0.18);
  ctx.restore();
}

function drawWheels(ctx: CanvasRenderingContext2D, size: number, classId: ClassId, paint: string, time: number) {
  ctx.fillStyle = "#2a261f";
  if (classId === "tank") {
    roundRect(ctx, -size * 0.48, -size * 0.08, size * 0.96, size * 0.22, 6);
    ctx.fill();
    ctx.strokeStyle = paint;
    ctx.strokeRect(-size * 0.48, -size * 0.08, size * 0.96, size * 0.22);
    ctx.strokeStyle = "#0e0d0b";
    const roll = (time * 40) % (size * 0.16);
    for (let i = -3; i <= 3; i++) {
      const x = -size * 0.4 + i * size * 0.16 + roll;
      ctx.beginPath();
      ctx.moveTo(x, -size * 0.06);
      ctx.lineTo(x, size * 0.12);
      ctx.stroke();
    }
    return;
  }
  for (const ox of [-0.28, 0.12]) {
    ctx.beginPath();
    ctx.arc(size * ox, size * 0.05, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(size * ox, size * 0.05);
    ctx.rotate(time * 8);
    ctx.strokeStyle = paint;
    ctx.beginPath();
    ctx.moveTo(-size * 0.09, 0);
    ctx.lineTo(size * 0.09, 0);
    ctx.stroke();
    ctx.restore();
  }
}

function drawWeapon(ctx: CanvasRenderingContext2D, size: number, family: string, pose: Pose, time: number) {
  ctx.save();
  ctx.fillStyle = pose === "hit" ? "#ff5a1f" : "#d9d3c7";
  ctx.translate(size * 0.38, -size * 0.2);
  const spinning = family === "saw" || family === "disc" || family === "drum";
  if (spinning) ctx.rotate(time * (family === "disc" ? 16 : family === "drum" ? 11 : 9));
  if (family === "hammer") ctx.rotate(pose === "lunge" ? -1 : pose === "hit" ? 1.15 : -0.2);
  if (family === "saw" || family === "disc" || family === "drum") {
    const radius = size * (family === "disc" ? 0.2 : 0.16);
    ctx.fillStyle = "#4a4338";
    ctx.beginPath();
    ctx.arc(0, size * 0.05, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pose === "hit" ? "#ff5a1f" : "#d9d3c7";
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0e0d0b";
    ctx.beginPath();
    ctx.moveTo(-size * 0.14, 0);
    ctx.lineTo(size * 0.14, 0);
    ctx.moveTo(0, -size * 0.14);
    ctx.lineTo(0, size * 0.14);
    ctx.stroke();
  } else if (family === "claw") {
    const open = size * (0.1 + Math.sin(time * 3) * 0.03 + (pose === "hit" ? 0.06 : 0));
    ctx.fillRect(0, -size * 0.22, size * 0.08, size * 0.28);
    ctx.fillRect(open, -size * 0.22, size * 0.08, size * 0.28);
  } else if (family === "hammer") {
    ctx.fillRect(size * 0.02, -size * 0.34, size * 0.08, size * 0.34);
    ctx.fillRect(-size * 0.08, -size * 0.42, size * 0.28, size * 0.12);
  } else {
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.05);
    ctx.lineTo(size * 0.28, size * 0.08);
    ctx.lineTo(0, size * 0.12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawSparks(ctx: CanvasRenderingContext2D, w: number, h: number, sparks: Spark[]) {
  for (const s of sparks) {
    ctx.globalAlpha = Math.max(0, s.life * 2);
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x * w, s.y * h, 3, 3);
  }
  ctx.globalAlpha = 1;
}

function drawTop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  result: FightResult,
  beat: Beat,
  local: number,
  time: number,
  trails: Spot[][],
  reduced: boolean,
) {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#080807";
  ctx.fillRect(0, 0, w, h);
  const side = Math.min(w, h);
  const ox = (w - side) / 2;
  const oy = (h - side) / 2;
  const pad = side * 0.1;
  const x0 = ox + pad;
  const y0 = oy + pad;
  const s = side - pad * 2;
  ctx.fillStyle = "#3a3228";
  ctx.fillRect(x0 - side * 0.025, y0 - side * 0.025, s + side * 0.05, s + side * 0.05);
  const floor = ctx.createLinearGradient(x0, y0, x0, y0 + s);
  floor.addColorStop(0, "#2a241c");
  floor.addColorStop(1, "#100e0b");
  ctx.fillStyle = floor;
  ctx.fillRect(x0, y0, s, s);
  ctx.strokeStyle = "#f0a202";
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = Math.max(2, s * 0.012);
  ctx.strokeRect(x0 + s * 0.04, y0 + s * 0.04, s * 0.92, s * 0.92);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#8a8175";
  for (const [px, py] of [
    [0.08, 0.08],
    [0.92, 0.08],
    [0.08, 0.92],
    [0.92, 0.92],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x0 + s * px, y0 + s * py, Math.max(2, s * 0.016), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = `600 ${Math.max(11, s * 0.05)}px Oswald, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("TOP", x0 + s * 0.05, y0 + s * 0.09);
  const map = (spot: Spot) => ({ x: x0 + spot.x * s, y: y0 + spot.y * s });

  if (result.method === "melee" || result.fighters.length > 2) {
    const bots = result.fighters.filter((f) => f.id !== "house");
    const attacker = beat.kind === "exchange" ? result.exchanges[beat.index]?.attackerId : null;
    bots.forEach((bot, i) => {
      const orbit = time * 0.45 + (Math.PI * 2 * i) / Math.max(1, bots.length);
      let spot = { x: 0.5 + Math.cos(orbit) * 0.28, y: 0.58 + Math.sin(orbit) * 0.2 };
      if (attacker === bot.id && beat.kind === "exchange") spot = mixSpot(spot, { x: 0.5, y: 0.62 }, local > 0.28 && local < 0.62 ? 0.65 : 0.2);
      const dead = beat.kind === "decision" && result.meleeOrder && result.meleeOrder[0] !== bot.id && (result.hp[bot.id] ?? 0) < 30;
      drawTopBot(ctx, map(spot), orbit + Math.PI / 2, bot, dead ? "down" : "lunge", s);
    });
    ctx.restore();
    return;
  }

  const drive = fightDrive(Math.max(1, w), Math.max(1, h), result, beat, local, reduced ? 0 : time);
  drawTrail(ctx, trails[0] ?? [], map, PAINT[drive.a.bot.paint] ?? "#e2a21a");
  drawTopBot(ctx, map(drive.spotA), drive.headingA, drive.a.bot, reduced ? "idle" : drive.a.pose, s);
  if (drive.b && drive.spotB) {
    drawTrail(ctx, trails[1] ?? [], map, PAINT[drive.b.bot.paint] ?? "#3c8f78");
    drawTopBot(ctx, map(drive.spotB), drive.headingB, drive.b.bot, reduced ? "idle" : drive.b.pose, s);
  }
  ctx.restore();
}

function drawTrail(ctx: CanvasRenderingContext2D, trail: Spot[], map: (spot: Spot) => { x: number; y: number }, color: string) {
  if (trail.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 2;
  ctx.beginPath();
  trail.forEach((spot, i) => {
    const p = map(spot);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawTopBot(
  ctx: CanvasRenderingContext2D,
  at: { x: number; y: number },
  heading: number,
  bot: FighterSnap,
  pose: Pose,
  cage: number,
) {
  const paint = PAINT[bot.paint] ?? "#e2a21a";
  const len = cage * (bot.classId === "tank" ? 0.16 : bot.classId === "specialist" ? 0.11 : 0.14);
  const wid = cage * (bot.classId === "tank" ? 0.12 : 0.075);
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(pose === "down" ? heading + 0.8 : heading);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(3, 4, len * 0.55, wid * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(paint, -65);
  ctx.fillRect(-len * 0.5, -wid * 0.5 + 3, len, wid);
  ctx.fillStyle = paint;
  roundRect(ctx, -len * 0.5, -wid * 0.5, len, wid, 3);
  ctx.fill();
  ctx.fillStyle = shade(paint, 45);
  ctx.fillRect(-len * 0.22, -wid * 0.28, len * 0.38, wid * 0.56);
  ctx.fillStyle = pose === "hit" ? "#ff5a1f" : "#d9d3c7";
  if (bot.weaponFamily === "saw" || bot.weaponFamily === "disc" || bot.weaponFamily === "drum") {
    ctx.beginPath();
    ctx.arc(len * 0.42, 0, wid * 0.55, 0, Math.PI * 2);
    ctx.fill();
  } else if (bot.weaponFamily === "hammer") {
    ctx.fillRect(len * 0.35, -wid * 0.7, wid * 0.28, wid * 1.4);
  } else if (bot.weaponFamily === "claw") {
    ctx.fillRect(len * 0.4, -wid * 0.7, wid * 0.22, wid * 0.45);
    ctx.fillRect(len * 0.4, wid * 0.25, wid * 0.22, wid * 0.45);
  } else {
    ctx.beginPath();
    ctx.moveTo(len * 0.35, -wid * 0.35);
    ctx.lineTo(len * 0.72, 0);
    ctx.lineTo(len * 0.35, wid * 0.35);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawMelee(ctx: CanvasRenderingContext2D, w: number, h: number, result: FightResult, beat: Beat, local: number, time: number) {
  const bots = result.fighters.filter((f) => f.id !== "house");
  const attacker = beat.kind === "exchange" ? result.exchanges[beat.index]?.attackerId : null;
  const placed = bots.map((bot, i) => {
    const orbit = time * 0.45 + (Math.PI * 2 * i) / Math.max(1, bots.length);
    let spot = { x: 0.5 + Math.cos(orbit) * 0.28, y: 0.58 + Math.sin(orbit) * 0.2 };
    if (attacker === bot.id && beat.kind === "exchange") {
      spot = mixSpot(spot, { x: 0.5, y: 0.62 }, local > 0.28 && local < 0.62 ? 0.65 : 0.2);
    }
    const p = project(spot, w, h);
    const dead = beat.kind === "decision" && result.meleeOrder && result.meleeOrder[0] !== bot.id && (result.hp[bot.id] ?? 0) < 30;
    return { bot, ...p, dead, facing: Math.cos(orbit) > 0 ? 1 : -1 };
  });
  placed.sort((p, q) => p.y - q.y);
  for (const row of placed) {
    drawBot(ctx, row.x, row.y, row.size, row.facing, row.bot, row.dead ? "down" : "lunge", false, time);
  }
  if (beat.kind === "exchange" && local > 0.4) {
    ctx.fillStyle = "#f0a202";
    ctx.font = `600 ${Math.max(16, w / 28)}px Oswald, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("SCRUM", w / 2, h * 0.22);
  }
}
