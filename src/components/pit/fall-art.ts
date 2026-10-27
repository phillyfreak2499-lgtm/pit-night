/**
 * Drawings for the Veterans Day (Week 3) and America Recycles Day (Week 4) sets: the two
 * week-only weapons in both cameras, their stickers and toppers, and the symbols the
 * Warehouse and Junkyard hang on their walls. Pictures only; the fight math never reads them.
 */
import { RECYCLES_COLORS } from "@/lib/pit/recycles";
import { VETERANS_COLORS } from "@/lib/pit/veterans";

type Ctx = CanvasRenderingContext2D;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A five-point star centered on (x, y). */
export function star(c: Ctx, x: number, y: number, r: number) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
}

/** Three chasing arrows around a circle: the recycling mark. */
export function chasingArrows(c: Ctx, x: number, y: number, r: number, rot: number, color: string, width: number) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = width;
  c.lineCap = "butt";
  for (let i = 0; i < 3; i++) {
    const a0 = (i * 2 * Math.PI) / 3 - Math.PI / 2 + 0.34;
    const a1 = a0 + (2 * Math.PI) / 3 - 0.95;
    c.beginPath();
    c.arc(0, 0, r, a0, a1);
    c.stroke();
    const hx = Math.cos(a1) * r;
    const hy = Math.sin(a1) * r;
    const tx = -Math.sin(a1);
    const ty = Math.cos(a1);
    const head = width * 1.9;
    c.beginPath();
    c.moveTo(hx + tx * head * 1.2, hy + ty * head * 1.2);
    c.lineTo(hx + Math.cos(a1) * head, hy + Math.sin(a1) * head);
    c.lineTo(hx - Math.cos(a1) * head, hy - Math.sin(a1) * head);
    c.closePath();
    c.fill();
  }
  c.restore();
}

/** Thirteen stripes and a starred canton, flat. The arena adds the ripple shading live. */
export function flatFlag(c: Ctx, x: number, y: number, w: number, h: number) {
  const { red, white, navy } = VETERANS_COLORS;
  for (let s = 0; s < 13; s++) {
    c.fillStyle = s % 2 ? white : red;
    c.fillRect(x, y + (h * s) / 13, w, h / 13 + 0.5);
  }
  const cw = w * 0.4;
  const ch = (h * 7) / 13;
  c.fillStyle = navy;
  c.fillRect(x, y, cw, ch);
  c.fillStyle = white;
  for (let row = 0; row < 9; row++) {
    const n = row % 2 ? 5 : 6;
    for (let k = 0; k < n; k++) {
      const sx = x + (cw * (k * 2 + (row % 2 ? 2 : 1))) / 12;
      const sy = y + (ch * (row + 1)) / 10;
      star(c, sx, sy, Math.max(0.8, h * 0.022));
    }
  }
}

/* ------------------------------------------------------------------ */
/* Week-only weapons                                                    */
/* ------------------------------------------------------------------ */

/**
 * Side camera, front of the bot. Origin on the floor, +x forward, -y up; `deck` is the
 * hull top (negative). Rivet Gun: a pneumatic gun on a deck mount with a pressure gauge
 * and an air hose, firing a short burst of rivets. Can Crusher: a two-post press whose
 * plate slams down on a can.
 */
export function drawFallWeapon(c: Ctx, fam: string, fx: number, deck: number, u: number, stroke: number) {
  c.save();
  if (fam === "rivetgun") {
    const { olive, gold, white } = VETERANS_COLORS;
    const cy = deck * 0.55;
    const kick = stroke > 0.6 ? -0.025 * u * (1 - stroke) * 2.5 : 0;
    // Air hose back over the deck.
    c.strokeStyle = "#1b1b1b";
    c.lineWidth = 0.02 * u;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(fx - 0.04 * u, cy);
    c.bezierCurveTo(fx - 0.2 * u, cy + 0.05 * u, fx - 0.18 * u, deck - 0.1 * u, fx - 0.34 * u, deck - 0.02 * u);
    c.stroke();
    // Gun body.
    c.translate(kick, 0);
    c.fillStyle = olive;
    c.beginPath();
    c.roundRect(fx - 0.06 * u, cy - 0.06 * u, 0.26 * u, 0.12 * u, 0.025 * u);
    c.fill();
    c.fillStyle = "rgba(255,255,255,0.12)";
    c.fillRect(fx - 0.05 * u, cy - 0.055 * u, 0.24 * u, 0.02 * u);
    c.fillStyle = white;
    star(c, fx + 0.06 * u, cy + 0.01 * u, 0.03 * u);
    // Pressure gauge; the needle jumps on each shot.
    c.fillStyle = "#e9e4d8";
    c.strokeStyle = gold;
    c.lineWidth = 0.008 * u;
    c.beginPath();
    c.arc(fx + 0.14 * u, cy - 0.085 * u, 0.035 * u, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    const needle = lerp(-2.4, -0.5, stroke);
    c.strokeStyle = "#b22234";
    c.lineWidth = 0.006 * u;
    c.beginPath();
    c.moveTo(fx + 0.14 * u, cy - 0.085 * u);
    c.lineTo(fx + 0.14 * u + Math.cos(needle) * 0.028 * u, cy - 0.085 * u + Math.sin(needle) * 0.028 * u);
    c.stroke();
    // Barrel and muzzle.
    c.fillStyle = "#9aa0a6";
    c.fillRect(fx + 0.2 * u, cy - 0.025 * u, 0.13 * u, 0.05 * u);
    c.fillStyle = "#5e6368";
    c.fillRect(fx + 0.31 * u, cy - 0.035 * u, 0.03 * u, 0.07 * u);
    c.translate(-kick, 0);
    // A burst of rivets in flight.
    if (stroke > 0.15) {
      for (let k = 0; k < 3; k++) {
        const t = stroke - k * 0.18;
        if (t <= 0.1) continue;
        const rx = fx + 0.36 * u + t * 0.3 * u;
        c.fillStyle = "#d9dde1";
        c.beginPath();
        c.arc(rx + 0.02 * u, cy, 0.02 * u, -Math.PI / 2, Math.PI / 2);
        c.fill();
        c.fillRect(rx - 0.03 * u, cy - 0.007 * u, 0.05 * u, 0.014 * u);
      }
      if (stroke > 0.7) {
        c.fillStyle = `rgba(235,235,230,${(stroke - 0.7) * 1.6})`;
        c.beginPath();
        c.arc(fx + 0.37 * u, cy, 0.05 * u, 0, Math.PI * 2);
        c.fill();
      }
    }
  } else if (fam === "crusher") {
    const { green, can, yellow } = RECYCLES_COLORS;
    const x0 = fx - 0.07 * u;
    const x1 = fx + 0.19 * u;
    const beam = Math.max(deck - 0.1 * u, -0.42 * u);
    // Mounting arm off the hull, two posts and a top beam.
    c.fillStyle = "#6f7378";
    c.fillRect(x0 - 0.28 * u, -0.17 * u, 0.3 * u, 0.045 * u);
    c.fillStyle = "#3b3d40";
    c.fillRect(x0, beam, 0.035 * u, -beam);
    c.fillRect(x1 - 0.035 * u, beam, 0.035 * u, -beam);
    c.fillStyle = "#55585c";
    c.fillRect(x0 - 0.01 * u, beam - 0.04 * u, x1 - x0 + 0.02 * u, 0.05 * u);
    // The can under the press squashes as the plate lands.
    const plateTop = lerp(beam + 0.04 * u, -0.1 * u, stroke);
    const canH = Math.max(0.025 * u, Math.min(0.15 * u, -plateTop - 0.045 * u));
    const cx = (x0 + x1) / 2;
    c.fillStyle = green;
    c.fillRect(cx - 0.05 * u, -canH, 0.1 * u, canH);
    c.fillStyle = can;
    c.fillRect(cx - 0.05 * u, -canH, 0.1 * u, Math.min(0.015 * u, canH * 0.25));
    c.fillRect(cx - 0.05 * u, -0.012 * u, 0.1 * u, 0.012 * u);
    if (canH < 0.1 * u) {
      c.strokeStyle = "rgba(0,0,0,0.35)";
      c.lineWidth = 0.006 * u;
      for (let i = 1; i < 4; i++) {
        c.beginPath();
        c.moveTo(cx - 0.05 * u, -canH * (i / 4));
        c.lineTo(cx + 0.05 * u, -canH * (i / 4) - 0.008 * u * (i % 2 ? 1 : -1));
        c.stroke();
      }
    }
    // Ram and plate with a hazard edge.
    c.fillStyle = "#c9ccd0";
    c.fillRect(cx - 0.015 * u, beam + 0.01 * u, 0.03 * u, plateTop - beam);
    c.fillStyle = "#6f7378";
    c.fillRect(x0 + 0.03 * u, plateTop, x1 - x0 - 0.06 * u, 0.045 * u);
    c.save();
    c.beginPath();
    c.rect(x0 + 0.03 * u, plateTop + 0.03 * u, x1 - x0 - 0.06 * u, 0.015 * u);
    c.clip();
    for (let x = x0; x < x1; x += 0.03 * u) {
      c.fillStyle = yellow;
      c.beginPath();
      c.moveTo(x, plateTop + 0.045 * u);
      c.lineTo(x + 0.015 * u, plateTop + 0.03 * u);
      c.lineTo(x + 0.03 * u, plateTop + 0.03 * u);
      c.lineTo(x + 0.015 * u, plateTop + 0.045 * u);
      c.fill();
    }
    c.restore();
    if (stroke > 0.85) {
      c.fillStyle = "rgba(220,215,200,0.35)";
      c.beginPath();
      c.ellipse(cx, -0.01 * u, 0.2 * u, 0.03 * u, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();
}

/** Overhead camera: +x forward along the bot, `len` and `wid` are the bot's size. */
export function drawFallWeaponTop(c: Ctx, fam: string, len: number, wid: number, stroke: number) {
  if (fam === "rivetgun") {
    c.fillStyle = VETERANS_COLORS.olive;
    c.fillRect(len * 0.28, -wid * 0.12, len * 0.32, wid * 0.24);
    c.fillStyle = "#9aa0a6";
    c.fillRect(len * 0.6, -wid * 0.05, len * 0.2, wid * 0.1);
    c.fillStyle = VETERANS_COLORS.white;
    star(c, len * 0.42, 0, wid * 0.08);
    if (stroke > 0.15)
      for (let k = 0; k < 3; k++) {
        const t = stroke - k * 0.18;
        if (t <= 0.1) continue;
        c.fillStyle = "#d9dde1";
        c.beginPath();
        c.arc(len * (0.84 + t * 0.35), 0, wid * 0.045, 0, Math.PI * 2);
        c.fill();
      }
  } else if (fam === "crusher") {
    c.strokeStyle = "#3b3d40";
    c.lineWidth = Math.max(1, wid * 0.06);
    c.strokeRect(len * 0.42, -wid * 0.32, len * 0.42, wid * 0.64);
    c.fillStyle = stroke > 0.85 ? "#8f9398" : "#6f7378";
    c.fillRect(len * 0.46, -wid * 0.26, len * 0.34, wid * 0.52);
    c.strokeStyle = RECYCLES_COLORS.yellow;
    c.lineWidth = Math.max(1, wid * 0.03);
    c.strokeRect(len * 0.46, -wid * 0.26, len * 0.34, wid * 0.52);
    chasingArrows(c, len * 0.63, 0, wid * 0.13, 0, RECYCLES_COLORS.green, Math.max(1, wid * 0.04));
  }
}

/* ------------------------------------------------------------------ */
/* Stickers and toppers                                                 */
/* ------------------------------------------------------------------ */

/** The week's stickers. `cx`, `cy` center it on the panel and `r` is its radius. Returns false for other art. */
export function drawFallSticker(c: Ctx, art: string, cx: number, cy: number, r: number): boolean {
  const V = VETERANS_COLORS;
  const R = RECYCLES_COLORS;
  if (art === "dogtags") {
    // Two stamped tags on a bead chain.
    c.fillStyle = "#8d9197";
    for (let i = 0; i < 14; i++) {
      const a = Math.PI * (1.1 + (i / 13) * 0.8);
      c.beginPath();
      c.arc(cx + Math.cos(a) * r * 0.9, cy - r * 0.45 + Math.sin(a) * r * 0.6, Math.max(0.6, r * 0.06), 0, Math.PI * 2);
      c.fill();
    }
    for (const [dx, rot] of [[-0.18, -0.18], [0.2, 0.14]] as const) {
      c.save();
      c.translate(cx + dx * r, cy + r * 0.1);
      c.rotate(rot);
      c.fillStyle = V.tag;
      c.strokeStyle = "#5e6368";
      c.lineWidth = Math.max(0.6, r * 0.05);
      c.beginPath();
      c.roundRect(-r * 0.36, -r * 0.6, r * 0.72, r * 1.1, r * 0.2);
      c.fill();
      c.stroke();
      c.fillStyle = "#5e6368";
      c.beginPath();
      c.arc(0, -r * 0.44, r * 0.07, 0, Math.PI * 2);
      c.fill();
      for (let k = 0; k < 3; k++) c.fillRect(-r * 0.22, -r * 0.18 + k * r * 0.18, r * (k === 2 ? 0.28 : 0.44), Math.max(0.5, r * 0.05));
      c.restore();
    }
    return true;
  }
  if (art === "medal") {
    // A striped ribbon drape over a gold star medallion.
    const stripes = [V.navy, V.white, V.red, V.white, V.navy];
    const rw = r * 0.9;
    stripes.forEach((col, i) => {
      c.fillStyle = col;
      c.fillRect(cx - rw / 2 + (rw * i) / stripes.length, cy - r, rw / stripes.length + 0.3, r * 0.75);
    });
    c.fillStyle = V.gold;
    c.beginPath();
    c.arc(cx, cy + r * 0.25, r * 0.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#b8862a";
    star(c, cx, cy + r * 0.25, r * 0.34);
    return true;
  }
  if (art === "yellowribbon") {
    c.strokeStyle = "#f2c230";
    c.lineWidth = Math.max(1, r * 0.3);
    c.lineJoin = "round";
    c.lineCap = "butt";
    c.beginPath();
    c.moveTo(cx - r * 0.55, cy + r * 0.95);
    c.bezierCurveTo(cx + r * 0.55, cy - r * 0.1, cx + r * 0.55, cy - r * 1.05, cx, cy - r * 1.0);
    c.bezierCurveTo(cx - r * 0.55, cy - r * 1.05, cx - r * 0.55, cy - r * 0.1, cx + r * 0.55, cy + r * 0.95);
    c.stroke();
    return true;
  }
  if (art === "recycle") {
    c.fillStyle = "#f4f1ea";
    c.beginPath();
    c.arc(cx, cy, r * 1.05, 0, Math.PI * 2);
    c.fill();
    chasingArrows(c, cx, cy, r * 0.6, 0, R.green, Math.max(1, r * 0.2));
    return true;
  }
  if (art === "bottlecap") {
    // Crimped cap, top view.
    c.fillStyle = R.green;
    c.beginPath();
    for (let i = 0; i < 42; i++) {
      const a = (i / 42) * Math.PI * 2;
      const rr = i % 2 ? r * 0.88 : r;
      c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    c.closePath();
    c.fill();
    c.fillStyle = "#3cb868";
    c.beginPath();
    c.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(255,255,255,0.35)";
    c.beginPath();
    c.ellipse(cx - r * 0.25, cy - r * 0.3, r * 0.25, r * 0.1, -0.6, 0, Math.PI * 2);
    c.fill();
    chasingArrows(c, cx, cy, r * 0.36, 0, "#f4f1ea", Math.max(0.8, r * 0.11));
    return true;
  }
  if (art === "sprout") {
    c.fillStyle = "#5a3d24";
    c.beginPath();
    c.ellipse(cx, cy + r * 0.7, r * 0.75, r * 0.25, 0, Math.PI, 0);
    c.fill();
    c.strokeStyle = R.green;
    c.lineWidth = Math.max(1, r * 0.12);
    c.beginPath();
    c.moveTo(cx, cy + r * 0.6);
    c.quadraticCurveTo(cx - r * 0.1, cy, cx, cy - r * 0.35);
    c.stroke();
    c.fillStyle = R.leaf;
    for (const side of [-1, 1]) {
      c.beginPath();
      c.ellipse(cx + side * r * 0.32, cy - r * 0.45, r * 0.36, r * 0.17, side * -0.5, 0, Math.PI * 2);
      c.fill();
    }
    return true;
  }
  return false;
}

/** The week's toppers, centered on x = 0 with `top` the hull top. Returns false for others. */
export function drawFallTopper(c: Ctx, topper: string, top: number, u: number, time = 0): boolean {
  if (topper === "bugle") {
    const brass = "#d4a53a";
    c.fillStyle = "#3a3834";
    c.fillRect(-u * 0.015, top - u * 0.05, u * 0.03, u * 0.05);
    c.strokeStyle = brass;
    c.lineWidth = Math.max(1.2, u * 0.022);
    c.beginPath();
    c.ellipse(-u * 0.02, top - u * 0.1, u * 0.1, u * 0.04, 0, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.moveTo(-u * 0.18, top - u * 0.06);
    c.lineTo(u * 0.09, top - u * 0.1);
    c.stroke();
    c.fillStyle = brass;
    c.beginPath();
    c.moveTo(u * 0.08, top - u * 0.115);
    c.lineTo(u * 0.21, top - u * 0.17);
    c.lineTo(u * 0.21, top - u * 0.02);
    c.lineTo(u * 0.08, top - u * 0.085);
    c.closePath();
    c.fill();
    c.fillStyle = "#f2d27a";
    c.fillRect(-u * 0.2, top - u * 0.07, u * 0.03, u * 0.02);
    // Gold cord and tassel, swaying a little.
    const sway = Math.sin(time * 2) * u * 0.01;
    c.strokeStyle = VETERANS_COLORS.gold;
    c.lineWidth = Math.max(0.8, u * 0.008);
    c.beginPath();
    c.moveTo(-u * 0.1, top - u * 0.07);
    c.quadraticCurveTo(-u * 0.04, top + u * 0.0, u * 0.02 + sway, top - u * 0.02);
    c.stroke();
    c.fillStyle = VETERANS_COLORS.gold;
    c.fillRect(u * 0.01 + sway, top - u * 0.025, u * 0.025, u * 0.04);
    return true;
  }
  if (topper === "tincan") {
    c.save();
    c.translate(0, top);
    c.rotate(-0.12);
    const g = c.createLinearGradient(-u * 0.11, 0, u * 0.11, 0);
    g.addColorStop(0, "#8b9096");
    g.addColorStop(0.45, "#e6e9ec");
    g.addColorStop(1, "#7d8288");
    c.fillStyle = g;
    c.fillRect(-u * 0.11, -u * 0.24, u * 0.22, u * 0.24);
    c.fillStyle = RECYCLES_COLORS.green;
    c.fillRect(-u * 0.11, -u * 0.17, u * 0.22, u * 0.1);
    chasingArrows(c, 0, -u * 0.12, u * 0.03, time * 0.6, "#f4f1ea", Math.max(0.7, u * 0.009));
    c.strokeStyle = "rgba(0,0,0,0.3)";
    c.lineWidth = Math.max(0.6, u * 0.005);
    for (const y of [-0.21, -0.04]) {
      c.beginPath();
      c.moveTo(-u * 0.11, u * y);
      c.lineTo(u * 0.11, u * y);
      c.stroke();
    }
    c.fillStyle = "#cfd3d7";
    c.beginPath();
    c.ellipse(0, -u * 0.24, u * 0.11, u * 0.025, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#9aa0a6";
    c.lineWidth = Math.max(0.8, u * 0.01);
    c.beginPath();
    c.ellipse(u * 0.04, -u * 0.255, u * 0.03, u * 0.012, 0, 0, Math.PI * 2);
    c.stroke();
    c.restore();
    return true;
  }
  return false;
}
