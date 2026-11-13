import { SLOTS } from "./engine";
import type { Condition, PitData, Slot } from "./types";

/** Single owner-authorized gift; the owner confirmed the live Desk is in Week 3. */
export const NOV13_REPAIR_GIFT = "owner-period12-week3-free-repairs-2026-11-13";
export const NOV13_REPAIR_START = Date.parse("2026-11-13T00:00:00.000Z");
// Nov 16 midnight America/Chicago. Never heal a later week after a late deployment.
export const NOV13_REPAIR_END = Date.parse("2026-11-16T06:00:00.000Z");
export const NOV13_REPAIR_TARGET_WEEK: number | null = 3;

/** Vercel previews may share Neon; only the production deployment may activate this gift.
 * Fail closed when system environment variables are not exposed. Verify before release.
 */
export function nov13RepairDeploymentAllowed(vercelEnv: string | undefined): boolean {
  return vercelEnv === "production";
}

export function nov13RepairDue(data: Pick<PitData, "seasonName" | "week" | "phase" | "ownerEvents">, now: Date, targetWeek: number | null = NOV13_REPAIR_TARGET_WEEK): boolean {
  return data.seasonName === "Period 12" &&
    targetWeek === 3 && data.week === targetWeek &&
    // Fought has pending damage: wait for inspection before consuming the gift.
    ["open", "locked", "inspected"].includes(data.phase) &&
    now.getTime() >= NOV13_REPAIR_START && now.getTime() < NOV13_REPAIR_END &&
    !data.ownerEvents?.includes(NOV13_REPAIR_GIFT);
}

/** Pure, idempotent and independently scope-checked, including on retries. */
export function grantNov13Repairs(data: PitData, now: Date, targetWeek: number | null = NOV13_REPAIR_TARGET_WEEK): PitData {
  if (!nov13RepairDue(data, now, targetWeek)) return data;
  const wear = Object.fromEntries(SLOTS.map((slot) => [slot, "clean"])) as Record<Slot, Condition>;
  return {
    ...data,
    bots: data.bots.map((bot) => ({
      ...bot, wear: { ...wear },
      // Absent entries are clean, including owned spares and legacy damage.
      partWear: {}, weldForWeek: {}, weldedParts: {},
    })),
    quotes: Object.fromEntries(data.bots.map((bot) => [bot.storeId, []])),
    ownerEvents: [...(data.ownerEvents ?? []), NOV13_REPAIR_GIFT],
    log: [
      "Commissioner gift: every bot repaired to 100% for Pit Week 3. No coins, vouchers, or Bolts spent.",
      ...data.log,
    ].slice(0, 24),
  };
}
