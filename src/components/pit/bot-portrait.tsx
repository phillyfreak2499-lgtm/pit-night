import { useEffect, useRef } from "react";
import { partById } from "@/lib/pit/catalog";
import { botFor, canSeeLoadout, weaponFamilyOf } from "@/lib/pit/engine";
import { usePit } from "@/lib/pit/store";
import type { BotLook, BotStyle, ClassId, FighterSnap, Tier } from "@/lib/pit/types";
import { drawSideBot, paintOf, shade } from "./cage-draw";
import type { BotState } from "./cage-motion";

export type BotLookProps = {
  id: string;
  paint: string;
  classId: ClassId;
  /** Weapon family, or "hidden" when the viewer may not see the loadout. */
  weapon: string;
  look: BotLook;
  number: string;
  hp: number;
  style?: BotStyle;
  storeName: string;
  brainTier?: Tier;
  /** Damaged parts not yet repaired. */
  scars?: number;
};

/** What a store's bot looks like to whoever is viewing. Weapons stay under the tarp until the bell. */
export function useBotLook(storeId: string): BotLookProps | null {
  const data = usePit();
  const store = data.stores.find((s) => s.id === storeId);
  if (!store) return null;
  const bot = botFor(data, storeId);
  const see = canSeeLoadout(data, storeId);
  const wear = Object.values(bot.wear);
  const hp =
    100 -
    wear.filter((w) => w === "scratched").length * 6 -
    wear.filter((w) => w === "bent").length * 18 -
    wear.filter((w) => w === "disabled").length * 30;
  const scars = wear.filter((w) => w && w !== "clean").length;
  return {
    id: storeId,
    paint: store.paint,
    classId: bot.classId,
    weapon: see ? weaponFamilyOf(bot) || "none" : "hidden",
    look: bot.look,
    number: bot.number,
    hp: Math.max(10, hp),
    scars,
    style: bot.style,
    storeName: store.name,
    brainTier: see ? (partById((bot.locked ?? bot.draft).brain)?.tier ?? "stock") : "stock",
  };
}

function stateFor(look: BotLookProps): BotState {
  const snap = {
    id: look.id,
    paint: look.paint,
    classId: look.classId,
    weaponFamily: look.weapon,
    look: look.look,
    number: look.number,
    style: look.style,
    storeName: look.storeName,
    brainTier: look.brainTier,
  } as FighterSnap;
  return {
    bot: snap,
    spot: { x: 0.5, y: 0.5 },
    heading: 0,
    lift: 0,
    pitch: 0,
    flipped: false,
    stroke: 0,
    rev: 0.35,
    gone: 0,
    dead: false,
    roll: 0,
    hp: look.hp,
    scars: look.scars ?? 0,
    charging: false,
    spotlight: false,
    flame: 0,
  };
}

/**
 * A store's bot, drawn by the same renderer as the broadcast.
 * Revs its weapon when the nearest `[data-bot-hover]` ancestor is hovered or focused.
 */
export function BotPortrait({
  look,
  facing = 1,
  className = "",
  floor = true,
  zoom = 1,
}: {
  look: BotLookProps | null;
  facing?: 1 | -1;
  className?: string;
  floor?: boolean;
  zoom?: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const key = look
    ? `${look.id}|${look.paint}|${look.classId}|${look.weapon}|${look.look}|${look.number}|${look.hp}|${JSON.stringify(look.style ?? {})}|${look.brainTier ?? ""}`
    : "";

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !look) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const state = stateFor(look);
    const host = (canvas.closest("[data-bot-hover]") as HTMLElement | null) ?? canvas;
    let hot = false;
    let heat = 0;
    let spin = 0;
    let visible = true;
    let dirty = true;
    let raf = 0;
    let last = performance.now();
    const enter = () => (hot = true);
    const leave = () => (hot = false);
    host.addEventListener("pointerenter", enter);
    host.addEventListener("pointerleave", leave);
    host.addEventListener("focusin", enter);
    host.addEventListener("focusout", leave);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      dirty = true;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver((rows) => {
      visible = rows.some((row) => row.isIntersecting);
    });
    io.observe(canvas);

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (visible || dirty) {
        dirty = false;
        heat += ((hot ? 1 : 0) - heat) * (1 - Math.exp(-dt * 6));
        const w = canvas.width;
        const h = canvas.height;
        const u = Math.min(w * 0.62, h * 1.25) * zoom;
        const gx = w / 2 - facing * u * 0.08;
        const gy = h * 0.82;
        ctx.clearRect(0, 0, w, h);
        if (floor) {
          const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, u * 0.9);
          g.addColorStop(0, `rgba(255,220,150,${0.1 + heat * 0.12})`);
          g.addColorStop(1, "rgba(255,220,150,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(gx, gy, u * 0.9, u * 0.2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        const t = now / 1000;
        state.rev = 0.25 + heat * 0.75;
        state.stroke =
          look.weapon === "hammer" ||
          look.weapon === "saw" ||
          look.weapon === "flip" ||
          look.weapon === "claw"
            ? heat * (0.5 + 0.5 * Math.sin(t * 5)) * 0.8
            : 0;
        state.roll = reduced ? 0 : heat * t * 2;
        state.pitch = reduced ? 0 : heat * Math.sin(t * 18) * 0.012;
        const rate =
          look.weapon === "disc"
            ? 34
            : look.weapon === "drum"
              ? 28
              : look.weapon === "saw"
                ? 24
                : 0;
        if (!reduced) spin += rate * state.rev * dt;
        drawSideBot(ctx, state, gx, gy, u, reduced ? 0 : t, spin, facing);
        if (look.weapon === "hidden") drawTarp(ctx, look, gx, gy, u, facing, t, heat);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      host.removeEventListener("pointerenter", enter);
      host.removeEventListener("pointerleave", leave);
      host.removeEventListener("focusin", enter);
      host.removeEventListener("focusout", leave);
    };
    // `key` captures every field of `look` that changes the picture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, facing, floor, zoom]);

  if (!look) return null;
  return <canvas ref={ref} aria-hidden className={`block ${className}`} />;
}

/** A cover thrown over the weapon mount. Hull, paint and number show; the weapon does not. */
function drawTarp(
  ctx: CanvasRenderingContext2D,
  look: BotLookProps,
  x: number,
  y: number,
  u: number,
  facing: number,
  t: number,
  heat: number,
) {
  const s = u * (look.classId === "tank" ? 1.06 : look.classId === "specialist" ? 0.94 : 1);
  const height = look.classId === "tank" ? 0.54 : look.classId === "specialist" ? 0.46 : 0.36;
  const flutter = Math.sin(t * 2.2) * 0.01 * (1 + heat * 2);
  const top = -(height + 0.01) * s;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  const cloth = "#45412f";
  const g = ctx.createLinearGradient(0, top, 0, 0);
  g.addColorStop(0, shade(cloth, 35));
  g.addColorStop(0.6, cloth);
  g.addColorStop(1, shade(cloth, -30));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0.02 * s, -0.1 * s);
  ctx.quadraticCurveTo(-0.02 * s, top + 0.04 * s, 0.12 * s, top);
  ctx.quadraticCurveTo(0.4 * s, top - 0.03 * s + flutter * s, 0.62 * s, top + 0.12 * s);
  ctx.quadraticCurveTo(0.9 * s, top + 0.3 * s, 0.94 * s, -0.005 * s);
  for (let i = 0; i <= 7; i++) {
    const hx = 0.94 - (i / 7) * 0.92;
    const hy =
      -0.005 - (i / 7) * 0.095 + (i % 2 === 0 ? 0.012 : -0.008) + Math.sin(t * 3 + i) * 0.003;
    ctx.lineTo(hx * s, hy * s);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = Math.max(1, s * 0.012);
  for (const fx of [0.15, 0.42, 0.68]) {
    ctx.beginPath();
    ctx.moveTo(fx * s, top + (fx > 0.6 ? 0.14 : 0.01) * s);
    ctx.quadraticCurveTo((fx + 0.08) * s, top * 0.45, (fx + 0.04) * s, -0.04 * s);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  for (const fx of [0.05, 0.3, 0.55]) {
    ctx.beginPath();
    ctx.moveTo(fx * s, top + 0.03 * s);
    ctx.quadraticCurveTo((fx - 0.03) * s, top * 0.5, (fx + 0.02) * s, -0.06 * s);
    ctx.stroke();
  }
  // Ratchet strap in the store's paint.
  ctx.fillStyle = paintOf(look.paint);
  ctx.beginPath();
  ctx.moveTo(0.26 * s, top - 0.005 * s);
  ctx.lineTo(0.33 * s, top + 0.0 * s);
  ctx.lineTo(0.37 * s, -0.03 * s);
  ctx.lineTo(0.3 * s, -0.035 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#b8b2a6";
  ctx.fillRect(0.3 * s, top * 0.55, 0.05 * s, 0.035 * s);
  ctx.restore();
}
