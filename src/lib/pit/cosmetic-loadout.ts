import { bannerVerdict } from "../../../scripts/copy-guard.mjs";
import { styleOf } from "./catalog";
import { cosmeticLoadoutSchema } from "./commands";
import { cosmeticUnlocked, validBodyForClass, type CosmeticKind } from "./cosmetics";
import { lockerItem } from "./week";
import { showcasePrizeOwned } from './showcase-prizes';
import type { CosmeticLoadout, PitData } from "./types";
import { deadlineDue } from './time';

/** Only the combat prize is locked; ordinary appearance remains editable. */
export function prizeChangeBlocked(data: PitData, storeId: string, prize: string | undefined, now = new Date()): boolean {
  if (data.session.role === 'commissioner' || data.week !== 5) return false;
  const current = data.bots.find(b => b.storeId === storeId)?.style?.showcasePrize ?? 'none';
  return (prize ?? 'none') !== current && (deadlineDue(5, now) || data.phase !== 'open');
}

/** Single ownership gate for direct decoration and crew proposals. Never accepts combat fields. */
export function checkedCosmeticLoadout(
  data: PitData,
  storeId: string,
  input: CosmeticLoadout,
  preserveEquipped = false,
): CosmeticLoadout | null {
  const parsed = cosmeticLoadoutSchema.safeParse(input);
  const bot = data.bots.find((b) => b.storeId === storeId);
  const store = data.stores.find((s) => s.id === storeId);
  if (!parsed.success || !bot || !store) return null;
  const current = styleOf(bot, bot.classId);
  // A partial edit must not be blocked by an unrelated legacy/reward cosmetic.
  // Only server-held equipped values qualify; newly selected values still need ownership.
  const allowed = (kind: CosmeticKind, value: string) => {
    const existing = kind === "paint" ? store.paint : kind === "look" ? bot.look : current[kind as keyof typeof current];
    return (preserveEquipped && value === existing) || cosmeticUnlocked(data, storeId, kind, value);
  };
  const loadout = parsed.data;
  const style = styleOf({ style: loadout.style, classId: bot.classId });
  if (prizeChangeBlocked(data, storeId, style.showcasePrize)) return null;
  if (style.showcasePrize && style.showcasePrize !== 'none' && !showcasePrizeOwned(data,storeId,style.showcasePrize)) return null;
  if (
    !allowed("paint", loadout.paint) ||
    !allowed("look", loadout.look)
  )
    return null;
  if (
    style.body &&
    (!validBodyForClass(style.body, bot.classId) ||
      !allowed("body", style.body))
  )
    return null;
  if (data.week === 1 && bot.style?.body && style.body !== bot.style.body) return null;
  for (const kind of ["finish", "decal", "trim", "eye", "topper", "wings", "mask", "weaponSkin", "wheelColor", "leds"] as const) {
    if (!allowed(kind, style[kind] ?? "none")) return null;
  }
  if (!allowed("smoke", style.smoke ?? "")) return null;
  const banner = bannerVerdict(style.banner ?? "");
  if (!banner.ok) return null;
  if (banner.text && !allowed("banner", banner.text)) return null;
  if (
    Object.entries(style.stickers!).some(([slot, value]) => !(preserveEquipped && current.stickers?.[slot as keyof typeof current.stickers] === value) && !cosmeticUnlocked(data, storeId, "decal", value))
  )
    return null;
  for (const kind of ["walkout", "victory"] as const) {
    const value = style[kind];
    if (value && !(preserveEquipped && value === current[kind]) && (lockerItem(value)?.kind !== kind || !store.unlocks?.includes(value))) return null;
  }
  return { ...loadout, number: loadout.number.trim().toUpperCase(), style: { ...style, banner: banner.text } };
}
