import { PAINT } from "@/lib/pit/catalog";
import type { ClassId } from "@/lib/pit/types";
import { PIT, clamp, hash, lerp, type BotState, type Drive, type Spot } from "./cage-motion";

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
  kind: "spark" | "debris" | "smoke" | "fire" | "flash" | "dust";
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

export class Fx {
  side: Particle[] = [];
  top: Particle[] = [];
  flash = 0;
  spin = new Map<string, number>();
  emit = new Map<string, number>();
  cam = { x: 0, y: 0, z: 1, ready: false };

  clear() {
    this.side.length = 0;
    this.top.length = 0;
    this.flash = 0;
  }

  step(dt: number) {
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
        }
      }
    }
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

  smoke(list: "side" | "top", x: number, y: number, scale: number, dark: boolean, big = false) {
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
      color: dark ? "40,38,36" : "120,116,110",
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

  /** Rate-limited emitter. Returns how many to spawn this frame. */
  tick(key: string, rate: number, dt: number) {
    const acc = (this.emit.get(key) ?? 0) + rate * dt;
    const n = Math.floor(acc);
    this.emit.set(key, acc - n);
    return n;
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, list: Particle[]) {
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

const backdropCache = new WeakMap<
  CanvasRenderingContext2D,
  { w: number; h: number; canvas: HTMLCanvasElement }
>();

function backdrop(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const hit = backdropCache.get(ctx);
  if (hit && hit.w === w && hit.h === h) return hit.canvas;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d");
  if (c) paintBackdrop(c, w, h);
  backdropCache.set(ctx, { w, h, canvas });
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

function frameOf(classId: ClassId): Frame {
  if (classId === "tank") {
    return {
      hull: [
        [-0.46, -0.2],
        [-0.46, -0.46],
        [-0.3, -0.52],
        [0.3, -0.52],
        [0.46, -0.4],
        [0.46, -0.2],
      ],
      deck: -0.52,
      front: 0.46,
      height: 0.52,
      wheels: [-0.36, -0.18, 0, 0.18, 0.36].map((x) => ({ x, r: 0.075 })),
      treads: true,
    };
  }
  if (classId === "specialist") {
    return {
      hull: [
        [-0.4, -0.11],
        [-0.4, -0.38],
        [-0.28, -0.44],
        [0.1, -0.44],
        [0.32, -0.34],
        [0.4, -0.16],
        [0.4, -0.11],
      ],
      deck: -0.44,
      front: 0.4,
      height: 0.44,
      wheels: [
        { x: -0.25, r: 0.12 },
        { x: 0.2, r: 0.12 },
      ],
      treads: false,
    };
  }
  return {
    hull: [
      [-0.46, -0.1],
      [-0.46, -0.3],
      [-0.36, -0.34],
      [0.08, -0.34],
      [0.44, -0.13],
      [0.44, -0.1],
    ],
    deck: -0.34,
    front: 0.44,
    height: 0.34,
    wheels: [
      { x: -0.27, r: 0.13 },
      { x: 0.17, r: 0.13 },
    ],
    treads: false,
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
  ctx.fillStyle = "#77736b";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(paint, -40);
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
  const f = frameOf(s.bot.classId);
  const paint = paintOf(s.bot.paint);
  const scale = u * (s.bot.classId === "tank" ? 1.06 : s.bot.classId === "specialist" ? 0.94 : 1);
  const liftPx = s.lift * scale;

  // Shadow stays on the floor.
  if (s.gone < 1) {
    const spread = 1 - clamp(s.lift, 0, 1.2) * 0.5;
    ctx.save();
    ctx.globalAlpha = (1 - s.gone) * clamp(1 - s.lift * 0.6, 0.25, 1);
    const g = ctx.createRadialGradient(x, y, 0, x, y, scale * 0.6 * spread);
    g.addColorStop(0, "rgba(0,0,0,0.75)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, scale * 0.6 * spread, scale * 0.11 * spread, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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

  const u2 = scale;
  const dark = shade(paint, -80);

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
    for (const wh of f.wheels) drawWheel(ctx, wh.x * u2, -0.125 * u2, wh.r * u2, s.roll * 3, paint);
  } else {
    // Far-side wheels peek out behind the hull.
    for (const wh of f.wheels) {
      ctx.save();
      ctx.globalAlpha *= 0.55;
      drawWheel(ctx, (wh.x + 0.05) * u2, -wh.r * u2 - 0.015 * u2, wh.r * u2, s.roll * 3, paint);
      ctx.restore();
    }
  }

  // Hull: painted armour with a lit top edge.
  const top = f.deck * u2;
  const hg = ctx.createLinearGradient(0, top, 0, top + f.height * u2 * 0.9);
  hg.addColorStop(0, shade(paint, 70));
  hg.addColorStop(0.18, shade(paint, 25));
  hg.addColorStop(0.55, paint);
  hg.addColorStop(1, shade(paint, -70));
  ctx.fillStyle = hg;
  poly(ctx, f.hull, u2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.75)";
  ctx.lineWidth = Math.max(1, u2 * 0.014);
  ctx.stroke();

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
  // Specular sheen.
  ctx.globalCompositeOperation = "lighter";
  const sheen = ctx.createLinearGradient(-0.4 * u2, top, 0.2 * u2, top + f.height * u2);
  sheen.addColorStop(0, "rgba(255,255,255,0)");
  sheen.addColorStop(0.45, "rgba(255,255,255,0.16)");
  sheen.addColorStop(0.55, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(-0.6 * u2, top, 1.2 * u2, f.height * u2);
  ctx.globalCompositeOperation = "source-over";
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
      drawWheel(ctx, wh.x * u2, -wh.r * u2, wh.r * u2, s.roll * 3, paint);
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
  } else if (fam !== "hammer" && fam !== "saw" && fam !== "hidden" && fam !== "none") {
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
};

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
    : clamp(1 + drive.tight * 0.28 - clamp(spread / w - 0.3, 0, 0.5) * 0.4, 1, 1.32);
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
  cam.z = lerp(cam.z, wantZ, 1 - Math.exp(-dt * (wantZ > cam.z ? 4 : 1.5)));
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
  if (!opts.reduced) crowdFlashes(ctx, w, h, time, opts.hype);

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
      if (s.charging && s.lift < 0.05) {
        for (let i = fx.tick(`dust-${s.bot.id}`, 30, dt); i > 0; i--)
          fx.dust(
            p.x - facing * p.size * 0.45,
            p.y - p.size * 0.02,
            p.size * 1.5,
            Math.sign(facing),
          );
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
    drawSideBot(ctx, s, p.x, p.y, p.size, time, spin, facingOf(s.heading));
  }

  drawParticles(ctx, fx.side);

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
  { w: number; h: number; canvas: HTMLCanvasElement }
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
  if (hit && hit.w === w && hit.h === h) return hit.canvas;
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
  topCache.set(ctx, { w, h, canvas });
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

function drawTopBot(
  ctx: CanvasRenderingContext2D,
  s: BotState,
  at: { x: number; y: number },
  cage: number,
  spin: number,
  time: number,
) {
  const paint = paintOf(s.bot.paint);
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
  hg.addColorStop(0, shade(paint, 55));
  hg.addColorStop(0.5, paint);
  hg.addColorStop(1, shade(paint, -60));
  ctx.fillStyle = hg;
  ctx.beginPath();
  if (s.bot.classId === "striker") {
    ctx.moveTo(-len * 0.5, -wid * 0.45);
    ctx.lineTo(len * 0.25, -wid * 0.45);
    ctx.lineTo(len * 0.5, -wid * 0.3);
    ctx.lineTo(len * 0.5, wid * 0.3);
    ctx.lineTo(len * 0.25, wid * 0.45);
    ctx.lineTo(-len * 0.5, wid * 0.45);
  } else {
    ctx.roundRect(-len * 0.5, -wid * 0.45, len, wid * 0.9, tank ? 2 : 4);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 1;
  ctx.stroke();
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
  ctx.fillStyle = "#cfcac0";
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
  } else if (fam === "hammer") {
    const reach = len * (0.1 + s.stroke * 0.55);
    ctx.fillStyle = "#8e8a82";
    ctx.fillRect(-len * 0.05, -wid * 0.06, reach, wid * 0.12);
    ctx.fillStyle = s.stroke > 0.8 ? "#ff8a3a" : "#d9d5cc";
    ctx.fillRect(reach - len * 0.08, -wid * 0.28, len * 0.14, wid * 0.56);
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
    const rate = fam === "disc" ? 34 : fam === "drum" ? 28 : fam === "saw" ? 24 : 0;
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
