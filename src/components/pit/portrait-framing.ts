import type { BotStyle, ClassId } from "@/lib/pit/types";
import { botFrameOf } from "./bot-frame";
import { sawPoseOf } from "./bot-weapons";

type PortraitLook = { classId: ClassId; weapon: string; style?: Partial<BotStyle> };

/** Preserve the requested zoom, shrinking only when the complete equipment would be clipped. */
export function fitSidePortrait(
  width: number,
  height: number,
  look: PortraitLook,
  zoom: number,
  turntable: boolean,
  facing: number,
  flagLength = 0,
) {
  const frame = botFrameOf(look.classId, look.style?.body);
  const scale = look.classId === "tank" ? 1.06 : look.classId === "specialist" ? 0.94 : 1;
  let rear = Math.max(0.62, flagLength > 0 ? 0.5 + flagLength : 0);
  let front = frame.front + (look.weapon === "none" ? 0.12 : 0.56);
  let above = frame.height + 0.08;
  if (flagLength > 0 || (look.style?.topper && look.style.topper !== "none"))
    above = Math.max(above, -frame.deck + 0.55);
  if (look.weapon === "hidden") front = Math.max(front, 0.9);
  if (look.weapon === "piston") front = frame.front + 0.75;
  if (look.style?.weaponSkin === "hockey-machete") front = Math.max(front, frame.front + 0.56);
  if (look.weapon === "hammer") {
    // A hammer sweeps through vertical during the hover stroke, above its resting pose.
    const reach = Math.hypot(0.72, 0.1);
    above = Math.max(above, -frame.deck + 0.02 + reach);
    rear = Math.max(rear, 0.05 + reach);
  }
  if (look.weapon === "saw") {
    const rest = sawPoseOf(frame, 0);
    const end = sawPoseOf(frame, 1);
    const straight = sawPoseOf(frame, -rest.angle / (end.angle - rest.angle));
    for (const pose of [rest, straight, end]) {
      front = Math.max(front, pose.bladeX + pose.tipRadius);
      above = Math.max(above, -pose.bladeY + pose.tipRadius);
    }
  }
  // The side renderer pitches by up to .012 radians when hovered. Leave room for
  // that motion, stroke widths, and the full pennant throughout a turn.
  const leftReach = (rear + 0.03) * scale;
  const rightReach = (front + 0.03) * scale;
  const horizontalReach = turntable
    ? Math.max(leftReach, rightReach)
    : Math.max(leftReach + 0.08, rightReach - 0.08);
  const desired = Math.min(Math.min(width * 0.62, height * 1.25) * zoom, height * 0.6);
  const u = Math.min(
    desired,
    (width * 0.46) / horizontalReach,
    (height * 0.78) / ((above + 0.03) * scale),
  );
  return { u, gx: turntable ? width / 2 : width / 2 - facing * u * 0.08, gy: height * 0.82 };
}
