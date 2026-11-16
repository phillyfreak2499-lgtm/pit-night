import { fightDuel, duelWear } from "./combat";
import { approvedCard, expectedHistory } from "./period12-approved-card";
import type { Bout, PitData } from "./types";
export const FINALE_POST_AFTER = Date.parse("2026-11-17T16:00:00.000Z");
export const FINALE_EVENT = "owner-period12-week4-approved-2026-11-16";
export const FINALE_HOLD_LABEL = "Tuesday, Nov 17, after 10:00 AM CT";

/** Match the exact recorded season approved by the commissioner. */
export function pendingApprovedFinale(
  data: Pick<PitData, "seasonName" | "week" | "bouts" | "ownerEvents">,
): boolean {
  if (
    data.seasonName !== "Period 12" ||
    data.week !== 4 ||
    data.ownerEvents?.includes(FINALE_EVENT) ||
    data.bouts.some((b) => b.week === 4 && b.result)
  )
    return false;
  const history = data.bouts.filter((b) => b.week < 4 && b.result);
  return (
    history.length === expectedHistory.length &&
    expectedHistory.every((e) => {
      const b = history.find((b) => b.id === e.id);
      return (
        b &&
        JSON.stringify(b.result!.winnerIds) === JSON.stringify(e.winners) &&
        JSON.stringify(b.result!.loserIds) === JSON.stringify(e.losers)
      );
    })
  );
}

/** Preserve seven watched outcomes; repair only the zero-HP berth tape. */
export function approvedFinaleTape(): Bout[] {
  const card = structuredClone(approvedCard),
    tie = card.find((b) => b.title === "Frontier Conference Tiebreaker")!;
  const [college, abilene] = tie.result!.fighters;
  const fought = fightDuel(college!, abilene!, { hot: true, pitOnly: true });
  if (fought.hp.college !== 0 || !(fought.hp.abilene! > 0))
    throw new Error("Approved Frontier outcome changed; commissioner review required.");
  tie.result = {
    ...tie.result!,
    ...fought,
    winnerIds: ["abilene"],
    loserIds: ["college"],
    wear: duelWear("abilene", "college", fought.method, fought.exchanges.length <= 3),
    blowout: fought.exchanges.length <= 3 || fought.hp.abilene! >= 60,
  };
  return card;
}
