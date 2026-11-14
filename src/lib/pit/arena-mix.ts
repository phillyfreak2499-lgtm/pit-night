const RATE = 22050;
const TAU = 2 * Math.PI;
const tracks = [
  { bpm: 152, root: 73.416, roots: [0,0,3,5,0,0,8,7], riff: [1,0,.42,.42,0,0,.7,0,1,0,.42,0,.8,0,.45,.45], kicks: [0,3,6,8,10,14] },
  { bpm: 168, root: 82.407, roots: [0,7,5,3,0,3,5,7], riff: [1,0,0,.5,.8,0,.6,0,1,0,0,.5,.8,0,.7,0], kicks: [0,2,4,8,11,12,15] },
  { bpm: 146, root: 65.406, roots: [0,5,7,7,0,3,10,7], riff: [1,0,0,0,0,.9,0,.4,0,0,1,0,.6,0,0,.7], kicks: [0,5,8,10,13] },
  { bpm: 160, root: 77.782, roots: [0,0,7,10,5,5,3,7], riff: [1,0,.5,0,.5,.5,0,.8,1,0,.5,0,.5,.5,0,.8], kicks: [0,4,6,7,8,12,14] },
];

// Eight bars of drop-D power chords. Short gated chugs answer the sustained
// downbeats; the last bar breaks into a tom fill and leads back into the loop.
function makeGroove(audio: BaseAudioContext, track: typeof tracks[number]) {
  const beatSeconds = 60 / track.bpm;
  const buffer = audio.createBuffer(1, Math.round(32 * beatSeconds * RATE), RATE);
  const samples = buffer.getChannelData(0);
  const { roots, riff } = track;
  const kickSteps = new Set(track.kicks);
  let guitarPhase = 0;
  let noiseLow = 0;
  let cabinet = 0;
  let lastPick = 0;
  for (let i = 0; i < samples.length; i++) {
    const sec = i / RATE;
    const beat = sec / beatSeconds;
    const bar = Math.min(7, Math.floor(beat / 4));
    const step = Math.floor(beat * 4) % 16;
    const stepTime = (beat * 4 % 1) * beatSeconds / 4;
    if (stepTime < 1 / RATE && riff[step]) lastPick = sec;
    const t = sec - lastPick;
    const attackStep = Math.round(lastPick / beatSeconds * 4) % 16;
    const accent = riff[attackStep] ?? 1;
    const root = track.root * 2 ** (roots[bar]! / 12);
    guitarPhase += TAU * root / RATE;
    const pick = Math.min(1, t * 420) * Math.exp(-t * (accent < 0.5 ? 30 : 6));
    const fifth = guitarPhase * 1.5;
    const string = Math.sin(guitarPhase) + 0.55 * Math.sin(2 * guitarPhase) + 0.25 * Math.sin(4 * guitarPhase)
      + 0.74 * Math.sin(fifth) + 0.38 * Math.sin(2 * fifth);
    cabinet += 0.45 * (Math.tanh(string * (2.8 + pick)) - cabinet);
    const guitars = cabinet * pick * (0.55 + 0.45 * accent);
    const noise = Math.random() * 2 - 1;
    noiseLow += 0.30 * (noise - noiseLow);
    const kick = kickSteps.has(step) ?
      Math.sin(TAU * (54 * stepTime + 1.4 * (1 - Math.exp(-60 * stepTime)))) * Math.exp(-23 * stepTime) : 0;
    const backbeat = beat % 2 >= 1 ? (beat % 2 - 1) * beatSeconds : 1;
    const snare = (noiseLow * 2.1 + Math.sin(TAU * 180 * backbeat) * 0.5) * Math.exp(-24 * backbeat);
    const hat = (noise - noiseLow) * Math.exp(-64 * (beat * 2 % 1) * beatSeconds / 2);
    const tom = bar === 7 && step >= 12 ?
      Math.sin(TAU * (170 - 20 * (step - 12)) * stepTime) * Math.exp(-15 * stepTime) : 0;
    const crash = (noise - noiseLow) * Math.exp(-6 * (beat % 8) * beatSeconds);
    const edge = Math.min(1, i / 80, (samples.length - 1 - i) / 80);
    samples[i] = edge * Math.tanh(0.89 * guitars + 0.24 * pick * Math.sin(guitarPhase / 2)
      + 0.83 * kick + 0.82 * snare + 0.13 * hat + 0.35 * crash + 0.5 * tom);
  }
  return buffer;
}

// Crowd recording attribution is shipped in /arena-audio-credits.txt.
let crowd: AudioBuffer | undefined;
let loading: Promise<void> | undefined;
export function loadCheer(audio: BaseAudioContext) {
  loading ??= fetch("/arena-cheers.wav").then(async response => {
    if (!response.ok) throw new Error("Arena crowd unavailable");
    crowd = await audio.decodeAudioData(await response.arrayBuffer());
  }).catch(() => { loading = undefined; });
  return loading;
}

const grooves = new Map<number, AudioBuffer>();

export function startArenaMix(audio: AudioContext, fightNumber = 0) {
  const index = Math.abs(fightNumber) % tracks.length;
  const groove = grooves.get(index) ?? makeGroove(audio, tracks[index]!);
  grooves.set(index, groove);
  void loadCheer(audio);
  const master = audio.createGain();
  master.connect(audio.destination);
  const music = audio.createBufferSource();
  const musicGain = audio.createGain();
  musicGain.gain.value = 0.39;
  music.buffer = groove;
  music.loop = true;
  music.connect(musicGain).connect(master);
  music.start();


  let activeCheer: AudioBufferSourceNode | null = null;
  return {
    cheer() {
      if (!crowd || activeCheer) return;
      const source = audio.createBufferSource();
      const level = audio.createGain();
      const now = audio.currentTime;
      const duration = 3.4;
      level.gain.setValueAtTime(0, now);
      level.gain.linearRampToValueAtTime(0.86, now + 0.035);
      level.gain.setValueAtTime(0.86, now + 1.8);
      level.gain.linearRampToValueAtTime(0, now + duration);
      source.buffer = crowd;
      source.connect(level).connect(master);
      activeCheer = source;
      source.onended = () => {
        activeCheer = null;
        source.disconnect();
        level.disconnect();
      };
      source.start(now, 0, duration);
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
