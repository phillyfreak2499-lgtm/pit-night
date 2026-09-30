import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CLASS_META, SLOT_LABEL, tierWord } from "@/lib/pit/catalog";
import { gradesOf, methodLabel, recordOf, scrapMath } from "@/lib/pit/engine";
import { paintHex, usePit } from "@/lib/pit/store";
import type { Bout, Grade, StoreCard } from "@/lib/pit/types";

export function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** Period 12 opens at Central midnight, October 25, 2026. */
export const PERIOD_OPENS = new Date("2026-10-25T05:00:00.000Z");

/** Bots lock at Saturday close. Fights run Monday morning on the official numbers. */
export function nextLock(now: Date) {
  const target = new Date(now);
  const day = target.getDay();
  const add = (6 - day + 7) % 7;
  target.setDate(target.getDate() + add);
  target.setHours(18, 0, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 7);
  return target;
}

export function formatRemain(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(sec)}`;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

const GRADE_CLASS: Record<Grade, string> = {
  green: "bg-ok/15 text-ok",
  blue: "bg-info/15 text-info",
  orange: "bg-warn/15 text-warn",
  red: "bg-bad/15 text-bad",
};

export function GradeMark({ grade }: { grade: Grade }) {
  return (
    <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${GRADE_CLASS[grade]}`}>
      {grade}
    </span>
  );
}

export function PaintChip({ paint, className = "" }: { paint: string; className?: string }) {
  return (
    <span
      className={`inline-block h-3 w-3 shrink-0 ${className}`}
      style={{ background: paintHex(paint) }}
      aria-hidden
    />
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-display text-xs tracking-[0.22em] text-amber uppercase">{children}</p>;
}

export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`border border-line bg-surface ${className}`}>{children}</section>;
}

export function Btn({
  children,
  onClick,
  tone = "amber",
  type = "button",
  disabled,
  testId,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: "amber" | "ghost" | "spark" | "line";
  type?: "button" | "submit";
  disabled?: boolean;
  testId?: string;
  className?: string;
}) {
  const tones = {
    amber: "bg-amber text-deep hover:brightness-110",
    spark: "bg-spark text-deep hover:brightness-110",
    ghost: "bg-transparent text-fg border border-line hover:border-amber",
    line: "bg-surface-2 text-fg border border-line hover:border-amber",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      data-testid={testId}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center justify-center px-4 py-2 font-display text-sm tracking-wide uppercase disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-11 w-full border border-line bg-deep px-3 text-fg outline-none focus:border-amber ${props.className ?? ""}`}
    />
  );
}

export function StatStrip({
  power,
  speed,
  armor,
  heat,
}: {
  power: number;
  speed: number;
  armor: number;
  heat: number;
}) {
  const rows = [
    ["Power", power],
    ["Speed", speed],
    ["Armor", armor],
    ["Heat", heat],
  ] as const;
  return (
    <div className="grid grid-cols-4 gap-2">
      {rows.map(([label, value]) => (
        <div key={label} className="border border-line bg-deep px-2 py-2">
          <p className="text-[0.65rem] tracking-widest text-muted uppercase">{label}</p>
          <p className="font-display text-2xl leading-none">{value}</p>
        </div>
      ))}
    </div>
  );
}

export function GradeRow({ card }: { card: StoreCard }) {
  const grades = gradesOf(card);
  const scrap = scrapMath(grades);
  const items = [
    ["Demo", grades.demo],
    ["Close", grades.close],
    ["NSNU", grades.nsnu],
    ["Reviews", grades.reviews],
    ["Ticket", grades.ticket],
  ] as const;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map(([label, grade]) => (
        <span key={label} className="inline-flex items-center gap-1 text-xs text-muted">
          {label}
          <GradeMark grade={grade} />
        </span>
      ))}
      <span className="text-xs text-amber">
        {scrap.total} scrap{scrap.bonus ? ` · +${scrap.bonus} green bonus` : ""}
      </span>
    </div>
  );
}

export function StoreLink({ id, children, className = "" }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <Link to="/stores/$storeId" params={{ storeId: id }} className={className}>
      {children}
    </Link>
  );
}

export function Record({ storeId }: { storeId: string }) {
  const data = usePit();
  const rec = recordOf(data, storeId);
  return (
    <span className="font-display text-lg tracking-wide">
      {rec.w}–{rec.l}
    </span>
  );
}

export function BoutWatch({ bout }: { bout: Bout }) {
  if (!bout.result) return null;
  return (
    <Link
      to="/bout/$boutId"
      params={{ boutId: bout.id }}
      className="inline-flex min-h-11 items-center bg-amber px-4 font-display text-sm tracking-wide text-deep uppercase"
    >
      Watch
    </Link>
  );
}

export function ResultLine({ bout }: { bout: Bout }) {
  const stores = usePit((s) => s.stores);
  const name = (id: string) => stores.find((s) => s.id === id)?.name ?? id;
  if (!bout.result) return <span className="text-muted">Waiting on the bell</span>;
  if (bout.kind === "bye") return <span className="text-muted">Bye · counts as a win</span>;
  if (bout.kind === "melee") {
    const winner = bout.result.winnerIds[0];
    return (
      <span>
        Last bot · {winner ? name(winner) : "—"} · {methodLabel(bout.result.method)}
      </span>
    );
  }
  const winners = bout.result.winnerIds.map(name).join(" & ");
  const losers = bout.result.loserIds.map(name).join(" & ");
  return (
    <span>
      {winners} over {losers} · {methodLabel(bout.result.method)}
      {bout.result.blowout ? " · blowout" : ""}
    </span>
  );
}

export function ClassTag({ classId }: { classId: keyof typeof CLASS_META }) {
  return <span className="text-xs tracking-widest text-muted uppercase">{CLASS_META[classId].label}</span>;
}

export function slotTitle(slot: keyof typeof SLOT_LABEL) {
  return SLOT_LABEL[slot];
}

export function TierTag({ tier }: { tier: string }) {
  return <span className="text-xs tracking-widest text-amber uppercase">{tierWord(tier as "stock")}</span>;
}
