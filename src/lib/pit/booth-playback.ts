import type { BoothClip, BoothLine } from "./booth";

/** Schedule the whole exchange on one clock so the analysts never talk over one another. */
export async function playBooth(context: AudioContext, clips: BoothClip[], signal: AbortSignal,
  onLine: (line: BoothLine) => void, onSpeaking?: (speaking: boolean) => void) {
  const buffers = await Promise.all(clips.map(c =>
    context.decodeAudioData(Uint8Array.from(atob(c.audio), ch => ch.charCodeAt(0)).buffer)));
  if (signal.aborted || !buffers.length || context.state !== "running") return;
  await new Promise<void>((resolve) => {
    const sources: AudioBufferSourceNode[] = [];
    const timers: number[] = [];
    const finish = () => {
      signal.removeEventListener("abort", finish);
      timers.forEach(clearTimeout);
      for (const source of sources) {
        source.onended = null;
        source.stop();
        source.disconnect();
      }
      onSpeaking?.(false);
      resolve();
    };
    signal.addEventListener("abort", finish, { once: true });
    const start = context.currentTime;
    let offset = 0;
    onSpeaking?.(true);
    buffers.forEach((buffer, i) => {
      const source = context.createBufferSource();
      sources.push(source);
      source.buffer = buffer;
      source.connect(context.destination);
      if (i === buffers.length - 1) source.onended = finish;
      if (i === 0) onLine(clips[i]!);
      else timers.push(window.setTimeout(() => onLine(clips[i]!), offset * 1000));
      source.start(start + offset);
      offset += buffer.duration + 0.18;
    });
  });
}
