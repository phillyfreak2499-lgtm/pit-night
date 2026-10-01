const KEY = "pit-night-muted";

let muted = false;
let ctx: AudioContext | null = null;
const listeners = new Set<() => void>();

function boot() {
  if (typeof localStorage === "undefined") return;
  muted = localStorage.getItem(KEY) === "1";
}

boot();

export function soundMuted() {
  return muted;
}

export function subscribeSound(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function armSound() {
  if (typeof AudioContext === "undefined") return;
  if (!ctx) ctx = new AudioContext();
  void ctx.resume();
}

export function setSoundMuted(next: boolean) {
  muted = next;
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    /* private mode */
  }
  emit();
  if (!next) {
    armSound();
    playBell();
  }
}

function live(): AudioContext | null {
  if (muted || !ctx) return null;
  return ctx;
}

function beep(freq: number, at: number, dur: number, peak: number, type: OscillatorType) {
  const audio = live();
  if (!audio) return;
  const start = audio.currentTime + at;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(audio.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

export function playBell() {
  beep(520, 0, 0.16, 0.035, "triangle");
  beep(780, 0.11, 0.2, 0.028, "triangle");
}

export function playHit() {
  const audio = live();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(148, audio.currentTime);
  osc.frequency.exponentialRampToValueAtTime(48, audio.currentTime + 0.12);
  gain.gain.setValueAtTime(0.045, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.16);
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + 0.17);
}

export function playFinisher() {
  beep(90, 0, 0.28, 0.06, "sawtooth");
  beep(180, 0.04, 0.12, 0.02, "square");
}

export function playDecision() {
  beep(392, 0, 0.14, 0.03, "triangle");
  beep(494, 0.12, 0.14, 0.03, "triangle");
  beep(587, 0.24, 0.22, 0.028, "triangle");
}

/** Countdown: a pip on 3, 2, 1 and a horn on FIGHT. */
export function playCount(n: number) {
  if (n > 0) beep(660, 0, 0.12, 0.03, "square");
  else {
    beep(330, 0, 0.5, 0.04, "sawtooth");
    beep(495, 0, 0.5, 0.03, "sawtooth");
  }
}

/** Armor holds: a bright clank. */
export function playClank() {
  beep(1180, 0, 0.09, 0.025, "triangle");
  beep(1760, 0.01, 0.07, 0.015, "square");
}

/** A big one: low thump under the hit. */
export function playCrit() {
  playHit();
  beep(60, 0, 0.35, 0.07, "sine");
  beep(120, 0.02, 0.2, 0.03, "sawtooth");
}
