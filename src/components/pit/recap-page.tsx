import { Link, useNavigate } from "@tanstack/react-router";
import { Flame, Package, Printer, Trophy, Wrench } from "lucide-react";
import { CLASS_META } from "@/lib/pit/catalog";
import { botFor, rankedStores, recordOf } from "@/lib/pit/engine";
import { paintHex, usePit } from "@/lib/pit/store";
import type { Bout, PitData } from "@/lib/pit/types";
import { boltsOf, sparkStreak } from "@/lib/pit/week";
import { ResultLine, SectionLabel } from "./bits";
import { BotPortrait, useBotLook } from "./bot-portrait";

type WeekRow = { week: number; name: string; bout: Bout | null; outcome: "W" | "L" | "Bye" | "—"; tuned: boolean; mvp: string | null };

function weekRows(data: PitData, storeId: string): WeekRow[] {
  return data.weeks.map((w) => {
    const bout = data.bouts.find((b) => b.week === w.number && b.result && b.storeIds.includes(storeId)) ?? null;
    const r = bout?.result;
    const outcome: WeekRow["outcome"] = !r
      ? "—"
      : bout.kind === "bye" || r.method === "bye"
        ? "Bye"
        : r.winnerIds.includes(storeId)
          ? "W"
          : "L";
    const tuned = Boolean(r?.fighters.find((f) => f.id === storeId)?.tuned);
    const mvp = data.mvps.find((m) => m.week === w.number && m.storeId === storeId)?.name ?? null;
    return { week: w.number, name: w.name, bout, outcome, tuned, mvp };
  });
}

/** The win this store will want framed: a KO first, then the biggest health gap. */
function bestFight(rows: WeekRow[], storeId: string): Bout | null {
  const wins = rows.filter((r) => r.outcome === "W" && r.bout?.result).map((r) => r.bout!);
  if (!wins.length) return null;
  const score = (b: Bout) => {
    const r = b.result!;
    const mine = r.hp[storeId] ?? 0;
    const theirs = Math.max(0, ...r.loserIds.map((id) => r.hp[id] ?? 0));
    return (r.method === "ko" ? 1000 : r.method === "dump" ? 500 : 0) + (mine - theirs);
  };
  return [...wins].sort((a, b) => score(b) - score(a))[0] ?? null;
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]!);
}

export function RecapPage({ storeId }: { storeId: string }) {
  const data = usePit();
  const look = useBotLook(storeId);
  const navigate = useNavigate();
  const store = data.stores.find((s) => s.id === storeId);
  if (!store) {
    return (
      <div>
        <h1 className="font-display text-4xl">No such store</h1>
        <Link to="/honors" className="mt-3 inline-block text-amber">
          Back to Honors
        </Link>
      </div>
    );
  }
  const bot = botFor(data, storeId);
  const rec = recordOf(data, storeId);
  const place = rankedStores(data).findIndex((s) => s.id === storeId) + 1;
  const rows = weekRows(data, storeId);
  const best = bestFight(rows, storeId);
  const tuneUps = rows.filter((r) => r.tuned).length;
  const bolts = boltsOf(data, storeId);
  const crew = data.crew.filter((c) => c.storeId === storeId);
  const jobs = data.jobLog.filter((e) => e.storeId === storeId && e.status === "approved");
  const crates = jobs.filter((e) => e.jobId.endsWith("-crate")).length;
  const sparks = data.sparkLog.filter((e) => e.storeId === storeId);
  const perfect = sparks.filter((e) => e.total > 0 && e.correct === e.total).length;
  const shouts = data.shouts.filter((s) => s.storeId === storeId).length;
  const flames = crew.map((c) => ({ c, s: sparkStreak(data, c.id) })).filter((x) => x.s.badge);
  const honors = [
    data.honors.pitBelt === storeId ? "Period 12 trophy" : null,
    data.honors.plate === storeId ? "Runner-up plate" : null,
    data.honors.bestBuild === storeId ? "Best Build" : null,
  ].filter(Boolean) as string[];
  const done = data.phase === "complete";
  const accent = paintHex(store.paint);

  return (
    <div className="recap mx-auto flex max-w-4xl flex-col gap-5" data-testid="season-recap">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link to="/honors" className="inline-flex min-h-11 items-center text-sm text-muted">
          ← Honors
        </Link>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Store recap"
            className="min-h-11 border border-line bg-deep px-3 text-sm"
            value={storeId}
            onChange={(e) => {
              void navigate({ to: "/recap/$storeId", params: { storeId: e.target.value } });
            }}
          >
            {data.stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 bg-amber px-4 font-display text-sm tracking-wide text-deep uppercase">
            <Printer size={16} aria-hidden /> Print
          </button>
        </div>
      </div>

      <article className="recap-sheet border-2 bg-surface" style={{ borderColor: accent }}>
        <div className="h-3" style={{ background: accent }} />
        <header className="grid gap-4 p-5 md:grid-cols-[1fr_15rem] md:p-8">
          <div>
            <p className="font-display text-xs tracking-[0.3em] text-amber uppercase">The Waterman Battle Bot League · Period 12</p>
            <h1 className="mt-2 font-display text-5xl leading-none md:text-6xl">{store.name}</h1>
            <p className="mt-2 font-display text-2xl leading-none text-muted">
              {bot.name} · {CLASS_META[bot.classId].label} · Bay {bot.number}
            </p>
            <p className="mt-1 text-sm text-muted">Captain {store.captain}</p>
            {!done ? <p className="no-print mt-3 text-sm text-warn">Season still running. This sheet fills in as the fights post.</p> : null}
            <div className="mt-5 flex flex-wrap items-end gap-6">
              <div>
                <p className="text-[11px] tracking-widest text-muted uppercase">Record</p>
                <p className="font-display text-6xl leading-none tabular-nums">
                  {rec.w}–{rec.l}
                </p>
              </div>
              <div>
                <p className="text-[11px] tracking-widest text-muted uppercase">{done ? "Final place" : "Place now"}</p>
                <p className="font-display text-6xl leading-none">{ordinal(place)}</p>
              </div>
              <div>
                <p className="text-[11px] tracking-widest text-muted uppercase">Tune-Ups</p>
                <p className="font-display text-6xl leading-none">{tuneUps}</p>
              </div>
            </div>
            {honors.length ? (
              <p className="mt-4 inline-flex flex-wrap items-center gap-2 font-display text-xl text-amber">
                <Trophy size={20} aria-hidden /> {honors.join(" · ")}
              </p>
            ) : null}
          </div>
          <div className="relative h-48 md:h-full">
            <BotPortrait look={look} zoom={0.95} className="h-full w-full" />
          </div>
        </header>

        <section className="border-t border-line p-5 md:px-8">
          <SectionLabel>Fight by fight</SectionLabel>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-[11px] tracking-widest text-muted uppercase">
              <tr>
                <th className="py-1 pr-2 font-normal">Week</th>
                <th className="py-1 pr-2 font-normal">Result</th>
                <th className="hidden py-1 pr-2 font-normal sm:table-cell">How it went</th>
                <th className="py-1 pr-2 font-normal">Tune-Up</th>
                <th className="py-1 font-normal">MVP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.week} className="border-t border-line align-top">
                  <td className="py-2 pr-2">
                    <span className="font-display">{r.week}</span> <span className="text-muted">{r.name}</span>
                  </td>
                  <td className={`py-2 pr-2 font-display text-lg ${r.outcome === "W" || r.outcome === "Bye" ? "text-ok" : r.outcome === "L" ? "text-bad" : "text-muted"}`}>{r.outcome}</td>
                  <td className="hidden py-2 pr-2 text-muted sm:table-cell">{r.bout ? <ResultLine bout={r.bout} /> : "Not fought yet"}</td>
                  <td className="py-2 pr-2">{r.tuned ? <span className="text-spark">+4 earned</span> : <span className="text-muted">—</span>}</td>
                  <td className="py-2">{r.mvp ?? <span className="text-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="grid gap-5 border-t border-line p-5 md:grid-cols-2 md:px-8">
          <div>
            <SectionLabel>Best fight</SectionLabel>
            {best ? (
              <div className="mt-2">
                <p className="font-display text-2xl leading-tight">
                  Week {best.week} · {best.title}
                </p>
                <p className="mt-1 text-sm">
                  <ResultLine bout={best} />
                </p>
                <Link to="/bout/$boutId" params={{ boutId: best.id }} className="no-print mt-2 inline-flex min-h-11 items-center text-sm text-amber">
                  Watch the tape →
                </Link>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">No win on the tape yet.</p>
            )}
          </div>
          <div>
            <SectionLabel>Pit Week</SectionLabel>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Jobs approved</dt>
              <dd className="font-display text-lg">{jobs.length - crates}</dd>
              <dt className="flex items-center gap-1 text-muted">
                <Package size={13} aria-hidden /> Mystery Crates
              </dt>
              <dd className="font-display text-lg">{crates}</dd>
              <dt className="text-muted">Perfect Sparks</dt>
              <dd className="font-display text-lg">
                {perfect} <span className="text-sm text-muted">of {sparks.length}</span>
              </dd>
              <dt className="text-muted">Shout-outs given</dt>
              <dd className="font-display text-lg">{shouts}</dd>
              <dt className="flex items-center gap-1 text-muted">
                <Wrench size={13} aria-hidden /> Bolts earned
              </dt>
              <dd className="font-display text-lg">{bolts.earned}</dd>
            </dl>
          </div>
        </section>

        <section className="border-t border-line p-5 md:px-8">
          <SectionLabel>The pit crew</SectionLabel>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
            {crew.map((c) => {
              const flame = flames.find((f) => f.c.id === c.id);
              const mvps = data.mvps.filter((m) => m.crewId === c.id).length;
              return (
                <li key={c.id} className="font-display text-lg">
                  {c.name}
                  {c.role === "captain" ? <span className="ml-1 text-xs tracking-widest text-muted uppercase">captain</span> : null}
                  {flame ? (
                    <span className="ml-1 inline-flex items-center text-sm text-spark" title="Spark streak">
                      <Flame size={14} aria-hidden />
                      {flame.s.best}
                    </span>
                  ) : null}
                  {mvps ? <span className="ml-1 text-sm text-amber">MVP×{mvps}</span> : null}
                </li>
              );
            })}
          </ul>
        </section>
        <footer className="border-t border-line px-5 py-3 text-xs text-muted md:px-8">
          Oct 25 – Nov 21, 2026 · Eleven Good Feet stores · One trophy · The store is the bot.
        </footer>
      </article>
    </div>
  );
}
