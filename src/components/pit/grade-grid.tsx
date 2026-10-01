import { GRADE_COINS, METRICS, SLOT_LABEL, bandText } from "@/lib/pit/catalog";
import { paintHex } from "@/lib/pit/store";
import type { Grade, StatKey } from "@/lib/pit/types";

const GRADES: Grade[] = ["green", "blue", "orange", "red"];

const CHIP: Record<Grade, { on: string; off: string; letter: string }> = {
  green: { on: "bg-ok text-deep border-ok", off: "border-ok/40 text-ok/80 hover:bg-ok/15", letter: "G" },
  blue: { on: "bg-info text-deep border-info", off: "border-info/40 text-info/80 hover:bg-info/15", letter: "B" },
  orange: { on: "bg-warn text-deep border-warn", off: "border-warn/40 text-warn/80 hover:bg-warn/15", letter: "O" },
  red: { on: "bg-bad text-deep border-bad", off: "border-bad/40 text-bad/80 hover:bg-bad/15", letter: "R" },
};

export type GradeRowData = {
  id: string;
  name: string;
  paint: string;
  grades: Partial<Record<StatKey, Grade>>;
  /** Shown faded where no color is clicked yet (e.g. a typed or projected number). */
  fallback?: Partial<Record<StatKey, Grade>>;
  /** Coins to show; defaults to clicked colors only. */
  coins?: number;
};

export function coinsFor(grades: Partial<Record<StatKey, Grade>>) {
  return METRICS.reduce((n, m) => n + (grades[m.stat] ? GRADE_COINS[grades[m.stat]!] : 0), 0);
}

/** Click a color for each of the six numbers. Click it again to clear. */
export function GradeGrid({
  rows,
  onPick,
  disabled,
  aside,
  testId,
}: {
  rows: GradeRowData[];
  onPick: (id: string, stat: StatKey, grade: Grade | null) => void;
  disabled?: boolean;
  aside?: (row: GradeRowData) => React.ReactNode;
  testId?: string;
}) {
  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      <div className="hidden grid-cols-[9.5rem_repeat(6,minmax(0,1fr))_6rem] gap-2 px-2 text-[11px] tracking-widest text-muted uppercase xl:grid">
        <span>Store</span>
        {METRICS.map((m) => (
          <span key={m.stat} title={`Green ${bandText(m).green}`}>
            {m.label}
            <span className="block text-[10px] tracking-normal normal-case opacity-70">{SLOT_LABEL[m.slot]} coins</span>
          </span>
        ))}
        <span className="text-right">Coins</span>
      </div>
      {rows.map((row) => {
        const done = METRICS.filter((m) => row.grades[m.stat]).length;
        return (
          <div
            key={row.id}
            className={`grid gap-2 border bg-deep p-2 xl:grid-cols-[9.5rem_repeat(6,minmax(0,1fr))_6rem] xl:items-center ${done === METRICS.length ? "border-ok/40" : "border-line"}`}
          >
            <div className="flex items-center justify-between gap-2 xl:block">
              <p className="flex items-center gap-2 font-display text-lg leading-none">
                <span className="h-3 w-3 shrink-0" style={{ background: paintHex(row.paint) }} aria-hidden />
                {row.name}
              </p>
              <span className="text-xs text-muted xl:mt-1 xl:block">{done}/6 colors</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:contents">
              {METRICS.map((m) => {
                const picked = row.grades[m.stat];
                const ghost = !picked ? row.fallback?.[m.stat] : undefined;
                return (
                  <div key={m.stat} className="flex flex-col gap-1" role="group" aria-label={`${row.name} ${m.label}`}>
                    <span className="text-[11px] tracking-widest text-muted uppercase xl:hidden">{m.label}</span>
                    <div className="grid grid-cols-4 gap-1">
                      {GRADES.map((g) => (
                        <button
                          key={g}
                          type="button"
                          disabled={disabled}
                          aria-pressed={picked === g}
                          aria-label={`${row.name} ${m.label} ${g}`}
                          title={`${g} · +${GRADE_COINS[g]} coins`}
                          onClick={() => onPick(row.id, m.stat, picked === g ? null : g)}
                          className={`min-h-11 border-2 font-display text-sm transition-colors disabled:opacity-40 xl:min-h-9 ${
                            picked === g ? CHIP[g].on : CHIP[g].off
                          } ${ghost === g ? "border-dashed bg-surface-2" : ""}`}
                        >
                          {CHIP[g].letter}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-2 xl:flex-col xl:items-end">
              <span className="font-display text-xl leading-none text-amber">{row.coins ?? coinsFor(row.grades)}</span>
              {aside ? aside(row) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
