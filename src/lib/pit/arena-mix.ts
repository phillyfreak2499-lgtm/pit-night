// Each loop has its own fader. The master fader leaves speech and weapon hits alone.
const RATE = 22050;
const BEAT = 60 / 112;
const TAU = 2 * Math.PI;

function makeGroove(audio: BaseAudioContext) {
  const buffer = audio.createBuffer(1, Math.round(16 * BEAT * RATE), RATE);
  const samples = buffer.getChannelData(0);
  const roots = [73.42, 73.42, 87.31, 65.41];
  const bass = [0, 0, 7, 12, 0, 7, 3, 7];
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
    const edge = Math.min(1, i / 100, (samples.length - i - 1) / 100);
    samples[i] = edge * (0.38 * bassNote + 0.44 * kick + 0.16 * snare + hat);
  }
  return buffer;
}

function makeCrowd(audio: BaseAudioContext) {
  const buffer = audio.createBuffer(2, RATE * 4, RATE);
  for (let channel = 0; channel < 2; channel++) {
    const samples = buffer.getChannelData(channel);
    let rumble = 0;
    for (let i = 0; i < samples.length; i++) {
      const t = i / RATE;
      rumble += 0.22 * (Math.random() * 2 - 1 - rumble);
      let voices = 0;
      for (let j = 0; j < 5; j++) {
        const swell = (1 + Math.sin(TAU * (t * (j + 2) / 4 + j * 0.37 + channel * 0.14))) / 2;
        const phase = TAU * ((138 + j * 19 + channel * 2) * t + 0.7 * Math.sin(TAU * t * (j + 1) / 4));
        voices += swell * swell * (Math.sin(phase) + 0.5 * Math.sin(phase * 3));
      }
      const edge = Math.min(1, i / 160, (samples.length - i - 1) / 160);
      samples[i] = edge * (rumble * 0.65 + voices * 0.055);
    }
  }
  return buffer;
}

let loops: { music: AudioBuffer; crowd: AudioBuffer } | undefined;

export function startArenaMix(audio: AudioContext) {
  loops ??= { music: makeGroove(audio), crowd: makeCrowd(audio) };
  const master = audio.createGain();
  master.gain.value = 1;
  master.connect(audio.destination);
  function layer(buffer: AudioBuffer, volume: number) {
    const source = audio.createBufferSource();
    const level = audio.createGain();
    level.gain.value = volume;
    source.buffer = buffer;
    source.loop = true;
    source.connect(level).connect(master);
    source.start();
    return { source, level };
  }
  const music = layer(loops.music, 0.105);
  const crowd = layer(loops.crowd, 0.10);
  return {
    cheer() {
      const now = audio.currentTime;
      crowd.level.gain.cancelScheduledValues(now);
      crowd.level.gain.setTargetAtTime(0.30, now, 0.12);
      crowd.level.gain.setTargetAtTime(0.10, now + 0.48, 0.45);
    },
    duck(speaking: boolean) {
      master.gain.setTargetAtTime(speaking ? 0.18 : 1, audio.currentTime, speaking ? 0.025 : 0.25);
    },
    stop() {
      for (const { source, level } of [music, crowd]) {
        source.stop();
        source.disconnect();
        level.disconnect();
      }
      master.disconnect();
    },
  };
}
