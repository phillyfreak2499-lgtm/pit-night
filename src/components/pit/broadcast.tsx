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
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const beats = buildBeats(result);
    const total = beats.reduce((m, b) => Math.max(m, b.t + b.dur), 0);
    const sparks: Spark[] = [];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();
    let shook = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

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
        spawn(sparks, result, beat.index);
        playHit();
      }
      if (shook > 0) shook *= 0.86;
      drawArena(ctx, canvas.width, canvas.height, result, beat, local, sparks, shook, reduced);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]!;
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.15;
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
      <div className="relative">
        <canvas ref={canvasRef} className="aspect-video w-full bg-deep" />
        <div className="pointer-events-none absolute inset-x-0 top-0 grid gap-2 p-3 md:grid-cols-2">
          {left ? <Health name={left.botName} store={left.storeName} hp={hp[left.id] ?? 100} paint={left.paint} align="left" /> : null}
          {right ? <Health name={right.botName} store={right.storeName} hp={hp[right.id] ?? 100} paint={right.paint} align="right" /> : null}
        </div>
        <p className="absolute inset-x-0 bottom-0 bg-deep/80 px-3 py-3 text-sm md:text-base">{caption}</p>
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

function spawn(sparks: Spark[], result: FightResult, index: number) {
  const ex = result.exchanges[index];
  if (!ex) return;
  const fromRight = result.fighters[1] && (ex.attackerId === result.fighters[1].id || ex.attackerId.includes(result.fighters[1].id));
  const x = fromRight ? 0.62 : 0.38;
  for (let i = 0; i < 18; i++) {
    sparks.push({
      x,
      y: 0.58,
      vx: (Math.random() - 0.5) * 0.02,
      vy: -Math.random() * 0.02,
      life: 0.35 + Math.random() * 0.3,
      color: i % 3 === 0 ? "#ff5a1f" : "#f0a202",
    });
  }
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
) {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  ctx.fillStyle = "#080807";
  ctx.fillRect(-20, -20, w + 40, h + 40);
  ctx.strokeStyle = "#3a342c";
  ctx.lineWidth = Math.max(1, w / 400);
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo((w / 7) * i, h * 0.42);
    ctx.lineTo(w * 0.5 + (i - 3.5) * w * 0.12, h * 0.92);
    ctx.stroke();
  }
  ctx.fillStyle = "#12100d";
  ctx.beginPath();
  ctx.moveTo(0, h * 0.72);
  ctx.lineTo(w, h * 0.72);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  ctx.strokeStyle = "#f0a202";
  ctx.globalAlpha = 0.35;
  ctx.strokeRect(w * 0.08, h * 0.16, w * 0.84, h * 0.7);
  ctx.globalAlpha = 1;

  const a = result.fighters[0];
  const b = result.fighters[1];
  if (!a) {
    ctx.restore();
    return;
  }
  if (result.method === "melee" || result.fighters.length > 2) {
    drawMelee(ctx, w, h, result, beat, local);
    drawSparks(ctx, w, h, sparks);
    ctx.restore();
    return;
  }

  let ax = w * 0.3;
  let bx = w * 0.7;
  let poseA: Pose = "idle";
  let poseB: Pose = "idle";
  let spotlight: 0 | 1 | null = null;
  if (beat.kind === "intro") spotlight = beat.side;
  if (beat.kind === "exchange") {
    const ex = result.exchanges[beat.index];
    const attackerLeft = ex?.attackerId === a.id;
    const lunge = local > 0.28 && local < 0.62;
    if (attackerLeft) {
      poseA = lunge ? "lunge" : local > 0.5 ? "hit" : "idle";
      poseB = local > 0.45 ? "recoil" : "idle";
      if (lunge) ax += w * 0.08;
    } else {
      poseB = lunge ? "lunge" : local > 0.5 ? "hit" : "idle";
      poseA = local > 0.45 ? "recoil" : "idle";
      if (lunge) bx -= w * 0.08;
    }
  }
  if (beat.kind === "decision" && result.loserIds.includes(a.id)) poseA = "down";
  if (b && beat.kind === "decision" && result.loserIds.includes(b.id)) poseB = "down";
  if (!reduced) {
    drawBot(ctx, ax, h * 0.7, w * 0.22, 1, a, poseA, spotlight === 0);
    if (b) drawBot(ctx, bx, h * 0.7, w * 0.22, -1, b, poseB, spotlight === 1);
  } else {
    drawBot(ctx, ax, h * 0.7, w * 0.22, 1, a, "idle", spotlight === 0);
    if (b) drawBot(ctx, bx, h * 0.7, w * 0.22, -1, b, "idle", spotlight === 1);
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

type Pose = "idle" | "lunge" | "hit" | "recoil" | "down";

function drawBot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  facing: number,
  bot: FighterSnap,
  pose: Pose,
  hot: boolean,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  if (pose === "recoil") ctx.rotate(0.08);
  if (pose === "lunge") ctx.rotate(-0.12);
  if (pose === "down") ctx.rotate(0.9);
  const paint = PAINT[bot.paint] ?? "#e2a21a";
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.28, size * 0.46, size * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  if (hot) {
    ctx.strokeStyle = paint;
    ctx.globalAlpha = 0.8;
    ctx.strokeRect(-size * 0.55, -size * 0.7, size * 1.1, size);
    ctx.globalAlpha = 1;
  }
  drawWheels(ctx, size, bot.classId, paint);
  ctx.fillStyle = paint;
  if (bot.classId === "tank") {
    roundRect(ctx, -size * 0.42, -size * 0.42, size * 0.84, size * 0.48, 4);
  } else if (bot.classId === "specialist") {
    roundRect(ctx, -size * 0.28, -size * 0.5, size * 0.5, size * 0.55, 2);
    ctx.strokeStyle = "#f3efe6";
    ctx.strokeRect(-size * 0.34, -size * 0.56, size * 0.62, size * 0.66);
  } else {
    ctx.beginPath();
    ctx.moveTo(-size * 0.45, -size * 0.05);
    ctx.lineTo(size * 0.4, -size * 0.28);
    ctx.lineTo(size * 0.4, -size * 0.02);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fill();
  drawLook(ctx, size, bot.look ?? "plain");
  drawBayNumber(ctx, size, bot.number ?? "", facing);
  drawWeapon(ctx, size, bot.weaponFamily, pose === "hit");
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

function drawWheels(ctx: CanvasRenderingContext2D, size: number, classId: ClassId, paint: string) {
  ctx.fillStyle = "#2a261f";
  if (classId === "tank") {
    roundRect(ctx, -size * 0.48, -size * 0.08, size * 0.96, size * 0.22, 6);
    ctx.fill();
    ctx.strokeStyle = paint;
    ctx.strokeRect(-size * 0.48, -size * 0.08, size * 0.96, size * 0.22);
    return;
  }
  for (const ox of [-0.28, 0.12]) {
    ctx.beginPath();
    ctx.arc(size * ox, size * 0.05, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWeapon(ctx: CanvasRenderingContext2D, size: number, family: string, hit: boolean) {
  ctx.save();
  ctx.fillStyle = hit ? "#ff5a1f" : "#d9d3c7";
  ctx.translate(size * 0.38, -size * 0.2);
  if (family === "saw" || family === "disc" || family === "drum") {
    ctx.beginPath();
    ctx.arc(0, 0, size * (family === "disc" ? 0.2 : 0.16), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0e0d0b";
    ctx.beginPath();
    ctx.moveTo(-size * 0.14, 0);
    ctx.lineTo(size * 0.14, 0);
    ctx.moveTo(0, -size * 0.14);
    ctx.lineTo(0, size * 0.14);
    ctx.stroke();
  } else if (family === "claw") {
    ctx.fillRect(0, -size * 0.22, size * 0.08, size * 0.28);
    ctx.fillRect(size * 0.12, -size * 0.22, size * 0.08, size * 0.28);
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

function drawMelee(ctx: CanvasRenderingContext2D, w: number, h: number, result: FightResult, beat: Beat, local: number) {
  const bots = result.fighters.filter((f) => f.id !== "house");
  bots.forEach((bot, i) => {
    const ang = (Math.PI * 2 * i) / bots.length - Math.PI / 2;
    const rad = Math.min(w, h) * 0.22;
    const x = w * 0.5 + Math.cos(ang) * rad;
    const y = h * 0.58 + Math.sin(ang) * rad * 0.45;
    const dead = beat.kind === "decision" && result.meleeOrder && result.meleeOrder[0] !== bot.id && (result.hp[bot.id] ?? 0) < 30;
    drawBot(ctx, x, y, w * 0.1, Math.cos(ang) > 0 ? 1 : -1, bot, dead ? "down" : "idle", false);
  });
  if (beat.kind === "exchange" && local > 0.4) {
    ctx.fillStyle = "#f0a202";
    ctx.font = `600 ${Math.max(16, w / 28)}px Oswald, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("SCRUM", w / 2, h * 0.22);
  }
}
