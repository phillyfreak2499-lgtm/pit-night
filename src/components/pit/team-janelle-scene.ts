import type { FighterSnap } from "@/lib/pit/types";
import type { BotState } from "./cage-motion";
import { drawSideBot } from "./cage-draw";
import { fitSidePortrait } from "./portrait-framing";
import { measureTeamFlag } from "./team-flag";
const COLORS = ["#f68fbd", "#d0a0ed", "#f5d78d", "#fff5fc", "#95dacc"];
const smooth = (n: number) => { const p = Math.max(0, Math.min(1, n)); return p * p * (3 - 2 * p); };
/** One canvas and clock keep the entire cast together; reduced motion is a static tableau. */
export function paintCelebration(ctx: CanvasRenderingContext2D, width: number, height: number, cast: FighterSnap[], seconds: number, reduced: boolean) {
  ctx.clearRect(0, 0, width, height);
  if (!width || !height) return;
  for (const x of [0.12, 0.5, 0.88]) {
    const glow = ctx.createRadialGradient(width * x, height * 0.2, 0, width * x, height * 0.2, width * 0.4);
    glow.addColorStop(0, "rgba(224,132,195,0.12)"); glow.addColorStop(1, "rgba(224,132,195,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
  }
  const columns = width / height < 1.5 ? 4 : 7;
  const rows = Math.max(1, Math.ceil(cast.length / columns));
  const cellW = width / columns, cellH = height / rows;
  cast.forEach((bot, index) => {
    const row = Math.floor(index / columns), rowCount = Math.min(columns, cast.length - row * columns), col = index % columns;
    const x = (col + (columns - rowCount) / 2) * cellW, y = row * cellH;
    const facing = col < rowCount / 2 ? 1 : -1;
    const arrival = reduced ? 1 : smooth((seconds - index * 0.14) / 2.4);
    const dance = reduced ? 0 : smooth((seconds - 5) / 2) * (1 - smooth((seconds - 24) / 3));
    const beat = (seconds - 5) * Math.PI * 1.25, sway = Math.sin(beat) * dance;
    const flag = bot.style?.flag ? measureTeamFlag(ctx, bot.storeName).length : 0;
    const fit = fitSidePortrait(cellW * 0.9, cellH * 0.65, { classId: bot.classId, weapon: "none", style: bot.style }, 0.9, false, facing, flag);
    const gx = x + cellW * 0.05 + fit.gx + sway * fit.u * 0.08, ground = y + cellH * 0.69;
    ctx.strokeStyle = "rgba(235,180,215,0.2)"; ctx.lineWidth = Math.max(1, Math.min(width / 900, height / 400));
    ctx.beginPath(); ctx.ellipse(x + cellW / 2, ground + fit.u * 0.015, cellW * 0.4, cellH * 0.055, 0, 0, Math.PI * 2); ctx.stroke();
    const state: BotState = { bot, spot: { x: 0.5, y: 0.5 }, heading: 0, lift: Math.max(0, Math.sin(beat)) * dance * 0.07,
      pitch: sway * 0.045, flipped: false, stroke: 0, rev: 0, gone: 0, dead: false, roll: sway * 0.35, hp: 100, scars: 0,
      charging: false, spotlight: false, flame: 0 };
    ctx.save(); ctx.globalAlpha = arrival;
    drawSideBot(ctx, state, gx + (1 - arrival) * cellW * (facing === 1 ? -0.3 : 0.3), ground, fit.u, reduced ? 0 : seconds, 0, facing);
    ctx.restore(); ctx.fillStyle = "#fff3fa"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `600 ${Math.max(9, Math.min(cellW * 0.09, cellH * 0.09))}px Arial, sans-serif`;
    ctx.fillText(bot.storeName, x + cellW / 2, y + cellH * 0.83, cellW * 0.92);
    ctx.fillStyle = "#d4acc7"; ctx.font = `500 ${Math.max(8, Math.min(cellW * 0.07, cellH * 0.075))}px Arial, sans-serif`;
    ctx.fillText(bot.botName, x + cellW / 2, y + cellH * 0.94, cellW * 0.9);
  });
  const confetti = reduced ? 1 : smooth((seconds - 7) / 2);
  if (confetti <= 0) return;
  ctx.save(); ctx.globalAlpha = confetti * 0.85;
  for (let i = 0; i < 100; i++) {
    const baseX = ((i * 47) % 101) / 101, baseY = ((i * 31) % 103) / 103;
    const fall = reduced ? baseY : (baseY + Math.max(0, seconds - 7) * (0.07 + (i % 4) * 0.008)) % 1;
    ctx.save(); ctx.translate((baseX + (reduced ? 0 : Math.sin(seconds * 0.8 + i) * 0.015)) * width, fall * height);
    ctx.rotate(reduced ? i : seconds * 0.7 + i); ctx.fillStyle = COLORS[i % COLORS.length]!;
    const size = Math.max(2, Math.min(width / 180, height / 80)); ctx.fillRect(-size / 2, -size, size, size * 1.7); ctx.restore();
  }
  ctx.restore();
}
