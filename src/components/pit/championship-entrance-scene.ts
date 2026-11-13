import type { FighterSnap } from "@/lib/pit/types";
import { drawCosmeticEffect, drawSideBot, Fx, paintOf } from "./cage-draw";
import type { BotState } from "./cage-motion";
import { fitSidePortrait } from "./portrait-framing";
import { measureTeamFlag } from "./team-flag";

const smooth = (t: number) => { const n = Math.max(0, Math.min(1, t)); return n * n * (3 - 2 * n); };

/** Championship-only hero stage, using the same bot and pyro/smoke/spark assets as the cage. */
export function paintFinalistEntrance(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  fighter: FighterSnap,
  side: 0 | 1,
  progress: number,
  time: number,
  dt: number,
  fx: Fx,
  reduced: boolean,
) {
  const paint = paintOf(fighter.paint);
  const ground = h * 0.76;
  const movingTime = reduced ? 0 : time;
  ctx.fillStyle = "#080a10";
  ctx.fillRect(0, 0, w, h);
  const backdrop = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.5, Math.max(w, h) * 0.7);
  backdrop.addColorStop(0, "#34304a");
  backdrop.addColorStop(0.6, "#12141f");
  backdrop.addColorStop(1, "#080a10");
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, w, h);

  // Slow, broad spotlights. There are no flashes, camera shakes or strobe effects.
  for (let i = 0; i < 6; i++) {
    const source = w * (i < 3 ? 0.12 : 0.88);
    const target = w * (0.22 + (i % 3) * 0.28 + Math.sin(movingTime * 0.45 + i) * (reduced ? 0 : 0.05));
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = i % 2 ? "#ffe2a2" : paint;
    ctx.beginPath();
    ctx.moveTo(source, h * 0.02);
    ctx.lineTo(target - w * 0.1, ground);
    ctx.lineTo(target + w * 0.1, ground);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Gold truss and runway guide the eye toward the center reveal.
  ctx.strokeStyle = "#8e7746";
  ctx.lineWidth = Math.max(1, h * 0.004);
  ctx.strokeRect(w * 0.06, h * 0.035, w * 0.88, h * 0.035);
  for (let i = 0; i < 13; i++) {
    ctx.fillStyle = i % 2 ? paint : "#f5d98b";
    ctx.fillRect(w * (0.08 + i * 0.07), h * 0.05, Math.max(3, w * 0.008), h * 0.018);
  }
  ctx.fillStyle = "#171923";
  ctx.beginPath();
  ctx.ellipse(w / 2, ground, w * 0.35, h * 0.085, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = paint;
  ctx.lineWidth = Math.max(2, h * 0.006);
  ctx.stroke();
  ctx.strokeStyle = "#efd58e";
  ctx.beginPath();
  ctx.ellipse(w / 2, ground, w * 0.31, h * 0.065, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Both finalists get the entire package, regardless of owned cosmetic effects.
  // These temporary particles never equip an item or change a fighter snapshot.
  if (!reduced && dt > 0) {
    const scale = Math.min(w * 0.17, h * 0.24);
    if (progress > 0.15 && progress < 0.85) {
      for (let n = fx.tick("championship-pyro", 15, dt); n > 0; n--) {
        for (const x of [0.08, 0.19, 0.81, 0.92]) fx.pyro(w * x, ground, scale);
      }
    }
    for (let n = fx.tick("championship-sparks", 36, dt); n > 0; n--) {
      fx.sparkRain(w * 0.22, h * 0.07, scale, ground);
      fx.sparkRain(w * 0.78, h * 0.07, scale, ground);
    }
    for (let n = fx.tick("championship-smoke", 5, dt); n > 0; n--) {
      fx.stageSmoke(w * 0.27, ground, scale, "123,116,160");
      fx.stageSmoke(w * 0.73, ground, scale, "123,116,160");
    }
  }
  if (!reduced) drawCosmeticEffect(ctx, fx, "", w / 2, ground, h * 0.2, w, h, dt, paint);

  const facing = side === 0 ? 1 : -1;
  const arrival = reduced ? 1 : smooth(progress / 0.28);
  const flag = fighter.style?.flag ? measureTeamFlag(ctx, fighter.storeName).length : 0;
  const fit = fitSidePortrait(w * 0.75, h * 0.49, { classId: fighter.classId, weapon: fighter.weaponFamily, style: fighter.style }, 1, false, facing, flag);
  const x = w * 0.125 + fit.gx + (1 - arrival) * w * (side === 0 ? -0.7 : 0.7);
  const state: BotState = {
    bot: fighter, spot: { x: 0.5, y: 0.5 }, heading: 0, lift: 0,
    pitch: reduced ? 0 : Math.sin(movingTime * 1.6) * 0.009,
    flipped: false, stroke: 0, rev: reduced ? 0 : 0.65,
    gone: 0, dead: false, roll: reduced ? 0 : arrival * 2,
    hp: 100, scars: fighter.scars ?? 0, charging: false, spotlight: true, flame: 0,
  };
  drawSideBot(ctx, state, x, ground - (1 - arrival) * h * 0.02, fit.u, movingTime, reduced ? 0 : movingTime * 12, facing);

  // Readable screen-space identities never mirror with the bot or disclose the result.
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f3d58e";
  ctx.font = `700 ${Math.max(10, Math.min(w * 0.025, h * 0.034))}px Arial, sans-serif`;
  ctx.fillText("WATERMAN CHAMPIONSHIP · THE FINALISTS", w / 2, h * 0.13, w * 0.9);
  ctx.fillStyle = "#fff6dd";
  ctx.font = `800 ${Math.max(18, Math.min(w * 0.07, h * 0.09))}px Oswald, sans-serif`;
  ctx.fillText(fighter.botName, w / 2, h * 0.235, w * 0.88);
  ctx.fillStyle = "#e5dcce";
  ctx.font = `600 ${Math.max(12, Math.min(w * 0.035, h * 0.044))}px Arial, sans-serif`;
  ctx.fillText(fighter.storeName, w / 2, h * 0.32, w * 0.86);
  ctx.fillStyle = "#f3d58e";
  ctx.font = `700 ${Math.max(10, Math.min(w * 0.025, h * 0.033))}px Arial, sans-serif`;
  ctx.fillText(side === 0 ? "FIRST FINALIST · ONE SHOT AT THE TITLE" : "SECOND FINALIST · ONE SHOT AT THE TITLE", w / 2, h * 0.89, w * 0.9);
}
