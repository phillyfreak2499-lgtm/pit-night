/**
 * Weekly arenas. Week 1 is the original steel Pit; each later week fights somewhere new:
 * an outdoor ring at dusk, a warehouse, a junkyard at night, and the Grand Arena for
 * Championship Saturday. Scenes and floor hazards are pictures only: bots fight on the
 * same floor area and the fight math never reads the arena.
 */
import type { Spot } from "./cage-motion";

export type ArenaId = "pit" | "ring" | "warehouse" | "junkyard" | "grand";

export const ARENAS: Record<ArenaId, { name: string; blurb: string }> = {
  pit: { name: "The Pit", blurb: "The home cage: steel plate, glass, and a crowd behind it." },
  ring: { name: "The Ring", blurb: "Outdoors at dusk: a dirt ring, light towers and a chain-link fence." },
  warehouse: { name: "The Warehouse", blurb: "Brick, steel racks, shop lamps and a cracked concrete floor." },
  junkyard: { name: "The Junkyard", blurb: "Night, floodlights, scrap piles and a crusher in the middle." },
  grand: { name: "The Grand Arena", blurb: "Championship Saturday: a packed stadium and the big screen." },
};

export const ARENA_IDS = Object.keys(ARENAS) as ArenaId[];

/** The holiday dressing that belongs to each arena's week, so a replay keeps its own week's theme. */
export type ArenaTheme = "halloween" | "election" | "thanksgiving" | null;
export function arenaTheme(arena: ArenaId): ArenaTheme {
  return arena === "pit" ? "halloween" : arena === "ring" ? "election" : arena === "grand" ? "thanksgiving" : null;
}

/** Which arena a league week fights in. */
export function arenaForWeek(week: number): ArenaId {
  return week === 2 ? "ring" : week === 3 ? "warehouse" : week === 4 ? "junkyard" : week === 5 ? "grand" : "pit";
}

type Project = (spot: Spot, w: number, h: number) => { x: number; y: number; size: number };

/** What each arena calls its three floor hazards. The fight math is the same everywhere. */
export const HAZARD_NAMES: Record<ArenaId, { saw: string; pit: string; water: string }> = {
  pit: { saw: "Floor saw", pit: "The pit", water: "Water strip" },
  ring: { saw: "Tire bumper", pit: "Sand trap", water: "Oil slick" },
  warehouse: { saw: "Conveyor belt", pit: "Pallet pit", water: "Steam grate" },
  junkyard: { saw: "Scrap spikes", pit: "The crusher", water: "Rust puddle" },
  grand: { saw: "Pop-up hammer", pit: "The trapdoor", water: "Slick floor" },
};

/** A broadcast callout for a hazard mark: what hit (or was dodged) and for how much. */
export function hazardCallout(arena: ArenaId, kind: string, damage: number): { text: string; hit: boolean } | null {
  const names = HAZARD_NAMES[arena];
  if (kind === "jet") return { text: `FLAME JET -${damage}`, hit: true };
  if (kind === "saw") return { text: `${names.saw.toUpperCase()} -${damage}`, hit: true };
  if (kind === "pit") return { text: `${names.pit.toUpperCase()} -${damage}`, hit: true };
  if (kind === "water") return { text: `${names.water.toUpperCase()}: SLOWED`, hit: true };
  if (kind === "swerve") return { text: damage > 0 ? `SWERVED: ONLY -${damage}` : "SWERVED IT", hit: damage > 0 };
  if (kind === "hover") return { text: `HOVERED OVER ${names.pit.toUpperCase().replace(/^THE /, "")}`, hit: false };
  if (kind === "air") return { text: "AIR CUSHION: NO EFFECT", hit: false };
  return null;
}

function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** The four corners of the fighting floor, a little past the edges bots reach. */
function floorQuad(P: Project, w: number, h: number) {
  const bl = P({ x: -0.04, y: -0.04 }, w, h);
  const br = P({ x: 1.04, y: -0.04 }, w, h);
  const fr = P({ x: 1.08, y: 1.12 }, w, h);
  const fl = P({ x: -0.08, y: 1.12 }, w, h);
  return { bl, br, fr, fl };
}

function quadPath(c: CanvasRenderingContext2D, q: ReturnType<typeof floorQuad>) {
  c.beginPath();
  c.moveTo(q.bl.x, q.bl.y);
  c.lineTo(q.br.x, q.br.y);
  c.lineTo(q.fr.x, q.fr.y);
  c.lineTo(q.fl.x, q.fl.y);
  c.closePath();
}

function glow(c: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}

function crowd(c: CanvasRenderingContext2D, w: number, y0: number, y1: number, rows: number, rnd: () => number, flash = 0) {
  for (let row = 0; row < rows; row++) {
    const y = y0 + ((y1 - y0) * row) / Math.max(1, rows - 1);
    const r = w * (0.0045 + (row / rows) * 0.004);
    for (let x = -r; x < w + r; x += r * (2 + rnd())) {
      const tone = 18 + row * 3 + rnd() * 14;
      c.fillStyle = `rgb(${tone},${tone - 2},${tone + 4})`;
      c.beginPath();
      c.arc(x, y + (rnd() - 0.5) * r, r, 0, Math.PI * 2);
      c.fill();
      if (rnd() < flash) glow(c, x, y, r * 3, "255,250,235", 0.7);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Static scenes (cached by the caller)                                 */
/* ------------------------------------------------------------------ */

export function paintArenaScene(c: CanvasRenderingContext2D, w: number, h: number, arena: ArenaId, P: Project) {
  if (arena === "ring") paintRing(c, w, h, P);
  else if (arena === "warehouse") paintWarehouse(c, w, h, P);
  else if (arena === "junkyard") paintJunkyard(c, w, h, P);
  else if (arena === "grand") paintGrand(c, w, h, P);
}

function paintRing(c: CanvasRenderingContext2D, w: number, h: number, P: Project) {
  const rnd = seeded(211);
  const horizon = h * 0.36;
  const sky = c.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#1f1b33");
  sky.addColorStop(0.55, "#7a3f45");
  sky.addColorStop(1, "#f08a3c");
  c.fillStyle = sky;
  c.fillRect(0, 0, w, horizon);
  glow(c, w * 0.62, horizon, w * 0.16, "255,190,110", 0.75);
  c.fillStyle = "#ffd28a";
  c.beginPath();
  c.arc(w * 0.62, horizon, w * 0.035, Math.PI, 0);
  c.fill();
  // Far skyline and hills.
  c.fillStyle = "#2a1f2a";
  for (let x = 0; x < w; x += w * 0.03) {
    const bh = h * (0.03 + rnd() * 0.07);
    c.fillRect(x, horizon - bh, w * 0.026, bh);
  }
  c.fillStyle = "#1c1a1c";
  c.beginPath();
  c.moveTo(0, horizon);
  for (let x = 0; x <= w; x += w / 12) c.lineTo(x, horizon - h * 0.02 - Math.sin(x / w * 7) * h * 0.012);
  c.lineTo(w, horizon + 2);
  c.lineTo(0, horizon + 2);
  c.fill();
  // Ground beyond the ring.
  const ground = c.createLinearGradient(0, horizon, 0, h);
  ground.addColorStop(0, "#2a2a1c");
  ground.addColorStop(1, "#141410");
  c.fillStyle = ground;
  c.fillRect(0, horizon, w, h - horizon);
  // Bleachers with a crowd, low behind the fence.
  c.fillStyle = "#3a3632";
  c.fillRect(w * 0.08, horizon + h * 0.01, w * 0.84, h * 0.06);
  crowd(c, w, horizon + h * 0.02, horizon + h * 0.06, 3, rnd, 0.01);
  // Light towers.
  for (const x of [w * 0.06, w * 0.94]) {
    c.fillStyle = "#1a1a1a";
    c.fillRect(x - w * 0.004, h * 0.08, w * 0.008, h * 0.4);
    c.fillStyle = "#2b2b2b";
    c.fillRect(x - w * 0.03, h * 0.06, w * 0.06, h * 0.03);
    for (let i = 0; i < 4; i++) glow(c, x - w * 0.022 + i * w * 0.015, h * 0.075, w * 0.03, "255,244,214", 0.9);
  }
  // The ring: a dirt circle with a concrete curb, wider than the floor bots use.
  const back = P({ x: 0.5, y: -0.06 }, w, h);
  const front = P({ x: 0.5, y: 1.14 }, w, h);
  const side = P({ x: 1.1, y: 1.0 }, w, h);
  const cx = w / 2;
  const cy = (back.y + front.y) / 2;
  const rx = side.x - cx;
  const ry = (front.y - back.y) / 2;
  c.fillStyle = "#9c9488";
  c.beginPath();
  c.ellipse(cx, cy, rx * 1.05, ry * 1.08, 0, 0, Math.PI * 2);
  c.fill();
  const dirt = c.createRadialGradient(cx, cy, ry * 0.1, cx, cy, rx);
  dirt.addColorStop(0, "#8c6a46");
  dirt.addColorStop(0.7, "#6d5036");
  dirt.addColorStop(1, "#4d3826");
  c.fillStyle = dirt;
  c.beginPath();
  c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
  // Raked dirt and tire tracks.
  c.strokeStyle = "rgba(40,28,18,0.35)";
  c.lineWidth = Math.max(1, w * 0.0015);
  for (let i = 0; i < 14; i++) {
    c.beginPath();
    c.ellipse(cx + (rnd() - 0.5) * rx * 0.6, cy + (rnd() - 0.5) * ry * 0.6, rx * (0.2 + rnd() * 0.4), ry * (0.1 + rnd() * 0.3), 0, rnd() * 6, rnd() * 6 + 1.5);
    c.stroke();
  }
  // Chain-link fence along the back of the ring.
  c.strokeStyle = "rgba(190,190,180,0.35)";
  c.lineWidth = Math.max(1, w * 0.001);
  const top = h * 0.12;
  for (let a = Math.PI; a <= Math.PI * 2 + 0.001; a += Math.PI / 40) {
    const x = cx + Math.cos(a) * rx * 1.05;
    const y = cy + Math.sin(a) * ry * 1.08;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x, y - (y - top) * 0.32);
    c.stroke();
  }
  c.strokeStyle = "#6f6a62";
  c.lineWidth = Math.max(2, w * 0.003);
  for (const a of [Math.PI, Math.PI * 1.25, Math.PI * 1.5, Math.PI * 1.75, Math.PI * 2]) {
    const x = cx + Math.cos(a) * rx * 1.05;
    const y = cy + Math.sin(a) * ry * 1.08;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x, y - (y - top) * 0.34);
    c.stroke();
  }
}

function paintWarehouse(c: CanvasRenderingContext2D, w: number, h: number, P: Project) {
  const rnd = seeded(331);
  const q = floorQuad(P, w, h);
  // Brick back wall.
  c.fillStyle = "#3a2420";
  c.fillRect(0, 0, w, h);
  const bh = h * 0.022;
  const bw = w * 0.045;
  for (let row = 0; row * bh < q.bl.y; row++) {
    for (let x = row % 2 ? -bw / 2 : 0; x < w; x += bw) {
      const tone = 52 + rnd() * 22;
      c.fillStyle = `rgb(${tone + 20},${tone - 10},${tone - 18})`;
      c.fillRect(x + 1, row * bh + 1, bw - 2, bh - 2);
    }
  }
  // High windows letting in a cold night.
  for (let i = 0; i < 5; i++) {
    const x = w * (0.14 + i * 0.17);
    c.fillStyle = "#11161c";
    c.fillRect(x, h * 0.05, w * 0.1, h * 0.09);
    c.fillStyle = "rgba(160,180,200,0.18)";
    c.fillRect(x + 2, h * 0.05 + 2, w * 0.1 - 4, h * 0.09 - 4);
    c.strokeStyle = "#0b0d10";
    c.lineWidth = Math.max(1, w * 0.002);
    c.beginPath();
    c.moveTo(x + w * 0.05, h * 0.05);
    c.lineTo(x + w * 0.05, h * 0.14);
    c.moveTo(x, h * 0.095);
    c.lineTo(x + w * 0.1, h * 0.095);
    c.stroke();
  }
  // Steel racks with boxes on both sides.
  for (const [x0, x1] of [[0, w * 0.2], [w * 0.8, w]] as const) {
    c.fillStyle = "#c46a1c";
    for (let lvl = 0; lvl < 4; lvl++) c.fillRect(x0, h * (0.16 + lvl * 0.075), x1 - x0, h * 0.008);
    c.fillStyle = "#2a2f36";
    c.fillRect(x0 + w * 0.01, h * 0.14, w * 0.008, h * 0.32);
    c.fillRect(x1 - w * 0.018, h * 0.14, w * 0.008, h * 0.32);
    for (let lvl = 0; lvl < 4; lvl++)
      for (let x = x0 + w * 0.025; x < x1 - w * 0.04; x += w * 0.035) {
        if (rnd() < 0.25) continue;
        const bx = h * (0.04 + rnd() * 0.025);
        c.fillStyle = rnd() < 0.5 ? "#9a7a4e" : "#7d6240";
        c.fillRect(x, h * (0.16 + lvl * 0.075) - bx, w * 0.03, bx);
      }
  }
  // Floor: cracked concrete with safety lines.
  const conc = c.createLinearGradient(0, q.bl.y, 0, q.fl.y);
  conc.addColorStop(0, "#56534e");
  conc.addColorStop(1, "#2f2d2a");
  c.fillStyle = conc;
  c.fillRect(0, q.bl.y, w, h - q.bl.y);
  quadPath(c, q);
  c.fillStyle = "rgba(0,0,0,0.12)";
  c.fill();
  c.strokeStyle = "#e3b23c";
  c.lineWidth = Math.max(2, w * 0.004);
  quadPath(c, q);
  c.stroke();
  c.strokeStyle = "rgba(0,0,0,0.45)";
  c.lineWidth = Math.max(1, w * 0.0015);
  for (let i = 0; i < 9; i++) {
    let x = q.fl.x + rnd() * (q.fr.x - q.fl.x);
    let y = q.bl.y + rnd() * (q.fl.y - q.bl.y);
    c.beginPath();
    c.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (rnd() - 0.5) * w * 0.06;
      y += (rnd() - 0.3) * h * 0.03;
      c.lineTo(x, y);
    }
    c.stroke();
  }
  for (let i = 0; i < 6; i++) {
    c.fillStyle = "rgba(10,10,10,0.25)";
    c.beginPath();
    c.ellipse(q.fl.x + rnd() * (q.fr.x - q.fl.x), q.bl.y + rnd() * (q.fl.y - q.bl.y), w * (0.02 + rnd() * 0.03), h * 0.008, 0, 0, Math.PI * 2);
    c.fill();
  }
  // Hanging shop lamps with light cones.
  for (let i = 0; i < 4; i++) {
    const x = w * (0.2 + i * 0.2);
    c.strokeStyle = "#1a1a1a";
    c.lineWidth = Math.max(1, w * 0.0015);
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, h * 0.16);
    c.stroke();
    c.fillStyle = "#3b3f3a";
    c.beginPath();
    c.moveTo(x - w * 0.025, h * 0.19);
    c.lineTo(x + w * 0.025, h * 0.19);
    c.lineTo(x + w * 0.01, h * 0.16);
    c.lineTo(x - w * 0.01, h * 0.16);
    c.fill();
    const cone = c.createLinearGradient(0, h * 0.19, 0, h * 0.85);
    cone.addColorStop(0, "rgba(255,236,190,0.22)");
    cone.addColorStop(1, "rgba(255,236,190,0)");
    c.fillStyle = cone;
    c.beginPath();
    c.moveTo(x - w * 0.025, h * 0.19);
    c.lineTo(x + w * 0.025, h * 0.19);
    c.lineTo(x + w * 0.12, h * 0.85);
    c.lineTo(x - w * 0.12, h * 0.85);
    c.fill();
  }
}

function paintJunkyard(c: CanvasRenderingContext2D, w: number, h: number, P: Project) {
  const rnd = seeded(419);
  const q = floorQuad(P, w, h);
  const sky = c.createLinearGradient(0, 0, 0, q.bl.y);
  sky.addColorStop(0, "#06080d");
  sky.addColorStop(1, "#1b1f27");
  c.fillStyle = sky;
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) {
    c.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.6})`;
    c.fillRect(rnd() * w, rnd() * h * 0.25, 1.4, 1.4);
  }
  glow(c, w * 0.2, h * 0.08, w * 0.06, "230,235,245", 0.5);
  c.fillStyle = "#e6e9ee";
  c.beginPath();
  c.arc(w * 0.2, h * 0.08, w * 0.018, 0, Math.PI * 2);
  c.fill();
  // Scrap piles: jagged silhouettes with a few rust highlights.
  for (let i = 0; i < 6; i++) {
    const x = w * (i / 5);
    const pw = w * (0.18 + rnd() * 0.1);
    const ph = h * (0.12 + rnd() * 0.12);
    c.fillStyle = i % 2 ? "#1c1a18" : "#24201c";
    c.beginPath();
    c.moveTo(x - pw / 2, q.bl.y);
    for (let k = 0; k <= 8; k++) c.lineTo(x - pw / 2 + (pw * k) / 8, q.bl.y - ph * Math.sin((k / 8) * Math.PI) * (0.7 + rnd() * 0.4));
    c.lineTo(x + pw / 2, q.bl.y);
    c.fill();
    for (let k = 0; k < 4; k++) {
      c.fillStyle = `rgba(${150 + rnd() * 60},${70 + rnd() * 30},30,0.5)`;
      c.fillRect(x - pw / 3 + rnd() * pw * 0.6, q.bl.y - ph * (0.2 + rnd() * 0.5), w * 0.012, h * 0.006);
    }
  }
  // Crushed car stack, left.
  const colors = ["#5a2b20", "#2e4a3a", "#57502e", "#3e3e44"];
  for (let i = 0; i < 4; i++) {
    c.fillStyle = colors[i]!;
    c.fillRect(w * 0.02, q.bl.y - h * (0.035 * (i + 1)), w * 0.13, h * 0.032);
    c.fillStyle = "rgba(0,0,0,0.35)";
    c.fillRect(w * 0.02, q.bl.y - h * (0.035 * (i + 1)) + h * 0.022, w * 0.13, h * 0.01);
  }
  // Crane with a magnet, right.
  c.strokeStyle = "#c48a1c";
  c.lineWidth = Math.max(2, w * 0.004);
  c.beginPath();
  c.moveTo(w * 0.86, q.bl.y);
  c.lineTo(w * 0.86, h * 0.1);
  c.lineTo(w * 0.62, h * 0.06);
  c.stroke();
  c.strokeStyle = "#333";
  c.lineWidth = Math.max(1, w * 0.0015);
  c.beginPath();
  c.moveTo(w * 0.64, h * 0.065);
  c.lineTo(w * 0.64, h * 0.2);
  c.stroke();
  c.fillStyle = "#2b2b2b";
  c.beginPath();
  c.ellipse(w * 0.64, h * 0.215, w * 0.025, h * 0.012, 0, 0, Math.PI * 2);
  c.fill();
  // Corrugated fence and floodlights.
  c.fillStyle = "#2a2d31";
  c.fillRect(0, q.bl.y - h * 0.045, w, h * 0.045);
  c.strokeStyle = "rgba(0,0,0,0.5)";
  for (let x = 0; x < w; x += w * 0.012) {
    c.beginPath();
    c.moveTo(x, q.bl.y - h * 0.045);
    c.lineTo(x, q.bl.y);
    c.stroke();
  }
  for (const x of [w * 0.3, w * 0.7]) glow(c, x, q.bl.y - h * 0.06, w * 0.08, "255,240,200", 0.55);
  // Dirt and gravel floor.
  const dirt = c.createLinearGradient(0, q.bl.y, 0, h);
  dirt.addColorStop(0, "#3d3328");
  dirt.addColorStop(1, "#211b15");
  c.fillStyle = dirt;
  c.fillRect(0, q.bl.y, w, h - q.bl.y);
  for (let i = 0; i < 400; i++) {
    c.fillStyle = `rgba(${90 + rnd() * 60},${80 + rnd() * 40},${60 + rnd() * 30},0.5)`;
    c.fillRect(rnd() * w, q.bl.y + rnd() * (h - q.bl.y), 1.5, 1.5);
  }
}

function paintGrand(c: CanvasRenderingContext2D, w: number, h: number, P: Project) {
  const rnd = seeded(509);
  const q = floorQuad(P, w, h);
  c.fillStyle = "#07070a";
  c.fillRect(0, 0, w, h);
  // Tiers of crowd, upper and lower bowls, with camera flashes.
  crowd(c, w, h * 0.05, h * 0.16, 6, rnd, 0.015);
  c.fillStyle = "#16151c";
  c.fillRect(0, h * 0.17, w, h * 0.012);
  glow(c, w * 0.5, h * 0.176, w * 0.5, "240,162,2", 0.08);
  crowd(c, w, h * 0.2, h * 0.36, 8, rnd, 0.02);
  // The big screen.
  const sx = w * 0.36;
  const sw = w * 0.28;
  c.fillStyle = "#101014";
  c.fillRect(sx - w * 0.01, h * 0.005, sw + w * 0.02, h * 0.1);
  const screen = c.createLinearGradient(0, h * 0.01, 0, h * 0.1);
  screen.addColorStop(0, "#2a1d06");
  screen.addColorStop(1, "#5a3a05");
  c.fillStyle = screen;
  c.fillRect(sx, h * 0.012, sw, h * 0.085);
  c.fillStyle = "#ffd166";
  c.font = `bold ${Math.max(8, h * 0.032)}px Oswald, Impact, sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("WATERMAN CHAMPIONSHIP", w / 2, h * 0.055);
  // Spotlight beams sweeping down from the rafters.
  for (const [x, tilt] of [[w * 0.12, 0.3], [w * 0.88, -0.3], [w * 0.3, 0.12], [w * 0.7, -0.12]] as const) {
    const beam = c.createLinearGradient(x, 0, x + tilt * w, h * 0.8);
    beam.addColorStop(0, "rgba(255,246,220,0.18)");
    beam.addColorStop(1, "rgba(255,246,220,0)");
    c.fillStyle = beam;
    c.beginPath();
    c.moveTo(x - w * 0.008, 0);
    c.lineTo(x + w * 0.008, 0);
    c.lineTo(x + tilt * w + w * 0.07, h * 0.8);
    c.lineTo(x + tilt * w - w * 0.07, h * 0.8);
    c.fill();
  }
  // Polished floor with a gold border and the center crest.
  const floor = c.createLinearGradient(0, q.bl.y, 0, h);
  floor.addColorStop(0, "#1d1b22");
  floor.addColorStop(1, "#0c0b0f");
  c.fillStyle = floor;
  c.fillRect(0, q.bl.y - h * 0.01, w, h);
  c.fillStyle = "#1a1010";
  c.fillRect(0, q.bl.y - h * 0.035, w, h * 0.025);
  c.fillStyle = "rgba(240,162,2,0.85)";
  c.fillRect(0, q.bl.y - h * 0.012, w, h * 0.004);
  quadPath(c, q);
  c.strokeStyle = "#d7a922";
  c.lineWidth = Math.max(2, w * 0.005);
  c.stroke();
  const mid = P({ x: 0.5, y: 0.55 }, w, h);
  c.strokeStyle = "rgba(215,169,34,0.55)";
  c.lineWidth = Math.max(1.5, w * 0.003);
  c.beginPath();
  c.ellipse(mid.x, mid.y, mid.size * 1.4, mid.size * 0.32, 0, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = "rgba(215,169,34,0.25)";
  c.font = `bold ${Math.max(10, mid.size * 0.5)}px Oswald, Impact, sans-serif`;
  c.save();
  c.translate(mid.x, mid.y);
  c.scale(1, 0.32);
  c.fillText("W", 0, 0);
  c.restore();
  // Floor reflection of the lights.
  const sheen = c.createLinearGradient(0, q.bl.y, 0, q.fl.y);
  sheen.addColorStop(0, "rgba(255,240,210,0.08)");
  sheen.addColorStop(0.5, "rgba(255,240,210,0)");
  c.fillStyle = sheen;
  quadPath(c, q);
  c.fill();
}

/* ------------------------------------------------------------------ */
/* Animated floor hazards (pictures only)                               */
/* ------------------------------------------------------------------ */

export function drawArenaHazards(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, arena: ArenaId, P: Project) {
  const at = (x: number, y: number) => P({ x, y }, w, h);
  if (arena === "ring") {
    // Oil slick with a moving sheen, a sand trap, and tire-stack bumpers.
    const oil = at(0.3, 0.72);
    ctx.fillStyle = "rgba(8,8,10,0.8)";
    ctx.beginPath();
    ctx.ellipse(oil.x, oil.y, oil.size * 0.45, oil.size * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    const s = ctx.createLinearGradient(oil.x - oil.size * 0.45, 0, oil.x + oil.size * 0.45, 0);
    const k = (Math.sin(time * 0.8) + 1) / 2;
    s.addColorStop(Math.max(0, k - 0.15), "rgba(120,200,160,0)");
    s.addColorStop(k, "rgba(190,150,255,0.25)");
    s.addColorStop(Math.min(1, k + 0.15), "rgba(255,210,120,0)");
    ctx.fillStyle = s;
    ctx.fill();
    const sand = at(0.6, 0.42);
    ctx.fillStyle = "rgba(214,184,130,0.75)";
    ctx.beginPath();
    ctx.ellipse(sand.x, sand.y, sand.size * 0.42, sand.size * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(150,120,80,0.6)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(sand.x, sand.y, sand.size * 0.12 * i, sand.size * 0.025 * i, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const x of [0.04, 0.96]) {
      const t = at(x, 0.55);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i % 2 ? "#1b1b1b" : "#262626";
        ctx.beginPath();
        ctx.ellipse(t.x, t.y - i * t.size * 0.07, t.size * 0.14, t.size * 0.045, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (arena === "warehouse") {
    // A conveyor belt across the back, steam grates, and a pallet pit.
    const l = at(0.18, 0.3);
    const r = at(0.82, 0.3);
    const beltH = l.size * 0.06;
    ctx.fillStyle = "#1c1f22";
    ctx.fillRect(l.x, l.y - beltH / 2, r.x - l.x, beltH);
    ctx.strokeStyle = "#e3b23c";
    ctx.lineWidth = Math.max(1, beltH * 0.18);
    const step = l.size * 0.12;
    const shift = (time * step * 1.5) % step;
    for (let x = l.x + shift; x < r.x - step * 0.3; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, l.y - beltH * 0.35);
      ctx.lineTo(x + step * 0.3, l.y);
      ctx.lineTo(x, l.y + beltH * 0.35);
      ctx.stroke();
    }
    for (const x of [0.22, 0.78]) {
      const g = at(x, 0.82);
      ctx.fillStyle = "#121314";
      ctx.fillRect(g.x - g.size * 0.14, g.y - g.size * 0.03, g.size * 0.28, g.size * 0.06);
      ctx.strokeStyle = "#3c3f42";
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(g.x + i * g.size * 0.035, g.y - g.size * 0.03);
        ctx.lineTo(g.x + i * g.size * 0.035, g.y + g.size * 0.03);
        ctx.stroke();
      }
      for (let i = 0; i < 4; i++) {
        const p = (time * 0.7 + i / 4 + x) % 1;
        ctx.fillStyle = `rgba(220,220,215,${0.25 * (1 - p)})`;
        ctx.beginPath();
        ctx.arc(g.x + Math.sin(p * 6 + i) * g.size * 0.04, g.y - p * g.size * 0.6, g.size * (0.05 + p * 0.1), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const pit = at(0.5, 0.62);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(pit.x - pit.size * 0.3, pit.y - pit.size * 0.06, pit.size * 0.6, pit.size * 0.12);
    ctx.strokeStyle = "#8a6a3e";
    ctx.lineWidth = Math.max(1, pit.size * 0.02);
    ctx.strokeRect(pit.x - pit.size * 0.3, pit.y - pit.size * 0.06, pit.size * 0.6, pit.size * 0.12);
  } else if (arena === "junkyard") {
    // A crusher plate with a pumping ram, rust puddles, and scrap spikes.
    const plate = at(0.5, 0.56);
    ctx.fillStyle = "#4a4640";
    ctx.beginPath();
    ctx.ellipse(plate.x, plate.y, plate.size * 0.32, plate.size * 0.075, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e3b23c";
    ctx.setLineDash([plate.size * 0.05, plate.size * 0.05]);
    ctx.lineWidth = Math.max(1, plate.size * 0.015);
    ctx.stroke();
    ctx.setLineDash([]);
    const lift = (Math.sin(time * 1.6) + 1) / 2;
    const ramY = plate.y - plate.size * (0.15 + lift * 0.9);
    ctx.fillStyle = "#2a2a2c";
    ctx.fillRect(plate.x - plate.size * 0.03, 0, plate.size * 0.06, ramY);
    ctx.fillStyle = "#5b5650";
    ctx.fillRect(plate.x - plate.size * 0.28, ramY, plate.size * 0.56, plate.size * 0.1);
    if (lift < 0.08) {
      ctx.fillStyle = "rgba(200,190,170,0.3)";
      ctx.beginPath();
      ctx.ellipse(plate.x, plate.y, plate.size * 0.5, plate.size * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const [x, y] of [[0.22, 0.34], [0.74, 0.86]] as const) {
      const p = at(x, y);
      ctx.fillStyle = "rgba(110,52,20,0.55)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size * 0.22, p.size * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const x of [0.06, 0.94]) {
      const p = at(x, 0.78);
      ctx.fillStyle = "#6e6a62";
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(p.x + (i - 1) * p.size * 0.08 - p.size * 0.03, p.y);
        ctx.lineTo(p.x + (i - 1) * p.size * 0.08, p.y - p.size * 0.18);
        ctx.lineTo(p.x + (i - 1) * p.size * 0.08 + p.size * 0.03, p.y);
        ctx.fill();
      }
    }
  } else if (arena === "grand") {
    // A lit trapdoor in the center and pop-up hammers on both sides.
    const door = at(0.5, 0.64);
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.beginPath();
    ctx.ellipse(door.x, door.y, door.size * 0.3, door.size * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const on = Math.floor(time * 6 + i) % 3 === 0;
      ctx.fillStyle = on ? "#ffd166" : "#5a4410";
      ctx.beginPath();
      ctx.arc(door.x + Math.cos(a) * door.size * 0.3, door.y + Math.sin(a) * door.size * 0.07, Math.max(1.2, door.size * 0.012), 0, Math.PI * 2);
      ctx.fill();
    }
    for (const [x, phase] of [[0.12, 0], [0.88, 0.5]] as const) {
      const p = at(x, 0.7);
      const cycle = (time * 0.5 + phase) % 1;
      const up = cycle < 0.6 ? 0 : cycle < 0.75 ? (cycle - 0.6) / 0.15 : 1 - (cycle - 0.75) / 0.25;
      ctx.fillStyle = "#151515";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size * 0.12, p.size * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
      const head = p.y - p.size * (0.05 + up * 0.35);
      ctx.fillStyle = "#8e8a82";
      ctx.fillRect(p.x - p.size * 0.015, head, p.size * 0.03, p.y - head);
      ctx.fillStyle = up > 0.9 ? "#ff8a3a" : "#c9c4ba";
      ctx.fillRect(p.x - p.size * 0.08, head - p.size * 0.06, p.size * 0.16, p.size * 0.07);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Overhead camera                                                      */
/* ------------------------------------------------------------------ */

export function drawArenaTopScene(
  ctx: CanvasRenderingContext2D,
  g: { x0: number; y0: number; s: number },
  time: number,
  arena: ArenaId,
) {
  const tint: Record<ArenaId, string> = {
    pit: "rgba(0,0,0,0)",
    ring: "rgba(120,88,56,0.55)",
    warehouse: "rgba(82,80,76,0.5)",
    junkyard: "rgba(70,56,40,0.55)",
    grand: "rgba(24,22,30,0.6)",
  };
  ctx.fillStyle = tint[arena];
  ctx.fillRect(g.x0, g.y0, g.s, g.s);
  const at = (x: number, y: number) => ({ x: g.x0 + x * g.s, y: g.y0 + y * g.s });
  if (arena === "ring") {
    ctx.strokeStyle = "#bdb6a8";
    ctx.lineWidth = Math.max(2, g.s * 0.02);
    ctx.beginPath();
    ctx.arc(g.x0 + g.s / 2, g.y0 + g.s / 2, g.s * 0.48, 0, Math.PI * 2);
    ctx.stroke();
    const oil = at(0.3, 0.72);
    ctx.fillStyle = "rgba(8,8,10,0.8)";
    ctx.beginPath();
    ctx.ellipse(oil.x, oil.y, g.s * 0.09, g.s * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    const sand = at(0.6, 0.42);
    ctx.fillStyle = "rgba(214,184,130,0.75)";
    ctx.beginPath();
    ctx.ellipse(sand.x, sand.y, g.s * 0.09, g.s * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (arena === "warehouse") {
    const l = at(0.18, 0.3);
    ctx.fillStyle = "#1c1f22";
    ctx.fillRect(l.x, l.y - g.s * 0.025, g.s * 0.64, g.s * 0.05);
    ctx.strokeStyle = "#e3b23c";
    const step = g.s * 0.05;
    for (let x = l.x + ((time * step) % step); x < l.x + g.s * 0.62; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, l.y - g.s * 0.015);
      ctx.lineTo(x + step * 0.3, l.y);
      ctx.lineTo(x, l.y + g.s * 0.015);
      ctx.stroke();
    }
    ctx.strokeStyle = "#e3b23c";
    ctx.lineWidth = Math.max(1, g.s * 0.008);
    ctx.strokeRect(g.x0 + 2, g.y0 + 2, g.s - 4, g.s - 4);
  } else if (arena === "junkyard") {
    const p = at(0.5, 0.56);
    const lift = (Math.sin(time * 1.6) + 1) / 2;
    ctx.fillStyle = lift < 0.1 ? "#7a7468" : "#4a4640";
    ctx.fillRect(p.x - g.s * 0.08, p.y - g.s * 0.08, g.s * 0.16, g.s * 0.16);
    ctx.strokeStyle = "#e3b23c";
    ctx.strokeRect(p.x - g.s * 0.08, p.y - g.s * 0.08, g.s * 0.16, g.s * 0.16);
  } else if (arena === "grand") {
    ctx.strokeStyle = "#d7a922";
    ctx.lineWidth = Math.max(2, g.s * 0.012);
    ctx.strokeRect(g.x0 + 3, g.y0 + 3, g.s - 6, g.s - 6);
    const door = at(0.5, 0.64);
    ctx.strokeStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(door.x, door.y, g.s * 0.07, 0, Math.PI * 2);
    ctx.stroke();
  }
}
