/** Shared arena signage; visual only, also used by the 3D garage's wall textures. */
export function paintTeamJanelleBanner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (width <= 0 || height <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  const top = height * 0.12;
  const bottom = height * 0.96;
  // A real hanging panel: steel rail, fabric folds, stitching and metal eyelets.
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(width * 0.012, top + height * 0.035, width * 0.98, bottom - top);
  const fabric = ctx.createLinearGradient(0, 0, width, height);
  fabric.addColorStop(0, "#501b71");
  fabric.addColorStop(0.48, "#8b285c");
  fabric.addColorStop(1, "#461a66");
  ctx.fillStyle = fabric;
  ctx.fillRect(width * 0.01, top, width * 0.98, bottom - top);
  for (const at of [0.1, 0.32, 0.62, 0.87]) {
    const fold = ctx.createLinearGradient(width * (at - 0.02), 0, width * (at + 0.04), 0);
    fold.addColorStop(0, "rgba(255,255,255,0)");
    fold.addColorStop(0.35, "rgba(255,255,255,0.07)");
    fold.addColorStop(0.55, "rgba(0,0,0,0.12)");
    fold.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = fold;
    ctx.fillRect(width * (at - 0.02), top, width * 0.06, bottom - top);
  }
  ctx.strokeStyle = "#d6a6cf";
  ctx.lineWidth = Math.max(0.5, height * 0.012);
  ctx.strokeRect(width * 0.025, top + height * 0.065, width * 0.95, bottom - top - height * 0.13);
  ctx.fillStyle = "#929ba5";
  ctx.fillRect(0, height * 0.02, width, height * 0.045);
  for (const at of [0.04, 0.96]) {
    ctx.fillStyle = "#d5d6d8";
    ctx.beginPath();
    ctx.arc(width * at, height * 0.15, height * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#302832";
    ctx.beginPath();
    ctx.arc(width * at, height * 0.15, height * 0.022, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(width * 0.12, height * 0.5);
  ctx.scale(height * 0.58, height * 0.58);
  ctx.fillStyle = "#f26bb5";
  ctx.strokeStyle = "#ffdaec";
  ctx.lineWidth = 0.025;
  ctx.beginPath();
  ctx.moveTo(0, 0.5);
  ctx.bezierCurveTo(-0.18, 0.32, -0.57, 0.02, -0.43, -0.25);
  ctx.bezierCurveTo(-0.32, -0.45, -0.1, -0.35, 0, -0.19);
  ctx.bezierCurveTo(0.1, -0.35, 0.32, -0.45, 0.43, -0.25);
  ctx.bezierCurveTo(0.57, 0.02, 0.18, 0.32, 0, 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#fff5fc";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${height * 0.43}px Arial, sans-serif`;
  ctx.fillText("TEAM JANELLE", width * 0.575, height * 0.55, width * 0.72);
  ctx.restore();
}
