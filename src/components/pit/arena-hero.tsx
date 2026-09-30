import { useEffect, useRef } from "react";
import { PAINT } from "@/lib/pit/catalog";
import type { FightResult } from "@/lib/pit/types";
import { Fx, drawSide, impactPoints, stepBots } from "./cage-draw";
import {
  beatAt,
  buildBeats,
  ease,
  fightDrive,
  lerp,
  type Beat,
  type Drive,
  type Spot,
} from "./cage-motion";

/**
 * A silent, looping slice of a real tape: face-off, then every exchange, then both bots
 * drive back to their marks and it goes again. Used as the Titantron backdrop.
 */
export function ArenaHero({
  result,
  className = "",
}: {
  result: FightResult | null;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !result || result.fighters.length !== 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const beats = buildBeats(result);
    const stats = beats.find((b) => b.kind === "stats");
    const fights = beats.filter(
      (b): b is Extract<Beat, { kind: "exchange" }> => b.kind === "exchange",
    );
    const lastFight = fights[fights.length - 1];
    if (!stats || !lastFight) return;
    const start = stats.t;
    const end = lastFight.t + lastFight.dur;
    const RESET = 3.5;
    const cycle = end - start + RESET;
    const fx = new Fx();
    const trails = new Map<string, Spot[]>();
    let clock = 0;
    let last = performance.now();
    let raf = 0;
    let visible = true;
    let shake = 0;
    let freeze = 0;
    let fired = "";
    let lap = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      fx.clear();
      fx.cam.ready = false;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver((rows) => (visible = rows.some((r) => r.isIntersecting)));
    io.observe(canvas);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) {
        raf = requestAnimationFrame(frame);
        return;
      }
      if (freeze > 0) freeze -= dt;
      else if (!reduced) clock += dt;
      const inLoop = clock % cycle;
      const thisLap = Math.floor(clock / cycle);
      if (thisLap !== lap) {
        lap = thisLap;
        trails.clear();
      }
      const time = start + inLoop;
      let drive: Drive;
      if (time < end) {
        const beat = beatAt(beats, time);
        const local = (time - beat.t) / beat.dur;
        drive = fightDrive(result, beat, local, time);
        const key = `${lap}|${drive.hitKey}`;
        if (drive.hitKey && local >= drive.hitAt && local < drive.hitAt + 0.2 && fired !== key) {
          fired = key;
          const at = impactPoints(drive, canvas.width, canvas.height, 1, 1);
          if (at) {
            const victim = drive.bots.find((b) => b.bot.id === drive.victim) ?? drive.bots[0];
            fx.burst(
              at.side.x,
              at.side.y,
              at.side.ground,
              at.side.scale,
              drive.power,
              PAINT[victim?.bot.paint ?? ""] ?? "#e2a21a",
              drive.weapon,
              reduced,
            );
            shake = reduced ? 0 : (5 + drive.power * 10) * (canvas.width / 1200);
            freeze = reduced ? 0 : 0.05 + drive.power * 0.06;
          }
        }
      } else {
        // Drive back to the marks. Everyone gets patched up on the way.
        const k = ease((time - end) / RESET);
        const from = fightDrive(result, lastFight, 1, end);
        const to = fightDrive(result, stats, 0, time);
        drive = {
          ...to,
          focus: { x: 0.5, y: 0.55 },
          tight: 0.1,
          bots: to.bots.map((b, i) => {
            const a = from.bots[i] ?? b;
            return {
              ...b,
              spot: { x: lerp(a.spot.x, b.spot.x, k), y: lerp(a.spot.y, b.spot.y, k) },
              hp: lerp(a.hp, 100, k),
              flipped: a.flipped && k < 0.3,
              dead: a.dead && k < 0.3,
              charging: k > 0.05 && k < 0.9,
            };
          }),
        };
      }
      shake *= Math.exp(-dt * 9);
      stepBots(drive, fx, trails, dt, reduced);
      fx.step(dt * (freeze > 0 ? 0.15 : 1));
      drawSide(ctx, canvas.width, canvas.height, drive, fx, time, dt, {
        title: null,
        word: "",
        hype: drive.impact ? 1 : 0.35,
        reduced,
        shake,
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [result]);

  if (!result) return null;
  return <canvas ref={ref} aria-hidden className={`block ${className}`} />;
}
