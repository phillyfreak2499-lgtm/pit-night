// Each loop has its own fader. The master fader leaves speech and weapon hits alone.
const RATE = 22050;
const BEAT = 60 / 112;
const TAU = 2 * Math.PI;

function makeGroove(audio: BaseAudioContext) {
  const buffer = audio.createBuffer(1, Math.round(16 * BEAT * RATE), RATE);
  const samples = buffer.getChannelData(0);
  const roots = [73.42, 73.42, 87.31, 65.41];
  const bass = [0, 0, 7, 12, 0, 7, 3, 7];
  // D-minor hook, voiced above the bass so small speakers carry the tune.
  const lead = [62, 65, 69, 67, 65, 64, 62, 60, 65, 69, 72, 69, 67, 64, 60, 64];
  let previousNoise = 0;
  for (let i = 0; i < samples.length; i++) {
    const beat = i / RATE / BEAT;
    const step = Math.floor(beat * 2);
    const t = (beat * 2 - step) * BEAT / 2;
    const root = roots[Math.floor(beat / 4) % 4]!;
    const freq = root * 2 ** (bass[step % 8]! / 12);
    const pluck = Math.min(1, t * 140) * Math.exp(-t * 18);
    const bassNote = pluck * (Math.sin(TAU * freq * t) + 0.22 * Math.sin(TAU * 2 * freq * t));
    const noise = Math.random() * 2 - 1;
    const hat = (noise - previousNoise) * Math.exp(-95 * t) * 0.06;
    previousNoise = noise;
    const kick = step % 4 === 0 ? Math.sin(TAU * (49 * t + 0.85 * (1 - Math.exp(-45 * t)))) * Math.exp(-23 * t) : 0;
    const snare = step % 4 === 2 ? noise * Math.exp(-36 * t) : 0;
    const noteTime = (beat % 1) * BEAT;
    const notePhase = TAU * 440 * 2 ** ((lead[Math.floor(beat) % 16]! - 69) / 12) * noteTime;
    const envelope = Math.min(1, noteTime / 0.012) * Math.exp(-4.8 * noteTime) *
      Math.min(1, (BEAT - noteTime) / 0.055);
    const melody = envelope * (Math.sin(notePhase) + 0.36 * Math.sin(2 * notePhase) + 0.16 * Math.sin(3 * notePhase));
    const edge = Math.min(1, i / 100, (samples.length - i - 1) / 100);
    samples[i] = edge * (0.35 * melody + 0.34 * bassNote + 0.35 * kick + 0.12 * snare + 0.55 * hat);
  }
  return buffer;
}

// "Clapping hurray", starlite (public domain). Source recording:
// https://commons.wikimedia.org/wiki/File:Clapping_hurray.ogg
let crowd: AudioBuffer | undefined;
let loading: Promise<void> | undefined;
export function loadCheer(audio: BaseAudioContext) {
  loading ??= fetch("/arena-cheers.wav").then(async response => {
    if (!response.ok) throw new Error("Arena crowd unavailable");
    crowd = await audio.decodeAudioData(await response.arrayBuffer());
  }).catch(() => { loading = undefined; });
  return loading;
}

let groove: AudioBuffer | undefined;

export function startArenaMix(audio: AudioContext) {
  groove ??= makeGroove(audio);
  void loadCheer(audio);
  const master = audio.createGain();
  master.connect(audio.destination);
  const music = audio.createBufferSource();
  const musicGain = audio.createGain();
  musicGain.gain.value = 0.30;
  music.buffer = groove;
  music.loop = true;
  music.connect(musicGain).connect(master);
  music.start();

  let cheerIndex = 0;
  let activeCheer: AudioBufferSourceNode | null = null;
  return {
    cheer() {
      if (!crowd || activeCheer) return;
      const source = audio.createBufferSource();
      const level = audio.createGain();
      const now = audio.currentTime;
      const duration = 1.8;
      level.gain.setValueAtTime(0, now);
      level.gain.linearRampToValueAtTime(0.22, now + 0.08);
      level.gain.setValueAtTime(0.22, now + 0.9);
      level.gain.linearRampToValueAtTime(0, now + duration);
      source.buffer = crowd;
      source.connect(level).connect(master);
      activeCheer = source;
      source.onended = () => {
        activeCheer = null;
        source.disconnect();
        level.disconnect();
      };
      source.start(now, [0.35, 3.1, 5.8][cheerIndex++ % 3], duration);
    },
    duck(speaking: boolean) {
      master.gain.setTargetAtTime(speaking ? 0.14 : 1, audio.currentTime, speaking ? 0.025 : 0.25);
    },
    stop() {
      activeCheer?.stop();
      music.stop();
      music.disconnect();
      musicGain.disconnect();
      master.disconnect();
    },
  };
}
