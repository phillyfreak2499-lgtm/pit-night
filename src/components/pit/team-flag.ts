/** Shared flag measurements use the same normalized bot units in both renderers. */
export type TeamFlagLayout = {
  lines: string[];
  length: number;
  drop: number;
  fontSize: number;
  lineHeight: number;
  labelWidth: number;
  labelHeight: number;
  labelCenter: number;
};

export function teamFlagLayout(name: string, measureEm: (text: string) => number): TeamFlagLayout {
  const label = name.trim().replace(/\s+/g, " ").toUpperCase();
  const words = label.split(" ");
  let lines = [label];
  // Keep every word and punctuation mark. Long multiword names use a balanced
  // second line instead of shrinking the letters or dropping the location.
  if (words.length > 1 && measureEm(label) > 7.5) {
    let narrowest = Infinity;
    for (let split = 1; split < words.length; split++) {
      const candidate = [words.slice(0, split).join(" "), words.slice(split).join(" ")];
      const width = Math.max(...candidate.map(measureEm));
      if (width < narrowest) {
        narrowest = width;
        lines = candidate;
      }
    }
  }
  const fontSize = 0.05,
    lineHeight = 0.065;
  const measuredWidth = Math.max(...lines.map(measureEm)) * fontSize;
  const length = Math.max(0.38, (measuredWidth + 0.02) / 0.5);
  const labelHeight = lines.length * lineHeight;
  // The label occupies the wide half of the triangle, with clearance above,
  // below, and at the taper. Increasing its size never exposes text off cloth.
  return {
    lines,
    length,
    drop: Math.max(0.18, labelHeight / 0.36),
    fontSize,
    lineHeight,
    labelWidth: length * 0.5,
    labelHeight,
    labelCenter: length * 0.3,
  };
}

export function measureTeamFlag(ctx: CanvasRenderingContext2D | null, name: string) {
  if (!ctx) return teamFlagLayout(name, (text) => text.length * 0.75);
  ctx.save();
  ctx.font = "700 100px Arial, sans-serif";
  const layout = teamFlagLayout(name, (text) => ctx.measureText(text).width / 100);
  ctx.restore();
  return layout;
}

/** Paint at the label center; callers orient the front/rear face before this. */
export function paintTeamFlagName(
  ctx: CanvasRenderingContext2D,
  layout: TeamFlagLayout,
  unit: number,
) {
  ctx.fillStyle = "#0e0d0b";
  ctx.font = `700 ${layout.fontSize * unit}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  layout.lines.forEach((line, index) => {
    ctx.fillText(line, 0, (index - (layout.lines.length - 1) / 2) * layout.lineHeight * unit);
  });
}
