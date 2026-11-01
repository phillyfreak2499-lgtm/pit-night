import type { CommercialScene } from "@/lib/pit/commercials";

const DEEP = "#080807";
const AMBER = "#f0a202";
const SPARK = "#ff5a1f";
const FG = "#f3efe6";
const MUTED = "#a39b90";
const LINE = "#3a342c";
const STEEL = "#6a645a";
const STEEL_DARK = "#3a3630";

/** Procedural picture for a house spot. `t` is seconds. Deterministic: no Math.random. */
export function paintCommercial(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, scene: CommercialScene) {
  if (w < 2 || h < 2) return;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = DEEP;
  ctx.fillRect(0, 0, w, h);

  const vw = 1000;
  const vh = 640;
  const scale = Math.min(w / vw, h / vh);
  ctx.save();
  ctx.translate((w - vw * scale) / 2, (h - vh * scale) / 2);
  ctx.scale(scale, scale);
  backdrop(ctx, vw, vh, scene);
  if (scene === "mutual") paintMutual(ctx, t);
  else if (scene === "voltage") paintVoltage(ctx, t);
  else if (scene === "sals") paintSals(ctx, t);
  else if (scene === "brain") paintBrain(ctx, t);
  else if (scene === "hotline") paintHotline(ctx, t);
  else paintNap(ctx, t);
  hazardBand(ctx, vw, vh - 16);
  vignette(ctx, vw, vh);
  ctx.restore();
}

function backdrop(ctx: CanvasRenderingContext2D, w: number, h: number, scene: CommercialScene) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  if (scene === "voltage") {
    g.addColorStop(0, "#1a1204");
    g.addColorStop(1, "#070604");
  } else if (scene === "sals") {
    g.addColorStop(0, "#2a160c");
    g.addColorStop(1, "#100c09");
  } else if (scene === "brain") {
    g.addColorStop(0, "#10161c");
    g.addColorStop(1, "#080a0c");
  } else if (scene === "nap") {
    g.addColorStop(0, "#10141c");
    g.addColorStop(1, "#07080c");
  } else if (scene === "mutual") {
    g.addColorStop(0, "#141a12");
    g.addColorStop(1, "#0a0c09");
  } else {
    g.addColorStop(0, "#16120e");
    g.addColorStop(1, "#090807");
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(58,52,44,0.55)";
  ctx.lineWidth = 1;
  for (let x = 40; x < w; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, h * 0.62);
    ctx.lineTo(x - 80, h);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(0, h * 0.72, w, h * 0.28);
}

function vignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.72);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function hazardBand(ctx: CanvasRenderingContext2D, w: number, y: number) {
  const h = 16;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, y, w, h);
  ctx.clip();
  for (let x = -24; x < w + 24; x += 22) {
    ctx.fillStyle = Math.floor((x + 24) / 22) % 2 === 0 ? AMBER : DEEP;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 16, y);
    ctx.lineTo(x + 24, y + h);
    ctx.lineTo(x + 8, y + h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function rivets(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "#c8c0b2";
  const pts: [number, number][] = [
    [x + 8, y + 8],
    [x + w - 8, y + 8],
    [x + 8, y + h - 8],
    [x + w - 8, y + h - 8],
  ];
  for (const [px, py] of pts) {
    ctx.beginPath();
    ctx.arc(px, py, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

type BotOpts = {
  body?: string;
  dent?: boolean;
  missingArm?: "left" | "right";
  missingWheel?: "left" | "right";
  eyes?: "open" | "sad" | "shut" | "angry" | "spiral";
  arm?: "down" | "up" | "drink";
  tilt?: number;
  vibrate?: number;
};

function drawBot(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, t: number, opts: BotOpts = {}) {
  const shake = opts.vibrate ? Math.sin(t * 55) * opts.vibrate : Math.sin(t * 1.4) * s * 0.008;
  ctx.save();
  ctx.translate(cx + shake, cy);
  ctx.rotate(opts.tilt ?? 0);

  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(0, s * 0.78, s * 0.62, s * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  const wheel = (x: number) => {
    ctx.fillStyle = "#1c1a17";
    ctx.beginPath();
    ctx.arc(x, s * 0.62, s * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = MUTED;
    ctx.lineWidth = Math.max(2, s * 0.025);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, s * 0.62, s * 0.05, 0, Math.PI * 2);
    ctx.fillStyle = AMBER;
    ctx.fill();
  };
  if (opts.missingWheel !== "left") wheel(-s * 0.32);
  else {
    ctx.fillStyle = SPARK;
    ctx.fillRect(-s * 0.4, s * 0.52, s * 0.12, s * 0.08);
  }
  if (opts.missingWheel !== "right") wheel(s * 0.32);

  const body = opts.body ?? STEEL;
  ctx.fillStyle = body;
  roundRect(ctx, -s * 0.5, -s * 0.18, s, s * 0.72, s * 0.06);
  ctx.fill();
  ctx.strokeStyle = "#1a1814";
  ctx.lineWidth = Math.max(2, s * 0.03);
  ctx.stroke();
  rivets(ctx, -s * 0.5, -s * 0.18, s, s * 0.72);

  if (opts.dent) {
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.beginPath();
    ctx.ellipse(-s * 0.08, s * 0.16, s * 0.22, s * 0.14, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#241e16";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(243,239,230,0.28)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, s * 0.16);
  ctx.lineTo(s * 0.5, s * 0.16);
  ctx.stroke();

  ctx.fillStyle = body;
  roundRect(ctx, -s * 0.3, -s * 0.62, s * 0.6, s * 0.42, s * 0.05);
  ctx.fill();
  ctx.strokeStyle = "#1a1814";
  ctx.lineWidth = Math.max(2, s * 0.03);
  ctx.stroke();

  const eye = (x: number) => {
    const y = -s * 0.42;
    if (opts.eyes === "shut") {
      ctx.strokeStyle = FG;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.07, y);
      ctx.quadraticCurveTo(x, y + s * 0.05, x + s * 0.07, y);
      ctx.stroke();
      return;
    }
    ctx.fillStyle = opts.eyes === "angry" ? SPARK : "#d7ecff";
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.07, opts.eyes === "sad" ? s * 0.05 : s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = DEEP;
    if (opts.eyes === "spiral") {
      ctx.strokeStyle = DEEP;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.035, t * 2, t * 2 + Math.PI * 1.4);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x + (opts.eyes === "sad" ? -s * 0.01 : 0), y + (opts.eyes === "sad" ? s * 0.01 : 0), s * 0.028, 0, Math.PI * 2);
      ctx.fill();
    }
    if (opts.eyes === "angry") {
      ctx.strokeStyle = FG;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.08, y - s * 0.08);
      ctx.lineTo(x + s * 0.08, y - s * 0.03);
      ctx.stroke();
    }
  };
  eye(-s * 0.12);
  eye(s * 0.12);
  if (opts.eyes === "sad") {
    ctx.strokeStyle = "#8eafc9";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s * 0.16, -s * 0.36);
    ctx.lineTo(s * 0.2, -s * 0.26);
    ctx.stroke();
  }

  const arm = (side: -1 | 1) => {
    if ((side === -1 && opts.missingArm === "left") || (side === 1 && opts.missingArm === "right")) {
      ctx.fillStyle = SPARK;
      ctx.fillRect(side * s * 0.48, -s * 0.02, side * s * 0.08, s * 0.08);
      return;
    }
    ctx.strokeStyle = STEEL_DARK;
    ctx.lineWidth = Math.max(6, s * 0.09);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(side * s * 0.48, s * 0.02);
    if (opts.arm === "drink" && side === 1) ctx.lineTo(side * s * 0.2, -s * 0.55);
    else if (opts.arm === "up") ctx.lineTo(side * s * 0.72, -s * 0.35);
    else ctx.lineTo(side * s * 0.78, s * 0.28);
    ctx.stroke();
    ctx.fillStyle = "#2a2722";
    ctx.beginPath();
    const hx = opts.arm === "drink" && side === 1 ? side * s * 0.2 : opts.arm === "up" ? side * s * 0.72 : side * s * 0.78;
    const hy = opts.arm === "drink" && side === 1 ? -s * 0.55 : opts.arm === "up" ? -s * 0.35 : s * 0.28;
    ctx.arc(hx, hy, s * 0.07, 0, Math.PI * 2);
    ctx.fill();
  };
  arm(-1);
  arm(1);
  ctx.restore();
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color = FG, align: CanvasTextAlign = "center") {
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px Oswald, Barlow, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function paintMutual(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = "#1c2418";
  roundRect(ctx, 70, 90, 250, 320, 6);
  ctx.fill();
  ctx.strokeStyle = "#8fbf78";
  ctx.lineWidth = 3;
  ctx.stroke();
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = i % 2 ? "#d9d3c4" : "#efe8d8";
    const drift = Math.sin(t * 0.8 + i) * 3;
    roundRect(ctx, 96 + drift, 120 + i * 36, 200, 26, 2);
    ctx.fill();
    ctx.fillStyle = "#8a8478";
    ctx.fillRect(108 + drift, 130 + i * 36, 120, 4);
  }
  label(ctx, "CLAIM", 196, 70, 28, "#8fbf78");

  drawBot(ctx, 620, 300, 210, t, { dent: true, eyes: "sad", body: "#7d8a72" });

  ctx.save();
  ctx.translate(760, 250);
  ctx.rotate(-0.35);
  ctx.strokeStyle = "#e06a52";
  ctx.lineWidth = 8;
  ctx.strokeRect(-90, -36, 180, 72);
  label(ctx, "DENIED", 0, 2, 36, "#e06a52");
  ctx.restore();
}

function paintVoltage(ctx: CanvasRenderingContext2D, t: number) {
  ctx.strokeStyle = `rgba(255, 225, 74, ${0.35 + 0.4 * Math.abs(Math.sin(t * 9))})`;
  ctx.lineWidth = 4;
  for (let i = 0; i < 5; i++) {
    const x = 80 + i * 180;
    bolt(ctx, x, 40, 70 + (i % 2) * 30);
  }

  ctx.save();
  ctx.translate(250, 300);
  const glow = 0.45 + 0.55 * Math.abs(Math.sin(t * 8));
  ctx.fillStyle = `rgba(255, 225, 74, ${0.2 + glow * 0.35})`;
  ctx.beginPath();
  ctx.ellipse(0, 20, 90, 150, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffe14a";
  roundRect(ctx, -58, -130, 116, 250, 16);
  ctx.fill();
  ctx.fillStyle = DEEP;
  ctx.beginPath();
  ctx.moveTo(4, -108);
  ctx.lineTo(-18, -62);
  ctx.lineTo(0, -62);
  ctx.lineTo(-6, -40);
  ctx.lineTo(20, -70);
  ctx.lineTo(2, -70);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = DEEP;
  ctx.fillRect(-58, 28, 116, 46);
  label(ctx, "400%", 0, 52, 26, AMBER);
  ctx.fillStyle = "#b42318";
  roundRect(ctx, -70, 78, 140, 28, 4);
  ctx.fill();
  ctx.restore();

  const shake = Math.sin(t * 55) * 10;
  drawBot(ctx, 700, 320, 190, t, { vibrate: 10, eyes: "open", arm: "drink", body: "#8a8478" });
  ctx.save();
  ctx.translate(742 + shake, 214);
  ctx.rotate(0.5);
  ctx.fillStyle = "#ffe14a";
  roundRect(ctx, -16, -36, 32, 64, 6);
  ctx.fill();
  ctx.fillStyle = DEEP;
  ctx.fillRect(-16, -6, 32, 14);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,225,74,0.85)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    const y = 220 + i * 36;
    ctx.beginPath();
    ctx.moveTo(560, y);
    ctx.lineTo(520 - (i % 2) * 16, y + 6);
    ctx.moveTo(860, y);
    ctx.lineTo(900 + (i % 2) * 16, y + 6);
    ctx.stroke();
  }
  for (let i = 0; i < 4; i++) {
    const y = 180 - ((t * 40 + i * 28) % 120);
    ctx.fillStyle = `rgba(180,180,180,${0.15 + (i % 3) * 0.08})`;
    ctx.beginPath();
    ctx.arc(760, y, 10 + i * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function bolt(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - 18, y + h * 0.45);
  ctx.lineTo(x + 6, y + h * 0.45);
  ctx.lineTo(x - 10, y + h);
  ctx.lineTo(x + 22, y + h * 0.4);
  ctx.lineTo(x, y + h * 0.4);
  ctx.closePath();
  ctx.stroke();
}

function paintSals(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = "#5c3a24";
  roundRect(ctx, 90, 250, 280, 200, 8);
  ctx.fill();
  ctx.strokeStyle = "#c4622d";
  ctx.lineWidth = 6;
  ctx.stroke();
  label(ctx, "SAL'S", 230, 220, 36, "#e0a15a");

  ctx.save();
  ctx.translate(150, 320);
  ctx.rotate(-0.6 + Math.sin(t) * 0.04);
  roundRect(ctx, -16, -70, 32, 120, 8);
  ctx.fillStyle = "#7d8a72";
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(250, 330);
  ctx.rotate(0.4);
  ctx.fillStyle = "#1c1a17";
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = MUTED;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "#8a8478";
  roundRect(ctx, 190, 360, 90, 28, 4);
  ctx.fill();

  drawBot(ctx, 700, 300, 210, t, { missingArm: "left", missingWheel: "left", eyes: "open", body: "#8d6844" });
}

function paintBrain(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = "#12181e";
  ctx.fillRect(40, 70, 440, 470);
  ctx.fillStyle = "#1c1412";
  ctx.fillRect(520, 70, 440, 470);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 70, 440, 470);
  ctx.strokeRect(520, 70, 440, 470);
  label(ctx, "LOGIC", 260, 110, 28, "#8eafc9");
  label(ctx, "BERSERKER", 740, 110, 28, SPARK);

  drawBot(ctx, 260, 330, 160, t, { eyes: "spiral", body: "#607888" });
  const orbit = t * 1.6;
  for (let i = 0; i < 3; i++) {
    const a = orbit + i * 2.1;
    ctx.fillStyle = "#8eafc9";
    ctx.beginPath();
    ctx.arc(260 + Math.cos(a) * 90, 200 + Math.sin(a) * 28, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawBot(ctx, 740, 340, 170, t, { eyes: "angry", arm: "up", body: "#a24a32", vibrate: 2 });

  const press = Math.sin(t * 2) > 0.4 ? 6 : 0;
  ctx.fillStyle = press ? "#5a1010" : "#e06a52";
  ctx.beginPath();
  ctx.arc(500, 340, 36 - press, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = FG;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(500, 330, 12, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(500, 328);
  ctx.lineTo(500, 348);
  ctx.stroke();
  label(ctx, "POWER", 500, 420, 22, MUTED);
}

function paintHotline(ctx: CanvasRenderingContext2D, t: number) {
  label(ctx, "1-800-BOLT-ON", 500, 78, 54, AMBER);

  ctx.strokeStyle = MUTED;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(180, 150);
  ctx.quadraticCurveTo(180, 230, 250, 240);
  ctx.stroke();
  ctx.fillStyle = STEEL;
  roundRect(ctx, 230, 214, 70, 36, 10);
  ctx.fill();

  ctx.fillStyle = "#4a4036";
  roundRect(ctx, 300, 360, 460, 28, 4);
  ctx.fill();
  ctx.fillStyle = "#1c1a17";
  ctx.beginPath();
  ctx.arc(330, 400, 22, 0, Math.PI * 2);
  ctx.arc(730, 400, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(530, 348);
  ctx.rotate(-Math.PI / 2);
  drawBot(ctx, 0, 0, 120, t, { eyes: "sad", body: "#7a756c" });
  ctx.restore();

  const bob = Math.sin(t * 2) * 4;
  for (const x of [180, 250]) {
    ctx.fillStyle = STEEL_DARK;
    roundRect(ctx, x, 470 + bob, 18, 46, 4);
    ctx.fill();
    ctx.fillStyle = "#1c1a17";
    ctx.beginPath();
    ctx.arc(x + 9, 520 + bob, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintNap(ctx: CanvasRenderingContext2D, t: number) {
  const lid = Math.max(0.18, 1 - Math.min(1, t / 4));
  ctx.save();
  ctx.translate(500, 390);
  ctx.fillStyle = "#3a414c";
  roundRect(ctx, -230, -40, 460, 180, 10);
  ctx.fill();
  ctx.strokeStyle = "#8e97a6";
  ctx.lineWidth = 4;
  ctx.stroke();
  rivets(ctx, -230, -40, 460, 180);
  label(ctx, "NAP POD", 0, 40, 36, FG);

  ctx.save();
  ctx.translate(-230, -40);
  ctx.rotate(-lid * 0.95);
  ctx.fillStyle = "#525a68";
  roundRect(ctx, 0, -28, 460, 36, 8);
  ctx.fill();
  ctx.restore();

  if (lid > 0.25) {
    ctx.fillStyle = "#d7ecff";
    ctx.beginPath();
    ctx.ellipse(-30, -18, 10, 6, 0, 0, Math.PI * 2);
    ctx.ellipse(24, -18, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = DEEP;
    ctx.beginPath();
    ctx.arc(-30, -18, 3, 0, Math.PI * 2);
    ctx.arc(24, -18, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = AMBER;
  roundRect(ctx, 150, 20, 36, 44, 6);
  ctx.fill();
  ctx.fillStyle = DEEP;
  ctx.beginPath();
  ctx.arc(168, 34, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = DEEP;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(168, 28, 8, Math.PI, 0);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "rgba(243,239,230,0.75)";
  ctx.font = "700 42px Oswald, sans-serif";
  ctx.textAlign = "center";
  const z = ["z", "z", "Z"];
  for (let i = 0; i < 3; i++) {
    const rise = (t * 24 + i * 28) % 90;
    ctx.globalAlpha = 1 - rise / 90;
    ctx.fillText(z[i]!, 690 + i * 28, 250 - rise);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(240,162,2,0.08)";
  ctx.beginPath();
  ctx.ellipse(500, 300, 260, 80, 0, 0, Math.PI * 2);
  ctx.fill();
}
