import { styleOf } from "./catalog";
import { cosmeticLoadoutSchema } from "./commands";
import { cosmeticUnlocked, validBodyForClass } from "./cosmetics";
import { lockerItem } from "./week";
import type { CosmeticLoadout, PitData } from "./types";

/** Single ownership gate for direct decoration and crew proposals. Never accepts combat fields. */
export function checkedCosmeticLoadout(
  data: PitData,
  storeId: string,
  input: CosmeticLoadout,
): CosmeticLoadout | null {
  const parsed = cosmeticLoadoutSchema.safeParse(input);
  const bot = data.bots.find((b) => b.storeId === storeId);
  const store = data.stores.find((s) => s.id === storeId);
  if (!parsed.success || !bot || !store) return null;
  const loadout = parsed.data;
  const style = styleOf({ style: loadout.style, classId: bot.classId });
  if (
    !cosmeticUnlocked(data, storeId, "paint", loadout.paint) ||
    !cosmeticUnlocked(data, storeId, "look", loadout.look)
  )
    return null;
  if (
    style.body &&
    (!validBodyForClass(style.body, bot.classId) ||
      !cosmeticUnlocked(data, storeId, "body", style.body))
  )
    return null;
  if (data.week === 1 && bot.style?.body && style.body !== bot.style.body) return null;
  for (const kind of ["finish", "decal", "trim", "eye", "topper"] as const) {
    if (!cosmeticUnlocked(data, storeId, kind, style[kind] ?? "none")) return null;
  }
  if (
    Object.values(style.stickers!).some((value) => !cosmeticUnlocked(data, storeId, "decal", value))
  )
    return null;
  for (const kind of ["walkout", "victory"] as const) {
    const value = style[kind];
    if (value && (lockerItem(value)?.kind !== kind || !store.unlocks?.includes(value))) return null;
  }
  return { ...loadout, number: loadout.number.trim().toUpperCase(), style };
}
