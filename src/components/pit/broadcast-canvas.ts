/** Do not reset a canvas (or its effects) just because playback controls changed. */
export function resizeBroadcastCanvas(canvas: HTMLCanvasElement, dpr: number) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width === width && canvas.height === height) return false;
  canvas.width = width;
  canvas.height = height;
  return true;
}
