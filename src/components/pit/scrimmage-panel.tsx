import { useMemo, useState } from "react";
import { CLASS_META, SLOT_LABEL } from "@/lib/pit/catalog";
import { bestLock, cardFor, gradesOf, methodLabel, scrimmageDrills, weekQuality, type LockAdvice, type ScrimmageHit } from "@/lib/pit/engine";
import { usePit } from "@/lib/pit/store";
import type { ClassId, StatBlock } from "@/lib/pit/types";
import { Broadcast } from "./broadcast";
import { Btn, SectionLabel } from "./bits";

const ORDER = ["ai-striker", "ai-tank", "ai-specialist"];
const STATS: (keyof StatBlock)[] = ["power", "speed", "armor", "heat"];

export function ScrimmagePanel({ storeId }: { storeId: string }) {
  const data = usePit();
  const setDraftLoadout = usePit((s) => s.setDraftLoadout);
  const [hits, setHits] = useState<ScrimmageHit[]>([]);
  const [watchId, setWatchId] = useState<string | null>(null);
  const [stamp, setStamp] = useState("");
  const [advice, setAdvice] = useState<LockAdvice | null>(null);
  const [adviceKey, setAdviceKey] = useState("");
  const bot = data.bots.find((row) => row.storeId === storeId);
  const card = cardFor(data, storeId);
  const load = bot?.locked ?? bot?.draft;
  const signature = load
    ? `${load.chassis}:${load.drive}:${load.weapon}:${load.armor}:${load.utility}:${bot?.wear.weapon}:${card?.demoPct}:${card?.closePct}:${card?.nsnuPct}:${card?.reviews}`
    : "";
  const stale = Boolean(stamp) && stamp !== signature;
  const watching = hits.find((hit) => hit.id === watchId) ?? null;
  const shown = advice && adviceKey === signature ? advice : null;
  const canApply = Boolean(
    shown &&
      !shown.already &&
      bot &&
      !bot.locked &&
      (data.session.role === "commissioner" || (data.session.role === "captain" && data.session.storeId === storeId)) &&
      (data.phase === "open" || data.session.role === "commissioner"),
  );
  const record = useMemo(() => {
    let w = 0;
    let l = 0;
    for (const hit of hits) {
      if (hit.bout.result?.winnerIds.includes(storeId)) w += 1;
      else l += 1;
    }
    return { w, l };
  }, [hits, storeId]);

  function optimize() {
    if (!bot) return;
    const weekQ = card ? weekQuality(gradesOf(card)) : 0.4;
    setAdvice(bestLock(bot, weekQ));
    setAdviceKey(signature);
  }

  function run(which: ClassId | "all") {
    const next = scrimmageDrills(data, storeId, which);
    setHits((prev) => {
      if (which === "all") return next;
      const rest = prev.filter((hit) => hit.id !== next[0]?.id);
      return [...rest, ...next].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
    });
    setWatchId(next[0]?.id ?? null);
    setStamp(signature);
  }

  return (
    <section className="border border-line bg-surface p-4" data-testid="bay-scrimmage">
      <SectionLabel>Best lock</SectionLabel>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Uses this week's grades and only iron already in the bay. It does not spend scrap, change class, or lock Friday.
      </p>
      <div className="mt-3">
        <Btn testId="optimize-build" onClick={optimize}>
          Optimize stats
        </Btn>
      </div>
      {shown ? (
        <div className="mt-4 border border-line bg-deep p-3" data-testid="lock-advice">
          <p className="font-display text-xl leading-tight">{shown.summary}</p>
          <p className="mt-2 text-sm text-muted">
            Rating {shown.current.rating} → {shown.best.rating}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            {STATS.map((key) => {
              const from = shown.current.stats[key];
              const to = shown.best.stats[key];
              return (
                <div key={key} className="border border-line px-2 py-2">
                  <p className="text-xs tracking-widest text-muted uppercase">{key}</p>
                  <p className="font-display text-2xl leading-none">
                    {from}
                    {from === to ? null : <span className="text-amber"> → {to}</span>}
                  </p>
                </div>
              );
            })}
          </div>
          {shown.changes.length ? (
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {shown.changes.map((change) => (
                <li key={change.slot}>
                  <span className="text-muted uppercase">{SLOT_LABEL[change.slot]}</span> {change.from} → {change.to}
                </li>
              ))}
            </ul>
          ) : null}
          {canApply ? (
            <div className="mt-3">
              <Btn testId="apply-best-lock" tone="line" onClick={() => setDraftLoadout(storeId, shown.loadout)}>
                Put it on the draft
              </Btn>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 border-t border-line pt-4">
        <SectionLabel>Test the build</SectionLabel>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Three house drills. Stock iron, a blue week, and the right weapon for the class. Your current build fights them. Nothing posts. No damage, no scrap, no record.
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn tone="line" onClick={() => run("striker")}>
          Vs {CLASS_META.striker.label}
        </Btn>
        <Btn tone="line" onClick={() => run("tank")}>
          Vs {CLASS_META.tank.label}
        </Btn>
        <Btn tone="line" onClick={() => run("specialist")}>
          Vs {CLASS_META.specialist.label}
        </Btn>
        <Btn testId="scrimmage-all" onClick={() => run("all")}>
          Run all three
        </Btn>
      </div>
      {stale ? <p className="mt-3 text-sm text-amber">The build changed. Run it again. The tape on screen is the old lock.</p> : null}
      {hits.length ? (
        <p className="mt-4 font-display text-2xl leading-none">
          {record.w}–{record.l} <span className="text-base text-muted">against the drills</span>
        </p>
      ) : null}
      <ul className="mt-3 flex flex-col gap-2">
        {hits.map((hit) => {
          const result = hit.bout.result;
          const won = Boolean(result?.winnerIds.includes(storeId));
          const foe = result?.fighters.find((fighter) => fighter.id !== storeId);
          return (
            <li key={hit.id} className="border border-line bg-deep p-3" data-testid={`scrimmage-${hit.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-xl leading-none">
                  <span className={won ? "text-ok" : "text-bad"}>{won ? "Win" : "Loss"}</span>
                  <span className="text-fg"> · {hit.label}</span>
                </p>
                <button type="button" className="min-h-11 text-sm text-amber" onClick={() => setWatchId(hit.id)}>
                  Watch
                </button>
              </div>
              <p className="mt-1 text-sm text-muted">
                {methodLabel(result?.method ?? "decision")}
                {result?.blowout ? " · blowout" : ""} · {foe?.botName} {foe ? (result?.hp[foe.id] ?? 0) : 0} left
              </p>
              <p className="mt-2 text-sm">{hit.note}</p>
            </li>
          );
        })}
      </ul>
      {watching?.bout.result ? (
        <div className="mt-4">
          <Broadcast bout={watching.bout} kicker="SCRIMMAGE · NO DAMAGE" noDamage />
        </div>
      ) : null}
    </section>
  );
}
