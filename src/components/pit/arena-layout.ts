/** Expand floor area relative to bot size; duels and four-bot tags stay unchanged. */
export function arenaBotScale(count: number): number {
  return count <= 4 ? 1 : Math.max(0.42, Math.sqrt(3 / count));
}

/** Stable, spaced bays keep every entrant identifiable on a large-field broadcast. */
export function largeFieldSlot(index: number, count: number) {
  const columns = Math.round(Math.sqrt(count * 1.34));
  const rows = Math.ceil(count / columns);
  const row = Math.floor(index / columns);
  const inRow = Math.min(columns, count - row * columns);
  return {
    x: 0.14 + (index % columns) * (0.72 / Math.max(1, inRow - 1)),
    y: 0.3 + row * (0.54 / Math.max(1, rows - 1)),
  };
}
