import { GRADE_COINS, METRICS, SLOT_LABEL, bandText } from "@/lib/pit/catalog";
import { cardValue, gradeMetric } from "@/lib/pit/engine";
import type { Grade, StatKey, StoreCard } from "@/lib/pit/types";
import { GradeMark } from "./bits";

const FIELD: Record<StatKey, keyof StoreCard> = {
  nsnu: "nsnu",
  conv: "conv",
  demoRate: "demoRate",
  demoClose: "demoClose",
  arch: "arch",
  ticket: "demoTicket",
};

const EDGE: Record<Grade, string> = {
  green: "border-ok/70",
  blue: "border-info/70",
  orange: "border-warn/70",
  red: "border-bad/70",
};

/** Six boxes, one per metric, each showing its grade, coins, and the part it feeds. */
export function ScoreInputs({
  card,
  disabled,
  onChange,
  compact = false,
}: {
  card: StoreCard;
  disabled?: boolean;
  onChange: (patch: Partial<StoreCard>) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`grid gap-2 ${compact ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6" : "sm:grid-cols-2 lg:grid-cols-3"}`}
    >
      {METRICS.map((m) => {
        const value = cardValue(card, m.stat);
        const grade = gradeMetric(m.stat, value);
        const bands = bandText(m);
        return (
          <label key={m.stat} className={`flex flex-col gap-1 border-2 bg-deep p-2 ${EDGE[grade]}`}>
            <span className="flex items-center justify-between gap-2">
              <span className="font-display text-sm tracking-wide uppercase">{m.label}</span>
              <GradeMark grade={grade} />
            </span>
            <input
              type="number"
              step={m.step}
              disabled={disabled}
              value={Number.isFinite(value) ? value : 0}
              aria-label={m.label}
              className="min-h-11 w-full border border-line bg-bg px-2 font-display text-xl text-fg outline-none focus:border-amber disabled:opacity-60"
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) onChange({ [FIELD[m.stat]]: n } as Partial<StoreCard>);
              }}
            />
            <span className="text-[11px] leading-tight text-muted">
              +{GRADE_COINS[grade]} {SLOT_LABEL[m.slot].toLowerCase()} coins
              {compact ? "" : ` · green ${bands.green}`}
            </span>
          </label>
        );
      })}
    </div>
  );
}
