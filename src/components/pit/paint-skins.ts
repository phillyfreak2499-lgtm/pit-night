import { RAIN_CITY } from "@/lib/pit/rain-city";
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
  if (!["two-tone", "camouflage", "tie-dye", "texas", "louisiana", "cowboys", "seahawks", "raiders", "chiefs", "bumblebee", "chase", "rain-city"].includes(look)) return;
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

  // Original deterministic graphics shared by 2D broadcasts and 3D garage.
  // Team colors are fan tributes, without reproducing official NFL crests.
  const star = (cx: number, cy: number, radius: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const r = radius * (i % 2 ? 0.41 : 1);
      if (i === 0) ctx.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      else ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fill();
  };
  if (look === "louisiana") {
    // Blue state flag, feeding mother pelican, three chicks, nest, and motto.
    ctx.fillStyle = "#003b7a"; ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = "#f8f7ef";
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(0.5, 0.43);
      ctx.bezierCurveTo(0.5 + side * 0.14, 0.06, 0.5 + side * 0.46, 0.29, 0.5 + side * 0.26, 0.67);
      ctx.quadraticCurveTo(0.5 + side * 0.16, 0.75, 0.5, 0.52);
      ctx.closePath(); ctx.fill();
    }
    ctx.beginPath(); ctx.ellipse(0.5, 0.51, 0.125, 0.19, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#f8f7ef"; ctx.lineWidth = 0.041;
    ctx.beginPath(); ctx.moveTo(0.52, 0.37);
    ctx.bezierCurveTo(0.42, 0.2, 0.64, 0.22, 0.64, 0.4); ctx.stroke();
    ctx.beginPath(); ctx.arc(0.64, 0.39, 0.043, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#d5aa39";
    ctx.beginPath(); ctx.moveTo(0.67, 0.4); ctx.lineTo(0.78, 0.44); ctx.lineTo(0.66, 0.45); ctx.fill();
    ctx.fillStyle = "#18334f";
    ctx.beginPath(); ctx.arc(0.65, 0.372, 0.01, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#c02039";
    for (const x of [0.47, 0.52, 0.57]) {
      ctx.beginPath(); ctx.moveTo(x, 0.54); ctx.lineTo(x - 0.017, 0.592);
      ctx.arc(x, 0.592, 0.017, Math.PI, 0); ctx.fill();
    }
    ctx.strokeStyle = "#e0c178"; ctx.lineWidth = 0.024;
    ctx.beginPath(); ctx.moveTo(0.22, 0.77);
    ctx.quadraticCurveTo(0.5, 0.7, 0.78, 0.77); ctx.stroke();
    for (const x of [0.39, 0.5, 0.61]) {
      ctx.fillStyle = "#f8f7ef";
      ctx.beginPath(); ctx.ellipse(x, 0.69, 0.056, 0.065, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#d5aa39";
      ctx.beginPath(); ctx.moveTo(x + 0.025, 0.67); ctx.lineTo(x + 0.08, 0.64);
      ctx.lineTo(x + 0.03, 0.71); ctx.fill();
    }
    ctx.fillStyle = "#f2ebcf"; ctx.fillRect(0.17, 0.855, 0.66, 0.08);
    ctx.fillStyle = "#003b7a"; ctx.font = "bold 0.051px Arial, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("UNION JUSTICE CONFIDENCE", 0.5, 0.895, 0.64);
  }
  if (look === "cowboys") {
    ctx.fillStyle = "#b0b7bc"; ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = "#041e42"; ctx.fillRect(0, 0, 1, 0.14);
    ctx.fillRect(0, 0.86, 1, 0.14);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0.14, 1, 0.042);
    ctx.fillRect(0, 0.82, 1, 0.04);
    star(0.5, 0.5, 0.35, "#ffffff");
    star(0.5, 0.5, 0.295, "#003594");
    ctx.strokeStyle = "#869397"; ctx.lineWidth = 0.019;
    ctx.strokeRect(0.038, 0.2, 0.924, 0.6);
  }
  if (look === "seahawks") {
    ctx.fillStyle = "#002244"; ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = "#69be28"; ctx.fillRect(0, 0.065, 1, 0.095);
    ctx.fillRect(0, 0.84, 1, 0.095);
    // Stylized original metallic feather / speed-chevron graphic.
    ctx.fillStyle = "#a5acaf";
    ctx.beginPath(); ctx.moveTo(0.1, 0.43); ctx.lineTo(0.57, 0.25);
    ctx.lineTo(0.91, 0.44); ctx.lineTo(0.57, 0.49);
    ctx.lineTo(0.12, 0.68); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#002244";
    ctx.beginPath(); ctx.moveTo(0.2, 0.46); ctx.lineTo(0.57, 0.35);
    ctx.lineTo(0.83, 0.43); ctx.lineTo(0.53, 0.46);
    ctx.lineTo(0.24, 0.56); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#69be28";
    ctx.beginPath(); ctx.moveTo(0.68, 0.36); ctx.lineTo(0.81, 0.42);
    ctx.lineTo(0.69, 0.46); ctx.closePath(); ctx.fill();
  }
  if (look === "raiders") {
    // Retro Oakland silver-and-black with an original crossed-tool badge.
    ctx.fillStyle = "#a5acaf"; ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = "#111111"; ctx.fillRect(0, 0, 0.13, 1);
    ctx.fillRect(0.87, 0, 0.13, 1);
    ctx.fillStyle = "#151515"; ctx.beginPath();
    ctx.moveTo(0.26, 0.2); ctx.lineTo(0.74, 0.2);
    ctx.lineTo(0.74, 0.62); ctx.quadraticCurveTo(0.5, 0.91, 0.26, 0.62);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#f1f2f2"; ctx.lineWidth = 0.025; ctx.stroke();
    ctx.strokeStyle = "#a5acaf"; ctx.lineWidth = 0.04; ctx.beginPath();
    ctx.moveTo(0.34, 0.34); ctx.lineTo(0.66, 0.66);
    ctx.moveTo(0.66, 0.34); ctx.lineTo(0.34, 0.66); ctx.stroke();
    ctx.fillStyle = "#151515"; ctx.textAlign = "center";
    ctx.font = "bold 0.105px Arial, sans-serif"; ctx.fillText("OAKLAND", 0.5, 0.14, 0.7);
  }
  if (look === "chiefs") {
    ctx.fillStyle = "#e31837"; ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = "#ffb81c"; ctx.fillRect(0, 0.12, 1, 0.105);
    ctx.fillRect(0, 0.78, 1, 0.105);
    ctx.fillStyle = "#ffffff"; ctx.beginPath();
    ctx.moveTo(0.12, 0.5); ctx.lineTo(0.5, 0.24); ctx.lineTo(0.88, 0.5);
    ctx.lineTo(0.5, 0.76); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ffb81c"; ctx.beginPath();
    ctx.moveTo(0.23, 0.5); ctx.lineTo(0.5, 0.32);
    ctx.lineTo(0.77, 0.5); ctx.lineTo(0.5, 0.68); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#e31837"; ctx.beginPath();
    ctx.moveTo(0.36, 0.5); ctx.lineTo(0.5, 0.4);
    ctx.lineTo(0.64, 0.5); ctx.lineTo(0.5, 0.6); ctx.closePath(); ctx.fill();
  }
  if (look === "bumblebee") {
    ctx.fillStyle = "#ffce1b"; ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = "#171717";
    for (const x of [0.1, 0.35, 0.6, 0.85]) ctx.fillRect(x, 0, 0.115, 1);
    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.beginPath(); ctx.ellipse(0.51, 0.5, 0.21, 0.29, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0.65, 0.5, 0.21, 0.29, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#171717"; ctx.lineWidth = 0.02;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 5; col++) {
        const x = 0.11 + col * 0.19 + (row % 2) * 0.09, y = 0.12 + row * 0.23;
        ctx.beginPath();
        for (let j = 0; j <= 6; j++) {
          const a = Math.PI / 3 * j;
          const px = x + Math.cos(a) * 0.052, py = y + Math.sin(a) * 0.052;
          if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        } ctx.stroke();
      }
    }
  }

  if (look === "rain-city") {
    // Weather scheme: navy field, action-green sash, wolf-gray rain and cloud.
    // A cloud and falling streaks, not a bird head.
    const { navy, green, gray } = RAIN_CITY;
    ctx.fillStyle = navy;
    ctx.fillRect(0, 0, 1, 1);
    const mist = ctx.createLinearGradient(0, 0, 0, 1);
    mist.addColorStop(0, "rgba(165,172,175,0.28)");
    mist.addColorStop(0.42, "rgba(165,172,175,0)");
    mist.addColorStop(1, "rgba(0,16,32,0.45)");
    ctx.fillStyle = mist;
    ctx.fillRect(0, 0, 1, 1);
    ctx.strokeStyle = gray;
    ctx.lineCap = "round";
    for (let i = 0; i < 16; i++) {
      const x = ((i * 61) % 97) / 100;
      const y0 = ((i * 23) % 48) / 100;
      ctx.globalAlpha = 0.28 + (i % 3) * 0.16;
      ctx.lineWidth = i % 4 === 0 ? 0.014 : 0.006;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x + 0.025, y0 + 0.18 + (i % 4) * 0.03);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = green;
    ctx.beginPath();
    ctx.moveTo(0, 0.74);
    ctx.lineTo(1, 0.56);
    ctx.lineTo(1, 0.67);
    ctx.lineTo(0, 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = gray;
    ctx.lineWidth = 0.012;
    ctx.beginPath();
    ctx.moveTo(0, 0.71);
    ctx.lineTo(1, 0.53);
    ctx.stroke();
    ctx.fillStyle = gray;
    ctx.beginPath();
    ctx.ellipse(0.32, 0.26, 0.15, 0.09, 0, 0, Math.PI * 2);
    ctx.ellipse(0.46, 0.22, 0.13, 0.1, 0, 0, Math.PI * 2);
    ctx.ellipse(0.58, 0.28, 0.11, 0.075, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = green;
    ctx.beginPath();
    ctx.ellipse(0.46, 0.33, 0.2, 0.032, -0.08, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = gray;
    for (const [dx, dy] of [
      [0.28, 0.4],
      [0.46, 0.44],
      [0.6, 0.39],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.bezierCurveTo(dx - 0.022, dy + 0.04, dx - 0.018, dy + 0.07, dx, dy + 0.085);
      ctx.bezierCurveTo(dx + 0.018, dy + 0.07, dx + 0.022, dy + 0.04, dx, dy);
      ctx.fill();
    }
  }

  if (look === "chase") {
    // CHASE: original green futuristic armor panels, golden mirrored visor,
    // broad angular chest plating; a homage to sci-fi armored heroes.
    ctx.fillStyle="#384b2b";ctx.fillRect(0,0,1,1);
    ctx.fillStyle="#1a2619";
    for(const x of [0.03,0.36,0.69]) {
      ctx.fillRect(x,0.06,0.28,0.08);
      ctx.fillRect(x,0.86,0.28,0.09);
    }
    ctx.fillStyle="#647947";ctx.beginPath();
    ctx.moveTo(0.1,0.22);ctx.lineTo(0.37,0.14);ctx.lineTo(0.63,0.14);
    ctx.lineTo(0.9,0.22);ctx.lineTo(0.85,0.77);ctx.lineTo(0.5,0.91);
    ctx.lineTo(0.15,0.77);ctx.closePath();ctx.fill();
    ctx.strokeStyle="#1a271b";ctx.lineWidth=0.045;ctx.stroke();
    ctx.fillStyle="#222d23";
    ctx.fillRect(0.12,0.26,0.76,0.13);
    ctx.fillStyle="#e5a83b";ctx.beginPath();
    ctx.moveTo(0.15,0.31);ctx.lineTo(0.78,0.29);ctx.lineTo(0.85,0.42);
    ctx.lineTo(0.73,0.52);ctx.lineTo(0.28,0.53);ctx.lineTo(0.13,0.44);ctx.closePath();ctx.fill();
    ctx.fillStyle="#fff1b3";ctx.fillRect(0.22,0.35,0.42,0.025);
    ctx.fillStyle="#36472a";
    ctx.beginPath();ctx.moveTo(0.48,0.6);ctx.lineTo(0.77,0.56);
    ctx.lineTo(0.81,0.79);ctx.lineTo(0.5,0.87);ctx.lineTo(0.19,0.79);
    ctx.lineTo(0.23,0.56);ctx.closePath();ctx.fill();
    ctx.strokeStyle="#92b16e";ctx.lineWidth=0.025;
    ctx.beginPath();ctx.moveTo(0.26,0.66);ctx.lineTo(0.43,0.7);ctx.lineTo(0.5,0.77);
    ctx.lineTo(0.57,0.7);ctx.lineTo(0.74,0.66);ctx.stroke();
    ctx.fillStyle="#a7ca81";
    ctx.font="bold 0.11px Arial, sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText("CHASE",0.5,0.955,0.75);
  }

  ctx.restore();
}
