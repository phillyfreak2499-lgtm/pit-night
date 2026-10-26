import { PARTS, SLOT_LABEL, tierWord } from "./catalog";
import { recordOf } from "./engine";
import type { Bout, FighterSnap, PitData, Slot } from "./types";

/** How long the program stays up before the tape, when the broadcast is rolling. */
export const PROGRAM_HOLD_MS = 11000;

/** Chassis, armor, drive, weapon, utility, brain. Every slot, in program order. */
export const PROGRAM_SLOTS = ["chassis", "armor", "drive", "weapon", "utility", "brain"] as const satisfies readonly Slot[];

export type WinLoss = { w: number; l: number };

export type ProgramSlotRow = {
  slot: Slot;
  label: string;
  name: string;
  tier: string;
  job: string;
};

const SLOT_NAME: Record<Slot, (fighter: FighterSnap) => string | null | undefined> = {
  chassis: (fighter) => fighter.chassisName,
  armor: (fighter) => fighter.armorName,
  drive: (fighter) => fighter.driveName,
  weapon: (fighter) => fighter.weaponName,
  utility: (fighter) => fighter.utilityName,
  brain: (fighter) => fighter.brainName,
};

function fallbackName(slot: Slot): string {
  if (slot === "utility") return "Empty";
  if (slot === "brain") return "Logic Board";
  return "—";
}

/** Full setup for one bot: every slot, its part, its tier, and what that part does. */
export function programSlots(fighter: FighterSnap): ProgramSlotRow[] {
  return PROGRAM_SLOTS.map((slot) => {
    const raw = SLOT_NAME[slot](fighter)?.trim() ?? "";
    const name = raw || fallbackName(slot);
    const part = raw ? PARTS.find((row) => row.slot === slot && row.name === raw) : undefined;
    const tier = fighter.tiers?.[slot] ?? part?.tier;
    const job =
      part?.job ?? (slot === "utility" && name === "Empty" ? "Utility can stay empty." : "");
    return {
      slot,
      label: SLOT_LABEL[slot],
      name,
      tier: tier ? tierWord(tier) : "—",
      job,
    };
  });
}

export function programSides(bout: Bout): { left: FighterSnap[]; right: FighterSnap[] } {
  const fighters = bout.result?.fighters ?? [];
  const onSide = (ids: string[], fighter: FighterSnap) => {
    if (fighter.id === "house") return false;
    const parts = fighter.id.split("+");
    return ids.some((id) => parts.includes(id));
  };
  return {
    left: fighters.filter((fighter) => onSide(bout.teamA, fighter)),
    right: bout.kind === "bye" ? [] : fighters.filter((fighter) => onSide(bout.teamB, fighter)),
  };
}

/** Store ids whose W-L belongs on this corner. */
export function cornerStoreIds(fighter: FighterSnap, team: string[]): string[] {
  const parts = fighter.id.split("+").filter((id) => team.includes(id));
  if (parts.length) return parts;
  if (team.includes(fighter.id)) return [fighter.id];
  return team.length ? team : [fighter.id];
}

/**
 * Record going into this bout. A posted result for this bout is left off
 * so the program shows the record before the bell, not after it.
 */
export function recordEntering(data: PitData, storeId: string, boutId: string): WinLoss {
  const posted = data.bouts.some((bout) => bout.id === boutId && bout.result);
  if (!posted) return recordOf(data, storeId);
  return recordOf({ ...data, bouts: data.bouts.filter((bout) => bout.id !== boutId) }, storeId);
}

export function programRecords(data: PitData, bout: Bout): Record<string, WinLoss> {
  const ids = [...new Set([...bout.storeIds, ...bout.teamA, ...bout.teamB])];
  const records: Record<string, WinLoss> = {};
  for (const id of ids) records[id] = recordEntering(data, id, bout.id);
  return records;
}

export function storeNameMap(data: PitData): Record<string, string> {
  const names: Record<string, string> = {};
  for (const store of data.stores) names[store.id] = store.name;
  return names;
}

export type ProgramSegment<T extends { id: string }> =
  | { id: string; kind: "open" }
  | { id: string; kind: "close" }
  | { id: string; kind: "card"; bout: T }
  | { id: string; kind: "fight"; bout: T }
  | { id: string; kind: "sting"; bout: T };

/** Cold open, then a program card before every tape, then the call, then sign-off. */
export function programSegments<T extends { id: string }>(bouts: T[]): ProgramSegment<T>[] {
  const segments: ProgramSegment<T>[] = [{ id: "open", kind: "open" }];
  for (const bout of bouts) {
    segments.push({ id: `c-${bout.id}`, kind: "card", bout });
    segments.push({ id: `f-${bout.id}`, kind: "fight", bout });
    segments.push({ id: `s-${bout.id}`, kind: "sting", bout });
  }
  segments.push({ id: "close", kind: "close" });
  return segments;
}
