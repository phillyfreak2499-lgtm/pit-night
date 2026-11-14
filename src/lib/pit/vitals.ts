import type { BellVitals, ExchangeVitals, FightResult } from "./types";
import { batteryCurve, batteryPace, glassOf, staminaCurve } from "./combat";

/** Only attribute an effect when the recorded swing agrees with the combat model. */
export function swingMeterCall(result: FightResult, index: number): string | undefined {
  const ex = result.exchanges[index];
  if (!ex || ex.tags.includes("sudden-death") || ex.tags.includes("pit-elimination")) return;
  const id = ex.attackerId;
  const fighter = result.fighters.find(f => f.id === id);
  const bell = result.bell?.[id];
  const trace = ex.combat?.[id];
  const swing = ex.vitals?.[id];
  if (!fighter?.stats || !bell || !trace || !swing || !(trace.hitCount > 0 && trace.damageDealt > 0)) return;
  const { battery, stamina } = trace.before;
  if (stamina == null || !(bell.batteryMax > 0 && bell.staminaMax > 0 && bell.power > 0) ||
      !(battery >= 0 && battery <= bell.batteryMax && stamina >= 0 && stamina <= bell.staminaMax)) return;
  const turns = result.exchanges.slice(0, index).filter(e => e.attackerId === id || e.defenderId === id).length;
  const cell = batteryCurve(bell.batteryMax, battery) * batteryPace(bell.batteryMax, battery, turns);
  const endurance = staminaCurve(bell.staminaMax, stamina, turns, glassOf(fighter.stats));
  const expected = bell.power * cell * endurance;
  if (!(Math.abs(expected - swing.power) < 0.01)) return;
  const power = Math.round(swing.power);
  if (power >= Math.round(bell.power)) return;
  if (endurance <= 0.95)
    return `${fighter.botName} went into that swing with ${Math.round(stamina)} stamina. Fatigue took some power off it.`;
  if (cell <= 0.90)
    return `${fighter.botName} had ${Math.round(100 * battery / bell.batteryMax)} percent battery going in. That swing had only ${power} power behind it.`;
  if (power <= 0.95 * bell.power)
    return `${fighter.botName} brought ${power} power to that hit, down from ${Math.round(bell.power)} at the bell.`;
}

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
