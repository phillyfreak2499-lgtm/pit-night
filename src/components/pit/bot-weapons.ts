import type { BotFrame } from "./bot-frame";

/** Shared visual saw pose in bot lengths: +x forward, -y up. Never used by combat math. */
export function sawPoseOf(frame: BotFrame, stroke = 0) {
  const rest = -0.55;
  const hit = 0.28;
  const bladeRadius = 0.16;
  // Covers the rotating tooth tips in both renderers, including the 3D tooth corners.
  const tipRadius = 0.2;
  const pivotX = frame.front - 0.32;
  // The raised pivot keeps the lowered arm above the bot's own roof.
  const pivotY = frame.deck - 0.16;
  const armLength = (frame.front - pivotX + tipRadius + 0.06) / Math.cos(rest);
  const angle = rest + (hit - rest) * Math.max(0, Math.min(1, stroke));
  // Anchor the pedestal to the actual sloped armor beneath this mount.
  let mountY = Infinity;
  for (let i = 0; i < frame.hull.length; i++) {
    const [x0, y0] = frame.hull[i];
    const [x1, y1] = frame.hull[(i + 1) % frame.hull.length];
    if (x0 === x1 || pivotX < Math.min(x0, x1) || pivotX > Math.max(x0, x1)) continue;
    mountY = Math.min(mountY, y0 + ((pivotX - x0) / (x1 - x0)) * (y1 - y0));
  }
  return {
    pivotX,
    pivotY,
    mountY: Number.isFinite(mountY) ? mountY : frame.deck,
    bladeX: pivotX + Math.cos(angle) * armLength,
    bladeY: pivotY + Math.sin(angle) * armLength,
    bladeRadius,
    tipRadius,
    armLength,
    angle,
  };
}
