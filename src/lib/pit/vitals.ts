import type { BellVitals, ExchangeVitals, FightResult } from "./types";

/**
 * Live meter sample for one fighter. Reads `result.bell` and `exchange.vitals`
 * only. A tape without those fields returns null so the watch party can show
 * N/A instead of inventing numbers or re-simulating the bout.
 */
export type MeterRead = {
  battery: number;
  batteryMax: number;
  stamina: number;
  staminaMax: number;
  /** Effective swing power recorded for this moment. */
  power: number;
  /** Printed power at the bell. The power bar fills against this. */
  powerMax: number;
};

export type MeterPhase =
  | { kind: "bell" }
  | { kind: "enter"; index: number }
  | { kind: "exchange"; index: number; local: number }
  | { kind: "final" };

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function fromBell(bell: BellVitals): MeterRead {
  return {
    battery: bell.battery,
    batteryMax: bell.batteryMax,
    stamina: bell.stamina,
    staminaMax: bell.staminaMax,
    power: bell.power,
    powerMax: bell.power,
  };
}

function fromSnap(bell: BellVitals, snap: ExchangeVitals): MeterRead {
  return {
    battery: snap.battery,
    batteryMax: bell.batteryMax,
    stamina: snap.stamina,
    staminaMax: bell.staminaMax,
    power: snap.power,
    powerMax: Math.max(1, bell.power),
  };
}

/** State a round is entered with: the previous exchange, or the bell. */
function entered(result: FightResult, id: string, index: number): MeterRead | null {
  const bell = result.bell?.[id];
  if (!bell) return null;
  if (index <= 0) return fromBell(bell);
  const prev = result.exchanges[index - 1]?.vitals?.[id];
  return prev ? fromSnap(bell, prev) : fromBell(bell);
}

export function readMeters(result: FightResult, fighterId: string, phase: MeterPhase): MeterRead | null {
  const bell = result.bell?.[fighterId];
  if (!bell) return null;
  if (phase.kind === "bell") return fromBell(bell);
  if (phase.kind === "enter") return entered(result, fighterId, phase.index);
  if (phase.kind === "final") {
    for (let i = result.exchanges.length - 1; i >= 0; i--) {
      const snap = result.exchanges[i]?.vitals?.[fighterId];
      if (snap) return fromSnap(bell, snap);
    }
    return fromBell(bell);
  }
  const curr = result.exchanges[phase.index]?.vitals?.[fighterId];
  const prev = entered(result, fighterId, phase.index);
  if (!curr || !prev) return prev;
  const t = clamp(phase.local, 0, 1);
  // Drain across the swing, then show the recorded recovery at the end of the beat.
  const stamina =
    t < 0.62 ? lerp(prev.stamina, curr.staminaLow, t / 0.62) : lerp(curr.staminaLow, curr.stamina, (t - 0.62) / 0.38);
  return {
    battery: lerp(prev.battery, curr.battery, t),
    batteryMax: bell.batteryMax,
    stamina,
    staminaMax: bell.staminaMax,
    power: t < 0.42 ? prev.power : curr.power,
    powerMax: Math.max(1, bell.power),
  };
}
