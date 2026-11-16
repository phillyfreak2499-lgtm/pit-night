import type { PitData, StatBlock, ClassId } from "./types";
import type { ShowcasePrizeId } from "./showcase-model";

export const SHOWCASE_PRIZES: readonly { id: ShowcasePrizeId; label: string; classId: ClassId; stat: keyof StatBlock; bonus: 2; eventLabel: string }[] = [
  { id: "rocket-tail", label: "Rocket Tail", classId: "striker", stat: "speed", bonus: 2, eventLabel: "Striker Stakes" },
  { id: "battle-tank", label: "Battle Tank", classId: "tank", stat: "armor", bonus: 2, eventLabel: "Iron Pull" },
  { id: "tesla-rig", label: "Tesla Rig", classId: "specialist", stat: "heat", bonus: 2, eventLabel: "Reactor Rescue" },
];
export function showcasePrizeOwned(data: PitData, storeId: string, prize: ShowcasePrizeId): boolean {
  return SHOWCASE_PRIZES.some((row) => row.id === prize) && !!data.stores.find((store) => store.id === storeId)?.unlocks?.includes(`showcase-prize:${prize}`);
}
/** Caller applies this only to Rumble snapshots, never ordinary fights. */
export function equippedShowcaseBonus(data: PitData, storeId: string): Partial<StatBlock> {
  const prize = data.bots.find((bot) => bot.storeId === storeId)?.style?.showcasePrize;
  const row = SHOWCASE_PRIZES.find((item) => item.id === prize);
  return row && showcasePrizeOwned(data, storeId, row.id) ? { [row.stat]: row.bonus } : {};
}

