/** Size-aware fabrication detail, shared by Garage and fight cameras. No simulation state. */
export function armorEdges(
  ctx: CanvasRenderingContext2D,
  points: readonly [number, number][],
  size: number,
  matte: boolean,
) {
  ctx.save();
  ctx.lineJoin = "round";
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!,
      b = points[(i + 1) % points.length]!;
    const light = b[0] > a[0];
    ctx.strokeStyle = light ? `rgba(233,242,255,${matte ? 0.28 : 0.65})` : "rgba(0,5,12,0.8)";
    ctx.lineWidth = Math.max(1, size * 0.012);
    ctx.beginPath();
    ctx.moveTo(a[0] * size, a[1] * size);
    ctx.lineTo(b[0] * size, b[1] * size);
    ctx.stroke();
  }
  ctx.restore();
}
export function deckHardware(
  ctx: CanvasRenderingContext2D,
  len: number,
  wid: number,
  scars: number,
  identity: number,
) {
  if (len < 45) return;
  ctx.save();
  // Recessed ventilation with raised louvers, at the rear away from the number plate.
  ctx.fillStyle = "#090e13";
  ctx.fillRect(-len * 0.38, -wid * 0.23, len * 0.19, wid * 0.46);
  const rows = len > 140 ? 7 : 4;
  for (let i = 0; i < rows; i++) {
    const y = (-0.2 + (i * 0.4) / rows) * wid;
    ctx.fillStyle = "rgba(194,212,228,0.42)";
    ctx.fillRect(-len * 0.37, y, len * 0.17, Math.max(0.7, wid * 0.014));
    ctx.fillStyle = "#03070c";
    ctx.fillRect(-len * 0.37, y + wid * 0.015, len * 0.17, Math.max(0.8, wid * 0.018));
  }
  // Machined mounting rails and recessed hex fasteners.
  for (const side of [-1, 1]) {
    const y = side * wid * 0.31;
    const rail = ctx.createLinearGradient(0, y - wid * 0.035, 0, y + wid * 0.035);
    rail.addColorStop(0, "#b0c0ce");
    rail.addColorStop(0.3, "#5d6c78");
    rail.addColorStop(1, "#101a23");
    ctx.fillStyle = rail;
    ctx.fillRect(-len * 0.3, y - wid * 0.025, len * 0.45, wid * 0.05);
    for (const x of [-0.28, 0.12]) {
      const r = Math.max(1.1, len * 0.012);
      ctx.fillStyle = "#080d12";
      ctx.beginPath();
      ctx.arc(x * len, y, r * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#b4bdc5";
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const px = x * len + Math.cos(a) * r,
          py = y + Math.sin(a) * r;
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#26313c";
      ctx.fillRect(x * len - r * 0.55, y - r * 0.2, r * 1.1, r * 0.4);
    }
  }
  // Persistent gouges remain under the stickers; cosmetic changes never repair them.
  for (let i = 0; i < Math.min(12, scars * 2); i++) {
    const n = (identity + i * 7919) >>> 0;
    const x = ((n % 101) / 100 - 0.5) * len * 0.7,
      y = (((n >>> 7) % 101) / 100 - 0.5) * wid * 0.7;
    ctx.lineWidth = Math.max(1, wid * 0.012);
    ctx.strokeStyle = "rgba(1,4,8,0.85)";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len * 0.1, y - wid * 0.09);
    ctx.stroke();
    ctx.lineWidth = Math.max(0.6, wid * 0.005);
    ctx.strokeStyle = "#bac2c8";
    ctx.beginPath();
    ctx.moveTo(x, y + 1);
    ctx.lineTo(x + len * 0.1, y - wid * 0.09 + 1);
    ctx.stroke();
  }
  ctx.restore();
}
