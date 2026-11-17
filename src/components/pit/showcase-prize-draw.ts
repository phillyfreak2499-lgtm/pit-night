import type { ShowcasePrizeId } from "@/lib/pit/showcase-model";

/** Local bot coordinates, front to the right; tape time freezes effects when paused. */
export function drawShowcasePrize(ctx: CanvasRenderingContext2D, prize: ShowcasePrizeId | "none" | undefined, view: "side" | "top", length: number, width: number, time: number, moving: boolean) {
  if (!prize || prize === "none") return;
  ctx.save(); ctx.scale(length, width); ctx.lineWidth = 0.025;
  if (prize === "battle-tank") {
    ctx.fillStyle = "#27312d"; ctx.strokeStyle = "#a5b4a1";
    if (view === "top") {
      for (const y of [-0.53, 0.35]) { ctx.fillRect(-0.53,y,1.06,0.18); ctx.strokeRect(-0.53,y,1.06,0.18); for(let x=-0.45;x<0.5;x+=0.15) ctx.strokeRect(x,y,0.035,0.18); }
      ctx.fillStyle="#536a50";ctx.fillRect(-0.38,-0.32,0.73,0.64);ctx.strokeRect(-0.38,-0.32,0.73,0.64);
      ctx.beginPath();ctx.ellipse(-0.05,0,0.22,0.23,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle="#263329";ctx.fillRect(0.06,-0.055,0.8,0.11);ctx.strokeRect(0.06,-0.055,0.8,0.11);
    } else {
      ctx.fillRect(-0.54,-0.22,1.08,0.21);ctx.strokeRect(-0.54,-0.22,1.08,0.21);for(let x=-0.48;x<0.5;x+=0.15) ctx.strokeRect(x,-0.22,0.04,0.21);
      ctx.fillStyle="#536a50";ctx.fillRect(-0.43,-0.45,0.8,0.22);ctx.strokeRect(-0.43,-0.45,0.8,0.22);
      ctx.fillRect(-0.22,-0.61,0.4,0.16);ctx.strokeRect(-0.22,-0.61,0.4,0.16);
      ctx.fillStyle="#263329";ctx.fillRect(0.1,-0.57,0.78,0.075);ctx.strokeRect(0.1,-0.57,0.78,0.075);
    }
  } else if (prize === "rocket-tail") {
    for (const y of (view === "top" ? [-0.29,0.16] : [-0.43,-0.28])) {
      ctx.fillStyle="#667782";ctx.strokeStyle="#d4e5ed";ctx.fillRect(-0.72,y,0.3,0.13);ctx.strokeRect(-0.72,y,0.3,0.13);
      if (moving) { const flare=0.16+0.07*Math.sin(time*16+y*13);ctx.fillStyle="#ff9b2f";ctx.beginPath();ctx.moveTo(-0.72,y);ctx.lineTo(-0.72-flare,y+0.065);ctx.lineTo(-0.72,y+0.13);ctx.fill();ctx.fillStyle="#fff0a2";ctx.fillRect(-0.78,y+0.045,0.08,0.04); }
    }
  } else {
    const y=view === "top" ? 0 : -0.5;
    ctx.shadowColor="#67e9ff";ctx.shadowBlur=0.12;ctx.fillStyle="#48cde8";ctx.strokeStyle="#d4ffff";
    ctx.beginPath();ctx.arc(-0.1,y,0.13,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
    for(const x of [-0.35,0.17]) {ctx.fillStyle="#354d5d";ctx.fillRect(x-0.06,y-0.12,0.12,0.24);ctx.strokeRect(x-0.06,y-0.12,0.12,0.24);for(let z=-0.08;z<=0.08;z+=0.08){ctx.beginPath();ctx.moveTo(x-0.07,y+z);ctx.lineTo(x+0.07,y+z);ctx.stroke();}}
    ctx.strokeStyle="#b5fbff";ctx.beginPath();ctx.moveTo(-0.29,y);ctx.lineTo(-0.21,y-0.07);ctx.lineTo(-0.12,y+0.04);ctx.lineTo(0.02,y-0.05);ctx.lineTo(0.11,y);ctx.stroke();
  }
  ctx.restore();
}
