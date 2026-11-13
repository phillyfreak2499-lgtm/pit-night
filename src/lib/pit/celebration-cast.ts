import type { FighterSnap, PitData } from "./types";
/** Detached public appearance only; no loadouts, private data, or result mutations. */
export function celebrationCast(data: Pick<PitData, "stores" | "bots">): FighterSnap[] {
  const bots = new Map(data.bots.map((bot) => [bot.storeId, bot]));
  const seen = new Set<string>();
  return data.stores.flatMap((store) => {
    if (seen.has(store.id)) return [];
    seen.add(store.id);
    const bot = bots.get(store.id);
    return [{ id: store.id, name: store.name, storeName: store.name, botName: bot?.name ?? store.name,
      classId: bot?.classId ?? "striker", paint: store.paint, look: bot?.look ?? "plain", number: bot?.number ?? "",
      style: bot?.style ? { ...bot.style } : undefined, weaponFamily: "none", weaponName: "", driveName: "",
      armorName: "", utilityName: null, chassisName: "", stats: { power: 0, speed: 0, armor: 0, heat: 0 }, rating: 0, fit: 0, weekQ: 0 }];
  });
}
export function celebrationMessage(seconds: number) {
  if (seconds < 7) return "Every bot. Every store. One team.";
  if (seconds < 16) return "We're rooting for you.";
  if (seconds < 24) return "We're proud of you.";
  return "All of us. With you. Team Janelle.";
}
