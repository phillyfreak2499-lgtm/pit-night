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

let noiseBuffer: AudioBuffer | null = null;

/** Half a second of white noise, made once, for scrapes, chops and whooshes. */
function noise(audio: AudioContext) {
  if (noiseBuffer && noiseBuffer.sampleRate === audio.sampleRate) return noiseBuffer;
  const length = Math.floor(audio.sampleRate * 0.5);
  noiseBuffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

/** Filtered noise: type and frequency shape it into a scrape, chop, whoosh or grind. */
function hiss(at: number, dur: number, peak: number, type: BiquadFilterType, freq: number, toFreq = freq) {
  const audio = live();
  if (!audio) return;
  const start = audio.currentTime + at;
  const src = audio.createBufferSource();
  src.buffer = noise(audio);
  const filter = audio.createBiquadFilter();
  filter.type = type;
  filter.Q.value = type === "bandpass" ? 6 : 0.8;
  filter.frequency.setValueAtTime(freq, start);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, toFreq), start + dur);
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filter).connect(gain).connect(audio.destination);
  src.start(start);
  src.stop(start + dur + 0.02);
}

/** A pitch that slides, for whines and zaps. */
function sweep(at: number, dur: number, peak: number, type: OscillatorType, from: number, to: number) {
  const audio = live();
  if (!audio) return;
  const start = audio.currentTime + at;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + dur);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(audio.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/** Which family of sound a weapon makes. */
export function hitVoice(weapon: string): "whine" | "clang" | "chop" | "scrape" | "crunch" | "whoosh" | "zap" | "thud" | "boom" | "punch" {
  if (["saw", "drum", "disc", "chainsaw", "thresher"].some((w) => weapon.includes(w))) return "whine";
  if (["hammer", "carver"].includes(weapon)) return "clang";
  if (["axe", "slasher", "ghost", "blade", "machete"].includes(weapon)) return "chop";
  if (["wedge", "flip", "broom"].includes(weapon)) return "scrape";
  if (["claw", "bones"].includes(weapon)) return "crunch";
  if (["flame", "burn"].includes(weapon)) return "whoosh";
  if (weapon === "tesla") return "zap";
  if (["flail", "piston"].includes(weapon)) return "thud";
  if (["launcher", "yamcannon"].includes(weapon)) return "boom";
  return "punch";
}

/** A hit that sounds like the weapon that landed it. Power 0..1 sets the weight. */
export function playWeaponHit(weapon: string, power = 0.5, crit = false) {
  if (!live()) return;
  const p = 0.6 + Math.min(1, Math.max(0, power)) * 0.6;
  switch (hitVoice(weapon)) {
    case "whine":
      sweep(0, 0.26, 0.02 * p, "sawtooth", 1150, 620);
      hiss(0, 0.22, 0.05 * p, "bandpass", 3200, 1800);
      break;
    case "clang":
      beep(392, 0, 0.5, 0.035 * p, "triangle");
      beep(1081, 0, 0.32, 0.018 * p, "triangle");
      beep(70, 0, 0.18, 0.06 * p, "sine");
      break;
    case "chop":
      hiss(0, 0.09, 0.09 * p, "lowpass", 2600, 500);
      beep(110, 0.01, 0.16, 0.06 * p, "sine");
      break;
    case "scrape":
      hiss(0, 0.32, 0.05 * p, "bandpass", 900, 2400);
      beep(140, 0, 0.12, 0.035 * p, "square");
      break;
    case "crunch":
      hiss(0, 0.14, 0.07 * p, "highpass", 1800, 900);
      beep(95, 0.02, 0.14, 0.05 * p, "square");
      break;
    case "whoosh":
      hiss(0, 0.45, 0.07 * p, "lowpass", 600, 2200);
      break;
    case "zap":
      sweep(0, 0.18, 0.025 * p, "square", 1800, 260);
      hiss(0, 0.1, 0.04 * p, "highpass", 4000, 2500);
      break;
    case "thud":
      beep(85, 0, 0.22, 0.07 * p, "sine");
      hiss(0, 0.06, 0.04 * p, "lowpass", 900, 300);
      break;
    case "boom":
      beep(55, 0, 0.45, 0.08 * p, "sine");
      hiss(0, 0.3, 0.05 * p, "lowpass", 700, 120);
      break;
    default:
      playHit();
  }
  if (crit) {
    beep(60, 0, 0.35, 0.07, "sine");
    beep(120, 0.02, 0.2, 0.03, "sawtooth");
  }
}

/** A big one: low thump under the hit. */
export function playCrit() {
  playHit();
  beep(60, 0, 0.35, 0.07, "sine");
  beep(120, 0.02, 0.2, 0.03, "sawtooth");
}
