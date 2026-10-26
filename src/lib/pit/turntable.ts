/** Seconds for one full garage turntable revolution. */
export const GARAGE_SPIN_SECONDS = 11;

/**
 * Reduced motion starts the garage preview paused.
 * Anyone else starts on the turntable.
 */
export function garageSpinStartsPlaying(prefersReducedMotion: boolean): boolean {
  return !prefersReducedMotion;
}

/** Radians advanced during dt seconds. Constant speed, one turn per period. */
export function garageYawStep(dtSeconds: number): number {
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return 0;
  return (dtSeconds / GARAGE_SPIN_SECONDS) * Math.PI * 2;
}

/** Yaw after elapsed seconds, wrapped to [0, 2π). */
export function garageYaw(elapsedSeconds: number): number {
  if (!Number.isFinite(elapsedSeconds)) return 0;
  const turns = elapsedSeconds / GARAGE_SPIN_SECONDS;
  const wrapped = turns - Math.floor(turns);
  return wrapped * Math.PI * 2;
}

export type GaragePose = {
  /** Signed horizontal scale. Positive faces screen-right. */
  facing: number;
  /** 0 at the nose or tail, 1 on a full side. */
  side: number;
  /** 0 on a full side, 1 looking at the nose or the tail. */
  end: number;
  rear: boolean;
};

/** Side, nose, other side, tail. Width eases through the ends so the flip does not pop. */
export function garagePose(yaw: number): GaragePose {
  const tau = Math.PI * 2;
  const wrapped = ((yaw % tau) + tau) % tau;
  const c = Math.cos(wrapped);
  const s = Math.sin(wrapped);
  const side = Math.abs(c);
  const mag = 0.16 + 0.84 * side;
  const sign = Math.abs(c) < 1e-8 ? (s >= 0 ? 1 : -1) : c > 0 ? 1 : -1;
  return {
    facing: sign * mag,
    side,
    end: s * s,
    rear: s < 0,
  };
}

/**
 * How strongly the front or rear plate replaces the side drawing.
 * Stays at 0 through the three-quarter view so the side profile does not ghost.
 */
export function garagePlateMix(end: number): number {
  const x = Math.min(1, Math.max(0, (end - 0.62) / 0.38));
  return x * x * (3 - 2 * x);
}
