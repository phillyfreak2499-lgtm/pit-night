import type { BotLook } from "@/lib/pit/types";

/**
 * Shared procedural hull graphics for the side broadcast, overhead replay,
 * and 3D garage. Coordinates are relative to the painted surface.
 * Static, deterministic and cosmetic only: never used by combat math.
 */
export function drawPaintSkin(
  ctx: CanvasRenderingContext2D,
  look: BotLook,
  x: number,
  y: number,
  width: number,
  height: number,
  base: string,
  accent: string,
) {
  if (!["two-tone", "camouflage", "tie-dye", "texas"].includes(look)) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(width, height);

  if (look === "two-tone") {
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0.5, 1, 0.5);
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fillRect(0, 0.47, 1, 0.035);
    ctx.fillStyle = "rgba(0,0,0,0.26)";
    ctx.fillRect(0, 0.51, 1, 0.028);
  }

  if (look === "camouflage") {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 1, 1);
    const colors = [accent, "#304e35", "#b0a478", "#2b3334", "#78934e"];
    for (let i = 0; i < 24; i++) {
      const px = ((i * 37 + 17) % 101) / 101;
      const py = ((i * 53 + 19) % 103) / 103;
      const radius = 0.08 + (i % 4) * 0.029;
      ctx.fillStyle = colors[i % colors.length]!;
      ctx.beginPath();
      ctx.moveTo(px - radius, py);
      ctx.bezierCurveTo(px - radius * 1.2, py - radius * 0.9, px - radius * 0.1, py - radius * 0.9, px + radius * 0.2, py - radius * 0.5);
      ctx.bezierCurveTo(px + radius * 1.1, py - radius * 0.7, px + radius * 1.35, py + radius * 0.5, px + radius * 0.3, py + radius * 0.55);
      ctx.bezierCurveTo(px - radius * 0.1, py + radius, px - radius * 1.15, py + radius * 0.7, px - radius, py);
      ctx.closePath();
      ctx.fill();
    }
  }

  if (look === "tie-dye") {
    ctx.fillStyle = "#7b35df";
    ctx.fillRect(0, 0, 1, 1);
    const colors = ["#ff4f98", "#ffbb39", "#37efab", "#52bbff", "#d2ff53", "#ad6bff"];
    for (let i = 0; i < 12; i++) {
      const px = (0.11 + (i * 0.173) % 0.8);
      const py = (0.15 + (i * 0.319) % 0.7);
      const radius = 0.16 + (i % 3) * 0.045;
      const glow = ctx.createRadialGradient(px, py, 0.005, px, py, radius);
      glow.addColorStop(0, colors[i % colors.length]!);
      glow.addColorStop(0.65, colors[(i + 2) % colors.length]!);
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineWidth = 0.025;
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(0.48, 0.53, 0.13 + i * 0.14, i * 0.68, i * 0.68 + Math.PI * 1.2);
      ctx.stroke();
    }
  }

  if (look === "texas") {
    // Texas Lone Star: navy vertical canton, white upper field, red lower field.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 1, 0.5);
    ctx.fillStyle = "#bf0a30";
    ctx.fillRect(0, 0.5, 1, 0.5);
    ctx.fillStyle = "#002868";
    ctx.fillRect(0, 0, 0.35, 1);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const radius = i % 2 ? 0.073 : 0.17;
      const px = 0.175 + Math.cos(angle) * radius;
      const py = 0.5 + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}
