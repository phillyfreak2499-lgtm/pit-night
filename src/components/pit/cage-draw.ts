import { bannerVerdict } from "../../../scripts/copy-guard.mjs";
import { EYES, LEDS, PAINT, SMOKE, TRIM, decalArt, styleOf } from "@/lib/pit/catalog";
import { halloweenVisuals } from "@/lib/pit/halloween";
import { thanksgivingVisuals } from "@/lib/pit/thanksgiving";
import { ELECTION_COLORS, electionVisuals } from "@/lib/pit/election";
import { armorEdges, deckHardware } from "./material-detail";
import type { BotBody, ClassId } from "@/lib/pit/types";
import { PIT, clamp, ease, hash, lerp, type BotState, type Drive, type Spot } from "./cage-motion";

/* ------------------------------------------------------------------ */
/* Colour helpers                                                      */
/* ------------------------------------------------------------------ */

function rgb(hex: string) {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) return [200, 160, 40] as const;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255] as const;
}

export function shade(hex: string, amt: number, alpha = 1) {
  const [r, g, b] = rgb(hex);
  const ch = (v: number) => Math.round(clamp(v + amt, 0, 255));
  return alpha >= 1
    ? `rgb(${ch(r)}, ${ch(g)}, ${ch(b)})`
    : `rgba(${ch(r)}, ${ch(g)}, ${ch(b)}, ${alpha})`;
}

export function paintOf(paint: string) {
  return PAINT[paint] ?? "#e2a21a";
}

function seeded(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Side camera geometry                                                */
/* ------------------------------------------------------------------ */

const FLOOR_BACK = 0.43;
const FLOOR_FRONT = 0.87;
const HALF_BACK = 0.35;
const HALF_FRONT = 0.56;

export function project(spot: Spot, w: number, h: number) {
  const t = clamp(spot.y, -0.2, 1.1);
  const sy = h * lerp(FLOOR_BACK, FLOOR_FRONT, t);
  const half = w * lerp(HALF_BACK, HALF_FRONT, t);
  const sx = w * 0.5 + (spot.x - 0.5) * 2 * half;
  const size = w * (0.12 + t * 0.085);
  return { x: sx, y: sy, size };
}

/* ------------------------------------------------------------------ */
/* Particles                                                           */
/* ------------------------------------------------------------------ */

type Particle = {
  kind: "spark" | "debris" | "smoke" | "fire" | "flash" | "dust" | "ring" | "plate" | "wheel";
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  ground: number;
  rot: number;
  vr: number;
  g?: number;
};

/** Damage numbers and calls that float off a hit. World space, so they ride the camera. */
type FloatText = { x: number; y: number; text: string; color: string; size: number; life: number; max: number; vy: number; pop: number };

export class Fx {
  side: Particle[] = [];
  top: Particle[] = [];
  texts: FloatText[] = [];
  /** Parts knocked off this fight. They stay on the floor until the tape restarts. */
  wreck: Particle[] = [];
  flash = 0;
  /** Extra zoom on a big hit; decays fast. */
  punch = 0;
  spin = new Map<string, number>();
  emit = new Map<string, number>();
  cam = { x: 0, y: 0, z: 1, ready: false };

  clear() {
    this.side.length = 0;
    this.top.length = 0;
    this.texts.length = 0;
    this.wreck.length = 0;
    this.flash = 0;
    this.punch = 0;
  }

  /** A number or a word that pops off the hit and floats up. */
  popText(x: number, y: number, text: string, color: string, size: number, life = 1.3) {
    this.texts.push({ x, y, text, color, size, life, max: life, vy: -size * 1.4, pop: 0 });
    if (this.texts.length > 24) this.texts.shift();
  }

  /** A shockwave ring on the floor. */
  ring(x: number, ground: number, scale: number, color = "255,220,160") {
    this.side.push({ kind: "ring", x, y: ground, vx: 0, vy: 0, life: 0.55, max: 0.55, size: scale * 0.2, color, ground, rot: 0, vr: scale * 3.2 });
  }

  /** Armor plates and wheels knocked loose. They tumble, land, and stay put. */
  shed(x: number, y: number, ground: number, scale: number, paint: string, count: number, wheel: boolean) {
    for (let i = 0; i < count; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
      const speed = scale * (2 + Math.random() * 2.5);
      this.wreck.push({
        kind: wheel && i === 0 ? "wheel" : "plate",
        x,
        y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - scale,
        life: 9999,
        max: 9999,
        size: scale * (wheel && i === 0 ? 0.1 : 0.08 + Math.random() * 0.06),
        color: paint,
        ground: ground + (Math.random() - 0.3) * scale * 0.5,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 18,
        g: scale * 12,
      });
    }
    if (this.wreck.length > 40) this.wreck.splice(0, this.wreck.length - 40);
  }

  step(dt: number) {
    // Bound cosmetic work during busy walk-outs and multi-bot cards.
    if (this.side.length > 360) this.side.splice(0, this.side.length - 360);
    if (this.top.length > 200) this.top.splice(0, this.top.length - 200);
    for (const list of [this.side, this.top]) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i]!;
        p.life -= dt;
        if (p.life <= 0) {
          list.splice(i, 1);
          continue;
        }
        if (p.kind === "spark" || p.kind === "debris") {
          p.vy += (p.g ?? 0) * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          if (list === this.top) {
            p.vx *= 1 - 2.2 * dt;
            p.vy *= 1 - 2.2 * dt;
          } else if (p.y > p.ground) {
            p.y = p.ground;
            p.vy *= p.kind === "spark" ? -0.32 : -0.28;
            p.vx *= 0.6;
            p.vr *= 0.5;
            if (Math.abs(p.vy) < 40) p.vy = 0;
          }
        } else if (p.kind === "smoke" || p.kind === "dust") {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 1 - 0.8 * dt;
          p.size += (p.kind === "smoke" ? 26 : 18) * dt * (p.max > 1.5 ? 1.4 : 1);
        } else if (p.kind === "fire") {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy -= 60 * dt;
          p.size *= 1 - 1.2 * dt;
        } else if (p.kind === "ring") {
          p.size += p.vr * dt;
        }
      }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i]!;
      t.life -= dt;
      t.pop = Math.min(1, t.pop + dt * 7);
      t.y += t.vy * dt;
      t.vy *= 1 - 1.8 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (const p of this.wreck) {
      if (p.vy === 0 && p.vx === 0) continue;
      p.vy += (p.g ?? 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.y > p.ground) {
        p.y = p.ground;
        p.vy *= -0.3;
        p.vx *= 0.55;
        p.vr *= 0.4;
        if (Math.abs(p.vy) < 30) {
          p.vy = 0;
          if (Math.abs(p.vx) < 20) p.vx = 0;
        }
      }
    }
    this.punch = Math.max(0, this.punch - dt * 1.6);
    this.flash = Math.max(0, this.flash - dt * 6);
    if (this.side.length > 900) this.side.splice(0, this.side.length - 900);
    if (this.top.length > 400) this.top.splice(0, this.top.length - 400);
  }

  burst(
    x: number,
    y: number,
    ground: number,
    scale: number,
    power: number,
    paint: string,
    weapon: string,
    reduced: boolean,
  ) {
    const n = Math.round((reduced ? 10 : 46) * (0.5 + power));
    const spinner = weapon === "saw" || weapon === "disc" || weapon === "drum";
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * (spinner ? 1.5 : 1.9);
      const speed = scale * (2 + Math.random() * (spinner ? 6.5 : 4.5)) * (0.6 + power * 0.7);
      this.side.push({
        kind: "spark",
        x,
        y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        life: 0.25 + Math.random() * 0.55,
        max: 0.8,
        size: Math.max(1, scale * 0.018),
        color: Math.random() < 0.25 ? "#fff6d0" : Math.random() < 0.6 ? "#ffc24a" : "#ff6a1f",
        ground: ground + (Math.random() - 0.3) * scale * 0.4,
        rot: 0,
        vr: 0,
        g: scale * 9,
      });
    }
    const chunks = reduced ? 2 : Math.round(3 + power * 7);
    for (let i = 0; i < chunks; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
      const speed = scale * (1.5 + Math.random() * 3.5) * (0.5 + power * 0.7);
      this.side.push({
        kind: "debris",
        x,
        y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        life: 2.2 + Math.random() * 1.6,
        max: 3.8,
        size: scale * (0.04 + Math.random() * 0.06),
        color: Math.random() < 0.55 ? paint : Math.random() < 0.5 ? "#9a948a" : "#3a3631",
        ground: ground + (Math.random() - 0.2) * scale * 0.5,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 30,
        g: scale * 11,
      });
    }
    for (let i = 0; i < (reduced ? 2 : 8); i++) {
      this.side.push({
        kind: "smoke",
        x: x + (Math.random() - 0.5) * scale * 0.3,
        y: y + (Math.random() - 0.5) * scale * 0.2,
        vx: (Math.random() - 0.5) * scale * 1.2,
        vy: -scale * (0.3 + Math.random() * 0.6),
        life: 0.9 + Math.random() * 0.9,
        max: 1.8,
        size: scale * (0.1 + Math.random() * 0.12),
        color: "150,145,138",
        ground,
        rot: 0,
        vr: 0,
      });
    }
    // Each weapon hits differently.
    if (!reduced) {
      if (weapon === "hammer") {
        this.ring(x, ground, scale);
        this.ring(x, ground, scale * 0.6, "255,170,80");
      } else if (weapon === "wedge" || weapon === "flip") {
        this.ring(x, ground, scale * 0.7, "190,180,165");
      } else if (spinner) {
        // A sheet of sparks thrown along the blade's spin.
        for (let i = 0; i < 18 + power * 20; i++) {
          const ang = -Math.PI * (0.05 + Math.random() * 0.35);
          const speed = scale * (6 + Math.random() * 5);
          this.side.push({ kind: "spark", x, y, vx: Math.cos(ang) * speed * (Math.random() < 0.5 ? 1 : -1), vy: Math.sin(ang) * speed, life: 0.4 + Math.random() * 0.5, max: 0.9, size: Math.max(1, scale * 0.022), color: "#fff2b8", ground, rot: 0, vr: 0, g: scale * 6 });
        }
      } else if (weapon === "claw") {
        for (let i = 0; i < 10; i++) {
          this.side.push({ kind: "spark", x: x + (Math.random() - 0.5) * scale * 0.2, y: y + (Math.random() - 0.5) * scale * 0.1, vx: (Math.random() - 0.5) * scale * 2, vy: -scale * (0.5 + Math.random()), life: 0.6, max: 0.6, size: Math.max(1, scale * 0.015), color: "#ffd27a", ground, rot: 0, vr: 0, g: scale * 4 });
        }
      } else if (weapon === "burn") {
        for (let i = 0; i < 26; i++) this.fire("side", x, y, (Math.random() - 0.5) * scale * 3, -scale * (0.5 + Math.random() * 1.5), scale * (0.08 + Math.random() * 0.1));
      }
    }
    this.side.push({
      kind: "flash",
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.16,
      max: 0.16,
      size: scale * (1.1 + power * 1.3),
      color: "#fff",
      ground,
      rot: 0,
      vr: 0,
    });
    this.flash = Math.max(this.flash, reduced ? 0 : 0.25 + power * 0.35);
  }

  topBurst(x: number, y: number, scale: number, power: number, reduced: boolean) {
    const n = Math.round((reduced ? 6 : 26) * (0.5 + power));
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const speed = scale * (1.5 + Math.random() * 5) * (0.6 + power);
      this.top.push({
        kind: "spark",
        x,
        y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        life: 0.2 + Math.random() * 0.45,
        max: 0.65,
        size: 1.5,
        color: Math.random() < 0.3 ? "#fff6d0" : "#ffb030",
        ground: 0,
        rot: 0,
        vr: 0,
      });
    }
    this.top.push({
      kind: "flash",
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.14,
      max: 0.14,
      size: scale * 1.2 * (0.6 + power),
      color: "#fff",
      ground: 0,
      rot: 0,
      vr: 0,
    });
  }

  smoke(list: "side" | "top", x: number, y: number, scale: number, dark: boolean, big = false, rgb?: string) {
    (list === "side" ? this.side : this.top).push({
      kind: "smoke",
      x: x + (Math.random() - 0.5) * scale * 0.1,
      y,
      vx: (Math.random() - 0.5) * scale * 0.4 + scale * 0.2,
      vy:
        list === "side"
          ? -scale * (0.5 + Math.random() * 0.5)
          : (Math.random() - 0.5) * scale * 0.4,
      life: big ? 2.2 : 1.4,
      max: big ? 2.2 : 1.4,
      size: scale * (big ? 0.14 : 0.08),
      color: rgb ?? (dark ? "40,38,36" : "120,116,110"),
      ground: 0,
      rot: 0,
      vr: 0,
    });
  }

  fire(list: "side" | "top", x: number, y: number, vx: number, vy: number, size: number) {
    (list === "side" ? this.side : this.top).push({
      kind: "fire",
      x,
      y,
      vx,
      vy,
      life: 0.35 + Math.random() * 0.3,
      max: 0.65,
      size,
      color: "",
      ground: 0,
      rot: 0,
      vr: 0,
    });
  }

  dust(x: number, y: number, scale: number, dir: number) {
    this.side.push({
      kind: "dust",
      x,
      y,
      vx: -dir * scale * (0.8 + Math.random()),
      vy: -scale * (0.1 + Math.random() * 0.25),
      life: 0.6,
      max: 0.6,
      size: scale * 0.05,
      color: "110,98,82",
      ground: y,
      rot: 0,
      vr: 0,
    });
  }

  /** Walk-out pyro: a flame column, rising. */
  pyro(x: number, y: number, scale: number) {
    for (let i = 0; i < 3; i++) {
      this.side.push({
        kind: "fire",
        x: x + (Math.random() - 0.5) * scale * 0.08,
        y,
        vx: (Math.random() - 0.5) * scale * 0.3,
        vy: -scale * (3.2 + Math.random() * 1.6),
        life: 0.45 + Math.random() * 0.25,
        max: 0.7,
        size: scale * (0.1 + Math.random() * 0.08),
        color: "",
        ground: 0,
        rot: 0,
        vr: 0,
      });
    }
  }

  /** Sparks raining from the truss. */
  sparkRain(x: number, y: number, scale: number, ground: number) {
    this.side.push({
      kind: "spark",
      x: x + (Math.random() - 0.5) * scale * 1.6,
      y,
      vx: (Math.random() - 0.5) * scale * 0.4,
      vy: scale * (0.5 + Math.random()),
      life: 0.9 + Math.random() * 0.6,
      max: 1.5,
      size: Math.max(1, scale * 0.012),
      color: Math.random() < 0.4 ? "#fff3c0" : "#ffb030",
      ground,
      rot: 0,
      vr: 0,
      g: scale * 6,
    });
  }

  /** Coloured smoke for a walk-out or an equipped smoke cosmetic. */
  stageSmoke(x: number, y: number, scale: number, rgb = "190,185,200") {
    this.side.push({
      kind: "smoke",
      x: x + (Math.random() - 0.5) * scale * 1.4,
      y: y - Math.random() * scale * 0.1,
      vx: (Math.random() - 0.5) * scale * 0.5,
      vy: -scale * (0.05 + Math.random() * 0.2),
      life: 2.4,
      max: 2.4,
      size: scale * (0.25 + Math.random() * 0.2),
      color: rgb,
      ground: 0,
      rot: 0,
      vr: 0,
    });
  }

  confetti(x: number, y: number, scale: number, colors: string[], ground: number) {
    for (let i = 0; i < 6; i++) {
      this.side.push({
        kind: "debris",
        x: x + (Math.random() - 0.5) * scale * 3,
        y: y - Math.random() * scale * 0.4,
        vx: (Math.random() - 0.5) * scale * 0.8,
        vy: scale * (0.2 + Math.random() * 0.4),
        life: 2.2 + Math.random(),
        max: 3.2,
        size: scale * (0.018 + Math.random() * 0.02),
        color: colors[Math.floor(Math.random() * colors.length)]!,
        ground: ground + (Math.random() - 0.3) * scale * 0.5,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 18,
        g: scale * 1.2,
      });
    }
  }

  firework(x: number, y: number, scale: number, color: string) {
    const n = 36;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const sp = scale * (1.6 + Math.random() * 0.6);
      this.side.push({
        kind: "spark",
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.9 + Math.random() * 0.4,
        max: 1.3,
        size: Math.max(1.2, scale * 0.016),
        color: Math.random() < 0.3 ? "#ffffff" : color,
        ground: y + scale * 20,
        rot: 0,
        vr: 0,
        g: scale * 1.4,
      });
    }
    this.side.push({ kind: "flash", x, y, vx: 0, vy: 0, life: 0.18, max: 0.18, size: scale * 1.2, color: "#fff", ground: 0, rot: 0, vr: 0 });
  }

  /** Festive slime. Blacklight makes the same ooze brighter. */
  ooze(x: number, y: number, scale: number, glow: boolean) {
    this.side.push({
      kind: "smoke",
      x: x + (Math.random() - 0.5) * scale * 0.8,
      y: y - scale * (0.05 + Math.random() * 0.25),
      vx: (Math.random() - 0.5) * scale * 0.4,
      vy: -scale * (0.15 + Math.random() * 0.35),
      life: 1.1,
      max: 1.1,
      size: scale * (glow ? 0.28 : 0.16),
      color: glow ? "170,255,80" : "70,190,60",
      ground: y,
      rot: 0,
      vr: 0,
    });
    if (glow) {
      this.side.push({
        kind: "spark",
        x,
        y: y - scale * 0.2,
        vx: (Math.random() - 0.5) * scale,
        vy: -scale * (0.4 + Math.random()),
        life: 0.45,
        max: 0.45,
        size: Math.max(1.5, scale * 0.02),
        color: "#d6ff6a",
        ground: y + scale,
        rot: 0,
        vr: 0,
      });
    }
  }

  ghostTrail(x: number, y: number, scale: number) {
    this.side.push({
      kind: "smoke",
      x,
      y: y - scale * 0.2,
      vx: (Math.random() - 0.5) * scale * 0.2,
      vy: -scale * 0.15,
      life: 0.7,
      max: 0.7,
      size: scale * 0.12,
      color: "190,255,210",
      ground: y,
      rot: 0,
      vr: 0,
    });
  }

  /** Rate-limited emitter. Returns how many to spawn this frame. */
  tick(key: string, rate: number, dt: number) {
    const acc = (this.emit.get(key) ?? 0) + rate * dt;
    const n = Math.floor(acc);
    this.emit.set(key, acc - n);
    return n;
  }
}

function drawWreck(ctx: CanvasRenderingContext2D, list: Particle[]) {
  for (const p of list) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    if (p.kind === "wheel") {
      ctx.fillStyle = "#1c1a17";
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#55504a";
      ctx.lineWidth = Math.max(1, p.size * 0.25);
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#8a847a";
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size, -p.size * 0.35, p.size * 2, p.size * 0.7);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(-p.size, p.size * 0.15, p.size * 2, p.size * 0.2);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(-p.size * 0.9, -p.size * 0.3, p.size * 1.8, p.size * 0.12);
      ctx.fillStyle = "#2a2622";
      for (const bx of [-0.7, 0.7]) {
        ctx.beginPath();
        ctx.arc(p.size * bx, 0, Math.max(0.8, p.size * 0.08), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

function drawTexts(ctx: CanvasRenderingContext2D, fx: Fx) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const t of fx.texts) {
    const a = clamp(t.life / 0.35, 0, 1);
    const pop = t.pop < 1 ? 1 + Math.sin(t.pop * Math.PI) * 0.5 : 1;
    ctx.globalAlpha = a;
    ctx.font = `700 ${Math.round(t.size * pop)}px Oswald, sans-serif`;
    ctx.lineWidth = Math.max(2, t.size * 0.14);
    ctx.strokeStyle = "rgba(0,0,0,0.9)";
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, list: Particle[]) {
  // Shockwave rings flat on the floor first.
  for (const p of list) {
    if (p.kind !== "ring") continue;
    const a = clamp(p.life / p.max, 0, 1);
    ctx.save();
    ctx.strokeStyle = `rgba(${p.color},${a * 0.8})`;
    ctx.lineWidth = Math.max(1.5, p.size * 0.06 * a + 1);
    ctx.beginPath();
    ctx.ellipse(p.x, p.ground, p.size, p.size * 0.22, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // Smoke and dust under, hot stuff added on top.
  for (const p of list) {
    if (p.kind !== "smoke" && p.kind !== "dust") continue;
    const a = clamp(p.life / p.max, 0, 1);
    const alpha = p.kind === "dust" ? a * 0.35 : a * a * 0.55;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
    g.addColorStop(0, `rgba(${p.color},${alpha})`);
    g.addColorStop(1, `rgba(${p.color},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of list) {
    if (p.kind !== "debris") continue;
    const a = clamp(p.life / 0.5, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(-p.size, -p.size * 0.4);
    ctx.lineTo(p.size * 0.7, -p.size * 0.6);
    ctx.lineTo(p.size, p.size * 0.3);
    ctx.lineTo(-p.size * 0.5, p.size * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(-p.size * 0.6, -p.size * 0.45, p.size * 1.1, p.size * 0.2);
    ctx.restore();
  }
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of list) {
    if (p.kind === "spark") {
      const a = clamp(p.life / 0.25, 0, 1);
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = a;
      ctx.lineWidth = p.size;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.x - p.vx * 0.016, p.y - p.vy * 0.016);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else if (p.kind === "fire") {
      const a = clamp(p.life / p.max, 0, 1);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      g.addColorStop(0, `rgba(255,${Math.round(200 * a + 40)},${Math.round(90 * a)},${0.9 * a})`);
      g.addColorStop(0.5, `rgba(255,${Math.round(90 * a + 30)},20,${0.5 * a})`);
      g.addColorStop(1, "rgba(200,40,0,0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === "flash") {
      const a = clamp(p.life / p.max, 0, 1);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      g.addColorStop(0, `rgba(255,250,230,${a})`);
      g.addColorStop(0.25, `rgba(255,200,90,${a * 0.6})`);
      g.addColorStop(1, "rgba(255,120,20,0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Side camera: the arena                                              */
/* ------------------------------------------------------------------ */

/** League emblem painted on the cage floor. Loads once; the backdrops redraw when it lands. */
let logoVersion = 0;
const floorLogo: HTMLImageElement | null = (() => {
  if (typeof Image === "undefined") return null;
  const img = new Image();
  img.onload = () => {
    logoVersion += 1;
  };
  img.src = "/league-floor-logo.png";
  return img;
})();

function logoReady() {
  return Boolean(floorLogo && floorLogo.complete && floorLogo.naturalWidth > 0);
}

/** Center of the floor, in arena units. */
const LOGO = { x: 0.5, y: 0.56, w: 0.46 };

const backdropCache = new WeakMap<
  CanvasRenderingContext2D,
  { w: number; h: number; v: number; decor: number; canvas: HTMLCanvasElement }
>();

function backdrop(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const decor = thanksgivingVisuals() ? 2 : halloweenVisuals() ? 1 : electionVisuals() ? 3 : 0;
  const hit = backdropCache.get(ctx);
  if (hit && hit.w === w && hit.h === h && hit.v === logoVersion && hit.decor === decor) return hit.canvas;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d");
  if (c) paintBackdrop(c, w, h);
  backdropCache.set(ctx, { w, h, v: logoVersion, decor, canvas });
  return canvas;
}

function floorPt(x: number, y: number, w: number, h: number) {
  const p = project({ x, y }, w, h);
  return [p.x, p.y] as const;
}

function paintBackdrop(c: CanvasRenderingContext2D, w: number, h: number) {
  const rnd = seeded(77);
  // Deep house.
  const sky = c.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#050506");
  sky.addColorStop(0.45, "#0c0b0c");
  sky.addColorStop(1, "#050505");
  c.fillStyle = sky;
  c.fillRect(0, 0, w, h);

  // Crowd: three rows of silhouettes behind the glass.
  for (let row = 0; row < 4; row++) {
    const baseY = h * (0.17 + row * 0.075);
    const r = w * (0.011 + row * 0.0022);
    const tint = 16 + row * 7;
    for (let x = -r; x < w + r; x += r * (1.7 + rnd() * 0.9)) {
      const y = baseY + (rnd() - 0.5) * r * 1.2;
      c.fillStyle = `rgb(${tint + rnd() * 10}, ${tint + rnd() * 8}, ${tint + 4 + rnd() * 10})`;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(x, y + r * 2.2, r * 1.6, r * 1.3, 0, Math.PI, 0);
      c.rect(x - r * 1.6, y + r * 2.2, r * 3.2, r * 2);
      c.fill();
      if (rnd() < 0.06) {
        c.fillStyle = "rgba(240,162,2,0.5)";
        c.fillRect(x - r * 1.2, y + r * 2, r * 2.4, r * 0.8);
      }
    }
  }

  const [blx, bly] = floorPt(0, 0, w, h);
  const [brx] = floorPt(1, 0, w, h);
  const [flx, fly] = floorPt(-0.06, 1.1, w, h);
  const [frx] = floorPt(1.06, 1.1, w, h);
  const wallTop = h * 0.13;

  // Back wall: polycarbonate over the crowd.
  const glass = c.createLinearGradient(0, wallTop, 0, bly);
  glass.addColorStop(0, "rgba(90,120,150,0.10)");
  glass.addColorStop(1, "rgba(60,80,100,0.28)");
  c.fillStyle = glass;
  c.fillRect(blx, wallTop, brx - blx, bly - wallTop);
  // Glass glare streaks.
  c.save();
  c.beginPath();
  c.rect(blx, wallTop, brx - blx, bly - wallTop);
  c.clip();
  c.globalCompositeOperation = "lighter";
  for (let i = 0; i < 6; i++) {
    const gx = blx + (brx - blx) * (0.08 + i * 0.17 + rnd() * 0.05);
    const g = c.createLinearGradient(gx, 0, gx + w * 0.05, 0);
    g.addColorStop(0, "rgba(180,210,255,0)");
    g.addColorStop(0.5, "rgba(180,210,255,0.06)");
    g.addColorStop(1, "rgba(180,210,255,0)");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(gx, wallTop);
    c.lineTo(gx + w * 0.03, wallTop);
    c.lineTo(gx + w * 0.07, bly);
    c.lineTo(gx + w * 0.04, bly);
    c.fill();
  }
  c.restore();
  // Kick plate under the glass.
  const kick = c.createLinearGradient(0, bly - h * 0.05, 0, bly);
  kick.addColorStop(0, "#3a3733");
  kick.addColorStop(1, "#1a1816");
  c.fillStyle = kick;
  c.fillRect(blx, bly - h * 0.05, brx - blx, h * 0.05);
  hazardBand(c, blx, bly - h * 0.05, brx - blx, h * 0.012);
  // Posts.
  const posts = 6;
  for (let i = 0; i <= posts; i++) {
    const px = lerp(blx, brx, i / posts);
    const pw = w * 0.012;
    const g = c.createLinearGradient(px - pw, 0, px + pw, 0);
    g.addColorStop(0, "#1b1a19");
    g.addColorStop(0.45, "#6d6a64");
    g.addColorStop(1, "#1b1a19");
    c.fillStyle = g;
    c.fillRect(px - pw / 2, wallTop - h * 0.02, pw, bly - wallTop + h * 0.02);
    c.fillStyle = "#8f8a80";
    for (let k = 0; k < 4; k++) {
      c.beginPath();
      c.arc(px, lerp(wallTop, bly - h * 0.06, k / 3), pw * 0.18, 0, Math.PI * 2);
      c.fill();
    }
  }
  // Top rail.
  const rail = c.createLinearGradient(0, wallTop - h * 0.025, 0, wallTop + h * 0.01);
  rail.addColorStop(0, "#77736b");
  rail.addColorStop(1, "#24221f");
  c.fillStyle = rail;
  c.fillRect(blx - w * 0.01, wallTop - h * 0.025, brx - blx + w * 0.02, h * 0.03);

  // Side walls, in perspective.
  for (const side of [0, 1] as const) {
    const bx = side === 0 ? blx : brx;
    const fx = side === 0 ? flx : frx;
    const outer = side === 0 ? -w * 0.2 : w * 1.2;
    const g = c.createLinearGradient(bx, 0, fx, 0);
    g.addColorStop(0, "#161514");
    g.addColorStop(1, "#070707");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(bx, wallTop - h * 0.02);
    c.lineTo(bx, bly);
    c.lineTo(fx, fly);
    c.lineTo(outer, fly);
    c.lineTo(outer, -h * 0.2);
    c.closePath();
    c.fill();
    c.fillStyle = "rgba(90,120,150,0.07)";
    c.beginPath();
    c.moveTo(bx, wallTop);
    c.lineTo(bx, bly - h * 0.05);
    c.lineTo(fx, fly - h * 0.14);
    c.lineTo(fx, h * -0.1);
    c.closePath();
    c.fill();
    c.strokeStyle = "#4b4843";
    c.lineWidth = Math.max(2, w * 0.006);
    c.beginPath();
    c.moveTo(bx, wallTop - h * 0.02);
    c.lineTo(fx, -h * 0.1);
    c.stroke();
    c.beginPath();
    c.moveTo(bx, bly - h * 0.05);
    c.lineTo(fx, fly - h * 0.14);
    c.stroke();
  }

  // Floor: steel plate.
  const floor = c.createLinearGradient(0, bly, 0, fly);
  floor.addColorStop(0, "#3b3833");
  floor.addColorStop(0.5, "#2c2a26");
  floor.addColorStop(1, "#1a1917");
  c.fillStyle = floor;
  c.beginPath();
  c.moveTo(blx, bly);
  c.lineTo(brx, bly);
  c.lineTo(frx, fly);
  c.lineTo(flx, fly);
  c.closePath();
  c.fill();
  c.save();
  c.clip();
  // Brushed texture.
  c.globalAlpha = 0.05;
  for (let i = 0; i < 260; i++) {
    const x = rnd() * w;
    const y = lerp(bly, fly, rnd());
    c.fillStyle = rnd() < 0.5 ? "#fff" : "#000";
    c.fillRect(x, y, w * (0.02 + rnd() * 0.06), 1);
  }
  c.globalAlpha = 1;
  // Plate seams.
  c.strokeStyle = "rgba(10,9,8,0.9)";
  c.lineWidth = Math.max(1, w / 700);
  for (let i = 0; i <= 6; i++) {
    const [x1, y1] = floorPt(i / 6, -0.1, w, h);
    const [x2, y2] = floorPt(i / 6, 1.1, w, h);
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
  }
  for (let j = 0; j <= 4; j++) {
    const [x1, y1] = floorPt(-0.1, j / 4, w, h);
    const [x2, y2] = floorPt(1.1, j / 4, w, h);
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
  }
  // Rivets on the seams.
  c.fillStyle = "rgba(160,150,135,0.35)";
  for (let i = 0; i <= 6; i++) {
    for (let j = 0; j <= 4; j++) {
      const p = project({ x: i / 6, y: j / 4 }, w, h);
      c.beginPath();
      c.ellipse(p.x, p.y, p.size * 0.02, p.size * 0.012, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
  // League emblem, painted on the plate in perspective.
  if (floorLogo && logoReady()) {
    const iw = floorLogo.naturalWidth;
    const ih = floorLogo.naturalHeight;
    const depth = LOGO.w * (ih / iw) * 1.3;
    const y0 = LOGO.y - depth / 2;
    const rows = 90;
    c.save();
    c.globalAlpha = 0.62;
    for (let k = 0; k < rows; k++) {
      const t0 = k / rows;
      const t1 = (k + 1) / rows;
      const a = project({ x: LOGO.x - LOGO.w / 2, y: y0 + depth * t0 }, w, h);
      const b = project({ x: LOGO.x + LOGO.w / 2, y: y0 + depth * t0 }, w, h);
      const d = project({ x: LOGO.x - LOGO.w / 2, y: y0 + depth * t1 }, w, h);
      const e = project({ x: LOGO.x + LOGO.w / 2, y: y0 + depth * t1 }, w, h);
      const left = Math.min(a.x, d.x);
      const right = Math.max(b.x, e.x);
      c.drawImage(floorLogo, 0, t0 * ih, iw, (t1 - t0) * ih, left, a.y, right - left, d.y - a.y + 0.6);
    }
    c.restore();
  }

  // Scuffs, gouges and tire marks from past fights.
  for (let i = 0; i < 26; i++) {
    const a = { x: rnd(), y: rnd() };
    const p = project(a, w, h);
    c.strokeStyle = rnd() < 0.5 ? "rgba(0,0,0,0.35)" : "rgba(200,190,170,0.12)";
    c.lineWidth = p.size * (0.01 + rnd() * 0.03);
    c.beginPath();
    const len = p.size * (0.4 + rnd() * 1.6);
    const ang = rnd() * Math.PI;
    c.moveTo(p.x, p.y);
    c.quadraticCurveTo(
      p.x + Math.cos(ang) * len * 0.5,
      p.y + Math.sin(ang) * len * 0.12 + len * 0.05,
      p.x + Math.cos(ang) * len,
      p.y + Math.sin(ang) * len * 0.25,
    );
    c.stroke();
  }
  for (let i = 0; i < 5; i++) {
    const p = project({ x: 0.15 + rnd() * 0.7, y: 0.2 + rnd() * 0.7 }, w, h);
    const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 0.5);
    g.addColorStop(0, "rgba(0,0,0,0.4)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(p.x, p.y, p.size * 0.5, p.size * 0.14, 0, 0, Math.PI * 2);
    c.fill();
  }
  // Killsaw slots.
  for (const s of [
    { x: 0.2, y: 0.35 },
    { x: 0.8, y: 0.35 },
    { x: 0.3, y: 0.82 },
    { x: 0.7, y: 0.82 },
  ]) {
    const a = project({ x: s.x - 0.05, y: s.y }, w, h);
    const b = project({ x: s.x + 0.05, y: s.y }, w, h);
    c.fillStyle = "rgba(90,86,80,0.5)";
    c.fillRect(a.x - 2, a.y - a.size * 0.022, b.x - a.x + 4, a.size * 0.044);
    c.fillStyle = "#050505";
    c.fillRect(a.x, a.y - a.size * 0.01, b.x - a.x, a.size * 0.02);
  }
  // Light pools.
  c.globalCompositeOperation = "lighter";
  for (const lx of [0.2, 0.5, 0.8]) {
    const p = project({ x: lx, y: 0.55 }, w, h);
    const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, w * 0.2);
    g.addColorStop(0, "rgba(255,236,200,0.12)");
    g.addColorStop(1, "rgba(255,236,200,0)");
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(p.x, p.y, w * 0.2, h * 0.14, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.globalCompositeOperation = "source-over";
  c.restore();

  // The pit, at the back.
  const pa = project({ x: PIT.x - PIT.w / 2, y: PIT.y - PIT.h / 2 }, w, h);
  const pb = project({ x: PIT.x + PIT.w / 2, y: PIT.y - PIT.h / 2 }, w, h);
  const pc = project({ x: PIT.x + PIT.w / 2, y: PIT.y + PIT.h / 2 }, w, h);
  const pd = project({ x: PIT.x - PIT.w / 2, y: PIT.y + PIT.h / 2 }, w, h);
  c.fillStyle = "#020202";
  c.beginPath();
  c.moveTo(pa.x, pa.y);
  c.lineTo(pb.x, pb.y);
  c.lineTo(pc.x, pc.y);
  c.lineTo(pd.x, pd.y);
  c.closePath();
  c.fill();
  const pg = c.createLinearGradient(0, pa.y, 0, pd.y);
  pg.addColorStop(0, "rgba(200,40,20,0.35)");
  pg.addColorStop(1, "rgba(200,40,20,0)");
  c.fillStyle = pg;
  c.fill();
  c.strokeStyle = "#f0a202";
  c.lineWidth = Math.max(2, w * 0.004);
  c.setLineDash([w * 0.012, w * 0.012]);
  c.stroke();
  c.setLineDash([]);

  // Front rail: the glass the camera shoots through.
  const railY = fly;
  const fr = c.createLinearGradient(0, railY, 0, h);
  fr.addColorStop(0, "#2a2825");
  fr.addColorStop(0.15, "#141312");
  fr.addColorStop(1, "#060606");
  c.fillStyle = fr;
  c.fillRect(0, railY, w, h - railY);
  hazardBand(c, 0, railY, w, h * 0.018);

  // Lighting truss and cones.
  c.fillStyle = "#0b0b0b";
  c.fillRect(0, 0, w, h * 0.055);
  c.strokeStyle = "#2a2826";
  c.lineWidth = Math.max(1, w / 600);
  for (let x = 0; x < w; x += w * 0.03) {
    c.beginPath();
    c.moveTo(x, h * 0.005);
    c.lineTo(x + w * 0.015, h * 0.05);
    c.lineTo(x + w * 0.03, h * 0.005);
    c.stroke();
  }
  c.globalCompositeOperation = "lighter";
  for (const lx of [0.2, 0.5, 0.8]) {
    const x = w * lx;
    const p = project({ x: lx, y: 0.55 }, w, h);
    const g = c.createLinearGradient(0, h * 0.05, 0, p.y);
    g.addColorStop(0, "rgba(255,240,210,0.10)");
    g.addColorStop(1, "rgba(255,240,210,0.0)");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x - w * 0.02, h * 0.05);
    c.lineTo(x + w * 0.02, h * 0.05);
    c.lineTo(p.x + w * 0.16, p.y);
    c.lineTo(p.x - w * 0.16, p.y);
    c.closePath();
    c.fill();
    const lamp = c.createRadialGradient(x, h * 0.05, 0, x, h * 0.05, w * 0.03);
    lamp.addColorStop(0, "rgba(255,250,235,0.95)");
    lamp.addColorStop(1, "rgba(255,230,180,0)");
    c.fillStyle = lamp;
    c.beginPath();
    c.arc(x, h * 0.05, w * 0.03, 0, Math.PI * 2);
    c.fill();
  }
  c.globalCompositeOperation = "source-over";
  if (halloweenVisuals()) paintHalloweenTrim(c, w, h);
  if (thanksgivingVisuals()) paintThanksgivingTrim(c, w, h);
  if (electionVisuals()) paintElectionTrim(c, w, h);
}

/** Election Week: civic bunting and ballot boxes. Gold, parchment and laurel only; no party colors. */
function paintElectionTrim(c: CanvasRenderingContext2D, w: number, h: number) {
  const { gold, parchment, laurel, bronze, ink } = ELECTION_COLORS;
  c.save();
  // Pennant bunting along the truss.
  const flags = [gold, parchment, laurel];
  const top = h * 0.06;
  c.strokeStyle = bronze;
  c.lineWidth = Math.max(1, w * 0.0015);
  c.beginPath();
  c.moveTo(w * 0.04, top);
  c.lineTo(w * 0.96, top);
  c.stroke();
  for (let i = 0; i < 30; i++) {
    const x = w * (0.05 + i * 0.03);
    const sag = Math.sin(((i % 4) / 4) * Math.PI) * h * 0.012;
    c.fillStyle = flags[i % flags.length]!;
    c.beginPath();
    c.moveTo(x - w * 0.011, top + sag);
    c.lineTo(x + w * 0.011, top + sag);
    c.lineTo(x, top + sag + h * 0.04);
    c.closePath();
    c.fill();
  }
  // Ballot boxes at the lower corners, a ballot halfway in.
  for (const side of [0, 1] as const) {
    const x = w * (side === 0 ? 0.08 : 0.92);
    const y = h * 0.78;
    const s = w * 0.045;
    c.fillStyle = parchment;
    c.fillRect(x - s * 0.4, y - s * 1.25, s * 0.8, s * 0.6);
    c.fillStyle = bronze;
    c.fillRect(x - s, y - s * 0.7, s * 2, s * 1.4);
    c.fillStyle = ink;
    c.fillRect(x - s * 0.6, y - s * 0.72, s * 1.2, s * 0.12);
    c.fillStyle = gold;
    c.fillRect(x - s * 0.9, y - s * 0.1, s * 1.8, s * 0.18);
  }
  c.restore();
}

/** Static ring dressing for Halloween week. Motion lives in the live frame, not this cache. */
function paintHalloweenTrim(c: CanvasRenderingContext2D, w: number, h: number) {
  c.save();
  // String lights along the truss. Decorative, not a status signal.
  for (let i = 0; i < 18; i++) {
    const x = w * (0.06 + i * 0.05);
    c.fillStyle = i % 2 === 0 ? "#ff8a1e" : "#7dff4a";
    c.beginPath();
    c.arc(x, h * 0.07, Math.max(2, w * 0.006), 0, Math.PI * 2);
    c.fill();
  }
  const pumpkins: [number, number, number][] = [
    [0.08, 0.22, 0.045],
    [0.92, 0.24, 0.04],
    [0.12, 0.78, 0.05],
    [0.88, 0.76, 0.046],
  ];
  for (const [px, py, s] of pumpkins) {
    const x = w * px;
    const y = h * py;
    const r = w * s;
    c.fillStyle = "#e07014";
    c.beginPath();
    c.ellipse(x, y, r, r * 0.86, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#8a3d08";
    c.lineWidth = Math.max(1, r * 0.08);
    c.beginPath();
    c.moveTo(x, y - r * 0.7);
    c.lineTo(x, y + r * 0.7);
    c.stroke();
    c.fillStyle = "#2f6b22";
    c.fillRect(x - r * 0.08, y - r * 1.05, r * 0.16, r * 0.28);
    c.fillStyle = "#2a1408";
    for (const [ox, oy] of [[-0.28, -0.05], [0.28, -0.05], [0, 0.28]] as const) {
      c.beginPath();
      c.moveTo(x + ox * r, y + oy * r - r * 0.12);
      c.lineTo(x + ox * r + r * 0.12, y + oy * r + r * 0.16);
      c.lineTo(x + ox * r - r * 0.12, y + oy * r + r * 0.16);
      c.closePath();
      c.fill();
    }
  }
  c.restore();
}

/** Static ring dressing for Championship Week. Motion lives in the live frame, not this cache. */
function paintThanksgivingTrim(c: CanvasRenderingContext2D, w: number, h: number) {
  c.save();
  // String lights along the truss, harvest palette. Decorative, not a status signal.
  const lamps = ["#e8871e", "#a31621", "#e2a21a"];
  for (let i = 0; i < 18; i++) {
    const x = w * (0.06 + i * 0.05);
    c.fillStyle = lamps[i % lamps.length]!;
    c.beginPath();
    c.arc(x, h * 0.07, Math.max(2, w * 0.006), 0, Math.PI * 2);
    c.fill();
  }
  // Cornucopia silhouettes at the lower corners: a horn spilling round fruit.
  for (const side of [0, 1] as const) {
    const x = w * (side === 0 ? 0.1 : 0.9);
    const y = h * 0.78;
    const r = w * 0.045;
    const flip = side === 0 ? 1 : -1;
    c.fillStyle = "#8a5a1e";
    c.beginPath();
    c.moveTo(x - flip * r * 1.1, y + r * 0.5);
    c.quadraticCurveTo(x + flip * r * 0.2, y + r * 0.9, x + flip * r * 0.9, y - r * 0.35);
    c.quadraticCurveTo(x + flip * r * 0.1, y - r * 0.05, x - flip * r * 0.75, y - r * 0.28);
    c.closePath();
    c.fill();
    for (const [ox, oy, s, col] of [
      [-0.55, -0.5, 0.34, "#e07014"],
      [-0.15, -0.72, 0.3, "#a31621"],
      [-0.8, -0.18, 0.27, "#e2a21a"],
    ] as const) {
      c.fillStyle = col;
      c.beginPath();
      c.arc(x + flip * ox * r, y + oy * r, r * s, 0, Math.PI * 2);
      c.fill();
    }
  }
  // Wheat-sheaf bundles at the upper corners: a bound stalk fan.
  for (const side of [0, 1] as const) {
    const x = w * (side === 0 ? 0.07 : 0.93);
    const y = h * 0.24;
    const r = w * 0.04;
    c.strokeStyle = "#c9973f";
    c.lineWidth = Math.max(1.5, r * 0.09);
    for (const a of [-0.5, -0.25, 0, 0.25, 0.5]) {
      c.beginPath();
      c.moveTo(x, y + r * 0.8);
      c.lineTo(x + Math.sin(a) * r * 1.1, y - r * (0.9 - Math.abs(a) * 0.35));
      c.stroke();
      c.fillStyle = "#e2c268";
      c.beginPath();
      c.ellipse(x + Math.sin(a) * r * 1.1, y - r * (0.95 - Math.abs(a) * 0.35), r * 0.13, r * 0.26, a, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#a31621";
    c.fillRect(x - r * 0.3, y + r * 0.55, r * 0.6, r * 0.18);
  }
  c.restore();
}

const LEAF_COLORS = ["#e8871e", "#a31621", "#e2a21a"];

/** One flat leaf. Shared by the arena dressing and the Falling Leaves show effect. */
function drawLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(r * 0.9, -r * 0.2, 0, r);
  ctx.quadraticCurveTo(-r * 0.9, -r * 0.2, 0, -r);
  ctx.fill();
  ctx.restore();
}

/** Leaves drifting across the ring for a bot running the Falling Leaves show effect. */
function drawFallingLeaves(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, reduced: boolean) {
  const n = reduced ? 8 : 22;
  for (let i = 0; i < n; i++) {
    const rx = (hash(`leafx${i}`) % 1000) / 1000;
    const speed = 0.03 + ((hash(`leafs${i}`) % 1000) / 1000) * 0.05;
    const phase = (hash(`leafp${i}`) % 1000) / 1000;
    const y = (((phase + time * speed) % 1) * 1.1 - 0.05) * h;
    const x = rx * w + Math.sin(time * 0.9 + i * 1.7) * w * 0.012;
    drawLeaf(ctx, x, y, Math.max(3, w * 0.008), time * 0.7 + i, LEAF_COLORS[i % LEAF_COLORS.length]!);
  }
}

function drawRingFog(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, reduced: boolean) {
  ctx.save();
  const drift = reduced ? 0 : Math.sin(time * 0.6) * w * 0.04;
  ctx.fillStyle = "rgba(210,214,206,0.16)";
  for (let i = 0; i < (reduced ? 2 : 5); i++) {
    const y = h * (0.58 + i * 0.06);
    ctx.beginPath();
    ctx.ellipse(w * 0.5 + drift * (i % 2 === 0 ? 1 : -1), y, w * 0.55, h * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function hazardBand(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  c.fillStyle = "#d99a0a";
  c.fillRect(x, y, w, h);
  c.fillStyle = "#111";
  const step = h * 2.2;
  for (let sx = x - h * 2; sx < x + w + h * 2; sx += step) {
    c.beginPath();
    c.moveTo(sx, y + h);
    c.lineTo(sx + h, y);
    c.lineTo(sx + h + step / 2, y);
    c.lineTo(sx + step / 2, y + h);
    c.closePath();
    c.fill();
  }
  c.restore();
}

function crowdFlashes(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  hype: number,
) {
  const n = 3 + Math.round(hype * 8);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) {
    const slot = Math.floor(time * (4 + hype * 6)) + i * 97;
    const r = (hash(`flash${slot}`) % 1000) / 1000;
    if (r > 0.35 + hype * 0.3) continue;
    const x = ((hash(`fx${slot}`) % 1000) / 1000) * w;
    const y = h * (0.16 + ((hash(`fy${slot}`) % 1000) / 1000) * 0.2);
    const g = ctx.createRadialGradient(x, y, 0, x, y, w * 0.012);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, w * 0.012, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Side camera: a bot                                                  */
/* ------------------------------------------------------------------ */

type Frame = {
  /** Hull outline, bot lengths, +x forward, -y up, origin on the floor. */
  hull: [number, number][];
  deck: number;
  front: number;
  height: number;
  wheels: { x: number; r: number }[];
  treads: boolean;
};

function frameOf(classId: ClassId, body?: BotBody): Frame {
  const id = body ?? (classId === "tank" ? "keystone" : classId === "specialist" ? "windlass" : "shrike");
  if (classId === "tank") {
    if (id === "juggernaut") return {
      hull:[[-0.52,-0.18],[-0.52,-0.43],[-0.36,-0.56],[0.23,-0.56],[0.5,-0.42],[0.5,-0.18]],
      deck:-0.56, front:0.5, height:0.56,
      wheels:[-0.4,-0.2,0,0.2,0.4].map(x=>({x,r:0.075})), treads:true,
    };
    if (id === "bunker") return {
      hull:[[-0.48,-0.18],[-0.48,-0.38],[-0.34,-0.46],[0.32,-0.46],[0.48,-0.32],[0.48,-0.18]],
      deck:-0.46, front:0.48, height:0.46,
      wheels:[-0.36,-0.18,0,0.18,0.36].map(x=>({x,r:0.072})), treads:true,
    };
    if (id === "fortress") return {
      hull:[[-0.5,-0.18],[-0.5,-0.46],[-0.38,-0.58],[-0.08,-0.62],[0.28,-0.57],[0.5,-0.4],[0.5,-0.18]],
      deck:-0.62, front:0.5, height:0.62,
      wheels:[-0.38,-0.19,0,0.19,0.38].map(x=>({x,r:0.078})), treads:true,
    };
    if (id === "colossus") return {
      hull:[[-0.54,-0.2],[-0.54,-0.48],[-0.42,-0.63],[0.12,-0.65],[0.38,-0.57],[0.54,-0.38],[0.54,-0.2]],
      deck:-0.65, front:0.54, height:0.65,
      wheels:[-0.42,-0.21,0,0.21,0.42].map(x=>({x,r:0.08})), treads:true,
    };
    return {
      hull:[[-0.46,-0.2],[-0.46,-0.46],[-0.3,-0.52],[0.3,-0.52],[0.46,-0.4],[0.46,-0.2]],
      deck:-0.52, front:0.46, height:0.52,
      wheels:[-0.36,-0.18,0,0.18,0.36].map(x=>({x,r:0.075})), treads:true,
    };
  }
  if (classId === "specialist") {
    if (id === "scorpion") return {
      hull:[[-0.44,-0.1],[-0.44,-0.38],[-0.3,-0.48],[0.08,-0.48],[0.28,-0.39],[0.46,-0.18],[0.46,-0.1]],
      deck:-0.48, front:0.46, height:0.48,
      wheels:[{x:-0.27,r:0.115},{x:0.22,r:0.115}], treads:false,
    };
    if (id === "mantis") return {
      hull:[[-0.4,-0.1],[-0.4,-0.35],[-0.22,-0.43],[0.06,-0.43],[0.2,-0.55],[0.36,-0.48],[0.42,-0.14],[0.42,-0.1]],
      deck:-0.55, front:0.42, height:0.55,
      wheels:[{x:-0.24,r:0.11},{x:0.21,r:0.11}], treads:false,
    };
    if (id === "phantom") return {
      hull:[[-0.45,-0.09],[-0.45,-0.31],[-0.28,-0.38],[0.16,-0.38],[0.46,-0.16],[0.46,-0.09]],
      deck:-0.38, front:0.46, height:0.38,
      wheels:[{x:-0.28,r:0.105},{x:0.22,r:0.105}], treads:false,
    };
    if (id === "reaper") return {
      hull:[[-0.46,-0.1],[-0.46,-0.4],[-0.3,-0.51],[0.02,-0.51],[0.22,-0.58],[0.47,-0.2],[0.47,-0.1]],
      deck:-0.58, front:0.47, height:0.58,
      wheels:[{x:-0.27,r:0.118},{x:0.22,r:0.118}], treads:false,
    };
    return {
      hull:[[-0.4,-0.11],[-0.4,-0.38],[-0.28,-0.44],[0.1,-0.44],[0.32,-0.34],[0.4,-0.16],[0.4,-0.11]],
      deck:-0.44, front:0.4, height:0.44,
      wheels:[{x:-0.25,r:0.12},{x:0.2,r:0.12}], treads:false,
    };
  }
  if (id === "raptor") return {
    hull:[[-0.48,-0.09],[-0.48,-0.32],[-0.34,-0.39],[0.08,-0.39],[0.52,-0.1]],
    deck:-0.39, front:0.52, height:0.39,
    wheels:[{x:-0.28,r:0.125},{x:0.18,r:0.125}], treads:false,
  };
  if (id === "stinger") return {
    hull:[[-0.43,-0.08],[-0.43,-0.27],[-0.28,-0.31],[0.1,-0.31],[0.49,-0.08]],
    deck:-0.31, front:0.49, height:0.31,
    wheels:[{x:-0.25,r:0.115},{x:0.17,r:0.115}], treads:false,
  };
  if (id === "viper") return {
    hull:[[-0.49,-0.08],[-0.49,-0.3],[-0.32,-0.36],[0.14,-0.36],[0.54,-0.09]],
    deck:-0.36, front:0.54, height:0.36,
    wheels:[{x:-0.28,r:0.12},{x:0.19,r:0.12}], treads:false,
  };
  if (id === "warhawk") return {
    hull:[[-0.5,-0.09],[-0.5,-0.36],[-0.34,-0.43],[-0.04,-0.46],[0.16,-0.39],[0.55,-0.1]],
    deck:-0.46, front:0.55, height:0.46,
    wheels:[{x:-0.29,r:0.125},{x:0.2,r:0.125}], treads:false,
  };
  return {
    hull:[[-0.46,-0.1],[-0.46,-0.3],[-0.36,-0.34],[0.08,-0.34],[0.44,-0.13],[0.44,-0.1]],
    deck:-0.34, front:0.44, height:0.34,
    wheels:[{x:-0.27,r:0.13},{x:0.17,r:0.13}], treads:false,
  };
}

function poly(ctx: CanvasRenderingContext2D, pts: [number, number][], u: number) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * u, y * u) : ctx.lineTo(x * u, y * u)));
  ctx.closePath();
}

function drawWheel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  roll: number,
  paint: string,
) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, "#3a3835");
  g.addColorStop(1, "#111");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // Tread blocks.
  ctx.strokeStyle = "#060606";
  ctx.lineWidth = Math.max(1, r * 0.12);
  for (let i = 0; i < 10; i++) {
    const a = roll + (i / 10) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.stroke();
  }
  // Hub.
  const rim = ctx.createLinearGradient(x-r,y-r,x+r,y+r);
  rim.addColorStop(0,"#eff4f8");rim.addColorStop(0.2,"#788896");rim.addColorStop(0.5,"#253440");rim.addColorStop(0.8,"#a7b8c5");rim.addColorStop(1,"#17212b");
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = paint;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1918";
  for (let i = 0; i < 5; i++) {
    const a = roll + (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2, r * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
}

function bolt(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = "#1a1917";
  ctx.beginPath();
  ctx.arc(x, y + r * 0.3, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b8b2a6";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Locker preview uses the broadcast particle primitives, with no fight state or rewards. */
export function drawCosmeticEffect(ctx: CanvasRenderingContext2D, fx: Fx, effect: string, x: number, y: number, size: number, w: number, h: number, dt: number, paint: string) {
  if (effect === "walkout-pyro") for (let i = fx.tick("preview-pyro", 26, dt); i > 0; i--) {
    fx.pyro(x - size * 0.8, y, size); fx.pyro(x + size * 0.8, y, size);
  }
  if (effect === "walkout-sparks") for (let i = fx.tick("preview-sparks", 70, dt); i > 0; i--) fx.sparkRain(x, h * 0.04, size, y);
  if (effect === "walkout-smoke") for (let i = fx.tick("preview-smoke", 9, dt); i > 0; i--) fx.stageSmoke(x, y, size);
  if (effect.startsWith("smoke-")) {
    const rgb = SMOKE[effect.slice("smoke-".length) as keyof typeof SMOKE]?.rgb ?? "190,185,200";
    for (let i = fx.tick("preview-color-smoke", 9, dt); i > 0; i--) fx.stageSmoke(x, y, size, rgb);
  }
  if (effect === "victory-confetti") for (let i = fx.tick("preview-confetti", 10, dt); i > 0; i--) fx.confetti(x, h * 0.1, size, [paint, "#f3efe6", "#f0a202"], y);
  if (effect === "victory-fireworks") for (let i = fx.tick("preview-fireworks", 1.6, dt); i > 0; i--) fx.firework(w * (0.25 + Math.random() * 0.5), h * 0.18, size, paint);
  fx.step(dt);
  drawParticles(ctx, fx.side);
}

export function drawSideBot(
  ctx: CanvasRenderingContext2D,
  s: BotState,
  x: number,
  y: number,
  u: number,
  time: number,
  spin: number,
  facing: number,
) {
  const style = styleOf(s.bot, s.bot.classId);
  const baseFrame = frameOf(s.bot.classId, style.body);
  const f = s.bot.driveFamily ? { ...baseFrame, treads: s.bot.driveFamily === "treads" } : baseFrame;
  const paint = paintOf(s.bot.paint);
  const scale = u * (s.bot.classId === "tank" ? 1.06 : s.bot.classId === "specialist" ? 0.94 : 1);
  const liftPx = s.lift * scale;

  // Shadow stays on the floor: it shrinks and fades as the bot rises, and lies flat and wide on a flip.
  if (s.gone < 1) {
    const air = clamp(s.lift, 0, 1.2);
    const spread = (1 - air * 0.28) * (s.flipped ? 1.18 : 1);
    ctx.save();
    ctx.globalAlpha = (1 - s.gone) * clamp(1 - air * 0.7, 0.2, 1);
    ctx.translate(x + liftPx * 0.12, y);
    ctx.scale(1, s.flipped ? 0.14 : 0.18);
    const radius = scale * 0.62 * spread;
    const g = ctx.createRadialGradient(0, 0, radius * 0.12, 0, 0, radius);
    g.addColorStop(0, "rgba(0,0,0,0.82)");
    g.addColorStop(0.45, "rgba(0,0,0,0.48)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Contact patches: hard, dark, right where rubber or hull meets the floor. Gone the moment it lifts.
    const touch = clamp(1 - air * 4, 0, 1) * (1 - s.gone);
    if (touch > 0) {
      ctx.save();
      ctx.globalAlpha = touch * 0.85;
      ctx.fillStyle = "rgba(0,0,0,0.9)";
      const spots = s.flipped ? [0] : [-0.32, 0.32];
      for (const sx of spots) {
        ctx.beginPath();
        ctx.ellipse(x + sx * scale * facing, y + scale * 0.004, scale * (s.flipped ? 0.42 : 0.15), scale * 0.028, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  ctx.save();
  if (s.gone > 0) {
    ctx.beginPath();
    ctx.rect(x - scale * 2, y - scale * 4, scale * 4, scale * 4 + 1);
    ctx.clip();
    ctx.globalAlpha = 1 - clamp((s.gone - 0.6) / 0.4, 0, 1);
  }
  ctx.translate(x, y - liftPx + s.gone * scale * 0.7);
  ctx.scale(facing, 1);
  const cy = -f.height * scale * 0.5;
  ctx.translate(0, cy);
  ctx.rotate(-s.pitch);
  ctx.translate(0, -cy);
  if (s.flipped) {
    ctx.translate(0, -f.height * scale);
    ctx.scale(1, -1);
  }
  if (s.charging && !s.dead) ctx.rotate(-0.035);
  // A damaged drive shudders mechanically rather than making the whole hull blink.
  if (!s.dead && s.hp < 20) ctx.rotate(Math.sin(time * 21 + hash(s.bot.id)) * 0.006);

  const u2 = scale;
  const dark = shade(paint, -80);
  const trim = TRIM[style.trim] ?? TRIM.steel!;
  const eye = EYES[style.eye] ?? EYES.green!;
  const hub = style.trim === "steel" ? shade(paint, -40) : trim;

  // Weapon behind the hull (arms, hammer back swing).
  weaponBack(ctx, s, f, u2, spin);

  // Running gear.
  if (f.treads) {
    const tg = ctx.createLinearGradient(0, -0.26 * u2, 0, 0);
    tg.addColorStop(0, "#2d2b28");
    tg.addColorStop(1, "#0d0d0c");
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.roundRect(-0.5 * u2, -0.25 * u2, 1.0 * u2, 0.25 * u2, 0.12 * u2);
    ctx.fill();
    ctx.strokeStyle = "#050505";
    ctx.lineWidth = Math.max(1, u2 * 0.012);
    const pitch = 0.065 * u2;
    const off = (((s.roll * u2 * 0.3) % pitch) + pitch) % pitch;
    for (let tx = -0.5 * u2 + off; tx < 0.5 * u2; tx += pitch) {
      ctx.beginPath();
      ctx.moveTo(tx, -0.25 * u2);
      ctx.lineTo(tx, -0.2 * u2);
      ctx.moveTo(tx, -0.05 * u2);
      ctx.lineTo(tx, 0);
      ctx.stroke();
    }
    for (const wh of f.wheels) drawWheel(ctx, wh.x * u2, -0.125 * u2, wh.r * u2, s.roll * 3, hub);
  } else {
    // Far-side wheels peek out behind the hull.
    for (const wh of f.wheels) {
      ctx.save();
      ctx.globalAlpha *= 0.55;
      drawWheel(ctx, (wh.x + 0.05) * u2, -wh.r * u2 - 0.015 * u2, wh.r * u2, s.roll * 3, hub);
      ctx.restore();
    }
  }

  // Hull: painted armour with a lit top edge.
  const top = f.deck * u2;
  const hg = ctx.createLinearGradient(0, top, 0, top + f.height * u2 * 0.9);
  if (style.finish === "chrome") {
    hg.addColorStop(0, shade(paint, 120));
    hg.addColorStop(0.2, shade(paint, 10));
    hg.addColorStop(0.38, shade(paint, 95));
    hg.addColorStop(0.55, shade(paint, -45));
    hg.addColorStop(0.75, shade(paint, 60));
    hg.addColorStop(1, shade(paint, -90));
  } else if (style.finish === "matte") {
    hg.addColorStop(0, shade(paint, 12));
    hg.addColorStop(1, shade(paint, -35));
  } else if (style.finish === "satin") {
    hg.addColorStop(0, shade(paint, 45));
    hg.addColorStop(0.5, paint);
    hg.addColorStop(1, shade(paint, -45));
  } else if (style.finish === "carbon") {
    hg.addColorStop(0, "#454a50");
    hg.addColorStop(0.35, "#171b20");
    hg.addColorStop(0.65, "#343a40");
    hg.addColorStop(1, "#0b0d10");
  } else if (style.finish === "iridescent") {
    hg.addColorStop(0, "#6ee7ff");
    hg.addColorStop(0.3, paint);
    hg.addColorStop(0.6, "#cf65ff");
    hg.addColorStop(1, "#ff8fc7");
  } else if (style.finish === "gold") {
    hg.addColorStop(0, "#fff1a8");
    hg.addColorStop(0.22, "#d7a922");
    hg.addColorStop(0.5, "#fff0a0");
    hg.addColorStop(0.78, "#9d6b0b");
    hg.addColorStop(1, "#4f3100");
  } else if (style.finish === "holographic") {
    const shift = (Math.sin(time * 1.5) + 1) / 2;
    hg.addColorStop(0, "#b8fff6");
    hg.addColorStop(0.18 + shift * 0.08, paint);
    hg.addColorStop(0.42, "#f3a0ff");
    hg.addColorStop(0.66, "#ffe59a");
    hg.addColorStop(1, "#7dffa8");
  } else {
    hg.addColorStop(0, shade(paint, 70));
    hg.addColorStop(0.18, shade(paint, 25));
    hg.addColorStop(0.55, paint);
    hg.addColorStop(1, shade(paint, -70));
  }
  ctx.fillStyle = hg;
  poly(ctx, f.hull, u2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.75)";
  ctx.lineWidth = Math.max(1, u2 * 0.014);
  ctx.stroke();

  // Extruded deck: the roof catches the overhead rig, while the near face stays painted.
  armorEdges(ctx, f.hull, u2, style.finish === "matte");
  ctx.save();
  const depth = 0.075 * u2;
  const roof = f.hull.filter(([, py]) => py < -f.height * 0.55);
  if (roof.length > 1) {
    const metal = ctx.createLinearGradient(0, top - depth, 0, top + depth);
    metal.addColorStop(0, shade(paint, style.finish === "matte" ? 35 : 100));
    metal.addColorStop(0.5, shade(paint, 30));
    metal.addColorStop(1, shade(paint, -35));
    ctx.fillStyle = metal;
    ctx.beginPath();
    roof.forEach(([px, py], i) => i ? ctx.lineTo(px * u2, py * u2) : ctx.moveTo(px * u2, py * u2));
    [...roof].reverse().forEach(([px, py]) => ctx.lineTo(px * u2 - depth, py * u2 - depth * 0.65));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(230,241,255,0.65)";
    ctx.lineWidth = Math.max(0.7, u2 * 0.006);
    ctx.stroke();
  }
  ctx.restore();

  // Panel lines and bolts.
  ctx.save();
  poly(ctx, f.hull, u2);
  ctx.clip();
  ctx.strokeStyle = shade(paint, -95, 0.55);
  ctx.lineWidth = Math.max(1, u2 * 0.008);
  const panelY = top + f.height * u2 * 0.45;
  ctx.beginPath();
  ctx.moveTo(-0.5 * u2, panelY);
  ctx.lineTo(0.5 * u2, panelY);
  ctx.moveTo(-0.08 * u2, top);
  ctx.lineTo(-0.08 * u2, 0);
  ctx.stroke();
  // Small, deterministic manufacturing differences identify each store even before its number is visible.
  const identity = hash(s.bot.id);
  const panelCount = 2 + identity % 3;
  const ventY = top + f.height * u2 * 0.25;
  for (let i = 0; i < panelCount; i++) {
    const vx = (-0.31 + i * 0.065) * u2;
    ctx.fillStyle = "rgba(4,8,12,0.8)";
    ctx.fillRect(vx, ventY, u2 * 0.032, u2 * 0.065);
    ctx.fillStyle = "rgba(214,228,241,0.45)";
    ctx.fillRect(vx, ventY + u2 * 0.065, u2 * 0.032, Math.max(0.7, u2 * 0.005));
  }
  // Recessed fasteners, a service hatch, and a fine brushed-metal grain.
  const hatchX = (0.08 + (identity % 3) * 0.025) * u2;
  ctx.fillStyle = "rgba(5,12,20,0.23)";
  ctx.fillRect(hatchX, panelY + u2 * 0.035, u2 * 0.15, u2 * 0.07);
  ctx.strokeStyle = "rgba(218,232,246,0.24)";
  ctx.strokeRect(hatchX, panelY + u2 * 0.035, u2 * 0.15, u2 * 0.07);
  for (const bx of [-0.35, -0.1, 0.28]) {
    ctx.fillStyle = "#111820";
    ctx.beginPath(); ctx.arc(bx * u2, panelY + u2 * 0.018, Math.max(1.2, u2 * 0.013), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#a2afbb";
    ctx.beginPath(); ctx.arc(bx * u2 - u2 * 0.003, panelY + u2 * 0.014, Math.max(0.6, u2 * 0.007), 0, Math.PI * 2); ctx.fill();
  }
  if (u2 > 65) {
    ctx.strokeStyle = "rgba(225,236,246,0.065)";
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 16; i++) {
      const gy = top + i * f.height * u2 / 20;
      ctx.beginPath(); ctx.moveTo(-0.4 * u2, gy); ctx.lineTo(0.4 * u2, gy - u2 * 0.01); ctx.stroke();
    }
  }
  // Overhead rig: the flanks curve away from the light and the belly sits in shade.
  const flank = ctx.createLinearGradient(-0.55 * u2, 0, 0.55 * u2, 0);
  flank.addColorStop(0, "rgba(0,0,0,0.34)");
  flank.addColorStop(0.2, "rgba(0,0,0,0)");
  flank.addColorStop(0.8, "rgba(0,0,0,0)");
  flank.addColorStop(1, "rgba(0,0,0,0.34)");
  ctx.fillStyle = flank;
  ctx.fillRect(-0.6 * u2, top, 1.2 * u2, f.height * u2);
  const belly = ctx.createLinearGradient(0, top, 0, top + f.height * u2);
  belly.addColorStop(0, "rgba(255,248,232,0.10)");
  belly.addColorStop(0.12, "rgba(255,248,232,0)");
  belly.addColorStop(0.62, "rgba(0,0,0,0)");
  belly.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = belly;
  ctx.fillRect(-0.6 * u2, top, 1.2 * u2, f.height * u2);
  // Arena lights slide across glossy paint as the bot moves, so it reads as metal in motion.
  const gloss =
    style.finish === "chrome" ? 0.42 : style.finish === "gold" ? 0.34 : style.finish === "iridescent" || style.finish === "holographic" ? 0.26 :
    style.finish === "factory" ? 0.2 : style.finish === "satin" ? 0.12 : 0;
  if (gloss > 0) {
    ctx.globalCompositeOperation = "lighter";
    for (const [lane, width] of [[0, 0.11], [0.43, 0.05]] as const) {
      const pos = ((x / Math.max(1, u * 5) + time * 0.04 + lane + (hash(s.bot.id) % 7) / 7) % 1 + 1) % 1;
      const gx = (-0.62 + pos * 1.24) * u2;
      const glint = ctx.createLinearGradient(gx - width * u2, 0, gx + width * u2, 0);
      glint.addColorStop(0, "rgba(255,252,240,0)");
      glint.addColorStop(0.5, `rgba(255,252,240,${gloss * (lane ? 0.6 : 1)})`);
      glint.addColorStop(1, "rgba(255,252,240,0)");
      ctx.fillStyle = glint;
      ctx.fillRect(gx - width * u2, top, width * 2 * u2, f.height * u2 * 0.7);
    }
    ctx.globalCompositeOperation = "source-over";
  }
  // Specular sheen, by finish.
  if (style.finish !== "matte") {
    ctx.globalCompositeOperation = "lighter";
    const shine = style.finish === "chrome" ? 0.34 : style.finish === "worn" ? 0.07 : 0.16;
    const sheen = ctx.createLinearGradient(-0.4 * u2, top, 0.2 * u2, top + f.height * u2);
    sheen.addColorStop(0, "rgba(255,255,255,0)");
    sheen.addColorStop(0.45, `rgba(255,255,255,${shine})`);
    sheen.addColorStop(0.55, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(-0.6 * u2, top, 1.2 * u2, f.height * u2);
    if (style.finish === "chrome") {
      const sheen2 = ctx.createLinearGradient(0.05 * u2, top, 0.45 * u2, top + f.height * u2);
      sheen2.addColorStop(0.4, "rgba(255,255,255,0)");
      sheen2.addColorStop(0.5, "rgba(255,255,255,0.28)");
      sheen2.addColorStop(0.6, "rgba(255,255,255,0)");
      ctx.fillStyle = sheen2;
      ctx.fillRect(-0.6 * u2, top, 1.2 * u2, f.height * u2);
    }
    ctx.globalCompositeOperation = "source-over";
  }
  if (style.finish === "worn") drawWear(ctx, f, u2, top, s.bot.id);
  // Battle scars: dents and scrapes from parts the store has not paid to fix.
  if (s.scars && s.scars > 0) {
    const r = seeded(hash(`${s.bot.id}scar`));
    for (let i = 0; i < Math.min(6, s.scars * 2); i++) {
      const sx = (r() - 0.5) * 0.75 * u2;
      const sy = top + (0.15 + r() * 0.65) * f.height * u2;
      const len = u2 * (0.05 + r() * 0.07);
      const tilt = (r() - 0.5) * 0.9;
      ctx.strokeStyle = "rgba(230,224,212,0.7)";
      ctx.lineWidth = Math.max(1, u2 * 0.007);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(tilt) * len, sy + Math.sin(tilt) * len);
      ctx.moveTo(sx + u2 * 0.01, sy + u2 * 0.012);
      ctx.lineTo(sx + Math.cos(tilt) * len * 0.7 + u2 * 0.01, sy + Math.sin(tilt) * len * 0.7 + u2 * 0.012);
      ctx.stroke();
      if (i % 2 === 0) {
        const d = ctx.createRadialGradient(sx, sy, 0, sx, sy, u2 * 0.045);
        d.addColorStop(0, "rgba(0,0,0,0.45)");
        d.addColorStop(0.7, "rgba(0,0,0,0.12)");
        d.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = d;
        ctx.beginPath();
        ctx.arc(sx, sy, u2 * 0.045, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Scorch as HP drops.
  const hurt = 1 - clamp(s.hp / 100, 0, 1);
  if (hurt > 0.25) {
    const r = seeded(hash(s.bot.id));
    for (let i = 0; i < Math.round(hurt * 6); i++) {
      const sx = (r() - 0.5) * 0.8 * u2;
      const sy = top + r() * f.height * u2 * 0.8;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, u2 * (0.06 + r() * 0.08));
      g.addColorStop(0, `rgba(10,8,6,${0.3 + hurt * 0.5})`);
      g.addColorStop(1, "rgba(10,8,6,0)");
      ctx.fillStyle = g;
      ctx.fillRect(sx - u2 * 0.2, sy - u2 * 0.2, u2 * 0.4, u2 * 0.4);
      if (hurt > 0.55) {
        ctx.strokeStyle = "rgba(210,205,195,0.55)";
        ctx.lineWidth = Math.max(1, u2 * 0.008);
        ctx.beginPath();
        ctx.moveTo(sx - u2 * 0.04, sy);
        ctx.lineTo(sx + u2 * 0.05, sy + u2 * 0.02);
        ctx.stroke();
      }
    }
  }
  ctx.restore();

  // Look.
  // Armor silhouettes track the installed family, with readable thickness and mechanical mounts.
  if (s.bot.armorFamily === "skirt") {
    ctx.fillStyle = shade(paint, -55);
    ctx.strokeStyle = "#9ba8b7";
    ctx.lineWidth = Math.max(1, u2 * 0.009);
    poly(ctx, [[-0.49, -0.19], [0.49, -0.19], [0.55, -0.04], [-0.54, -0.04]], u2);
    ctx.fill(); ctx.stroke();
  } else if (s.bot.armorFamily === "cage") {
    ctx.strokeStyle = "#8e9cab";
    ctx.lineWidth = Math.max(1.5, u2 * 0.018);
    ctx.beginPath();
    for (const bx of [-0.34, -0.08, 0.2]) {
      ctx.moveTo(bx * u2, -0.12 * u2); ctx.lineTo(bx * u2, top - u2 * 0.07);
    }
    ctx.moveTo(-0.38 * u2, top - u2 * 0.07); ctx.lineTo(0.3 * u2, top - u2 * 0.07); ctx.stroke();
  } else if (s.bot.armorFamily === "angle") {
    ctx.fillStyle = shade(paint, 25);
    ctx.strokeStyle = "rgba(223,235,250,0.5)";
    poly(ctx, [[0.18, -0.13], [0.38, -0.37], [0.51, -0.09]], u2);
    ctx.fill(); ctx.stroke();
  }
  drawInstalledSide(ctx, s, f, u2, top, time);
  const look = s.bot.look ?? "plain";
  if (look === "stripe") {
    ctx.save();
    poly(ctx, f.hull, u2);
    ctx.clip();
    ctx.fillStyle = "#f3efe6";
    ctx.fillRect(-0.6 * u2, top + f.height * u2 * 0.22, 1.2 * u2, f.height * u2 * 0.12);
    ctx.fillStyle = "#0e0d0b";
    ctx.fillRect(-0.6 * u2, top + f.height * u2 * 0.34, 1.2 * u2, f.height * u2 * 0.04);
    ctx.restore();
  } else if (look === "chevron") {
    ctx.save();
    poly(ctx, f.hull, u2);
    ctx.clip();
    ctx.strokeStyle = "#0e0d0b";
    ctx.lineWidth = u2 * 0.045;
    for (const off of [0, 0.09]) {
      ctx.beginPath();
      ctx.moveTo((-0.34 + off) * u2, top + f.height * u2 * 0.1);
      ctx.lineTo((-0.2 + off) * u2, top + f.height * u2 * 0.45);
      ctx.lineTo((-0.34 + off) * u2, top + f.height * u2 * 0.8);
      ctx.stroke();
    }
    ctx.restore();
  }
  {
    ctx.save();
    poly(ctx, f.hull, u2);
    ctx.clip();
    const stickers = style.stickers!;
    const b = hullBounds(f);
    const mid = (b.top + b.bottom) / 2;
    // Only the camera-facing armor is visible. Hood and rear sit in separate regions.
    stickerBadge(ctx, stickers[facing < 0 ? "left" : "right"], -0.04 * u2, mid * u2 + 0.025 * u2, 0.42 * u2, 0.16 * u2, paint, s.bot.id, s.bot.number, true);
    stickerBadge(ctx, stickers.hood, 0.13 * u2, (b.top + 0.045) * u2, 0.3 * u2, 0.085 * u2, paint, s.bot.id, s.bot.number, true);
    stickerBadge(ctx, stickers.rear, (b.minX + 0.09) * u2, mid * u2, 0.14 * u2, 0.17 * u2, paint, s.bot.id, s.bot.number, true);
    ctx.restore();
  }

  // Trim along the top edge.
  if (style.trim !== "steel") {
    ctx.save();
    ctx.strokeStyle = trim;
    ctx.lineWidth = Math.max(1.5, u2 * 0.022);
    ctx.lineJoin = "round";
    const edge = f.hull.filter(([, y]) => y <= f.deck + f.height * 0.35);
    ctx.beginPath();
    edge.forEach(([ex, ey], i) =>
      i === 0 ? ctx.moveTo(ex * u2, ey * u2) : ctx.lineTo(ex * u2, ey * u2),
    );
    ctx.stroke();
    ctx.restore();
  }
  if (style.leds && style.leds !== "none" && LEDS[style.leds]) {
    const edge = f.hull.filter(([, y]) => y <= f.deck + f.height * 0.35);
    const pulse = 0.4 + 0.35 * Math.sin(time * 5 + hash(s.bot.id));
    strokeGlow(ctx, edge, u2, LEDS[style.leds].hex, Math.max(2.5, u2 * 0.034), pulse);
  }

  const boltR = u2 * 0.016;
  const bolts: [number, number][] = [
    [-0.4, top / u2 + 0.06],
    [0.0, top / u2 + 0.05],
    [-0.4, -0.12],
  ];
  if (look === "rivets") {
    for (let i = 0; i < 7; i++) bolts.push([-0.4 + i * 0.1, top / u2 + 0.06]);
  }
  for (const [bx, by] of bolts) bolt(ctx, bx * u2, by * u2, boltR);

  if (!f.treads) {
    for (const wh of f.wheels) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.arc(wh.x * u2, -wh.r * u2, wh.r * u2 * 1.12, Math.PI, 0);
      ctx.fill();
      drawWheel(ctx, wh.x * u2, -wh.r * u2, wh.r * u2, s.roll * 3, hub);
    }
  } else {
    // Armour skirt over the upper run of the track.
    ctx.fillStyle = shade(paint, -35);
    ctx.fillRect(-0.48 * u2, -0.27 * u2, 0.96 * u2, 0.07 * u2);
    ctx.fillStyle = shade(paint, 20);
    ctx.fillRect(-0.48 * u2, -0.27 * u2, 0.96 * u2, 0.012 * u2);
    for (let i = 0; i < 6; i++) bolt(ctx, (-0.42 + i * 0.168) * u2, -0.235 * u2, u2 * 0.012);
  }

  // Bay number on a white plate, never mirrored.
  if (s.bot.number) {
    const px = -0.2 * u2;
    const py = top + f.height * u2 * (f.treads ? 0.34 : 0.5);
    ctx.fillStyle = "rgba(243,239,230,0.92)";
    ctx.beginPath();
    ctx.roundRect(px - u2 * 0.1, py - u2 * 0.065, u2 * 0.2, u2 * 0.13, u2 * 0.02);
    ctx.fill();
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(Math.sign(facing) || 1, s.flipped ? -1 : 1);
    ctx.fillStyle = "#0e0d0b";
    ctx.font = `700 ${Math.max(9, u2 * 0.11)}px Oswald, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s.bot.number, 0, u2 * 0.005);
    ctx.restore();
  }

  // Brain: a sensor dome on the deck. The lens colour is the tier.
  {
    const tier = s.bot.brainTier ?? "stock";
    const lens = tier === "super" ? "#b46bff" : tier === "pro" ? "#ffb020" : tier === "sport" ? "#3fb4ff" : tier === "championship" ? "#ffe066" : "#8e8a82";
    const dx = (f.treads ? -0.12 : -0.16) * u2;
    const dy = top + 0.004 * u2;
    const r = u2 * (tier === "stock" ? 0.05 : 0.06);
    ctx.fillStyle = "#24221f";
    ctx.fillRect(dx - r * 1.2, dy - r * 0.25, r * 2.4, r * 0.3);
    const dg = ctx.createRadialGradient(dx - r * 0.3, dy - r * 0.6, r * 0.1, dx, dy, r);
    dg.addColorStop(0, "#8f8a82");
    dg.addColorStop(1, "#2b2926");
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.arc(dx, dy, r, Math.PI, 0);
    ctx.fill();
    const pulse = s.dead ? 0.15 : tier === "stock" ? 0.55 : 0.75 + Math.sin(time * 4 + hash(s.bot.id)) * 0.25;
    if (tier !== "stock" && !s.dead) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const lg = ctx.createRadialGradient(dx, dy - r * 0.45, 0, dx, dy - r * 0.45, r * 2.2);
      lg.addColorStop(0, shade(lens, 0, 0.5 * pulse));
      lg.addColorStop(1, shade(lens, 0, 0));
      ctx.fillStyle = lg;
      ctx.fillRect(dx - r * 2.2, dy - r * 2.7, r * 4.4, r * 4.4);
      ctx.restore();
    }
    ctx.fillStyle = shade(lens, 0, Math.max(0.35, pulse));
    ctx.beginPath();
    ctx.arc(dx + r * 0.25, dy - r * 0.45, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  // Visor: the bot's eye.
  {
    const vx = (f.front - (f.treads ? 0.2 : 0.36)) * u2;
    const vy = top + f.height * u2 * (f.treads ? 0.2 : 0.16);
    const on = s.dead ? 0.15 : 0.85 + Math.sin(time * 3 + hash(s.bot.id)) * 0.15;
    ctx.fillStyle = "#0b0b0a";
    ctx.beginPath();
    ctx.roundRect(vx - u2 * 0.07, vy - u2 * 0.022, u2 * 0.14, u2 * 0.044, u2 * 0.02);
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const eg = ctx.createRadialGradient(vx + u2 * 0.02, vy, 0, vx + u2 * 0.02, vy, u2 * 0.12);
    eg.addColorStop(0, shade(eye, 0, 0.55 * on));
    eg.addColorStop(1, shade(eye, 0, 0));
    ctx.fillStyle = eg;
    ctx.fillRect(vx - u2 * 0.15, vy - u2 * 0.12, u2 * 0.3, u2 * 0.24);
    ctx.restore();
    ctx.fillStyle = shade(eye, 0, on);
    ctx.beginPath();
    ctx.roundRect(vx - u2 * 0.05, vy - u2 * 0.01, u2 * 0.1, u2 * 0.02, u2 * 0.01);
    ctx.fill();
  }

  drawFaceMask(ctx, style.mask, f, u2, top);
  if (s.bot.chassisFamily === "pumpkin") drawPumpkinShell(ctx, f, u2);
  if (s.bot.chassisFamily === "harvesttable") drawTableShell(ctx, f, u2);
  if (s.bot.driveFamily === "ghostchaser") drawChaserLamps(ctx, f, u2, top);

  if (style.flag && !s.flipped)
    drawFlag(ctx, f, u2, top, trim, paint, s.bot.storeName ?? "", time, s.charging, facing);
  if (!s.flipped) drawTopper(ctx, style.topper, top, u2, trim, eye, time);
  if (style.banner) drawBannerPlate(ctx, style.banner, -0.22 * u2, top + f.height * u2 * 0.18, u2, true);
  if (style.smoke && SMOKE[style.smoke])
    drawSmokePuffs(ctx, -0.34 * u2, top + u2 * 0.02, u2, SMOKE[style.smoke].rgb, time);

  // Status LED.
  const blink = s.dead ? 0 : Math.sin(time * 6 + hash(s.bot.id)) > 0 ? 1 : 0.35;
  ctx.fillStyle = s.dead
    ? "#3a1a18"
    : s.hp < 35
      ? `rgba(255,60,40,${blink})`
      : `rgba(80,255,140,${blink})`;
  ctx.beginPath();
  ctx.arc(-0.33 * u2, top + u2 * 0.035, u2 * 0.022, 0, Math.PI * 2);
  ctx.fill();

  weaponFront(ctx, s, f, u2, spin, dark);

  if (s.flame > 0) drawFlame(ctx, f.front * u2, top + f.height * u2 * 0.3, u2, s.flame, time);

  ctx.restore();
}

function hullBounds(f: Frame) {
  const xs = f.hull.map(([x]) => x);
  const ys = f.hull.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
}

function drawWear(ctx: CanvasRenderingContext2D, f: Frame, u: number, top: number, id: string) {
  const b = hullBounds(f);
  const r = seeded(hash(`${id}wear`));
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const x = lerp(b.minX, b.maxX, r()) * u;
    const y = lerp(b.top, b.bottom, 0.3 + r() * 0.7) * u;
    const g = ctx.createRadialGradient(x, y, 0, x, y, u * (0.04 + r() * 0.05));
    g.addColorStop(0, "rgba(120,58,20,0.75)");
    g.addColorStop(1, "rgba(120,58,20,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - u * 0.1, y - u * 0.1, u * 0.2, u * 0.2);
  }
  ctx.strokeStyle = "rgba(225,220,210,0.45)";
  ctx.lineWidth = Math.max(1, u * 0.006);
  for (let i = 0; i < 12; i++) {
    const x = lerp(b.minX, b.maxX, r()) * u;
    const y = lerp(b.top, b.bottom, r()) * u;
    const len = u * (0.03 + r() * 0.08);
    const a = (r() - 0.5) * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(20,18,16,0.7)";
  for (let i = 0; i < 6; i++) {
    const x = lerp(b.minX, b.maxX, r()) * u;
    ctx.fillRect(x, top, u * 0.02, u * 0.012);
  }
  ctx.restore();
}

/** Draws the actual decal art inside a bounded physical sticker region. */
function stickerBadge(
  ctx: CanvasRenderingContext2D,
  decal: string,
  x: number,
  y: number,
  w: number,
  h: number,
  paint: string,
  id: string,
  number = "",
  readable = false,
) {
  if (decal === "none") return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w, h);
  ctx.beginPath(); ctx.rect(-0.5, -0.5, 1, 1); ctx.clip();
  const frame: Frame = { hull: [[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]], deck: -0.5, front: 0.5, height: 1, wheels: [], treads: false };
  drawDecal(ctx, decal, frame, 1, paint, id, 1, number, readable);
  if (decalArt(decal).foil) drawFoilSheen(ctx);
  ctx.restore();
}

function drawFoilSheen(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createLinearGradient(-0.5, -0.5, 0.5, 0.5);
  g.addColorStop(0, "rgba(255,90,190,0.42)");
  g.addColorStop(0.35, "rgba(90,220,255,0.16)");
  g.addColorStop(0.55, "rgba(255,255,255,0.5)");
  g.addColorStop(0.78, "rgba(170,255,90,0.22)");
  g.addColorStop(1, "rgba(255,210,90,0.38)");
  ctx.fillStyle = g;
  ctx.fillRect(-0.5, -0.5, 1, 1);
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.beginPath();
  ctx.moveTo(-0.15, -0.5);
  ctx.lineTo(0.08, -0.5);
  ctx.lineTo(0.5, 0.18);
  ctx.lineTo(0.5, 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function strokeGlow(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  u: number,
  color: string,
  width: number,
  alpha: number,
) {
  if (points.length < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = shade(color, 30, alpha);
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = width * 2.4;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * u, y * u) : ctx.lineTo(x * u, y * u)));
  ctx.stroke();
  ctx.restore();
}

function drawSmokePuffs(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, rgb: string, time: number) {
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const t = (time * 0.45 + i * 0.23) % 1;
    ctx.fillStyle = `rgba(${rgb},${(1 - t) * 0.55})`;
    ctx.beginPath();
    ctx.ellipse(
      x + Math.sin(i * 2.1 + time) * u * 0.06,
      y - t * u * 0.5,
      u * (0.045 + t * 0.11),
      u * (0.035 + t * 0.08),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
}

function drawBannerPlate(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, u: number, readable: boolean) {
  const verdict = bannerVerdict(text);
  if (!verdict.ok || !verdict.text) return;
  const label = verdict.text;
  ctx.save();
  ctx.translate(x, y);
  if (readable) {
    const transform = ctx.getTransform();
    if (transform.a < 0) ctx.scale(-1, 1);
  }
  const width = u * Math.min(0.62, 0.18 + label.length * 0.038);
  const height = u * 0.085;
  ctx.fillStyle = "#14120e";
  ctx.strokeStyle = "#e2a21a";
  ctx.lineWidth = Math.max(1, u * 0.008);
  ctx.beginPath();
  ctx.roundRect(-width / 2, -height / 2, width, height, u * 0.012);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f3efe6";
  ctx.font = `700 ${Math.max(8, u * 0.05)}px Oswald, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 0, u * 0.002);
  ctx.restore();
}

function withReadable(ctx: CanvasRenderingContext2D, readable: boolean, draw: () => void) {
  ctx.save();
  if (readable) {
    const transform = ctx.getTransform();
    if (transform.a < 0) ctx.scale(-1, 1);
  }
  draw();
  ctx.restore();
}

const SPONSOR_BADGES: Record<string, { kicker: string; name: string; bg: string; fg: string }> = {
  gearhead: { kicker: "GG", name: "GEARHEAD", bg: "#1a140c", fg: "#ffd23a" },
  brace: { kicker: "B&B", name: "BRACE", bg: "#1c2430", fg: "#e7eef6" },
  fuel: { kicker: "PF", name: "PIT FUEL", bg: "#3a120c", fg: "#ffb089" },
  tonic: { kicker: "TQ", name: "TONIC", bg: "#14210c", fg: "#d6ff6a" },
  archlabs: { kicker: "AL", name: "ARCH", bg: "#10242a", fg: "#8ee7ff" },
  turbo: { kicker: "TK", name: "TURBO", bg: "#2a1408", fg: "#ffb15a" },
};

function drawFreshSticker(
  ctx: CanvasRenderingContext2D,
  art: string,
  X: (t: number) => number,
  Y: (t: number) => number,
  u: number,
  w: number,
  h: number,
  number: string,
  readable: boolean,
) {
  const cx = X(0.5);
  const cy = Y(0.5);
  const r = Math.min(w, h) * u * 0.42;
  if (art === "roundel") {
    ctx.fillStyle = "#f4f1ea";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    withReadable(ctx, readable, () => {
      ctx.fillStyle = "#111";
      ctx.font = `700 ${Math.max(0.12, r * 0.7)}px Oswald, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((number || "00").slice(0, 3), cx, cy + r * 0.04);
    });
    return true;
  }
  if (art === "gear") {
    ctx.fillStyle = "#d7dde4";
    ctx.strokeStyle = "#1b242e";
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath();
    const teeth = 8;
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 === 0 ? r : r * 0.72;
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1b242e";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d7dde4";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    return true;
  }
  if (art === "wrench") {
    ctx.strokeStyle = "#c5ced6";
    ctx.fillStyle = "#c5ced6";
    ctx.lineWidth = Math.max(1.5, r * 0.16);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.55, cy + r * 0.45);
    ctx.lineTo(cx + r * 0.35, cy - r * 0.45);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + r * 0.42, cy - r * 0.5, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#101418";
    ctx.beginPath();
    ctx.arc(cx + r * 0.42, cy - r * 0.5, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c5ced6";
    ctx.beginPath();
    ctx.arc(cx - r * 0.55, cy + r * 0.48, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    return true;
  }
  if (art === "optics") {
    for (const side of [-1, 1]) {
      const x = cx + side * r * 0.42;
      ctx.fillStyle = "#12161c";
      ctx.beginPath();
      ctx.roundRect(x - r * 0.38, cy - r * 0.28, r * 0.76, r * 0.56, r * 0.12);
      ctx.fill();
      ctx.fillStyle = "#7dfff0";
      ctx.beginPath();
      ctx.arc(x, cy, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#04120f";
      ctx.beginPath();
      ctx.arc(x + r * 0.05, cy, r * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
    return true;
  }
  if (art === "skull") {
    ctx.fillStyle = "#f4f1ea";
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.08, r * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a140f";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + side * r * 0.28, cy - r * 0.12, r * 0.16, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 0.02);
    ctx.lineTo(cx - r * 0.1, cy + r * 0.22);
    ctx.lineTo(cx + r * 0.1, cy + r * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1a140f";
    for (let i = 0; i < 4; i++) ctx.fillRect(cx - r * 0.34 + i * r * 0.18, cy + r * 0.34, r * 0.1, r * 0.16);
    return true;
  }
  if (art === "bullseye") {
    const rings: [string, number][] = [
      ["#e23b2f", 1],
      ["#f4f1ea", 0.68],
      ["#e23b2f", 0.4],
      ["#f4f1ea", 0.16],
    ];
    for (const [color, scale] of rings) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    return true;
  }
  if (art === "plate") {
    ctx.fillStyle = "#8d99a6";
    ctx.strokeStyle = "#1c242c";
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath();
    ctx.roundRect(cx - r, cy - r * 0.72, r * 2, r * 1.44, r * 0.12);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#d5dde6";
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.45, cy + r * 0.2);
    ctx.lineTo(cx, cy - r * 0.28);
    ctx.lineTo(cx + r * 0.45, cy + r * 0.2);
    ctx.stroke();
    ctx.fillStyle = "#1c242c";
    for (const [px, py] of [
      [-0.7, -0.42],
      [0.7, -0.42],
      [-0.7, 0.42],
      [0.7, 0.42],
    ] as const) {
      ctx.beginPath();
      ctx.arc(cx + px * r, cy + py * r, r * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
    return true;
  }
  const sponsor = SPONSOR_BADGES[art];
  if (sponsor) {
    ctx.fillStyle = sponsor.bg;
    ctx.strokeStyle = sponsor.fg;
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath();
    ctx.roundRect(X(0.08), Y(0.16), w * u * 0.84, h * u * 0.68, r * 0.12);
    ctx.fill();
    ctx.stroke();
    withReadable(ctx, readable, () => {
      ctx.fillStyle = sponsor.fg;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${Math.max(0.1, r * 0.62)}px Oswald, sans-serif`;
      ctx.fillText(sponsor.kicker, cx, cy - r * 0.16);
      ctx.font = `600 ${Math.max(0.08, r * 0.28)}px Oswald, sans-serif`;
      ctx.fillText(sponsor.name, cx, cy + r * 0.28);
    });
    return true;
  }
  return false;
}

function drawDecal(
  ctx: CanvasRenderingContext2D,
  decal: string,
  f: Frame,
  u: number,
  paint: string,
  id: string,
  facing: number,
  number = "",
  readable = false,
) {
  const b = hullBounds(f);
  const w = b.maxX - b.minX;
  const h = b.bottom - b.top;
  const X = (t: number) => (b.minX + w * t) * u;
  const Y = (t: number) => (b.top + h * t) * u;
  const art = decalArt(decal).art;
  if (drawFreshSticker(ctx, art, X, Y, u, w, h, number, readable)) return;
  if (art === "flames") {
    const layers: [string, string, number][] = [
      ["#ffd23a", "#d8261a", 1],
      ["#fff6b0", "#ff8c1a", 0.62],
    ];
    for (const [hot, cool, k] of layers) {
      const g = ctx.createLinearGradient(X(1), 0, X(0.2), 0);
      g.addColorStop(0, hot);
      g.addColorStop(1, cool);
      ctx.fillStyle = g;
      for (let i = 0; i < 4; i++) {
        const yc = lerp(0.8, 0.3, i / 3);
        const reach = (0.55 + ((i * 37) % 4) * 0.1) * k;
        const thick = 0.3 * k;
        ctx.beginPath();
        ctx.moveTo(X(1.05), Y(yc + thick / 2));
        ctx.quadraticCurveTo(
          X(1 - reach * 0.5),
          Y(yc + thick * 0.7),
          X(1 - reach),
          Y(yc - thick * 0.45),
        );
        ctx.quadraticCurveTo(X(1 - reach * 0.4), Y(yc - thick * 0.05), X(1.05), Y(yc - thick / 2));
        ctx.closePath();
        ctx.fill();
      }
    }
  } else if (art === "lightning") {
    const pts: [number, number][] = [
      [0.12, 0.18],
      [0.5, 0.36],
      [0.42, 0.5],
      [0.9, 0.78],
      [0.46, 0.62],
      [0.54, 0.5],
    ];
    ctx.fillStyle = "#ffe14a";
    ctx.strokeStyle = "#1a1918";
    ctx.lineWidth = Math.max(1, u * 0.01);
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(X(px), Y(py)) : ctx.lineTo(X(px), Y(py))));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (art === "teeth") {
    const mx = X(1);
    const my = Y(0.62);
    const back = X(0.66);
    ctx.fillStyle = "#3a0b0b";
    ctx.beginPath();
    ctx.moveTo(mx, my - u * 0.05);
    ctx.quadraticCurveTo(lerp(back, mx, 0.4), my - u * 0.06, back, my);
    ctx.quadraticCurveTo(lerp(back, mx, 0.4), my + u * 0.08, mx, my + u * 0.07);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f7f4ec";
    const n = 6;
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const xa = lerp(mx, back, t0);
      const xb = lerp(mx, back, t1);
      const ya = my - u * 0.05 * (1 - t0 * 0.8);
      ctx.beginPath();
      ctx.moveTo(xa, ya);
      ctx.lineTo(xb, ya);
      ctx.lineTo((xa + xb) / 2, ya + u * 0.04);
      ctx.closePath();
      ctx.fill();
      const yb = my + u * 0.07 * (1 - t0 * 0.9);
      ctx.beginPath();
      ctx.moveTo(xa, yb);
      ctx.lineTo(xb, yb);
      ctx.lineTo((xa + xb) / 2, yb - u * 0.035);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#f7f4ec";
    ctx.beginPath();
    ctx.arc(X(0.72), Y(0.3), u * 0.03, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0b0b0a";
    ctx.beginPath();
    ctx.arc(X(0.72) + u * 0.008, Y(0.3), u * 0.016, 0, Math.PI * 2);
    ctx.fill();
  } else if (art === "checker") {
    const cell = u * 0.055;
    const x0 = X(0);
    for (let cx = 0; cx < 5; cx++) {
      for (let cy = 0; cy * cell < h * u + cell; cy++) {
        ctx.fillStyle = (cx + cy) % 2 === 0 ? "#f3efe6" : "#111";
        ctx.fillRect(x0 + cx * cell, b.top * u + cy * cell, cell, cell);
      }
    }
  } else if (art === "hazard") {
    const y0 = Y(0.62);
    const band = h * u * 0.26;
    ctx.fillStyle = "#f0b400";
    ctx.fillRect(X(-0.05), y0, w * u * 1.1, band);
    ctx.fillStyle = "#111";
    const step = band * 1.6;
    for (let sx = X(-0.1); sx < X(1.1); sx += step) {
      ctx.beginPath();
      ctx.moveTo(sx, y0 + band);
      ctx.lineTo(sx + band, y0);
      ctx.lineTo(sx + band + step / 2, y0);
      ctx.lineTo(sx + step / 2, y0 + band);
      ctx.closePath();
      ctx.fill();
    }
  } else if (art === "camo") {
    const r = seeded(hash(`${id}camo`));
    const tones = [shade(paint, -55), shade(paint, -25), "#4b5a3a", "#2e3326"];
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = tones[i % tones.length]!;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(
        X(r()),
        Y(r()),
        u * (0.04 + r() * 0.06),
        u * (0.02 + r() * 0.03),
        r() * 3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (art === "arch") {
    const cx = X(0.3);
    const cy = Y(0.38);
    const r = Math.min(u * 0.075, h * u * 0.34);
    ctx.fillStyle = "#f3efe6";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1a1918";
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.stroke();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(Math.sign(facing) || 1, 1);
    ctx.fillStyle = "#1a1918";
    ctx.beginPath();
    ctx.moveTo(-r * 0.62, r * 0.32);
    ctx.quadraticCurveTo(-r * 0.62, -r * 0.18, -r * 0.3, -r * 0.2);
    ctx.quadraticCurveTo(0, -r * 0.2, r * 0.05, r * 0.05);
    ctx.quadraticCurveTo(r * 0.3, -r * 0.05, r * 0.62, r * 0.12);
    ctx.lineTo(r * 0.62, r * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e2a21a";
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, r * 0.32);
    ctx.quadraticCurveTo(-r * 0.1, -r * 0.05, r * 0.25, r * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (art === "stars") {
    ctx.fillStyle = "#fff4a8";
    ctx.strokeStyle = "#7a5b00";
    ctx.lineWidth = Math.max(1, u * 0.006);
    for (const [sx,sy,rr] of [[0.28,0.3,0.055],[0.48,0.58,0.04],[0.68,0.35,0.048]] as const) {
      ctx.save();
      ctx.translate(X(sx),Y(sy));
      ctx.beginPath();
      for (let i=0;i<10;i++) {
        const a=-Math.PI/2+i*Math.PI/5;
        const r=(i%2===0?rr:rr*0.42)*u;
        const px=Math.cos(a)*r, py=Math.sin(a)*r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  } else if (art === "circuit") {
    ctx.strokeStyle = "#52f6df";
    ctx.lineWidth = Math.max(1, u * 0.012);
    for (let i=0;i<4;i++) {
      const yy=0.24+i*0.14;
      ctx.beginPath();
      ctx.moveTo(X(0.12),Y(yy));
      ctx.lineTo(X(0.38+i*0.06),Y(yy));
      ctx.lineTo(X(0.5+i*0.04),Y(yy+0.08));
      ctx.lineTo(X(0.82),Y(yy+0.08));
      ctx.stroke();
      ctx.fillStyle="#52f6df";
      ctx.beginPath(); ctx.arc(X(0.82),Y(yy+0.08),u*0.015,0,Math.PI*2); ctx.fill();
    }
  } else if (art === "splash") {
    const r = seeded(hash(`${id}splash`));
    const tones=["#ff4fa3","#00b7ff","#a8ff2a","#ffe35a"];
    for(let i=0;i<18;i++){
      ctx.fillStyle=tones[i%tones.length]!;
      ctx.globalAlpha=0.82;
      ctx.beginPath();
      ctx.arc(X(r()),Y(r()),u*(0.012+r()*0.035),0,Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha=1;
  } else if (art === "pumpkin") {
    const cx = X(0.42);
    const cy = Y(0.48);
    const r = Math.min(u * 0.09, h * u * 0.36);
    ctx.fillStyle = "#e07014";
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.86, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2f6b22";
    ctx.fillRect(cx - r * 0.12, cy - r * 1.05, r * 0.24, r * 0.28);
    ctx.fillStyle = "#2a1408";
    for (const [ox, oy] of [[-0.32, -0.08], [0.32, -0.08], [0, 0.28]] as const) {
      ctx.beginPath();
      ctx.moveTo(cx + ox * r, cy + oy * r - r * 0.16);
      ctx.lineTo(cx + ox * r + r * 0.16, cy + oy * r + r * 0.18);
      ctx.lineTo(cx + ox * r - r * 0.16, cy + oy * r + r * 0.18);
      ctx.closePath();
      ctx.fill();
    }
  } else if (art === "ivoted") {
    // Round "I VOTED" sticker: parchment with a gold rim and a check mark. No party colors.
    const cx = X(0.46);
    const cy = Y(0.48);
    const r = Math.min(u * 0.12, h * u * 0.42);
    ctx.fillStyle = ELECTION_COLORS.parchment;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.25, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ELECTION_COLORS.gold;
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.stroke();
    ctx.fillStyle = ELECTION_COLORS.ink;
    ctx.font = `bold ${Math.max(5, r * 0.5)}px Oswald, Impact, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("I VOTED", cx, cy - r * 0.12);
    ctx.strokeStyle = ELECTION_COLORS.laurel;
    ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.3, cy + r * 0.45);
    ctx.lineTo(cx - r * 0.08, cy + r * 0.65);
    ctx.lineTo(cx + r * 0.35, cy + r * 0.3);
    ctx.stroke();
  } else if (art === "ballot") {
    const cx = X(0.46);
    const cy = Y(0.55);
    const r = Math.min(u * 0.1, h * u * 0.4);
    ctx.fillStyle = ELECTION_COLORS.parchment;
    ctx.fillRect(cx - r * 0.45, cy - r * 1.25, r * 0.9, r * 0.8);
    ctx.fillStyle = ELECTION_COLORS.bronze;
    ctx.fillRect(cx - r, cy - r * 0.55, r * 2, r * 1.3);
    ctx.fillStyle = ELECTION_COLORS.ink;
    ctx.fillRect(cx - r * 0.55, cy - r * 0.58, r * 1.1, r * 0.12);
    ctx.fillStyle = ELECTION_COLORS.gold;
    ctx.fillRect(cx - r * 0.8, cy + r * 0.05, r * 1.6, r * 0.16);
  } else if (art === "capitol") {
    const cx = X(0.46);
    const base = Y(0.78);
    const r = Math.min(u * 0.11, h * u * 0.42);
    ctx.fillStyle = ELECTION_COLORS.parchment;
    ctx.fillRect(cx - r * 1.2, base - r * 0.2, r * 2.4, r * 0.2);
    for (let i = -2; i <= 2; i++) ctx.fillRect(cx + i * r * 0.42 - r * 0.07, base - r * 0.75, r * 0.14, r * 0.55);
    ctx.fillRect(cx - r * 1.05, base - r * 0.85, r * 2.1, r * 0.12);
    ctx.fillStyle = ELECTION_COLORS.gold;
    ctx.beginPath();
    ctx.arc(cx, base - r * 0.85, r * 0.6, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(cx - r * 0.05, base - r * 1.75, r * 0.1, r * 0.35);
  } else if (art === "turkey") {
    const cx = X(0.42);
    const cy = Y(0.48);
    const r = Math.min(u * 0.1, h * u * 0.4);
    ctx.fillStyle = "#8a4b1f";
    for (const a of [-0.7, 0, 0.7]) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.95, r * 0.34, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = "#b06a28";
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.25, r * 0.78, r * 0.66, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d8261a";
    ctx.beginPath();
    ctx.arc(cx + r * 0.18, cy + r * 0.05, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f0a202";
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.3, cy - r * 0.12);
    ctx.lineTo(cx + r * 0.55, cy);
    ctx.lineTo(cx + r * 0.28, cy + r * 0.08);
    ctx.closePath();
    ctx.fill();
  } else if (art === "wishbone") {
    const cx = X(0.45);
    const cy = Y(0.47);
    const r = Math.min(u * 0.1, h * u * 0.4);
    ctx.strokeStyle = "#f3ead2";
    ctx.lineWidth = Math.max(1.5, r * 0.16);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.55, cy - r * 0.75);
    ctx.quadraticCurveTo(cx - r * 0.4, cy + r * 0.1, cx, cy + r * 0.55);
    ctx.quadraticCurveTo(cx + r * 0.4, cy + r * 0.1, cx + r * 0.55, cy - r * 0.75);
    ctx.stroke();
    ctx.fillStyle = "#f3ead2";
    ctx.beginPath();
    ctx.arc(cx - r * 0.55, cy - r * 0.8, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + r * 0.55, cy - r * 0.8, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (art === "champion") {
    const cx=X(0.45), cy=Y(0.45), r=Math.min(u*0.095,h*u*0.4);
    ctx.fillStyle="#f6cd46"; ctx.strokeStyle="#563700"; ctx.lineWidth=Math.max(1,u*0.008);
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle="#241700";
    ctx.font=`700 ${Math.max(8,r*0.9)}px Oswald, sans-serif`;
    ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("W",cx,cy+r*0.06);
  }
}

function drawTopper(
  ctx: CanvasRenderingContext2D,
  topper: string | undefined,
  top: number,
  u: number,
  trim: string,
  eye: string,
  time = 0,
) {
  if (!topper || topper === "none") return;
  ctx.save();
  ctx.lineCap = "round";
  if (topper === "antenna") {
    ctx.strokeStyle = "#b8c2cc";
    ctx.lineWidth = Math.max(1.2, u * 0.009);
    ctx.beginPath();
    ctx.moveTo(-u * 0.08, top);
    ctx.quadraticCurveTo(-u * 0.1, top - u * 0.28, -u * 0.02, top - u * 0.42);
    ctx.stroke();
    ctx.fillStyle = eye;
    ctx.beginPath();
    ctx.arc(-u * 0.02, top - u * 0.42, u * 0.025, 0, Math.PI * 2);
    ctx.fill();
  } else if (topper === "horns") {
    ctx.fillStyle = trim;
    for (const x of [-0.18, 0.12]) {
      ctx.beginPath();
      ctx.moveTo((x - 0.04) * u, top + u * 0.01);
      ctx.lineTo(x * u, top - u * 0.22);
      ctx.lineTo((x + 0.05) * u, top + u * 0.01);
      ctx.closePath();
      ctx.fill();
    }
  } else if (topper === "mohawk") {
    ctx.fillStyle = trim;
    for (let i = 0; i < 5; i++) {
      const x = (-0.22 + i * 0.09) * u;
      const h = (0.13 + (i % 2) * 0.055) * u;
      ctx.beginPath();
      ctx.moveTo(x - u * 0.025, top);
      ctx.lineTo(x, top - h);
      ctx.lineTo(x + u * 0.025, top);
      ctx.closePath();
      ctx.fill();
    }
  } else if (topper === "crown") {
    ctx.fillStyle = "#f6cd46";
    ctx.strokeStyle = "#6b4600";
    ctx.lineWidth = Math.max(1, u * 0.006);
    ctx.beginPath();
    ctx.moveTo(-u * 0.18, top);
    ctx.lineTo(-u * 0.15, top - u * 0.2);
    ctx.lineTo(-u * 0.06, top - u * 0.1);
    ctx.lineTo(0, top - u * 0.24);
    ctx.lineTo(u * 0.07, top - u * 0.1);
    ctx.lineTo(u * 0.16, top - u * 0.2);
    ctx.lineTo(u * 0.18, top);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (topper === "beacon") {
    ctx.strokeStyle = trim;
    ctx.lineWidth = Math.max(1.2, u * 0.012);
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(0, top - u * 0.28);
    ctx.stroke();
    const pulse = 0.65 + Math.sin(time * 6) * 0.35;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255,70,40,${0.35 * pulse})`;
    ctx.beginPath();
    ctx.arc(0, top - u * 0.34, u * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#ff4a2a";
    ctx.beginPath();
    ctx.arc(0, top - u * 0.34, u * 0.034, 0, Math.PI * 2);
    ctx.fill();
  } else if (topper === "dish") {
    ctx.strokeStyle = "#c5ccd4";
    ctx.lineWidth = Math.max(1.2, u * 0.01);
    ctx.beginPath();
    ctx.moveTo(-u * 0.02, top);
    ctx.lineTo(-u * 0.02, top - u * 0.2);
    ctx.stroke();
    ctx.fillStyle = "#dfe7ef";
    ctx.strokeStyle = "#1c2430";
    ctx.lineWidth = Math.max(1, u * 0.008);
    ctx.beginPath();
    ctx.ellipse(-u * 0.02, top - u * 0.26, u * 0.1, u * 0.045, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = eye;
    ctx.beginPath();
    ctx.arc(u * 0.05, top - u * 0.3, u * 0.014, 0, Math.PI * 2);
    ctx.fill();
  } else if (topper === "flagpole") {
    ctx.strokeStyle = "#f3efe6";
    ctx.lineWidth = Math.max(1.2, u * 0.01);
    ctx.beginPath();
    ctx.moveTo(u * 0.12, top);
    ctx.lineTo(u * 0.12, top - u * 0.38);
    ctx.stroke();
    const wave = Math.sin(time * 4) * u * 0.02;
    ctx.fillStyle = "#e0402e";
    ctx.beginPath();
    ctx.moveTo(u * 0.12, top - u * 0.38);
    ctx.lineTo(u * 0.3 + wave, top - u * 0.31);
    ctx.lineTo(u * 0.12, top - u * 0.24);
    ctx.closePath();
    ctx.fill();
  } else if (topper === "pilgrimhat") {
    ctx.fillStyle = "#1c1c22";
    ctx.fillRect(-u * 0.2, top - u * 0.02, u * 0.4, u * 0.035);
    ctx.fillRect(-u * 0.12, top - u * 0.24, u * 0.24, u * 0.22);
    ctx.fillStyle = "#7a4a16";
    ctx.fillRect(-u * 0.12, top - u * 0.09, u * 0.24, u * 0.05);
    ctx.fillStyle = "#f6cd46";
    ctx.fillRect(-u * 0.035, top - u * 0.095, u * 0.07, u * 0.06);
  } else if (topper === "tophat") {
    // Tall black top hat with a gold band. Civic, not a party costume.
    ctx.fillStyle = "#16151a";
    ctx.fillRect(-u * 0.22, top - u * 0.02, u * 0.44, u * 0.035);
    ctx.fillRect(-u * 0.13, top - u * 0.34, u * 0.26, u * 0.32);
    ctx.fillStyle = ELECTION_COLORS.gold;
    ctx.fillRect(-u * 0.13, top - u * 0.1, u * 0.26, u * 0.05);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(-u * 0.1, top - u * 0.33, u * 0.04, u * 0.22);
  } else if (topper === "wreath") {
    ctx.strokeStyle = "#2f6b22";
    ctx.lineWidth = Math.max(1.5, u * 0.045);
    ctx.beginPath();
    ctx.arc(0, top - u * 0.13, u * 0.13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#a31621";
    for (const a of [0.3, 1.8, 3.4, 5.0]) {
      ctx.beginPath();
      ctx.arc(Math.cos(a) * u * 0.13, top - u * 0.13 + Math.sin(a) * u * 0.13, u * 0.028, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawFlag(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  u: number,
  top: number,
  trim: string,
  paint: string,
  name: string,
  time: number,
  charging: boolean,
  facing: number,
) {
  const bx = (-0.38 + (f.treads ? 0.02 : 0)) * u;
  const by = top;
  const height = u * 0.5;
  const sway = Math.sin(time * 2.4) * u * 0.03 + (charging ? -u * 0.12 : 0);
  const tipX = bx + sway - u * 0.05;
  const tipY = by - height;
  ctx.save();
  ctx.strokeStyle = "#a8a298";
  ctx.lineWidth = Math.max(1.5, u * 0.012);
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.quadraticCurveTo(bx, by - height * 0.6, tipX, tipY);
  ctx.stroke();
  ctx.fillStyle = "#1a1918";
  ctx.fillRect(bx - u * 0.02, by - u * 0.03, u * 0.04, u * 0.03);
  // Pennant trails backward from the tip.
  const flutter = Math.sin(time * 7) * u * 0.015;
  const len = u * 0.3;
  const drop = u * 0.12;
  ctx.fillStyle = trim === "#b8b2a6" ? paint : trim;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.quadraticCurveTo(
    tipX - len * 0.5,
    tipY + drop * 0.25 + flutter,
    tipX - len,
    tipY + drop * 0.5 + flutter * 1.5,
  );
  ctx.quadraticCurveTo(tipX - len * 0.5, tipY + drop * 0.75 + flutter, tipX, tipY + drop);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();
  if (name) {
    ctx.save();
    ctx.translate(tipX - len * 0.42, tipY + drop * 0.52 + flutter);
    ctx.scale(Math.sign(facing) || 1, 1);
    ctx.fillStyle = "#0e0d0b";
    ctx.font = `700 ${Math.max(7, u * 0.05)}px Oswald, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = name
      .split(/[\s—-]+/)[0]!
      .toUpperCase()
      .slice(0, 9);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

function spinnerDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  spin: number,
  rev: number,
  teeth: number,
  hot: boolean,
) {
  // Motion blur ring.
  if (rev > 0.3) {
    const g = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 1.08);
    g.addColorStop(0, "rgba(200,200,200,0)");
    g.addColorStop(0.8, `rgba(220,215,205,${0.25 * rev})`);
    g.addColorStop(1, "rgba(220,215,205,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.08, 0, Math.PI * 2);
    ctx.fill();
  }
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, hot ? "#ffd9a0" : "#cfcbc2");
  g.addColorStop(0.55, hot ? "#e07030" : "#7d7a73");
  g.addColorStop(1, hot ? "#8a2a10" : "#34332f");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Teeth with ghost copies for blur.
  const ghosts = rev > 0.5 ? 3 : 1;
  for (let k = 0; k < ghosts; k++) {
    ctx.globalAlpha = k === 0 ? 1 : 0.35 / k;
    ctx.fillStyle = "#d9d5cc";
    for (let i = 0; i < teeth; i++) {
      const a = spin - k * 0.25 + (i / teeth) * Math.PI * 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(r * 0.85, -r * 0.14);
      ctx.lineTo(r * 1.18, -r * 0.02);
      ctx.lineTo(r * 0.95, r * 0.16);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  if (teeth <= 3) {
    // Heavy bar/disc: bevelled rim and lightening holes.
    ctx.strokeStyle = "rgba(20,20,18,0.55)";
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(15,14,13,0.8)";
    for (let i = 0; i < 3; i++) {
      const a = spin + Math.PI / 3 + (i / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r * 0.52, cy + Math.sin(a) * r * 0.52, r * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = "#1c1b19";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8e8a82";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(spin) * r * 0.25, cy + Math.sin(spin) * r * 0.25);
  ctx.lineTo(cx + Math.cos(spin) * r * 0.8, cy + Math.sin(spin) * r * 0.8);
  ctx.stroke();
}

function steel(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, "#e2ddd3");
  g.addColorStop(0.5, "#8e8a82");
  g.addColorStop(1, "#3e3c38");
  return g;
}

function drawFaceMask(ctx: CanvasRenderingContext2D, mask: string | undefined, f: Frame, u: number, top: number) {
  if (!mask || mask === "none") return;
  const vx = (f.front - (f.treads ? 0.2 : 0.36)) * u;
  const vy = top + f.height * u * 0.2;
  ctx.save();
  if (mask === "lantern") {
    ctx.fillStyle = "#e07014";
    ctx.beginPath();
    ctx.ellipse(vx, vy, u * 0.09, u * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a1408";
    ctx.beginPath();
    ctx.moveTo(vx - u * 0.03, vy - u * 0.01);
    ctx.lineTo(vx - u * 0.01, vy + u * 0.02);
    ctx.lineTo(vx - u * 0.05, vy + u * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(vx + u * 0.03, vy - u * 0.01);
    ctx.lineTo(vx + u * 0.05, vy + u * 0.02);
    ctx.lineTo(vx + u * 0.01, vy + u * 0.02);
    ctx.closePath();
    ctx.fill();
  } else if (mask === "hockey") {
    ctx.fillStyle = "#f4f1ea";
    ctx.beginPath();
    ctx.roundRect(vx - u * 0.07, vy - u * 0.05, u * 0.14, u * 0.1, u * 0.03);
    ctx.fill();
    ctx.fillStyle = "#1b1a18";
    for (const ox of [-0.03, 0, 0.03]) ctx.fillRect(vx + ox * u, vy - u * 0.02, u * 0.012, u * 0.04);
  }
  ctx.restore();
}

function drawPumpkinShell(ctx: CanvasRenderingContext2D, f: Frame, u: number) {
  const b = hullBounds(f);
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = "#e07014";
  ctx.lineWidth = Math.max(1, u * 0.02);
  for (let i = 1; i <= 3; i++) {
    const x = lerp(b.minX, b.maxX, i / 4) * u;
    ctx.beginPath();
    ctx.moveTo(x, b.top * u);
    ctx.quadraticCurveTo(x, (b.top + b.bottom) * 0.5 * u, x, b.bottom * u);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTableShell(ctx: CanvasRenderingContext2D, f: Frame, u: number) {
  const b = hullBounds(f);
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = "#b06a28";
  ctx.lineWidth = Math.max(1, u * 0.02);
  // A flat feast-table top across the hull, with two legs.
  const topY = (b.top + (b.bottom - b.top) * 0.18) * u;
  ctx.beginPath();
  ctx.moveTo(b.minX * u, topY);
  ctx.lineTo(b.maxX * u, topY);
  ctx.stroke();
  for (const t of [0.18, 0.82]) {
    const x = lerp(b.minX, b.maxX, t) * u;
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x, b.bottom * u);
    ctx.stroke();
  }
  ctx.restore();
}

function drawChaserLamps(ctx: CanvasRenderingContext2D, f: Frame, u: number, top: number) {
  ctx.save();
  ctx.fillStyle = "#f3efe6";
  ctx.fillRect(-0.12 * u, top - 0.04 * u, 0.24 * u, 0.02 * u);
  for (const [x, color] of [[-0.08, "#ffe9a8"], [0.08, "#fff"]] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x * u, top - 0.03 * u, 0.025 * u, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHockeyMachete(ctx: CanvasRenderingContext2D, f: Frame, u: number) {
  const fx = f.front * u;
  const cy = f.deck * u * 0.55;
  ctx.save();
  ctx.translate(fx, cy);
  ctx.fillStyle = "#d7d2c8";
  ctx.beginPath();
  ctx.moveTo(0, -0.04 * u);
  ctx.lineTo(0.42 * u, -0.015 * u);
  ctx.lineTo(0.46 * u, 0.02 * u);
  ctx.lineTo(0.08 * u, 0.045 * u);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f4f1ea";
  ctx.beginPath();
  ctx.ellipse(0.5 * u, -0.01 * u, 0.055 * u, 0.07 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1b1a18";
  ctx.fillRect(0.47 * u, -0.03 * u, 0.012 * u, 0.04 * u);
  ctx.fillRect(0.5 * u, -0.03 * u, 0.012 * u, 0.04 * u);
  ctx.restore();
}

function drawHalloweenWeapon(ctx: CanvasRenderingContext2D, fam: string, f: Frame, u: number, spin: number, stroke: number) {
  const fx = f.front * u;
  const cy = f.deck * u * 0.5;
  ctx.save();
  if (fam === "chainsaw") {
    ctx.translate(fx - 0.05 * u, cy);
    ctx.rotate(lerp(-0.2, 0.15, stroke));
    ctx.fillStyle = "#3a3834";
    ctx.fillRect(0, -0.04 * u, 0.22 * u, 0.08 * u);
    ctx.fillStyle = "#c5bfb4";
    ctx.fillRect(0.18 * u, -0.025 * u, 0.34 * u, 0.05 * u);
    ctx.fillStyle = "#f3efe6";
    const tooth = 0.04 * u;
    for (let i = 0; i < 6; i++) {
      const shift = (spin % tooth);
      ctx.fillRect(0.2 * u + i * tooth - shift, -0.04 * u, tooth * 0.45, 0.08 * u);
    }
  } else if (fam === "slasher") {
    ctx.fillStyle = "#e8e4dc";
    ctx.beginPath();
    ctx.moveTo(fx, cy - 0.02 * u);
    ctx.lineTo(fx + 0.48 * u, cy);
    ctx.lineTo(fx, cy + 0.02 * u);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2a241c";
    ctx.fillRect(fx - 0.06 * u, cy - 0.025 * u, 0.08 * u, 0.05 * u);
  } else if (fam === "ghost") {
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = "#d9ffe4";
    ctx.beginPath();
    ctx.moveTo(fx, cy - 0.03 * u);
    ctx.lineTo(fx + 0.4 * u, cy);
    ctx.lineTo(fx, cy + 0.03 * u);
    ctx.closePath();
    ctx.fill();
  } else if (fam === "launcher") {
    ctx.strokeStyle = "#6b4a28";
    ctx.lineWidth = 0.03 * u;
    ctx.beginPath();
    ctx.moveTo(fx, cy);
    ctx.lineTo(fx + 0.28 * u, cy - 0.16 * u);
    ctx.stroke();
    ctx.fillStyle = "#e07014";
    ctx.beginPath();
    ctx.arc(fx + 0.34 * u, cy - 0.2 * u, 0.07 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2f6b22";
    ctx.fillRect(fx + 0.32 * u, cy - 0.3 * u, 0.03 * u, 0.05 * u);
  } else if (fam === "bones") {
    ctx.strokeStyle = "#f3efe6";
    ctx.lineWidth = 0.02 * u;
    ctx.lineCap = "round";
    for (const y of [-0.08, 0.08]) {
      ctx.beginPath();
      ctx.moveTo(fx, cy + y * u);
      ctx.quadraticCurveTo(fx + 0.16 * u, cy + y * u * 1.4, fx + 0.32 * u, cy + y * 0.2 * u);
      ctx.stroke();
    }
  } else if (fam === "broom") {
    ctx.strokeStyle = "#8a5a32";
    ctx.lineWidth = 0.025 * u;
    ctx.beginPath();
    ctx.moveTo(fx, cy + 0.08 * u);
    ctx.lineTo(fx + 0.08 * u, cy - 0.28 * u);
    ctx.stroke();
    ctx.strokeStyle = "#c4a15a";
    ctx.lineWidth = 0.012 * u;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(fx + 0.08 * u, cy - 0.28 * u);
      ctx.lineTo(fx + 0.2 * u, cy - 0.34 * u + i * 0.03 * u);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function weaponBack(ctx: CanvasRenderingContext2D, s: BotState, f: Frame, u: number, spin: number) {
  const fam = s.bot.weaponFamily;
  if (fam === "hammer") {
    // Arm pivots on the deck. Rest: cocked up and back. Stroke: slammed forward.
    const rest = -2.3;
    const hit = 0.18;
    const a = lerp(rest, hit, s.stroke);
    const px = -0.05 * u;
    const py = f.deck * u - 0.02 * u;
    const len = 0.62 * u;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.fillStyle = steel(ctx, 0, -0.03 * u, 0, 0.03 * u);
    ctx.fillRect(0, -0.025 * u, len, 0.05 * u);
    ctx.fillStyle = "#3a3834";
    ctx.fillRect(len - 0.04 * u, -0.1 * u, 0.12 * u, 0.2 * u);
    ctx.fillStyle = s.stroke > 0.8 ? "#ff8a3a" : "#c9c4ba";
    ctx.fillRect(len + 0.06 * u, -0.07 * u, 0.04 * u, 0.14 * u);
    ctx.restore();
    ctx.fillStyle = "#26241f";
    ctx.beginPath();
    ctx.arc(px, py, 0.05 * u, 0, Math.PI * 2);
    ctx.fill();
  } else if (fam === "axe") {
    // Cherry Tree Axe: the hammer's overhead chop on a wood handle with a steel bit.
    // Rests raised over the deck so the bit reads; chops down and forward.
    const a = lerp(-0.5, 0.35, s.stroke);
    const px = -0.12 * u;
    const py = f.deck * u - 0.02 * u;
    const len = 0.46 * u;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.fillStyle = "#7b4a2a";
    ctx.fillRect(0, -0.022 * u, len, 0.044 * u);
    ctx.fillStyle = steel(ctx, len - 0.05 * u, -0.14 * u, len + 0.1 * u, 0.06 * u);
    ctx.beginPath();
    ctx.moveTo(len - 0.06 * u, -0.05 * u);
    ctx.lineTo(len + 0.04 * u, -0.15 * u);
    ctx.quadraticCurveTo(len + 0.13 * u, -0.05 * u, len + 0.04 * u, 0.06 * u);
    ctx.lineTo(len - 0.06 * u, 0.03 * u);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = s.stroke > 0.8 ? "#ffd27a" : "#efe8da";
    ctx.lineWidth = Math.max(1, 0.012 * u);
    ctx.beginPath();
    ctx.moveTo(len + 0.04 * u, -0.15 * u);
    ctx.quadraticCurveTo(len + 0.13 * u, -0.05 * u, len + 0.04 * u, 0.06 * u);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#26241f";
    ctx.beginPath();
    ctx.arc(px, py, 0.05 * u, 0, Math.PI * 2);
    ctx.fill();
  } else if (fam === "saw") {
    const a = lerp(-0.55, 0.28, s.stroke);
    const px = -0.12 * u;
    const py = f.deck * u - 0.02 * u;
    const len = 0.58 * u;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.fillStyle = steel(ctx, 0, -0.03 * u, 0, 0.03 * u);
    ctx.beginPath();
    ctx.roundRect(0, -0.035 * u, len, 0.07 * u, 0.02 * u);
    ctx.fill();
    spinnerDisc(ctx, len, 0, 0.16 * u, spin, s.rev, 14, s.stroke > 0.7);
    ctx.restore();
    ctx.fillStyle = "#26241f";
    ctx.beginPath();
    ctx.arc(px, py, 0.05 * u, 0, Math.PI * 2);
    ctx.fill();
  }
}

function weaponFront(
  ctx: CanvasRenderingContext2D,
  s: BotState,
  f: Frame,
  u: number,
  spin: number,
  dark: string,
) {
  const fam = s.bot.weaponFamily;
  const fx = f.front * u;
  const skin = styleOf(s.bot).weaponSkin;
  if (skin === "hockey-machete") {
    drawHockeyMachete(ctx, f, u);
    return;
  }
  if (fam === "chainsaw" || fam === "slasher" || fam === "ghost" || fam === "launcher" || fam === "bones" || fam === "broom") {
    drawHalloweenWeapon(ctx, fam, f, u, spin, s.stroke);
    return;
  }
  if (fam === "flip") {
    const hx = fx - 0.12 * u;
    const hy = f.deck * u * 0.55;
    const a = lerp(0.38, -1.25, s.stroke);
    // Ram.
    ctx.strokeStyle = "#b8b2a6";
    ctx.lineWidth = 0.03 * u;
    ctx.beginPath();
    ctx.moveTo(hx - 0.1 * u, -0.08 * u);
    ctx.lineTo(hx + Math.cos(a) * 0.22 * u, hy + Math.sin(a) * 0.22 * u);
    ctx.stroke();
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(a);
    ctx.fillStyle = steel(ctx, 0, -0.03 * u, 0, 0.03 * u);
    ctx.beginPath();
    ctx.moveTo(0, -0.03 * u);
    ctx.lineTo(0.46 * u, -0.012 * u);
    ctx.lineTo(0.5 * u, 0.012 * u);
    ctx.lineTo(0, 0.03 * u);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(hx, hy, 0.04 * u, 0, Math.PI * 2);
    ctx.fill();
  } else if (fam === "wedge") {
    const lift = s.stroke * 0.05;
    ctx.fillStyle = steel(ctx, fx, f.deck * u * 0.6, fx + 0.3 * u, 0);
    ctx.beginPath();
    ctx.moveTo(fx - 0.06 * u, f.deck * u * 0.62 - lift * u);
    ctx.lineTo(fx + 0.34 * u, -0.006 * u - lift * u);
    ctx.lineTo(fx + 0.34 * u, 0);
    ctx.lineTo(fx - 0.06 * u, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Forks.
    ctx.fillStyle = "#e8e4dc";
    ctx.fillRect(fx + 0.3 * u, -0.01 * u - lift * u, 0.1 * u, 0.01 * u);
  } else if (fam === "disc") {
    const cx = fx + 0.1 * u;
    const cy = f.deck * u * 0.62;
    ctx.fillStyle = "#3a3834";
    ctx.beginPath();
    ctx.moveTo(fx - 0.1 * u, cy - 0.04 * u);
    ctx.lineTo(cx, cy - 0.03 * u);
    ctx.lineTo(cx, cy + 0.03 * u);
    ctx.lineTo(fx - 0.1 * u, cy + 0.05 * u);
    ctx.fill();
    spinnerDisc(
      ctx,
      cx,
      cy,
      Math.min(0.21 * u, Math.abs(cy) * 0.95),
      spin,
      s.rev,
      2,
      s.stroke > 0.5,
    );
  } else if (fam === "drum") {
    const r = 0.13 * u;
    const cx = fx + 0.06 * u;
    const cy = -r - 0.02 * u;
    ctx.fillStyle = "#3a3834";
    ctx.fillRect(fx - 0.12 * u, cy - 0.03 * u, 0.18 * u, 0.06 * u);
    spinnerDisc(ctx, cx, cy, r, spin, s.rev, 3, s.stroke > 0.5);
  } else if (fam === "flail" || fam === "chainsaw") {
    const a = lerp(fam === "flail" ? -1.1 : -0.4, fam === "flail" ? 0.9 : 0.35, s.stroke);
    ctx.save();
    ctx.translate(fx - 0.08 * u, f.deck * u * 0.7);
    ctx.rotate(a);
    ctx.strokeStyle = fam === "chainsaw" ? "#d7d2c8" : "#8a847a";
    ctx.lineWidth = fam === "chainsaw" ? 0.045 * u : 0.02 * u;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0.42 * u, 0);
    ctx.stroke();
    if (fam === "flail") {
      ctx.translate(0.46 * u, Math.sin(spin * 2) * 0.06 * u);
      ctx.fillStyle = s.stroke > 0.6 ? "#ff8a3a" : "#cfcac0";
      ctx.beginPath();
      ctx.arc(0, 0, 0.09 * u, 0, Math.PI * 2);
      ctx.fill();
    } else {
      spinnerDisc(ctx, 0.48 * u, 0, 0.1 * u, spin, s.rev, 10, s.stroke > 0.5);
    }
    ctx.restore();
  } else if (fam === "piston") {
    const ext = s.stroke * 0.28 * u;
    ctx.fillStyle = "#3a3834";
    ctx.fillRect(fx - 0.04 * u, f.deck * u * 0.45, 0.22 * u, 0.08 * u);
    ctx.fillStyle = steel(ctx, fx, 0, fx + 0.4 * u, 0);
    ctx.fillRect(fx + 0.12 * u, f.deck * u * 0.47, 0.18 * u + ext, 0.045 * u);
    ctx.fillStyle = "#f3efe6";
    ctx.beginPath();
    ctx.moveTo(fx + 0.28 * u + ext, f.deck * u * 0.42);
    ctx.lineTo(fx + 0.46 * u + ext, f.deck * u * 0.49);
    ctx.lineTo(fx + 0.28 * u + ext, f.deck * u * 0.56);
    ctx.fill();
  } else if (fam === "flame") {
    ctx.fillStyle = "#2a2420";
    ctx.fillRect(fx - 0.02 * u, f.deck * u * 0.4, 0.28 * u, 0.1 * u);
    ctx.fillStyle = "#ff6a1f";
    ctx.beginPath();
    ctx.arc(fx + 0.28 * u, f.deck * u * 0.45, 0.035 * u, 0, Math.PI * 2);
    ctx.fill();
    drawFlame(ctx, fx + 0.3 * u, f.deck * u * 0.45, u, 0.35 + s.stroke * 0.65, spin);
  } else if (fam === "tesla") {
    ctx.strokeStyle = "#7ec8ff";
    ctx.lineWidth = Math.max(1, u * 0.02);
    ctx.beginPath();
    ctx.moveTo(fx, f.deck * u * 0.35);
    ctx.lineTo(fx + 0.16 * u, f.deck * u * 0.15);
    ctx.stroke();
    const glow = 0.5 + Math.sin(spin * 3) * 0.5;
    ctx.strokeStyle = `rgba(180,230,255,${0.35 + glow * 0.55})`;
    ctx.beginPath();
    ctx.arc(fx + 0.16 * u, f.deck * u * 0.12, 0.06 * u + glow * 0.02 * u, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = spin + i * 2.1;
      ctx.beginPath();
      ctx.moveTo(fx + 0.16 * u, f.deck * u * 0.12);
      ctx.lineTo(
        fx + 0.16 * u + Math.cos(a) * 0.16 * u,
        f.deck * u * 0.12 + Math.sin(a) * 0.08 * u,
      );
      ctx.stroke();
    }
  } else if (fam === "claw") {
    // Lower jaw on the floor, upper jaw bites down.
    ctx.fillStyle = steel(ctx, fx, -0.1 * u, fx, 0);
    ctx.beginPath();
    ctx.moveTo(fx - 0.04 * u, -0.1 * u);
    ctx.lineTo(fx + 0.32 * u, -0.02 * u);
    ctx.lineTo(fx + 0.32 * u, -0.005 * u);
    ctx.lineTo(fx - 0.04 * u, -0.02 * u);
    ctx.closePath();
    ctx.fill();
    const a = lerp(-0.55, 0.22, s.stroke);
    const px = fx - 0.06 * u;
    const py = f.deck * u * 0.85;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.fillStyle = steel(ctx, 0, -0.03 * u, 0, 0.04 * u);
    ctx.beginPath();
    ctx.moveTo(0, -0.03 * u);
    ctx.lineTo(0.36 * u, -0.02 * u);
    ctx.lineTo(0.42 * u, 0.1 * u);
    ctx.lineTo(0.36 * u, 0.04 * u);
    ctx.lineTo(0, 0.035 * u);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(px, py, 0.045 * u, 0, Math.PI * 2);
    ctx.fill();
  } else if (fam !== "hammer" && fam !== "axe" && fam !== "saw" && fam !== "hidden" && fam !== "none") {
    // Ram spike.
    const cy = f.deck * u * 0.5;
    ctx.fillStyle = steel(ctx, fx, cy - 0.05 * u, fx, cy + 0.05 * u);
    ctx.beginPath();
    ctx.moveTo(fx - 0.02 * u, cy - 0.06 * u);
    ctx.lineTo(fx + 0.26 * u, cy);
    ctx.lineTo(fx - 0.02 * u, cy + 0.06 * u);
    ctx.closePath();
    ctx.fill();
  }
}

function drawFlame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  u: number,
  amt: number,
  time: number,
) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const len = u * 0.9 * amt;
  for (let i = 0; i < 14; i++) {
    const t = i / 14;
    const wob = Math.sin(time * 40 + i * 1.7) * u * 0.02;
    const cx = x + len * t;
    const cy = y + wob - Math.sin(t * Math.PI) * u * 0.05;
    const r = u * (0.05 + t * 0.14) * amt;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(
      0,
      `rgba(255,${Math.round(240 - t * 150)},${Math.round(160 - t * 150)},${0.55 * (1 - t * 0.6)})`,
    );
    g.addColorStop(1, "rgba(255,60,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function facingOf(heading: number) {
  const c = Math.cos(heading);
  const mag = clamp(Math.abs(c) * 1.6, 0.62, 1);
  return (c >= 0 ? 1 : -1) * mag;
}

/* ------------------------------------------------------------------ */
/* Side camera: frame                                                  */
/* ------------------------------------------------------------------ */

export type SideOpts = {
  title: "bumper" | "decision" | null;
  word: string;
  hype: number;
  reduced: boolean;
  shake: number;
  /** 3, 2, 1, 0 = FIGHT, with 0..1 progress through that count. */
  countdown?: { n: number; t: number } | null;
  /** Slow-motion replay: letterbox, tint, banner. */
  replay?: boolean;
  /** 0..1 progress of the K.O. stamp. */
  ko?: number | null;
  /** 0..1 how close someone is to dying: red alarm lights. */
  alarm?: number;
  /** Round banner at the top of a trade. */
  round?: { n: number; t: number } | null;
  /** Combo call: same bot landing again and again. */
  combo?: { n: number; t: number; color: string } | null;
  /** Week 3 only: side flame jets and the front pop-up saw. */
  hazards?: boolean;
  /** Store-colored light beams during a walk-out. */
  beams?: string | null;
  /** Green ooze on a win. Week 1 tapes stay festive after the decorations come down. */
  festive?: boolean;
  /** 0..1 slow-motion zoom-and-hold on the finishing blow. */
  finish?: number;
};

function drawInstalledSide(
  ctx: CanvasRenderingContext2D,
  s: BotState,
  f: Frame,
  u: number,
  top: number,
  time: number,
) {
  const chassis = s.bot.chassisFamily;
  const armor = s.bot.armorFamily;
  const drive = s.bot.driveFamily;
  const utility = s.bot.utilityFamily;
  const pulse = 0.5 + Math.sin(time * 4 + hash(s.bot.id)) * 0.5;

  if (utility === "veil") {
    ctx.save();
    ctx.globalAlpha = 0.28 + pulse * 0.12;
    ctx.translate(-0.18 * u, -0.04 * u);
    ctx.fillStyle = "rgba(210,230,255,0.9)";
    poly(ctx, f.hull, u * 0.92);
    ctx.fill();
    ctx.restore();
  }
  if (chassis === "hover" || drive === "air") {
    ctx.fillStyle = `rgba(120,210,255,${0.18 + pulse * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(0, 0.02 * u, 0.55 * u, 0.06 * u, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (chassis === "spring") {
    ctx.strokeStyle = "#d7d2c8";
    ctx.lineWidth = Math.max(1, u * 0.03);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const x = -0.42 * u + i * 0.04 * u;
      ctx.lineTo(x, (-0.08 - (i % 2) * 0.08) * u);
    }
    ctx.stroke();
  }
  if (chassis === "skeleton") {
    ctx.strokeStyle = "rgba(243,239,230,0.7)";
    ctx.lineWidth = Math.max(1, u * 0.012);
    for (const y of [0.2, 0.45, 0.7]) {
      ctx.beginPath();
      ctx.moveTo(-0.28 * u, top + f.height * u * y);
      ctx.lineTo(0.22 * u, top + f.height * u * y);
      ctx.stroke();
    }
  }
  const batteryShapes = [
    "sprinter",
    "hornet",
    "hybrid",
    "dynamo",
    "scorpion",
    "crab",
    "capacitor",
    "mule",
    "monolith",
    "reactor",
  ];
  if (chassis && batteryShapes.includes(chassis)) {
    const cells =
      chassis === "reactor" ? 6 : chassis === "monolith" || chassis === "capacitor" ? 5 : 4;
    for (let i = 0; i < cells; i++) {
      ctx.fillStyle = i / cells < pulse ? "#7dffb2" : "#1c3a28";
      ctx.fillRect(-0.36 * u + i * 0.07 * u, top + 0.04 * u, 0.05 * u, 0.08 * u);
    }
    if (chassis === "hornet" || chassis === "scorpion") {
      ctx.fillStyle = shade("#111", 40);
      ctx.beginPath();
      ctx.moveTo(0.2 * u, top);
      ctx.lineTo(0.55 * u, top + 0.08 * u);
      ctx.lineTo(0.2 * u, top + 0.16 * u);
      ctx.fill();
    }
    if (chassis === "crab") {
      ctx.strokeStyle = "#cfcac0";
      ctx.lineWidth = Math.max(1, u * 0.02);
      ctx.beginPath();
      ctx.moveTo(-0.2 * u, -0.02 * u);
      ctx.lineTo(-0.45 * u, -0.16 * u);
      ctx.moveTo(0.2 * u, -0.02 * u);
      ctx.lineTo(0.48 * u, -0.16 * u);
      ctx.stroke();
    }
    if (chassis === "monolith" || chassis === "mule") {
      ctx.fillStyle = "rgba(20,20,18,0.35)";
      ctx.fillRect(-0.42 * u, top, 0.84 * u, f.height * u * 0.25);
    }
    if (chassis === "reactor") {
      ctx.fillStyle = `rgba(120,255,170,${0.25 + pulse * 0.35})`;
      ctx.beginPath();
      ctx.arc(-0.05 * u, top + f.height * u * 0.45, 0.08 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (armor === "ablative") {
    ctx.strokeStyle = "rgba(230,224,212,0.8)";
    ctx.lineWidth = Math.max(1, u * 0.01);
    ctx.strokeRect(-0.4 * u, top + 0.04 * u, 0.7 * u, f.height * u * 0.55);
  } else if (armor === "gel") {
    ctx.fillStyle = "rgba(80,180,255,0.28)";
    ctx.beginPath();
    ctx.ellipse(0.05 * u, top + f.height * u * 0.4, 0.32 * u, 0.12 * u, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (armor === "chain") {
    ctx.strokeStyle = "rgba(180,180,170,0.7)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.strokeRect(
        -0.3 * u + (i % 2) * 0.08 * u,
        top + 0.06 * u + i * 0.05 * u,
        0.12 * u,
        0.04 * u,
      );
    }
  } else if (armor === "spike") {
    ctx.fillStyle = "#d7d2c8";
    for (const x of [-0.2, 0.05, 0.28]) {
      ctx.beginPath();
      ctx.moveTo(x * u, top + 0.02 * u);
      ctx.lineTo((x + 0.04) * u, top - 0.08 * u);
      ctx.lineTo((x + 0.08) * u, top + 0.02 * u);
      ctx.fill();
    }
  } else if (armor === "ceramic") {
    ctx.fillStyle = "rgba(243,239,230,0.35)";
    ctx.fillRect(-0.22 * u, top + 0.08 * u, 0.28 * u, 0.16 * u);
    ctx.strokeStyle = "#f3efe6";
    ctx.strokeRect(-0.22 * u, top + 0.08 * u, 0.28 * u, 0.16 * u);
  } else if (armor === "magnet") {
    ctx.strokeStyle = `rgba(90,170,255,${0.35 + pulse * 0.4})`;
    ctx.lineWidth = Math.max(1, u * 0.015);
    ctx.beginPath();
    ctx.ellipse(0, top + f.height * u * 0.45, 0.4 * u, 0.16 * u, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (armor === "reactive") {
    ctx.fillStyle = s.hp < 70 ? "#ff6a1f" : "#6a3a28";
    for (const x of [-0.25, 0, 0.25]) ctx.fillRect(x * u, top + 0.1 * u, 0.06 * u, 0.06 * u);
  }
  if (drive === "swerve") {
    ctx.fillStyle = "#1a1a18";
    ctx.beginPath();
    ctx.arc(-0.15 * u, -0.02 * u, 0.05 * u, 0, Math.PI * 2);
    ctx.arc(0.22 * u, -0.02 * u, 0.05 * u, 0, Math.PI * 2);
    ctx.fill();
  } else if (drive === "rocket") {
    ctx.fillStyle = `rgba(255,140,40,${0.3 + pulse * 0.5})`;
    ctx.beginPath();
    ctx.moveTo(-0.48 * u, -0.04 * u);
    ctx.lineTo(-0.68 * u, 0.02 * u);
    ctx.lineTo(-0.48 * u, 0.08 * u);
    ctx.fill();
  } else if (drive === "anchor") {
    ctx.fillStyle = "#8e8a82";
    ctx.fillRect(-0.04 * u, -0.02 * u, 0.08 * u, 0.14 * u);
  } else if (drive === "chaser") {
    ctx.fillStyle = "rgba(180,255,220,0.45)";
    ctx.fillRect(0.3 * u, top + 0.02 * u, 0.08 * u, 0.12 * u);
  }
  if (utility === "spotlight" || utility === "uv") {
    ctx.fillStyle = utility === "uv" ? "rgba(120,80,255,0.85)" : "rgba(255,230,140,0.9)";
    ctx.beginPath();
    ctx.arc(0.34 * u, top + 0.02 * u, 0.035 * u, 0, Math.PI * 2);
    ctx.fill();
  } else if (utility === "decoy" || utility === "smoke") {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = utility === "smoke" ? "#9aa0a8" : "#d7d2c8";
    ctx.fillRect(0.4 * u, top + 0.1 * u, 0.12 * u, 0.08 * u);
    ctx.globalAlpha = 1;
  }
}

function drawInstalledTop(
  ctx: CanvasRenderingContext2D,
  s: BotState,
  len: number,
  wid: number,
  time: number,
) {
  const chassis = s.bot.chassisFamily;
  const utility = s.bot.utilityFamily;
  const drive = s.bot.driveFamily;
  const armor = s.bot.armorFamily;
  const pulse = 0.5 + Math.sin(time * 4) * 0.5;
  if (utility === "veil") {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.translate(-len * 0.12, wid * 0.08);
    ctx.fillStyle = "rgba(200,230,255,0.8)";
    ctx.beginPath();
    ctx.ellipse(0, 0, len * 0.42, wid * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (chassis === "hover" || drive === "air") {
    ctx.strokeStyle = `rgba(120,210,255,${0.35 + pulse * 0.4})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(-len * 0.55, -wid * 0.7, len * 1.1, wid * 1.4);
  }
  if (chassis === "spring") {
    ctx.strokeStyle = "#d7d2c8";
    ctx.beginPath();
    ctx.arc(-len * 0.35, 0, wid * 0.22, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (chassis === "skeleton") {
    ctx.strokeStyle = "rgba(243,239,230,0.65)";
    ctx.strokeRect(-len * 0.3, -wid * 0.28, len * 0.5, wid * 0.56);
  }
  if (armor === "spike") {
    ctx.fillStyle = "#e2ddd3";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, side * wid * 0.45);
      ctx.lineTo(len * 0.08, side * wid * 0.7);
      ctx.lineTo(-len * 0.08, side * wid * 0.45);
      ctx.fill();
    }
  } else if (armor === "magnet" || armor === "reactive") {
    ctx.strokeStyle = armor === "magnet" ? "rgba(90,170,255,0.7)" : "rgba(255,120,40,0.7)";
    ctx.beginPath();
    ctx.arc(0, 0, wid * (0.55 + pulse * 0.08), 0, Math.PI * 2);
    ctx.stroke();
  }
  if (drive === "anchor") {
    ctx.fillStyle = "#8e8a82";
    ctx.beginPath();
    ctx.arc(0, 0, wid * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawArenaFloor(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
  const pit = project({ x: 0.5, y: 0.62 }, w, h);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.ellipse(pit.x, pit.y, pit.size * 0.28, pit.size * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f0a202";
  ctx.lineWidth = Math.max(1, pit.size * 0.012);
  ctx.stroke();
  const water = project({ x: 0.5, y: 0.38 }, w, h);
  const wash = ctx.createLinearGradient(
    water.x - water.size,
    water.y,
    water.x + water.size,
    water.y,
  );
  wash.addColorStop(0, "rgba(40,120,180,0)");
  wash.addColorStop(0.5, "rgba(70,160,210,0.35)");
  wash.addColorStop(1, "rgba(40,120,180,0)");
  ctx.fillStyle = wash;
  ctx.fillRect(
    water.x - water.size * 1.4,
    water.y - water.size * 0.08,
    water.size * 2.8,
    water.size * 0.16,
  );
  for (const spot of [
    { x: 0.18, y: 0.78 },
    { x: 0.82, y: 0.78 },
  ]) {
    const saw = project(spot, w, h);
    ctx.save();
    ctx.translate(saw.x, saw.y);
    ctx.rotate(time * 6);
    ctx.fillStyle = "#c9c4ba";
    ctx.beginPath();
    const r = saw.size * 0.12;
    for (let t = 0; t < 16; t++) {
      const a = (t / 16) * Math.PI * 2;
      const rr = t % 2 === 0 ? r : r * 0.78;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.35);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawArenaTop(
  ctx: CanvasRenderingContext2D,
  g: { x0: number; y0: number; s: number },
  time: number,
) {
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(g.x0 + g.s * 0.5, g.y0 + g.s * 0.58, g.s * 0.08, g.s * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f0a202";
  ctx.stroke();
  ctx.fillStyle = "rgba(70,160,210,0.28)";
  ctx.fillRect(g.x0 + g.s * 0.08, g.y0 + g.s * 0.3, g.s * 0.84, g.s * 0.08);
  for (const [x, y] of [
    [0.16, 0.78],
    [0.84, 0.78],
  ] as const) {
    ctx.save();
    ctx.translate(g.x0 + g.s * x, g.y0 + g.s * y);
    ctx.rotate(time * 6);
    ctx.fillStyle = "#c9c4ba";
    ctx.beginPath();
    const r = g.s * 0.035;
    for (let t = 0; t < 12; t++) {
      const a = (t / 12) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * (t % 2 ? r * 0.7 : r), Math.sin(a) * (t % 2 ? r * 0.7 : r));
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

export function drawSide(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  drive: Drive,
  fx: Fx,
  time: number,
  dt: number,
  opts: SideOpts,
) {
  // Camera: drift toward the action, tighten on the hit.
  const pts = drive.bots.filter((b) => b.gone < 1).map((b) => project(b.spot, w, h));
  const focus = project(drive.focus, w, h);
  const spread =
    pts.length > 1 ? Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x)) : w * 0.3;
  const wantZ = opts.reduced
    ? 1
    : clamp(1 + drive.tight * 0.32 - clamp(spread / w - 0.3, 0, 0.5) * 0.4 + clamp(0.24 - spread / w, 0, 0.24) * 0.6, 1, 1.42) +
      fx.punch * 0.28 +
      (opts.replay ? 0.18 : 0) +
      (opts.finish ?? 0) * 0.32;
  const wantX = lerp(w / 2, focus.x, 0.55);
  const wantY = lerp(h * 0.55, focus.y - focus.size * 0.3, 0.45);
  const cam = fx.cam;
  if (!cam.ready) {
    cam.x = wantX;
    cam.y = wantY;
    cam.z = wantZ;
    cam.ready = true;
  }
  const k = 1 - Math.exp(-dt * 2.2);
  cam.x = lerp(cam.x, wantX, k);
  cam.y = lerp(cam.y, wantY, k);
  cam.z = lerp(cam.z, wantZ, 1 - Math.exp(-dt * (wantZ > cam.z ? (fx.punch > 0.2 || (opts.finish ?? 0) > 0 ? 14 : 4) : 1.5)));
  const half = w / 2 / cam.z;
  const halfH = h / 2 / cam.z;
  const cx = clamp(cam.x, half, w - half);
  const cy = clamp(cam.y, halfH, h - halfH);

  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.translate(
    w / 2 + (Math.random() - 0.5) * opts.shake,
    h / 2 + (Math.random() - 0.5) * opts.shake,
  );
  ctx.scale(cam.z, cam.z);
  ctx.translate(-cx, -cy);
  ctx.drawImage(backdrop(ctx, w, h), 0, 0);
  const festive = Boolean(opts.festive || halloweenVisuals() || thanksgivingVisuals());
  if (drive.bots.some((bot) => bot.bot.shows?.includes("fog"))) drawRingFog(ctx, w, h, time, opts.reduced);
  if (drive.bots.some((bot) => bot.bot.shows?.includes("leaves"))) drawFallingLeaves(ctx, w, h, time, opts.reduced);
  // Contact light belongs on the steel and floor, with falloff at arena scale.
  if (drive.impact && fx.flash > 0 && !opts.reduced) {
    const hit = project(drive.impact, w, h);
    const glow = ctx.createRadialGradient(hit.x, hit.y - hit.size * 0.22, 0, hit.x, hit.y - hit.size * 0.22, hit.size * 1.6);
    glow.addColorStop(0, `rgba(255,222,165,${fx.flash * 0.45})`);
    glow.addColorStop(1, "rgba(255,135,40,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(hit.x - hit.size * 2, hit.y - hit.size * 2, hit.size * 4, hit.size * 3);
  }
  if (!opts.reduced) crowdFlashes(ctx, w, h, time, opts.hype + (opts.ko ? 1 : 0));
  drawArenaFloor(ctx, w, h, time);
  if (opts.hazards) drawHazards(ctx, w, h, fx, time, dt, opts.reduced);
  drawWreck(ctx, fx.wreck);

  // Emitters: smoke from the hurt, dust from the charge, fire from the burnt.
  const order = [...drive.bots].sort((p, q) => p.spot.y - q.spot.y);
  for (const s of order) {
    const p = project(s.spot, w, h);
    const hurt = 1 - clamp(s.hp / 100, 0, 1);
    const facing = facingOf(s.heading);
    if (!opts.reduced && s.gone < 0.5) {
      const rate = s.dead ? 14 : hurt > 0.5 ? (hurt - 0.5) * 18 : 0;
      for (let i = fx.tick(`smoke-${s.bot.id}`, rate, dt); i > 0; i--) {
        fx.smoke(
          "side",
          p.x - facing * p.size * 0.1,
          p.y - p.size * (0.3 + s.lift),
          p.size * 1.4,
          s.dead || hurt > 0.75,
          s.dead,
        );
      }
      if (s.dead && s.hp <= 0) {
        for (let i = fx.tick(`fire-${s.bot.id}`, 10, dt); i > 0; i--) {
          fx.fire(
            "side",
            p.x + (Math.random() - 0.5) * p.size * 0.4,
            p.y - p.size * 0.3,
            (Math.random() - 0.5) * 20,
            -p.size * 1.2,
            p.size * (0.06 + Math.random() * 0.08),
          );
        }
      }
      if (!s.dead && s.hp > 0 && s.hp < 25 && (s.rise ?? 1) >= 1) {
        // Running on fumes: a small fire in the hull.
        for (let i = fx.tick(`lowfire-${s.bot.id}`, 7, dt); i > 0; i--) {
          fx.fire("side", p.x + (Math.random() - 0.5) * p.size * 0.3, p.y - p.size * (0.35 + s.lift), (Math.random() - 0.5) * 12, -p.size * 0.9, p.size * (0.05 + Math.random() * 0.05));
        }
      }
      if (s.charging && s.lift < 0.05) {
        for (let i = fx.tick(`dust-${s.bot.id}`, 30, dt); i > 0; i--)
          fx.dust(
            p.x - facing * p.size * 0.45,
            p.y - p.size * 0.02,
            p.size * 1.5,
            Math.sign(facing),
          );
      }
      const look = styleOf(s.bot);
      if (s.spotlight && look.walkout) {
        if (look.walkout === "walkout-pyro") {
          for (let i = fx.tick(`pyro-${s.bot.id}`, 26, dt); i > 0; i--) {
            fx.pyro(p.x - p.size * 0.8, p.y, p.size);
            fx.pyro(p.x + p.size * 0.8, p.y, p.size);
          }
        } else if (look.walkout === "walkout-sparks") {
          for (let i = fx.tick(`rain-${s.bot.id}`, 70, dt); i > 0; i--) fx.sparkRain(p.x, h * 0.04, p.size, p.y);
        } else if (look.walkout === "walkout-smoke") {
          for (let i = fx.tick(`stage-${s.bot.id}`, 9, dt); i > 0; i--) fx.stageSmoke(p.x, p.y, p.size);
        }
      }
      if (s.celebrate && festive && (thanksgivingVisuals() || s.bot.shows?.includes("leaves"))) {
        // A win shakes the tree: leaves burst around the winner and settle.
        if (opts.reduced) {
          ctx.save();
          ctx.fillStyle = "rgba(232,135,30,0.4)";
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size * 0.8, p.size * 0.2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          for (let i = fx.tick(`leaves-${s.bot.id}`, 10, dt); i > 0; i--) {
            drawLeaf(
              ctx,
              p.x + (Math.random() - 0.5) * p.size * 1.7,
              p.y - p.size * (0.15 + Math.random() * 0.75),
              p.size * (0.05 + Math.random() * 0.05),
              Math.random() * Math.PI * 2,
              LEAF_COLORS[i % LEAF_COLORS.length]!,
            );
          }
        }
      } else if (s.celebrate && festive && !opts.reduced) {
        const glow = Boolean(s.bot.shows?.includes("blacklight"));
        for (let i = fx.tick(`ooze-${s.bot.id}`, glow ? 14 : 8, dt); i > 0; i--) fx.ooze(p.x, p.y, p.size, glow);
      } else if (s.celebrate && festive && opts.reduced) {
        ctx.save();
        ctx.fillStyle = s.bot.shows?.includes("blacklight") ? "rgba(180,255,80,0.45)" : "rgba(70,180,50,0.4)";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size * 0.8, p.size * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (!opts.reduced && s.bot.weaponFamily === "ghost") {
        for (let i = fx.tick(`ghost-${s.bot.id}`, 8, dt); i > 0; i--) fx.ghostTrail(p.x - facing * p.size * 0.3, p.y, p.size);
      }
      if (look.smoke && SMOKE[look.smoke]) {
        const rgb = SMOKE[look.smoke].rgb;
        for (let i = fx.tick(`cosmetic-smoke-${s.bot.id}`, 6, dt); i > 0; i--) fx.stageSmoke(p.x, p.y, p.size * 0.8, rgb);
      }
      if (s.celebrate && look.victory) {
        const paint = paintOf(s.bot.paint);
        const trim = TRIM[look.trim] ?? "#f3efe6";
        if (look.victory === "victory-confetti") {
          for (let i = fx.tick(`conf-${s.bot.id}`, 10, dt); i > 0; i--) fx.confetti(p.x, h * 0.1, p.size, [paint, trim, "#f3efe6", "#f0a202"], p.y);
        } else if (look.victory === "victory-fireworks") {
          for (let i = fx.tick(`fw-${s.bot.id}`, 1.6, dt); i > 0; i--) {
            fx.firework(w * (0.25 + Math.random() * 0.5), h * (0.12 + Math.random() * 0.12), p.size, Math.random() < 0.5 ? paint : trim);
          }
        }
      }
      if (s.flame > 0.2) {
        for (let i = fx.tick(`flame-${s.bot.id}`, 50 * s.flame, dt); i > 0; i--) {
          fx.fire(
            "side",
            p.x + facing * p.size * 0.5,
            p.y - p.size * 0.25,
            Math.sign(facing) * p.size * (3 + Math.random() * 3),
            -p.size * (0.2 + Math.random() * 0.6),
            p.size * (0.08 + Math.random() * 0.1),
          );
        }
      }
    }
  }

  // Bots, back to front.
  for (const s of order) {
    const p = project(s.spot, w, h);
    const spin = fx.spin.get(s.bot.id) ?? 0;
    const hot = s.spotlight;
    if (hot) spotlight(ctx, p.x, p.y, p.size, h);
    const rise = s.rise ?? 1;
    if (rise < 1) {
      // Main-event lift: a lit hatch in the floor, the bot comes up through it.
      liftHatch(ctx, p.x, p.y, p.size, rise, paintOf(s.bot.paint));
      ctx.save();
      ctx.beginPath();
      ctx.rect(p.x - p.size * 2, 0, p.size * 4, p.y + p.size * 0.04);
      ctx.clip();
      ctx.translate(0, (1 - rise) * p.size * 0.95);
      drawSideBot(ctx, s, p.x, p.y, p.size, time, spin, facingOf(s.heading));
      ctx.restore();
      continue;
    }
    drawSideBot(ctx, s, p.x, p.y, p.size, time, spin, facingOf(s.heading));
  }

  drawParticles(ctx, fx.side);
  drawTexts(ctx, fx);

  // Title cards.
  if (opts.title) titleCard(ctx, w, h, cx, cy, cam.z, opts);
  ctx.restore();

  // Hit flash and vignette over everything.
  if (fx.flash > 0) {
    ctx.fillStyle = `rgba(255,236,200,${fx.flash * 0.35})`;
    ctx.fillRect(0, 0, w, h);
  }
  const v = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.35, w / 2, h * 0.55, w * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  drawOverlay(ctx, w, h, time, opts);
}

function liftHatch(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rise: number, paint: string) {
  ctx.save();
  const open = clamp(rise * 3, 0, 1) * (1 - clamp((rise - 0.85) / 0.15, 0, 1));
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createLinearGradient(0, y - size * 1.4, 0, y);
  g.addColorStop(0, "rgba(255,200,90,0)");
  g.addColorStop(1, `rgba(255,200,90,${0.35 * open})`);
  ctx.fillStyle = g;
  ctx.fillRect(x - size * 0.55, y - size * 1.4, size * 1.1, size * 1.4);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = `rgba(0,0,0,${0.7 * open})`;
  ctx.beginPath();
  ctx.ellipse(x, y, size * 0.6, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = paint;
  ctx.globalAlpha = open;
  ctx.lineWidth = Math.max(2, size * 0.025);
  ctx.beginPath();
  ctx.ellipse(x, y, size * 0.6, size * 0.12, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Week 3 only: side flame jets and the front pop-up saw. The pit, water strip, and two floor saws are drawArenaFloor, every fight. */
function drawHazards(ctx: CanvasRenderingContext2D, w: number, h: number, fx: Fx, time: number, dt: number, reduced: boolean) {
  for (const [i, spot] of [
    { x: 0.08, y: 0.22 },
    { x: 0.92, y: 0.22 },
  ].entries()) {
    const p = project(spot, w, h);
    // Grate.
    ctx.fillStyle = "#14120f";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.size * 0.22, p.size * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f0a202";
    ctx.lineWidth = Math.max(1, p.size * 0.015);
    ctx.stroke();
    const cycle = (time + i * 3.1) % 6.5;
    if (!reduced && cycle < 1.4) {
      for (let k = fx.tick(`jet-${i}`, 70, dt); k > 0; k--) {
        fx.fire("side", p.x + (Math.random() - 0.5) * p.size * 0.12, p.y - p.size * 0.05, (Math.random() - 0.5) * 20, -p.size * (4 + Math.random() * 3), p.size * (0.1 + Math.random() * 0.1));
      }
    }
  }
  const saw = project({ x: 0.5, y: 0.9 }, w, h);
  const up = clamp(Math.sin(((time % 9) / 9) * Math.PI * 2) * 2.2, 0, 1);
  ctx.fillStyle = "#14120f";
  ctx.fillRect(saw.x - saw.size * 0.45, saw.y - saw.size * 0.025, saw.size * 0.9, saw.size * 0.05);
  if (up > 0.02) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(saw.x - saw.size, 0, saw.size * 2, saw.y);
    ctx.clip();
    const r = saw.size * 0.32;
    const cy = saw.y + r * (1 - up * 0.75);
    ctx.translate(saw.x, cy);
    ctx.rotate(time * 18);
    ctx.fillStyle = "#c9c4ba";
    ctx.beginPath();
    for (let t = 0; t < 24; t++) {
      const a = (t / 24) * Math.PI * 2;
      const rr = t % 2 === 0 ? r : r * 0.86;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#6c665d";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (!reduced && up > 0.6) {
      for (let k = fx.tick("saw", 30, dt); k > 0; k--) {
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
        const sp = saw.size * (2 + Math.random() * 3);
        fx.side.push({ kind: "spark", x: saw.x + (Math.random() - 0.5) * r, y: saw.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0.3 + Math.random() * 0.3, max: 0.6, size: Math.max(1, saw.size * 0.012), color: "#ffc24a", ground: saw.y, rot: 0, vr: 0, g: saw.size * 8 });
      }
    }
  }
}

/** Broadcast graphics in screen space: countdown, replay, K.O., alarm lights, round and combo calls. */
function drawOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, opts: SideOpts) {
  const big = Math.max(24, w / 9);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (opts.beams && !opts.reduced) {
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 2; i++) {
      const sway = Math.sin(time * 0.9 + i * 2.2) * w * 0.18;
      const x0 = i === 0 ? w * 0.15 : w * 0.85;
      const x1 = w / 2 + sway;
      const g = ctx.createLinearGradient(x0, 0, x1, h);
      g.addColorStop(0, hexA(opts.beams, 0.32));
      g.addColorStop(1, hexA(opts.beams, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x0 - w * 0.01, 0);
      ctx.lineTo(x0 + w * 0.01, 0);
      ctx.lineTo(x1 + w * 0.09, h);
      ctx.lineTo(x1 - w * 0.09, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  if (opts.alarm && opts.alarm > 0 && !opts.reduced) {
    const pulse = (0.5 + 0.5 * Math.sin(time * 6)) * opts.alarm;
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
    g.addColorStop(0, "rgba(220,30,20,0)");
    g.addColorStop(1, `rgba(220,30,20,${0.35 * pulse})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  if (opts.replay) {
    ctx.fillStyle = "rgba(40,30,20,0.18)";
    ctx.fillRect(0, 0, w, h);
    const bar = h * 0.09;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, bar);
    ctx.fillRect(0, h - bar, w, bar);
    // Badge under the health bars, clear of the HUD and the caption.
    const fs = Math.max(12, Math.round(h * 0.045));
    ctx.font = `700 ${fs}px Oswald, sans-serif`;
    const label = "REPLAY  ·  SLOW MOTION";
    const tw = ctx.measureText(label).width;
    const bx = w / 2 - tw / 2 - fs * 1.1;
    const by = h * 0.25;
    ctx.fillStyle = "rgba(8,8,7,0.85)";
    ctx.fillRect(bx, by - fs * 0.8, tw + fs * 1.9, fs * 1.6);
    ctx.fillStyle = Math.floor(time * 2) % 2 ? "#e0402a" : "#7a1f14";
    ctx.beginPath();
    ctx.arc(bx + fs * 0.6, by, fs * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = "#f3efe6";
    ctx.fillText(label, bx + fs * 1.1, by + fs * 0.05);
    ctx.textAlign = "center";
  }

  if (opts.countdown) {
    const { n, t } = opts.countdown;
    const word = n > 0 ? String(n) : "FIGHT!";
    const scale = 1.6 - ease(clamp(t / 0.35, 0, 1)) * 0.6;
    const a = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
    ctx.globalAlpha = a;
    ctx.font = `700 ${Math.round(big * (n > 0 ? 1.6 : 1.2) * scale)}px Oswald, sans-serif`;
    ctx.lineWidth = Math.max(4, big * 0.1);
    ctx.strokeStyle = "rgba(0,0,0,0.9)";
    ctx.strokeText(word, w / 2, h * 0.45);
    const g = ctx.createLinearGradient(0, h * 0.3, 0, h * 0.55);
    g.addColorStop(0, "#fff3c4");
    g.addColorStop(1, n > 0 ? "#f0a202" : "#ff5a1f");
    ctx.fillStyle = g;
    ctx.fillText(word, w / 2, h * 0.45);
    ctx.globalAlpha = 1;
  }

  if (opts.round && opts.round.t < 1) {
    const { n, t } = opts.round;
    const slide = t < 0.2 ? ease(t / 0.2) : t > 0.8 ? 1 - ease((t - 0.8) / 0.2) : 1;
    ctx.globalAlpha = slide;
    const bw = w * 0.34;
    const bh = h * 0.1;
    const x = w / 2;
    const y = h * 0.24;
    ctx.fillStyle = "rgba(8,8,7,0.82)";
    ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh);
    ctx.fillStyle = "#f0a202";
    ctx.fillRect(x - bw / 2, y + bh / 2 - Math.max(2, bh * 0.06), bw * slide, Math.max(2, bh * 0.06));
    ctx.font = `700 ${Math.round(bh * 0.62)}px Oswald, sans-serif`;
    ctx.fillStyle = "#f3efe6";
    ctx.fillText(`ROUND ${n}`, x, y + bh * 0.04);
    ctx.globalAlpha = 1;
  }

  if (opts.combo && opts.combo.t < 1) {
    const { n, t, color } = opts.combo;
    const a = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
    const pop = t < 0.15 ? 1 + Math.sin((t / 0.15) * Math.PI) * 0.3 : 1;
    ctx.globalAlpha = a;
    ctx.textAlign = "left";
    ctx.font = `700 ${Math.round(big * 0.42 * pop)}px Oswald, sans-serif`;
    ctx.lineWidth = Math.max(3, big * 0.05);
    ctx.strokeStyle = "rgba(0,0,0,0.9)";
    ctx.strokeText(`${n} HIT COMBO`, w * 0.04, h * 0.62);
    ctx.fillStyle = color;
    ctx.fillText(`${n} HIT COMBO`, w * 0.04, h * 0.62);
    ctx.textAlign = "center";
    ctx.globalAlpha = 1;
  }

  if (opts.ko != null && opts.ko > 0) {
    const t = opts.ko;
    const s = t < 0.25 ? 2.4 - ease(t / 0.25) * 1.4 : 1;
    ctx.translate(w / 2, h * 0.42);
    ctx.rotate(-0.12);
    ctx.scale(s, s);
    ctx.globalAlpha = clamp(t / 0.1, 0, 1);
    ctx.font = `700 ${Math.round(big * 1.5)}px Oswald, sans-serif`;
    ctx.lineWidth = Math.max(6, big * 0.14);
    ctx.strokeStyle = "rgba(0,0,0,0.95)";
    ctx.strokeText("K.O.", 0, 0);
    ctx.fillStyle = "#e0402a";
    ctx.fillText("K.O.", 0, 0);
    ctx.lineWidth = Math.max(2, big * 0.03);
    ctx.strokeStyle = "#fff3c4";
    ctx.strokeText("K.O.", 0, 0);
  }
  ctx.restore();
}

function hexA(hex: string, a: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(240,162,2,${a})`;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function spotlight(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, h: number) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createLinearGradient(0, 0, 0, y);
  g.addColorStop(0, "rgba(255,230,170,0.02)");
  g.addColorStop(1, "rgba(255,230,170,0.18)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - size * 0.12, -h * 0.1);
  ctx.lineTo(x + size * 0.12, -h * 0.1);
  ctx.lineTo(x + size * 0.8, y);
  ctx.lineTo(x - size * 0.8, y);
  ctx.closePath();
  ctx.fill();
  const pool = ctx.createRadialGradient(x, y, 0, x, y, size * 0.9);
  pool.addColorStop(0, "rgba(255,230,170,0.35)");
  pool.addColorStop(1, "rgba(255,230,170,0)");
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.ellipse(x, y, size * 0.9, size * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function titleCard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cx: number,
  cy: number,
  z: number,
  opts: SideOpts,
) {
  // Draw in screen space.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1 / z, 1 / z);
  ctx.translate(-w / 2, -h / 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const big = Math.max(24, w / 14);
  if (opts.title === "bumper") {
    ctx.font = `600 ${Math.max(12, w / 42)}px Oswald, sans-serif`;
    ctx.fillStyle = "#f0a202";
    ctx.fillText("T H E   W A T E R M A N", w / 2, h * 0.27);
    ctx.font = `700 ${big}px Oswald, sans-serif`;
    ctx.lineWidth = Math.max(3, big * 0.08);
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.strokeText("BATTLE BOT LEAGUE", w / 2, h * 0.27 + big * 1.05);
    ctx.fillStyle = "#f3efe6";
    ctx.fillText("BATTLE BOT LEAGUE", w / 2, h * 0.27 + big * 1.05);
  } else {
    ctx.font = `700 ${big * 1.2}px Oswald, sans-serif`;
    ctx.lineWidth = Math.max(3, big * 0.1);
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.strokeText(opts.word, w / 2, h * 0.36);
    const g = ctx.createLinearGradient(0, h * 0.36 - big, 0, h * 0.36);
    g.addColorStop(0, "#fff3c4");
    g.addColorStop(1, "#f0a202");
    ctx.fillStyle = g;
    ctx.fillText(opts.word, w / 2, h * 0.36);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Top camera                                                          */
/* ------------------------------------------------------------------ */

const topCache = new WeakMap<
  CanvasRenderingContext2D,
  { w: number; h: number; v: number; canvas: HTMLCanvasElement }
>();

function topGeom(w: number, h: number) {
  const side = Math.min(w, h);
  const pad = side * 0.07;
  const x0 = (w - side) / 2 + pad;
  const y0 = (h - side) / 2 + pad;
  const s = side - pad * 2;
  return { x0, y0, s, map: (p: Spot) => ({ x: x0 + p.x * s, y: y0 + p.y * s }) };
}

function topBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const hit = topCache.get(ctx);
  if (hit && hit.w === w && hit.h === h && hit.v === logoVersion) return hit.canvas;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d");
  if (c) {
    const rnd = seeded(31);
    const { x0, y0, s } = topGeom(w, h);
    c.fillStyle = "#070707";
    c.fillRect(0, 0, w, h);
    const wall = s * 0.035;
    const wg = c.createLinearGradient(x0 - wall, 0, x0 + s + wall, 0);
    wg.addColorStop(0, "#2d2b28");
    wg.addColorStop(0.5, "#46433e");
    wg.addColorStop(1, "#2d2b28");
    c.fillStyle = wg;
    c.fillRect(x0 - wall, y0 - wall, s + wall * 2, s + wall * 2);
    const floor = c.createRadialGradient(
      x0 + s / 2,
      y0 + s / 2,
      s * 0.1,
      x0 + s / 2,
      y0 + s / 2,
      s * 0.75,
    );
    floor.addColorStop(0, "#44403a");
    floor.addColorStop(1, "#1d1b19");
    c.fillStyle = floor;
    c.fillRect(x0, y0, s, s);
    c.save();
    c.beginPath();
    c.rect(x0, y0, s, s);
    c.clip();
    c.globalAlpha = 0.06;
    for (let i = 0; i < 220; i++) {
      c.fillStyle = rnd() < 0.5 ? "#fff" : "#000";
      c.fillRect(x0 + rnd() * s, y0 + rnd() * s, s * (0.02 + rnd() * 0.05), 1);
    }
    c.globalAlpha = 1;
    c.strokeStyle = "rgba(8,8,8,0.9)";
    c.lineWidth = Math.max(1, s / 300);
    for (let i = 1; i < 6; i++) {
      c.beginPath();
      c.moveTo(x0 + (s * i) / 6, y0);
      c.lineTo(x0 + (s * i) / 6, y0 + s);
      c.stroke();
    }
    for (let j = 1; j < 4; j++) {
      c.beginPath();
      c.moveTo(x0, y0 + (s * j) / 4);
      c.lineTo(x0 + s, y0 + (s * j) / 4);
      c.stroke();
    }
    if (floorLogo && logoReady()) {
      const lw = LOGO.w * s;
      const lh = lw * (floorLogo.naturalHeight / floorLogo.naturalWidth);
      c.save();
      c.globalAlpha = 0.62;
      c.drawImage(floorLogo, x0 + LOGO.x * s - lw / 2, y0 + LOGO.y * s - lh / 2, lw, lh);
      c.restore();
    }
    for (let i = 0; i < 30; i++) {
      c.strokeStyle = rnd() < 0.5 ? "rgba(0,0,0,0.3)" : "rgba(220,210,190,0.08)";
      c.lineWidth = s * (0.002 + rnd() * 0.006);
      const x = x0 + rnd() * s;
      const y = y0 + rnd() * s;
      const a = rnd() * Math.PI * 2;
      const l = s * (0.03 + rnd() * 0.12);
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(
        x + Math.cos(a + 0.5) * l * 0.5,
        y + Math.sin(a + 0.5) * l * 0.5,
        x + Math.cos(a) * l,
        y + Math.sin(a) * l,
      );
      c.stroke();
    }
    // Killsaw slots.
    for (const k of [
      { x: 0.2, y: 0.35 },
      { x: 0.8, y: 0.35 },
      { x: 0.3, y: 0.82 },
      { x: 0.7, y: 0.82 },
    ]) {
      c.fillStyle = "#050505";
      c.fillRect(x0 + (k.x - 0.05) * s, y0 + k.y * s - s * 0.006, s * 0.1, s * 0.012);
      c.strokeStyle = "rgba(240,162,2,0.5)";
      c.lineWidth = 1;
      c.strokeRect(x0 + (k.x - 0.055) * s, y0 + k.y * s - s * 0.018, s * 0.11, s * 0.036);
    }
    c.restore();
    // Pit.
    const px = x0 + (PIT.x - PIT.w / 2) * s;
    const py = y0 + (PIT.y - PIT.h / 2) * s;
    c.fillStyle = "#020202";
    c.fillRect(px, py, PIT.w * s, PIT.h * s);
    const pg = c.createRadialGradient(
      px + (PIT.w * s) / 2,
      py + (PIT.h * s) / 2,
      0,
      px + (PIT.w * s) / 2,
      py + (PIT.h * s) / 2,
      PIT.w * s * 0.6,
    );
    pg.addColorStop(0, "rgba(200,40,20,0.3)");
    pg.addColorStop(1, "rgba(200,40,20,0)");
    c.fillStyle = pg;
    c.fillRect(px, py, PIT.w * s, PIT.h * s);
    c.strokeStyle = "#f0a202";
    c.lineWidth = Math.max(2, s * 0.008);
    c.setLineDash([s * 0.015, s * 0.015]);
    c.strokeRect(px, py, PIT.w * s, PIT.h * s);
    c.setLineDash([]);
    // Hazard border inside the wall.
    for (const [x, y, ww, hh] of [
      [x0, y0, s, s * 0.018],
      [x0, y0 + s - s * 0.018, s, s * 0.018],
    ] as const) {
      hazardBand(c, x, y, ww, hh);
    }
    c.save();
    c.translate(x0, y0 + s);
    c.rotate(-Math.PI / 2);
    hazardBand(c, 0, 0, s, s * 0.018);
    c.restore();
    c.save();
    c.translate(x0 + s, y0);
    c.rotate(Math.PI / 2);
    hazardBand(c, 0, 0, s, s * 0.018);
    c.restore();
    // Corner posts.
    for (const [cx, cy] of [
      [x0, y0],
      [x0 + s, y0],
      [x0, y0 + s],
      [x0 + s, y0 + s],
    ] as const) {
      c.fillStyle = "#6d6a64";
      c.beginPath();
      c.arc(cx, cy, s * 0.028, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#1a1918";
      c.beginPath();
      c.arc(cx, cy, s * 0.012, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#8a8175";
    c.font = `600 ${Math.max(10, s * 0.04)}px Oswald, sans-serif`;
    c.textAlign = "left";
    c.fillText("OVERHEAD", x0 + s * 0.04, y0 + s * 0.08);
    c.textAlign = "center";
    c.fillStyle = "rgba(240,162,2,0.8)";
    c.font = `600 ${Math.max(9, s * 0.03)}px Oswald, sans-serif`;
    c.fillText("PIT", x0 + PIT.x * s, y0 + (PIT.y + PIT.h / 2) * s + s * 0.04);
  }
  topCache.set(ctx, { w, h, v: logoVersion, canvas });
  return canvas;
}

export function drawTop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  drive: Drive,
  fx: Fx,
  trails: Map<string, Spot[]>,
  time: number,
  dt: number,
  reduced: boolean,
) {
  const g = topGeom(w, h);
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(topBackdrop(ctx, w, h), 0, 0);
  ctx.beginPath();
  ctx.rect(g.x0, g.y0, g.s, g.s);
  ctx.clip();
  drawArenaTop(ctx, g, time);

  // Skid marks.
  for (const s of drive.bots) {
    const trail = trails.get(s.bot.id);
    if (!trail || trail.length < 2) continue;
    ctx.strokeStyle = "rgba(8,8,8,0.55)";
    ctx.lineWidth = Math.max(2, g.s * 0.012);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    trail.forEach((spot, i) => {
      const p = g.map(spot);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  }

  for (const s of drive.bots) {
    const p = g.map(s.spot);
    const hurt = 1 - clamp(s.hp / 100, 0, 1);
      if (!reduced && s.gone < 0.5) {
      const rate = s.dead ? 10 : hurt > 0.5 ? (hurt - 0.5) * 12 : 0;
      for (let i = fx.tick(`tsmoke-${s.bot.id}`, rate, dt); i > 0; i--)
        fx.smoke("top", p.x, p.y, g.s * 0.25, s.dead);
      const look = styleOf(s.bot);
      if (look.smoke && SMOKE[look.smoke]) {
        for (let i = fx.tick(`tcosmetic-${s.bot.id}`, 5, dt); i > 0; i--)
          fx.smoke("top", p.x, p.y, g.s * 0.18, false, false, SMOKE[look.smoke].rgb);
      }
      if (s.flame > 0.2) {
        for (let i = fx.tick(`tflame-${s.bot.id}`, 40 * s.flame, dt); i > 0; i--) {
          const a = s.heading + (Math.random() - 0.5) * 0.4;
          const off = g.s * 0.07;
          fx.fire(
            "top",
            p.x + Math.cos(s.heading) * off,
            p.y + Math.sin(s.heading) * off,
            Math.cos(a) * g.s * 0.6,
            Math.sin(a) * g.s * 0.6,
            g.s * 0.025,
          );
        }
      }
    }
    drawTopBot(ctx, s, p, g.s, fx.spin.get(s.bot.id) ?? 0, time);
  }
  drawParticles(ctx, fx.top);
  ctx.restore();
}

function traceTopHull(
  ctx: CanvasRenderingContext2D,
  classId: ClassId,
  body: BotBody | undefined,
  len: number,
  wid: number,
) {
  const id = body ?? (classId === "tank" ? "keystone" : classId === "specialist" ? "windlass" : "shrike");
  ctx.beginPath();
  if (classId === "striker") {
    if (id === "stinger") {
      ctx.moveTo(-len*0.5,-wid*0.34); ctx.lineTo(len*0.18,-wid*0.34); ctx.lineTo(len*0.56,0);
      ctx.lineTo(len*0.18,wid*0.34); ctx.lineTo(-len*0.5,wid*0.34);
    } else if (id === "raptor" || id === "warhawk") {
      ctx.moveTo(-len*0.5,-wid*0.5); ctx.lineTo(len*0.1,-wid*0.5); ctx.lineTo(len*0.58,-wid*0.22);
      ctx.lineTo(len*0.58,wid*0.22); ctx.lineTo(len*0.1,wid*0.5); ctx.lineTo(-len*0.5,wid*0.5);
    } else {
      ctx.moveTo(-len*0.5,-wid*0.45); ctx.lineTo(len*0.25,-wid*0.45); ctx.lineTo(len*0.5,-wid*0.3);
      ctx.lineTo(len*0.5,wid*0.3); ctx.lineTo(len*0.25,wid*0.45); ctx.lineTo(-len*0.5,wid*0.45);
    }
  } else if (classId === "tank") {
    if (id === "bunker") {
      ctx.roundRect(-len*0.52,-wid*0.38,len*1.04,wid*0.76,Math.max(3,wid*0.12));
    } else if (id === "juggernaut" || id === "colossus") {
      ctx.moveTo(-len*0.52,-wid*0.52); ctx.lineTo(len*0.3,-wid*0.52); ctx.lineTo(len*0.55,-wid*0.35);
      ctx.lineTo(len*0.55,wid*0.35); ctx.lineTo(len*0.3,wid*0.52); ctx.lineTo(-len*0.52,wid*0.52);
    } else {
      ctx.roundRect(-len*0.5,-wid*0.45,len,wid*0.9,2);
    }
  } else {
    if (id === "scorpion") {
      ctx.moveTo(-len*0.5,-wid*0.42); ctx.lineTo(len*0.12,-wid*0.5); ctx.lineTo(len*0.52,-wid*0.32);
      ctx.lineTo(len*0.52,wid*0.32); ctx.lineTo(len*0.12,wid*0.5); ctx.lineTo(-len*0.5,wid*0.42);
    } else if (id === "mantis" || id === "reaper") {
      ctx.moveTo(-len*0.48,-wid*0.44); ctx.lineTo(-len*0.05,-wid*0.34); ctx.lineTo(len*0.22,-wid*0.52);
      ctx.lineTo(len*0.5,-wid*0.28); ctx.lineTo(len*0.5,wid*0.28); ctx.lineTo(len*0.22,wid*0.52);
      ctx.lineTo(-len*0.05,wid*0.34); ctx.lineTo(-len*0.48,wid*0.44);
    } else {
      ctx.roundRect(-len*0.5,-wid*0.45,len,wid*0.9,4);
    }
  }
  ctx.closePath();
}

export function drawTopBot(
  ctx: CanvasRenderingContext2D,
  s: BotState,
  at: { x: number; y: number },
  cage: number,
  spin: number,
  time: number,
) {
  const paint = paintOf(s.bot.paint);
  const style = styleOf(s.bot, s.bot.classId);
  const tank = s.bot.classId === "tank";
  const spec = s.bot.classId === "specialist";
  const len = cage * (tank ? 0.165 : spec ? 0.135 : 0.15);
  const wid = cage * (tank ? 0.125 : spec ? 0.1 : 0.105);
  const lift = 1 + s.lift * 0.35;
  ctx.save();
  ctx.translate(at.x, at.y);
  if (s.gone > 0) {
    ctx.globalAlpha = 1 - s.gone;
    ctx.scale(1 - s.gone * 0.6, 1 - s.gone * 0.6);
  }
  // Shadow, offset by height.
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.ellipse(
    cage * 0.01 + s.lift * cage * 0.04,
    cage * 0.014 + s.lift * cage * 0.06,
    len * 0.62,
    wid * 0.62,
    s.heading,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.rotate(s.heading);
  ctx.scale(lift, lift);

  // Wheels or tracks poking out the sides.
  ctx.fillStyle = "#111";
  if (tank) {
    ctx.fillRect(-len * 0.5, -wid * 0.62, len, wid * 0.22);
    ctx.fillRect(-len * 0.5, wid * 0.4, len, wid * 0.22);
    ctx.strokeStyle = "#2c2a27";
    ctx.lineWidth = 1;
    const step = len * 0.1;
    const off = (((s.roll * len * 0.4) % step) + step) % step;
    for (let x = -len * 0.5 + off; x < len * 0.5; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, -wid * 0.62);
      ctx.lineTo(x, -wid * 0.4);
      ctx.moveTo(x, wid * 0.4);
      ctx.lineTo(x, wid * 0.62);
      ctx.stroke();
    }
  } else {
    for (const wx of [-0.26, 0.2]) {
      for (const sy of [-1, 1]) {
        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.roundRect(
          len * wx - len * 0.13,
          sy * wid * 0.5 - wid * 0.13,
          len * 0.26,
          wid * 0.26,
          2,
        );
        ctx.fill();
      }
    }
  }

  if (s.flipped) {
    // Belly up.
    ctx.fillStyle = "#2b2926";
    ctx.beginPath();
    ctx.roundRect(-len * 0.5, -wid * 0.45, len, wid * 0.9, 3);
    ctx.fill();
    ctx.strokeStyle = "#4a4640";
    ctx.lineWidth = 1;
    ctx.strokeRect(-len * 0.35, -wid * 0.3, len * 0.7, wid * 0.6);
    ctx.fillStyle = shade(paint, -60);
    ctx.fillRect(-len * 0.5, -wid * 0.45, len, wid * 0.08);
    ctx.fillRect(-len * 0.5, wid * 0.37, len, wid * 0.08);
    ctx.restore();
    return;
  }

  // Weapon under the lid.
  topWeapon(ctx, s, len, wid, spin);

  // Hull.
  const hg = ctx.createLinearGradient(0, -wid * 0.5, 0, wid * 0.5);
  if (style.finish === "chrome") {
    hg.addColorStop(0,"#f4f8fc");hg.addColorStop(0.24,"#7892a6");hg.addColorStop(0.42,"#e3edf4");hg.addColorStop(0.5,"#263846");hg.addColorStop(1,"#8299aa");
  } else if (style.finish === "gold") {
    hg.addColorStop(0,"#fff0b3");hg.addColorStop(0.3,"#b98218");hg.addColorStop(0.48,"#ffe299");hg.addColorStop(1,"#68400b");
  } else if (style.finish === "holographic") {
    const shift = (Math.sin(time * 1.5) + 1) / 2;
    hg.addColorStop(0, "#9ff7ff");
    hg.addColorStop(0.28 + shift * 0.12, "#e07bff");
    hg.addColorStop(0.62, "#fff4b0");
    hg.addColorStop(1, "#7dffa8");
  } else {
    hg.addColorStop(0, shade(paint, style.finish === "matte" ? 24 : 65));
    hg.addColorStop(0.4, paint);
    hg.addColorStop(1, shade(paint, -70));
  }
  ctx.fillStyle = hg;
  traceTopHull(ctx, s.bot.classId, style.body, len, wid);
  ctx.fill();
  ctx.strokeStyle = style.trim === "steel" ? "rgba(0,0,0,0.7)" : (TRIM[style.trim] ?? "#000");
  ctx.lineWidth = style.trim === "steel" ? 1 : Math.max(1.5, cage * 0.005);
  ctx.stroke();
  if (style.leds && style.leds !== "none" && LEDS[style.leds]) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = LEDS[style.leds].hex;
    ctx.shadowBlur = cage * 0.02;
    ctx.strokeStyle = shade(LEDS[style.leds].hex, 30, 0.45 + 0.35 * Math.sin(time * 5));
    ctx.lineWidth = Math.max(2, cage * 0.008);
    traceTopHull(ctx, s.bot.classId, style.body, len, wid);
    ctx.stroke();
    ctx.restore();
  }
  {
    const eye = EYES[style.eye] ?? EYES.green!;
    const ex = len * 0.3;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(ex, 0, 0, ex, 0, wid * 0.5);
    g.addColorStop(0, shade(eye, 0, s.dead ? 0.1 : 0.6));
    g.addColorStop(1, shade(eye, 0, 0));
    ctx.fillStyle = g;
    ctx.fillRect(ex - wid * 0.5, -wid * 0.5, wid, wid);
    ctx.restore();
    ctx.fillStyle = shade(eye, 0, s.dead ? 0.2 : 1);
    ctx.fillRect(ex - len * 0.02, -wid * 0.18, len * 0.04, wid * 0.36);
  }
  // Lid panel and bolts.
  ctx.fillStyle = shade(paint, 25);
  ctx.fillRect(-len * 0.34, -wid * 0.28, len * 0.52, wid * 0.56);
  ctx.strokeStyle = shade(paint, -80, 0.6);
  ctx.strokeRect(-len * 0.34, -wid * 0.28, len * 0.52, wid * 0.56);
  ctx.fillStyle = "#c8c2b6";
  for (const [bx, by] of [
    [-0.42, -0.36],
    [-0.42, 0.36],
    [0.2, -0.36],
    [0.2, 0.36],
  ] as const) {
    ctx.beginPath();
    ctx.arc(len * bx, wid * by, Math.max(1, cage * 0.004), 0, Math.PI * 2);
    ctx.fill();
  }
  if (s.bot.look === "stripe") {
    ctx.fillStyle = "#f3efe6";
    ctx.fillRect(-len * 0.5, -wid * 0.05, len * 0.9, wid * 0.1);
  }
  ctx.save();
  traceTopHull(ctx, s.bot.classId, style.body, len, wid);
  ctx.clip();
  const stickers = style.stickers!;
  deckHardware(ctx, len, wid, s.scars ?? 0, hash(s.bot.id));
  stickerBadge(ctx, stickers.left, -len * 0.08, -wid * 0.36, len * 0.42, wid * 0.18, paint, s.bot.id, s.bot.number);
  stickerBadge(ctx, stickers.right, -len * 0.08, wid * 0.36, len * 0.42, wid * 0.18, paint, s.bot.id, s.bot.number);
  stickerBadge(ctx, stickers.hood, len * 0.12, 0, len * 0.32, wid * 0.44, paint, s.bot.id, s.bot.number);
  stickerBadge(ctx, stickers.rear, -len * 0.39, 0, len * 0.16, wid * 0.5, paint, s.bot.id, s.bot.number);
  ctx.restore();
  drawInstalledTop(ctx, s, len, wid, time);
  // LED.
  const blink = s.dead ? 0 : Math.sin(time * 6 + hash(s.bot.id)) > 0 ? 1 : 0.35;
  ctx.fillStyle = s.dead
    ? "#3a1a18"
    : s.hp < 35
      ? `rgba(255,60,40,${blink})`
      : `rgba(80,255,140,${blink})`;
  ctx.beginPath();
  ctx.arc(-len * 0.4, 0, Math.max(1.5, cage * 0.006), 0, Math.PI * 2);
  ctx.fill();
  if (s.bot.number) {
    ctx.save();
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = "#0e0d0b";
    ctx.font = `700 ${Math.max(8, wid * 0.42)}px Oswald, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s.bot.number, 0, len * 0.08);
    ctx.restore();
  }
  drawTopperPlan(ctx, style.topper, len, wid, time, EYES[style.eye] ?? "#50ff8c");
  if (style.banner) drawBannerPlate(ctx, style.banner, -len * 0.05, wid * 0.78, len * 1.4, false);
  if (style.smoke && SMOKE[style.smoke]) drawSmokePuffs(ctx, -len * 0.2, -wid * 0.1, len * 1.2, SMOKE[style.smoke].rgb, time);
  ctx.restore();
}

function drawTopperPlan(
  ctx: CanvasRenderingContext2D,
  topper: string | undefined,
  len: number,
  wid: number,
  time: number,
  eye: string,
) {
  if (!topper || topper === "none" || !["beacon", "dish", "flagpole"].includes(topper)) return;
  ctx.save();
  if (topper === "beacon") {
    const pulse = 0.55 + Math.sin(time * 6) * 0.35;
    ctx.fillStyle = `rgba(255,70,40,${0.45 * pulse})`;
    ctx.beginPath();
    ctx.arc(-len * 0.05, 0, wid * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff4a2a";
    ctx.beginPath();
    ctx.arc(-len * 0.05, 0, wid * 0.1, 0, Math.PI * 2);
    ctx.fill();
  } else if (topper === "dish") {
    ctx.strokeStyle = "#dfe7ef";
    ctx.lineWidth = Math.max(1, wid * 0.06);
    ctx.beginPath();
    ctx.ellipse(-len * 0.08, -wid * 0.05, len * 0.16, wid * 0.28, -0.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = eye;
    ctx.beginPath();
    ctx.arc(-len * 0.02, -wid * 0.02, wid * 0.06, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = "#f3efe6";
    ctx.lineWidth = Math.max(1, wid * 0.05);
    ctx.beginPath();
    ctx.moveTo(len * 0.05, wid * 0.15);
    ctx.lineTo(len * 0.05, -wid * 0.45);
    ctx.stroke();
    ctx.fillStyle = "#e0402e";
    ctx.beginPath();
    ctx.moveTo(len * 0.05, -wid * 0.45);
    ctx.lineTo(len * 0.28, -wid * 0.28);
    ctx.lineTo(len * 0.05, -wid * 0.12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function topWeapon(
  ctx: CanvasRenderingContext2D,
  s: BotState,
  len: number,
  wid: number,
  spin: number,
) {
  const fam = s.bot.weaponFamily;
  const skin = styleOf(s.bot).weaponSkin;
  ctx.fillStyle = "#cfcac0";
  if (skin === "hockey-machete" || fam === "slasher" || fam === "ghost" || fam === "chainsaw" || fam === "launcher" || fam === "bones" || fam === "broom") {
    ctx.fillStyle = fam === "ghost" ? "#d9ffe4" : fam === "launcher" ? "#e07014" : fam === "broom" ? "#c4a15a" : "#f4f1ea";
    ctx.fillRect(len * 0.35, -wid * 0.1, len * 0.42, wid * 0.2);
    if (fam === "launcher") {
      ctx.beginPath();
      ctx.arc(len * 0.78, 0, wid * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (fam === "disc" || fam === "saw") {
    // Vertical blade seen edge-on, with a blur box.
    const x = len * (fam === "saw" ? 0.25 + s.stroke * 0.15 : 0.55);
    const r = len * (fam === "saw" ? 0.3 : 0.36);
    if (fam === "saw") {
      ctx.fillStyle = "#8e8a82";
      ctx.fillRect(-len * 0.1, -wid * 0.05, x + len * 0.1, wid * 0.1);
    }
    ctx.fillStyle = `rgba(230,225,215,${0.2 + s.rev * 0.25})`;
    ctx.fillRect(x - r, -wid * 0.09, r * 2, wid * 0.18);
    ctx.fillStyle = s.stroke > 0.5 ? "#ff8a3a" : "#e2ddd3";
    ctx.fillRect(x - r, -wid * 0.035, r * 2, wid * 0.07);
    const tooth = Math.cos(spin) * r;
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + tooth - 1.5, -wid * 0.07, 3, wid * 0.14);
  } else if (fam === "drum") {
    const x = len * 0.56;
    ctx.fillStyle = "#6d6a64";
    ctx.fillRect(x - len * 0.1, -wid * 0.5, len * 0.2, wid);
    ctx.fillStyle = "#d9d5cc";
    for (let i = 0; i < 3; i++) {
      const a = spin + (i / 3) * Math.PI * 2;
      const off = Math.sin(a) * len * 0.08;
      if (Math.cos(a) < 0) continue;
      ctx.fillRect(x + off - 1.5, -wid * 0.48, 3, wid * 0.96);
    }
  } else if (fam === "flip") {
    const ext = s.stroke * len * 0.25;
    ctx.fillStyle = "#b9b4aa";
    ctx.beginPath();
    ctx.moveTo(len * 0.35, -wid * 0.42);
    ctx.lineTo(len * 0.72 - ext * 0.4, -wid * 0.42);
    ctx.lineTo(len * 0.72 - ext * 0.4, wid * 0.42);
    ctx.lineTo(len * 0.35, wid * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (fam === "wedge") {
    ctx.fillStyle = "#b9b4aa";
    ctx.beginPath();
    ctx.moveTo(len * 0.4, -wid * 0.5);
    ctx.lineTo(len * 0.78, -wid * 0.6);
    ctx.lineTo(len * 0.78, wid * 0.6);
    ctx.lineTo(len * 0.4, wid * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (fam === "axe") {
    const reach = len * (0.1 + s.stroke * 0.55);
    ctx.fillStyle = "#7b4a2a";
    ctx.fillRect(-len * 0.05, -wid * 0.05, reach, wid * 0.1);
    ctx.fillStyle = s.stroke > 0.8 ? "#ffd27a" : "#d9d5cc";
    ctx.beginPath();
    ctx.moveTo(reach - len * 0.06, -wid * 0.12);
    ctx.lineTo(reach + len * 0.06, -wid * 0.34);
    ctx.lineTo(reach + len * 0.06, wid * 0.34);
    ctx.lineTo(reach - len * 0.06, wid * 0.12);
    ctx.closePath();
    ctx.fill();
  } else if (fam === "hammer") {
    const reach = len * (0.1 + s.stroke * 0.55);
    ctx.fillStyle = "#8e8a82";
    ctx.fillRect(-len * 0.05, -wid * 0.06, reach, wid * 0.12);
    ctx.fillStyle = s.stroke > 0.8 ? "#ff8a3a" : "#d9d5cc";
    ctx.fillRect(reach - len * 0.08, -wid * 0.28, len * 0.14, wid * 0.56);
  } else if (fam === "flail") {
    const reach = len * (0.35 + Math.sin(spin) * 0.12);
    ctx.strokeStyle = "#8a847a";
    ctx.lineWidth = Math.max(1, wid * 0.08);
    ctx.beginPath();
    ctx.moveTo(len * 0.1, 0);
    ctx.lineTo(reach, Math.sin(spin * 2) * wid * 0.35);
    ctx.stroke();
    ctx.fillStyle = s.stroke > 0.6 ? "#ff8a3a" : "#e2ddd3";
    ctx.beginPath();
    ctx.arc(reach, Math.sin(spin * 2) * wid * 0.35, wid * 0.16, 0, Math.PI * 2);
    ctx.fill();
  } else if (fam === "chainsaw") {
    ctx.fillStyle = "#8e8a82";
    ctx.fillRect(len * 0.2, -wid * 0.08, len * 0.42, wid * 0.16);
    ctx.fillStyle = "#f3efe6";
    for (let i = 0; i < 6; i++) {
      const x = len * (0.28 + i * 0.05) + Math.sin(spin + i) * 2;
      ctx.fillRect(x, -wid * 0.14, 2, wid * 0.28);
    }
  } else if (fam === "piston") {
    const ext = s.stroke * len * 0.22;
    ctx.fillStyle = "#3a3834";
    ctx.fillRect(len * 0.25, -wid * 0.1, len * 0.2, wid * 0.2);
    ctx.fillStyle = "#e2ddd3";
    ctx.fillRect(len * 0.4, -wid * 0.04, len * 0.2 + ext, wid * 0.08);
  } else if (fam === "flame") {
    ctx.fillStyle = "#2a2420";
    ctx.fillRect(len * 0.3, -wid * 0.12, len * 0.28, wid * 0.24);
    ctx.fillStyle = `rgba(255,120,30,${0.45 + s.stroke * 0.4})`;
    ctx.beginPath();
    ctx.moveTo(len * 0.55, -wid * 0.16);
    ctx.lineTo(len * 0.85, 0);
    ctx.lineTo(len * 0.55, wid * 0.16);
    ctx.fill();
  } else if (fam === "tesla") {
    ctx.strokeStyle = `rgba(140,210,255,${0.45 + Math.sin(spin * 3) * 0.35})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(len * 0.45, 0, wid * 0.28, spin, spin + 1.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(len * 0.45, 0, wid * 0.42, -spin, -spin + 1);
    ctx.stroke();
  } else if (fam === "claw") {
    const open = (1 - s.stroke) * wid * 0.2;
    ctx.fillStyle = "#b9b4aa";
    ctx.fillRect(len * 0.4, -wid * 0.42 - open, len * 0.38, wid * 0.14);
    ctx.fillRect(len * 0.4, wid * 0.28 + open, len * 0.38, wid * 0.14);
  } else if (fam !== "hidden" && fam !== "none") {
    ctx.fillStyle = "#d9d5cc";
    ctx.beginPath();
    ctx.moveTo(len * 0.45, -wid * 0.2);
    ctx.lineTo(len * 0.75, 0);
    ctx.lineTo(len * 0.45, wid * 0.2);
    ctx.closePath();
    ctx.fill();
  }
}

/** Advance each bot's spinner and log its skid path. */
export function stepBots(
  drive: Drive,
  fx: Fx,
  trails: Map<string, Spot[]>,
  dt: number,
  reduced: boolean,
) {
  for (const s of drive.bots) {
    const fam = s.bot.weaponFamily;
    const rate = fam === "disc" ? 34 : fam === "drum" ? 28 : fam === "saw" || fam === "chainsaw" ? 24 : fam === "flail" ? 16 : fam === "tesla" ? 10 : 0;
    fx.spin.set(s.bot.id, ((fx.spin.get(s.bot.id) ?? 0) + rate * s.rev * dt) % (Math.PI * 200));
    if (reduced || s.gone > 0 || s.lift > 0.05) continue;
    let trail = trails.get(s.bot.id);
    if (!trail) {
      trail = [];
      trails.set(s.bot.id, trail);
    }
    const last = trail[trail.length - 1];
    if (last && Math.hypot(last.x - s.spot.x, last.y - s.spot.y) < 0.01) continue;
    if (last && Math.hypot(last.x - s.spot.x, last.y - s.spot.y) > 0.2) trail.length = 0;
    trail.push({ x: s.spot.x, y: s.spot.y });
    if (trail.length > 22) trail.shift();
  }
}

/** Where to throw sparks, in both cameras. */
export function impactPoints(
  drive: Drive,
  sideW: number,
  sideH: number,
  topW: number,
  topH: number,
) {
  if (!drive.impact) return null;
  const p = project(drive.impact, sideW, sideH);
  const g = topGeom(topW, topH);
  const t = g.map(drive.impact);
  return {
    side: { x: p.x, y: p.y - p.size * 0.22, ground: p.y, scale: p.size },
    top: { x: t.x, y: t.y, scale: g.s * 0.12 },
  };
}
