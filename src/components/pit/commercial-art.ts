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
  switch (scene) {
    case "mutual":
      paintMutual(ctx, t);
      break;
    case "voltage":
      paintVoltage(ctx, t);
      break;
    case "sals":
      paintSals(ctx, t);
      break;
    case "brain":
      paintBrain(ctx, t);
      break;
    case "hotline":
      paintHotline(ctx, t);
      break;
    case "nap":
      paintNap(ctx, t);
      break;
    case "bank":
      paintBank(ctx, t);
      break;
    case "gravy":
      paintGravy(ctx, t);
      break;
    case "movers":
      paintMovers(ctx, t);
      break;
    case "reach":
      paintReach(ctx, t);
      break;
    case "extra-pass":
      paintExtraPass(ctx, t);
      break;
    case "roses":
      paintRoses(ctx, t);
      break;
    case "machine":
      paintMachine(ctx, t);
      break;
    case "hall-pass":
      paintHallPass(ctx, t);
      break;
    case "spare-parts":
      paintSpareParts(ctx, t);
      break;
    default: {
      const uncovered: never = scene;
      void uncovered;
    }
  }
  hazardBand(ctx, vw, vh - 16);
  vignette(ctx, vw, vh);
  ctx.restore();
}

const SKY: Record<CommercialScene, readonly [string, string]> = {
  mutual: ["#141a12", "#0a0c09"],
  voltage: ["#1a1204", "#070604"],
  sals: ["#2a160c", "#100c09"],
  brain: ["#10161c", "#080a0c"],
  hotline: ["#16120e", "#090807"],
  nap: ["#10141c", "#07080c"],
  bank: ["#121a14", "#070a08"],
  gravy: ["#2a160e", "#100904"],
  movers: ["#241c14", "#0c0a08"],
  reach: ["#1a1210", "#0c0908"],
  "extra-pass": ["#141810", "#080a08"],
  roses: ["#1c1014", "#0c080a"],
  machine: ["#10141a", "#07080c"],
  "hall-pass": ["#161410", "#0a0908"],
  "spare-parts": ["#1a140c", "#0c0a08"],
};

function backdrop(ctx: CanvasRenderingContext2D, w: number, h: number, scene: CommercialScene) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  const sky = SKY[scene];
  g.addColorStop(0, sky[0]);
  g.addColorStop(1, sky[1]);
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

function paintBank(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = "#1c2820";
  ctx.beginPath();
  ctx.arc(220, 300, 148, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#c6a15a";
  ctx.lineWidth = 8;
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = t * 0.35 + i * (Math.PI / 4);
    ctx.fillStyle = i % 2 ? AMBER : "#8a8478";
    ctx.beginPath();
    ctx.arc(220 + Math.cos(a) * 128, 300 + Math.sin(a) * 128, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  label(ctx, "VAULT", 220, 268, 28, "#c6a15a");
  label(ctx, "10 = 1", 220, 318, 40, FG);

  const rock = Math.sin(t * 2.2) * 0.14;
  ctx.save();
  ctx.translate(500, 340);
  ctx.rotate(rock);
  ctx.fillStyle = "#8d6844";
  roundRect(ctx, -40, -78, 80, 130, 10);
  ctx.fill();
  ctx.fillStyle = "#c4622d";
  ctx.fillRect(-40, -78, 80, 22);
  label(ctx, "BOLTS", 0, -10, 18, FG);
  ctx.restore();

  for (let i = 0; i < 6; i++) {
    const fall = (t * 36 + i * 22) % 90;
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.arc(540 + Math.sin(i * 1.7) * 26, 230 + fall, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawBot(ctx, 780, 330, 160, t, { eyes: "spiral", body: "#6a7a68" });
  const wrong = ["7", "11", "4"][Math.floor(t * 1.5) % 3]!;
  label(ctx, wrong, 780, 130, 52, SPARK);
  label(ctx, "COUNT", 780, 172, 18, MUTED);
}

function paintGravy(ctx: CanvasRenderingContext2D, t: number) {
  label(ctx, "GOBBLE-GRADE", 500, 72, 40, "#e0a15a");
  ctx.fillStyle = "#3a2418";
  ctx.fillRect(70, 460, 860, 28);

  const pour = 0.45 + 0.55 * Math.sin(t * 1.6);
  ctx.save();
  ctx.translate(250, 250);
  ctx.rotate(-0.15 - pour * 0.28);
  ctx.fillStyle = "#e6d2a8";
  roundRect(ctx, -78, -40, 150, 78, 22);
  ctx.fill();
  ctx.strokeStyle = "#8a6844";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#6a3a18";
  ctx.beginPath();
  ctx.ellipse(0, -8, 42, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e6d2a8";
  ctx.beginPath();
  ctx.moveTo(64, -6);
  ctx.lineTo(118, 16);
  ctx.lineTo(64, 24);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = `rgba(122, 72, 28, ${0.4 + pour * 0.55})`;
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(340, 230);
  ctx.quadraticCurveTo(390, 310 + pour * 24, 470, 430);
  ctx.stroke();

  ctx.save();
  ctx.translate(620, 300);
  ctx.rotate(t * 0.7);
  ctx.strokeStyle = "#c6a15a";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(0, 0, 48, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = i * (Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 40, Math.sin(a) * 40);
    ctx.lineTo(Math.cos(a) * 62, Math.sin(a) * 62);
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(122, 72, 28, ${0.2 + pour * 0.5})`;
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "#e0a15a";
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const rise = (t * 22 + i * 26) % 72;
    ctx.globalAlpha = 1 - rise / 72;
    ctx.beginPath();
    ctx.arc(760 + i * 18, 200 - rise, 10 + i * 2, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  drawBot(ctx, 820, 360, 130, t, { eyes: "shut", body: "#8d6844" });
}

function paintMovers(ctx: CanvasRenderingContext2D, t: number) {
  label(ctx, "CLASS ACT", 210, 78, 36, "#e0a15a");

  ctx.strokeStyle = STEEL;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(150, 450);
  ctx.lineTo(150, 200);
  ctx.lineTo(210, 188);
  ctx.stroke();
  ctx.fillStyle = "#1c1a17";
  ctx.beginPath();
  ctx.arc(132, 462, 18, 0, Math.PI * 2);
  ctx.arc(188, 462, 18, 0, Math.PI * 2);
  ctx.fill();

  const packed: [number, number, string][] = [
    [150, 250, "ARM"],
    [146, 340, "WHEEL"],
  ];
  for (const [x, y, name] of packed) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t + y) * 0.03);
    ctx.fillStyle = "#c4a574";
    roundRect(ctx, -46, -40, 92, 78, 4);
    ctx.fill();
    ctx.strokeStyle = "#6a4a28";
    ctx.lineWidth = 3;
    ctx.stroke();
    label(ctx, name, 0, 2, 16, "#3a2418");
    ctx.restore();
  }

  const drop = Math.sin(t * 2.4) * 10;
  ctx.save();
  ctx.translate(430, 310 + drop);
  ctx.rotate(0.18);
  ctx.fillStyle = "#e6d2a8";
  roundRect(ctx, -58, -44, 116, 88, 4);
  ctx.fill();
  ctx.strokeStyle = SPARK;
  ctx.lineWidth = 3;
  ctx.stroke();
  label(ctx, "IMPORTANT", 0, 4, 16, SPARK);
  ctx.save();
  ctx.translate(-58, -44);
  ctx.rotate(-0.55);
  ctx.fillStyle = "#c4a574";
  ctx.fillRect(0, -12, 116, 16);
  ctx.restore();
  ctx.restore();

  const boltY = 250 + ((t * 36) % 70);
  ctx.fillStyle = AMBER;
  ctx.fillRect(468, boltY, 8, 22);
  ctx.beginPath();
  ctx.arc(472, boltY, 7, 0, Math.PI * 2);
  ctx.fill();

  drawBot(ctx, 760, 330, 170, t, { missingArm: "right", eyes: "sad", arm: "up", body: "#7a756c" });
  label(ctx, "60 BOLTS", 760, 120, 32, AMBER);
}

function bay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "#1a1814";
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 4;
  ctx.stroke();
  rivets(ctx, x, y, w, h);
}

function paintReach(ctx: CanvasRenderingContext2D, t: number) {
  label(ctx, "RED RIVER", 250, 78, 36, "#e06a52");
  bay(ctx, 70, 120, 360, 300);
  ctx.fillStyle = "#2a2420";
  ctx.fillRect(110, 300, 280, 18);
  const pulse = 0.55 + 0.45 * Math.sin(t * 1.8);
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.arc(250, 292, 8 + pulse * 2, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, "MEASURED", 250, 180, 22, MUTED);

  drawBot(ctx, 760, 340, 170, t, { eyes: "open", body: "#8d3a32", arm: "up" });
  const reach = 90 + pulse * 210;
  ctx.strokeStyle = STEEL;
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(680, 300);
  ctx.lineTo(680 - reach, 292);
  ctx.stroke();
  ctx.fillStyle = "#c8c0b2";
  ctx.beginPath();
  ctx.moveTo(680 - reach, 276);
  ctx.lineTo(680 - reach - 28, 292);
  ctx.lineTo(680 - reach, 308);
  ctx.closePath();
  ctx.fill();
  label(ctx, "REACH", 760, 130, 32, AMBER);
}

function paintExtraPass(ctx: CanvasRenderingContext2D, t: number) {
  label(ctx, "KEY CITY", 220, 78, 36, "#8fbf78");
  bay(ctx, 80, 140, 300, 280);
  drawBot(ctx, 230, 320, 140, t * 0.2, { eyes: "open", body: "#6a7a68" });
  const lap = t * 1.1;
  const cx = 230 + Math.cos(lap) * 120;
  const cy = 250 + Math.sin(lap) * 36;
  drawBot(ctx, cx, cy, 70, t, { eyes: "open", body: "#7d8a72", arm: "down" });

  for (let i = 0; i < 5; i++) {
    const last = i === 4;
    const wobble = last ? Math.sin(t * 8) * 6 : 0;
    ctx.save();
    ctx.translate(520 + i * 70, 340 + wobble);
    ctx.fillStyle = last && Math.sin(t * 8) > 0 ? AMBER : STEEL;
    roundRect(ctx, -8, -36, 16, 72, 4);
    ctx.fill();
    ctx.fillStyle = "#c8c0b2";
    ctx.beginPath();
    ctx.arc(0, -36, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  label(ctx, "ONE MORE", 660, 180, 28, AMBER);
}

function paintRoses(ctx: CanvasRenderingContext2D, t: number) {
  label(ctx, "ROSE CITY", 250, 78, 36, "#e07a92");
  bay(ctx, 90, 130, 280, 320);
  ctx.fillStyle = "#3a242c";
  roundRect(ctx, 150, 250, 160, 150, 8);
  ctx.fill();
  ctx.strokeStyle = "#c4626a";
  ctx.lineWidth = 4;
  ctx.stroke();
  const stems = [
    [190, "#e07a92"],
    [230, "#f3efe6"],
    [270, "#c4485a"],
  ] as const;
  for (const [x, color] of stems) {
    const sway = Math.sin(t * 1.4 + x) * 6;
    ctx.strokeStyle = "#3d6b3a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, 390);
    ctx.quadraticCurveTo(x + sway, 330, x + sway, 280);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + sway, 268, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.arc(x + sway, 268, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  drawBot(ctx, 720, 340, 180, t, { eyes: "open", body: "#8d4458", arm: "up" });
  label(ctx, "LOCKER", 230, 200, 22, MUTED);
}

function paintMachine(ctx: CanvasRenderingContext2D, t: number) {
  label(ctx, "SEACHICKEN", 280, 78, 36, "#8eafc9");
  bay(ctx, 60, 120, 420, 340);
  const gears: [number, number, number, number][] = [
    [160, 240, 54, 1],
    [250, 300, 40, -1.4],
    [330, 220, 32, 1.8],
  ];
  ctx.strokeStyle = STEEL;
  ctx.lineCap = "round";
  for (const [x, y, r, dir] of gears) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * dir);
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 6;
    for (let i = 0; i < 6; i++) {
      const a = i * (Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.stroke();
    }
    ctx.restore();
  }
  for (let i = 0; i < 4; i++) {
    const fall = (t * 40 + i * 28) % 110;
    ctx.fillStyle = `rgba(198, 161, 90, ${1 - fall / 110})`;
    ctx.beginPath();
    ctx.arc(180 + i * 36, 150 + fall, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  drawBot(ctx, 760, 340, 170, t, { eyes: "shut", body: "#607888" });
  ctx.fillStyle = AMBER;
  roundRect(ctx, 700, 250, 36, 44, 6);
  ctx.fill();
  ctx.fillStyle = DEEP;
  ctx.beginPath();
  ctx.arc(718, 268, 6, 0, Math.PI * 2);
  ctx.fill();
  const beep = Math.floor(t * 2) % 2 === 0 ? "BEEP" : "····";
  label(ctx, beep, 760, 150, 32, AMBER);
}

function paintHallPass(ctx: CanvasRenderingContext2D, t: number) {
  label(ctx, "HALL PASS", 260, 78, 36, AMBER);
  bay(ctx, 80, 140, 360, 300);
  ctx.save();
  ctx.translate(230, 280);
  ctx.rotate(-0.08 + Math.sin(t * 1.2) * 0.02);
  ctx.fillStyle = "#efe8d8";
  roundRect(ctx, -90, -110, 180, 220, 6);
  ctx.fill();
  ctx.strokeStyle = "#8a8478";
  ctx.lineWidth = 3;
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = "#c8c0b2";
    ctx.fillRect(-60, -70 + i * 28, 120, 6);
  }
  const stamp = 0.75 + 0.25 * Math.sin(t * 3);
  ctx.strokeStyle = `rgba(224, 106, 82, ${stamp})`;
  ctx.lineWidth = 6;
  ctx.strokeRect(-50, 20, 100, 40);
  label(ctx, "PASS", 0, 42, 24, "#e06a52");
  ctx.restore();
  drawBot(ctx, 740, 340, 180, t, { eyes: "angry", arm: "up", body: "#8a8478" });
  label(ctx, "CLEARED", 740, 140, 28, AMBER);
}

function paintSpareParts(ctx: CanvasRenderingContext2D, t: number) {
  label(ctx, "TEMPLETRON", 240, 78, 36, "#e0a15a");
  bay(ctx, 70, 130, 400, 320);
  const bins = ["BOLT", "ARM", "WHEEL"];
  bins.forEach((name, i) => {
    const x = 110 + i * 110;
    ctx.fillStyle = i === 0 ? "#5c3a24" : "#3a342c";
    roundRect(ctx, x, 250, 90, 140, 6);
    ctx.fill();
    ctx.strokeStyle = "#c4622d";
    ctx.lineWidth = 3;
    ctx.stroke();
    label(ctx, name, x + 45, 320, 16, FG);
  });
  for (let i = 0; i < 3; i++) {
    const fall = (t * 48 + i * 30) % 100;
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.arc(155 + i * 18, 180 + fall, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  drawBot(ctx, 760, 340, 170, t, { missingArm: "left", eyes: "open", body: "#8d6844" });
  label(ctx, "SPARES", 760, 140, 32, AMBER);
}
