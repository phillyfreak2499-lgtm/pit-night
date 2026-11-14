import type { FightResult, Session } from "./types";

export function coachStore(viewer: Session, result: FightResult) {
  if (viewer.role !== "captain" && viewer.role !== "crew") return null;
  return result.fighters.some(f => f.id === viewer.storeId) ? viewer.storeId : null;
}

/** Choose a moment this crew actually fought in, including on older group tapes. */
export function tapeNote(result: FightResult, storeId: string) {
  const bot = result.fighters.find(f => f.id === storeId);
  if (!bot) return null;
  const featured = result.exchanges.filter(e => e.attackerId === storeId || e.defenderId === storeId);
  const finish = result.finisher;
  const moment = finish && (finish.by === storeId || finish.against === storeId)
    ? finish : featured.reduce<(typeof featured)[number] | undefined>(
      (best, hit) => !best || hit.damage > best.damage ? hit : best, undefined);
  if (!moment) return null;
  const tip = bot.classId === "tank"
    ? bot.weaponFamily === "wedge"
      ? "Keep the rest of the build the same in a drill, then try a Hammer in place of the Wedge and compare the last exchange."
      : "Try a Wedge in a drill and see whether you can push the other bot toward the pit."
    : bot.classId === "specialist"
      ? bot.utilityFamily === "leech"
        ? "Run a drill with the utility slot empty and compare the Heat gap with your Leech run."
        : "Try Leech in a drill and watch the Heat gap after the first exchange."
      : bot.weaponFamily === "saw"
        ? "Swap the saw for a drum in a drill and compare your opening hit."
        : "Try a saw in a drill and compare your opening hit.";
  const observation = moment.call;
  return { observation, tip, bot: bot.botName, weapon: bot.weaponName, method: result.method,
    won: result.winnerIds.includes(storeId) };
}
