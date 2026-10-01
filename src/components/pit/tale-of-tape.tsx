import { Gauge, Shield, Swords } from "lucide-react";
import { PAINT } from "@/lib/pit/catalog";
import { methodLabel } from "@/lib/pit/engine";
import type { Bout, FighterSnap } from "@/lib/pit/types";

function Side({ fighter, won, hp }: { fighter: FighterSnap; won: boolean; hp: number }) {
  return (
    <div
      className="min-w-0 border-l-4 bg-deep px-3 py-2"
      style={{ borderColor: PAINT[fighter.paint] ?? "#f0a202" }}
    >
      <p className="font-display text-lg leading-tight">
        {fighter.botName} {won ? <span className="text-xs text-ok">WINNER</span> : null}
      </p>
      <p className="text-xs text-muted">{fighter.storeName}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted">Weapon</dt>
        <dd>{fighter.weaponName}</dd>
        <dt className="text-muted">Armor</dt>
        <dd>{fighter.armorName}</dd>
        <dt className="text-muted">Brain</dt>
        <dd>{fighter.brainName ?? "Logic Board"}</dd>
        <dt className="text-muted">Finish</dt>
        <dd>{hp} / 100 HP</dd>
        {fighter.tuned ? (
          <>
            <dt className="text-muted">Tune-Up</dt>
            <dd className="text-amber">+4 to all stats</dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}

/** Adapted from the supplied update. Reports actual results without changing combat or inventing causal HP estimates. */
export function TaleOfTape({ bout, compact = false }: { bout: Bout; compact?: boolean }) {
  const result = bout.result;
  if (!result || result.fighters.length !== 2 || !result.exchanges.length) return null;
  const winner = result.fighters.find((f) => result.winnerIds.includes(f.id));
  const loser = result.fighters.find((f) => result.loserIds.includes(f.id));
  if (!winner || !loser) return null;
  const hits = result.exchanges.filter((e) => e.attackerId === winner.id);
  const damage = hits.reduce((n, e) => n + e.damage, 0);
  return (
    <section
      className={`w-full text-left ${compact ? "max-w-xl" : "border border-line bg-surface p-4"}`}
      data-testid={compact ? "tale-compact" : "tale-of-tape"}
    >
      <p className="font-display text-xs tracking-[0.25em] text-amber uppercase">
        Tale of the tape
      </p>
      <h2 className="mt-1 font-display text-xl leading-tight">
        {winner.storeName} · {methodLabel(result.method)}
      </h2>
      {!compact ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Side fighter={winner} won hp={result.hp[winner.id] ?? 0} />
          <Side fighter={loser} won={false} hp={result.hp[loser.id] ?? 0} />
        </div>
      ) : null}
      <ul className="mt-3 flex flex-col gap-2 text-sm text-muted">
        <li className="flex gap-2">
          <Swords size={16} className="shrink-0 text-amber" />
          {hits.length} scoring exchanges · {damage} damage before any finisher.
        </li>
        <li className="flex gap-2">
          <Shield size={16} className="shrink-0 text-amber" />
          {winner.botName} finished with {result.hp[winner.id] ?? 0} HP; {loser.botName} with{" "}
          {result.hp[loser.id] ?? 0}.
        </li>
        {winner.tuned ? (
          <li className="flex gap-2">
            <Gauge size={16} className="shrink-0 text-amber" />
            Full Tune-Up added +4 Power, Speed, Armor and Heat. Bolts bought looks only.
          </li>
        ) : null}
      </ul>
    </section>
  );
}
