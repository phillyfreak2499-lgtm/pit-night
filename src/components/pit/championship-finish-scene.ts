import type { FightResult } from "@/lib/pit/types";
import { drawCosmeticEffect, Fx, paintOf, project } from "./cage-draw";
import type { Drive, Spot } from "./cage-motion";

/** Match the side camera's final transform so sparks stay on the pit as it zooms. */
export function finishScreenPoint(spot: Spot, w: number, h: number, camera: Fx["cam"]) {
  const p = project(spot, w, h);
  const cx = Math.max(w / 2 / camera.z, Math.min(w - w / 2 / camera.z, camera.x));
  const cy = Math.max(h / 2 / camera.z, Math.min(h - h / 2 / camera.z, camera.y));
  return { x: w / 2 + (p.x - cx) * camera.z, y: h / 2 + (p.y - cy) * camera.z, size: p.size * camera.z };
}

/** Extra presentation follows the recorded pit fall. It cannot create or change an elimination. */
export function paintChampionshipFinish(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  result: FightResult,
  drive: Drive,
  phase: "throw" | "reveal",
  dt: number,
  fx: Fx,
  reduced: boolean,
  camera: Fx["cam"],
) {
  const loser = drive.bots.find((bot) => result.loserIds.includes(bot.bot.id));
  const winner = drive.bots.find((bot) => result.winnerIds.includes(bot.bot.id));
  if (phase === "throw" && loser && loser.gone > 0) {
    const at = finishScreenPoint(loser.spot, w, h, camera);
    // The burst comes from the lip of the actual pit, not a fabricated second hit.
    if (!reduced && dt > 0 && loser.gone < 0.95) {
      for (let i = fx.tick("title-pit-sparks", 40, dt); i > 0; i--) {
        fx.sparkRain(at.x, at.y - at.size * 0.12, at.size * 0.55, at.y + at.size * 0.2);
      }
      for (let i = fx.tick("title-pit-debris", 3, dt); i > 0; i--) {
        fx.shed(at.x, at.y, at.y + at.size * 0.15, at.size * 0.5, paintOf(loser.bot.paint), 1, false);
      }
    }
    if (!reduced) drawCosmeticEffect(ctx, fx, "", at.x, at.y, at.size, w, h, dt, "#f3d58e");
    return;
  }
  if (phase !== "reveal" || !winner) return;
  const at = finishScreenPoint(winner.spot, w, h, camera);
  const glow = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, Math.min(w, h) * 0.55);
  glow.addColorStop(0, "rgba(255,212,106,0.16)");
  glow.addColorStop(1, "rgba(255,212,106,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  if (!reduced && dt > 0) {
    for (let n = fx.tick("title-winner-confetti", 7, dt); n > 0; n--) {
      fx.confetti(w / 2, h * 0.08, Math.min(w, h) * 0.35, ["#f3d58e", "#fff5d9", paintOf(winner.bot.paint)], h);
    }
    for (let n = fx.tick("title-winner-fireworks", 1.5, dt); n > 0; n--) {
      fx.firework(w * 0.18, h * 0.25, Math.min(w, h) * 0.28, "#f3d58e");
      fx.firework(w * 0.82, h * 0.25, Math.min(w, h) * 0.28, paintOf(winner.bot.paint));
    }
  }
  if (!reduced) drawCosmeticEffect(ctx, fx, "", at.x, at.y, at.size, w, h, dt, "#f3d58e");
  ctx.fillStyle = "rgba(8,10,16,0.88)";
  ctx.fillRect(w * 0.06, h * 0.19, w * 0.88, h * 0.23);
  ctx.strokeStyle = "#cda954";
  ctx.lineWidth = Math.max(1, h * 0.003);
  ctx.strokeRect(w * 0.06, h * 0.19, w * 0.88, h * 0.23);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f3d58e";
  ctx.font = `800 ${Math.max(13, Math.min(w * 0.038, h * 0.05))}px Oswald, sans-serif`;
  ctx.fillText("WATERMAN CHAMPION", w / 2, h * 0.245, w * 0.83);
  ctx.fillStyle = "#fff6dd";
  ctx.font = `800 ${Math.max(18, Math.min(w * 0.065, h * 0.07))}px Oswald, sans-serif`;
  ctx.fillText(winner.bot.botName, w / 2, h * 0.315, w * 0.8);
  ctx.font = `600 ${Math.max(11, Math.min(w * 0.028, h * 0.035))}px Arial, sans-serif`;
  ctx.fillText(winner.bot.storeName, w / 2, h * 0.38, w * 0.8);
}
