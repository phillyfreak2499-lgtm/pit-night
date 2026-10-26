import { CLASS_META, PAINT } from "@/lib/pit/catalog";
import { cornerStoreIds, programSides, programSlots, type WinLoss } from "@/lib/pit/fight-card";
import type { Bout, FighterSnap } from "@/lib/pit/types";
import { BotPortrait, type BotLookProps } from "./bot-portrait";

function lookFromFighter(fighter: FighterSnap): BotLookProps {
  const weapon = fighter.weaponFamily && fighter.weaponFamily !== "hidden" ? fighter.weaponFamily : "none";
  return {
    id: fighter.id,
    paint: fighter.paint,
    classId: fighter.classId,
    weapon,
    look: fighter.look,
    number: fighter.number,
    hp: 100,
    scars: fighter.scars,
    style: fighter.style,
    storeName: fighter.storeName,
    brainTier: fighter.brainTier,
    armorFamily: fighter.armorFamily,
    driveFamily: fighter.driveFamily,
    chassisFamily: fighter.chassisFamily,
    utilityFamily: fighter.utilityFamily,
  };
}

function RecordBlock({
  ids,
  records,
  storeNames,
}: {
  ids: string[];
  records: Record<string, WinLoss>;
  storeNames: Record<string, string>;
}) {
  if (ids.length <= 1) {
    const id = ids[0];
    const rec = (id && records[id]) || { w: 0, l: 0 };
    return (
      <p className="mt-2 font-display text-4xl leading-none tabular-nums md:text-5xl" data-testid={id ? `record-${id}` : undefined}>
        {rec.w}–{rec.l}
        <span className="ml-2 text-sm tracking-[0.2em] text-muted">W–L</span>
      </p>
    );
  }
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {ids.map((id) => {
        const rec = records[id] ?? { w: 0, l: 0 };
        return (
          <li key={id} className="flex items-baseline justify-between gap-3 text-sm" data-testid={`record-${id}`}>
            <span className="min-w-0 truncate text-muted">{storeNames[id] ?? id}</span>
            <span className="font-display text-xl tabular-nums">
              {rec.w}–{rec.l}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Corner({
  fighter,
  team,
  facing,
  records,
  storeNames,
}: {
  fighter: FighterSnap;
  team: string[];
  facing: 1 | -1;
  records: Record<string, WinLoss>;
  storeNames: Record<string, string>;
}) {
  const ids = cornerStoreIds(fighter, team);
  const slots = programSlots(fighter);
  const color = PAINT[fighter.paint] ?? "#f0a202";
  return (
    <article className="min-w-0 border border-line bg-surface" data-testid={`program-corner-${fighter.id}`}>
      <div className="h-1.5" style={{ background: color }} />
      <div className="relative h-36 bg-deep md:h-48">
        <BotPortrait look={lookFromFighter(fighter)} facing={facing} zoom={0.86} className="h-full w-full" />
      </div>
      <div className="p-3 md:p-4">
        <p className="text-[11px] tracking-[0.22em] text-amber uppercase">
          {CLASS_META[fighter.classId].label}
          {fighter.number ? ` · Bay ${fighter.number}` : ""}
        </p>
        <h3 className="mt-1 font-display text-3xl leading-none [overflow-wrap:anywhere] md:text-4xl">{fighter.botName}</h3>
        <p className="mt-1 text-sm text-muted [overflow-wrap:anywhere]">{fighter.teamName || fighter.storeName}</p>
        <RecordBlock ids={ids} records={records} storeNames={storeNames} />
        {fighter.tuned ? (
          <p className="mt-2 text-xs tracking-[0.18em] text-spark uppercase">Tuned up</p>
        ) : null}
        <ol className="mt-3" data-testid={`program-slots-${fighter.id}`}>
          {slots.map((row) => (
            <li
              key={row.slot}
              data-slot={row.slot}
              className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-x-2 border-t border-line py-2"
            >
              <span className="pt-0.5 text-[10px] tracking-[0.16em] text-amber uppercase">{row.label}</span>
              <span className="min-w-0">
                <span className="font-display text-lg leading-tight [overflow-wrap:anywhere]">{row.name}</span>
                <span className="ml-2 text-[10px] tracking-[0.16em] text-muted uppercase">{row.tier}</span>
                {row.job ? <span className="mt-0.5 block text-xs leading-snug text-muted">{row.job}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </article>
  );
}

/** Boxing-program card shown before a match. Both corners, every slot, the record going in. */
export function FightProgram({
  bout,
  records,
  storeNames = {},
  kicker,
}: {
  bout: Bout;
  records: Record<string, WinLoss>;
  storeNames?: Record<string, string>;
  kicker?: string;
}) {
  const { left, right } = programSides(bout);
  const duel = left.length === 1 && right.length === 1;
  const corners = [
    ...left.map((fighter) => ({ fighter, team: bout.teamA, facing: 1 as const })),
    ...right.map((fighter) => ({ fighter, team: bout.teamB, facing: -1 as const })),
  ];
  return (
    <section className="w-full max-w-full border border-line bg-deep" data-testid="fight-program" aria-label={`Fight program, ${bout.title}`}>
      <div className="hazard h-2" />
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-4">
        <div className="min-w-0">
          <p className="font-display text-[11px] tracking-[0.28em] text-amber uppercase">Waterman Battle Bot League</p>
          <p className="mt-1 text-xs tracking-[0.22em] text-muted uppercase">Official program</p>
          <h2 className="mt-1 font-display text-4xl leading-none md:text-5xl">{bout.title}</h2>
        </div>
        {kicker ? <p className="max-w-xs text-sm text-muted">{kicker}</p> : null}
      </header>
      <div className="p-3 md:p-4">
        {corners.length === 0 ? (
          <p className="border border-line bg-surface p-4 text-sm text-muted">The program prints when both builds are on the card.</p>
        ) : duel ? (
          <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-4">
            <Corner fighter={left[0]!} team={bout.teamA} facing={1} records={records} storeNames={storeNames} />
            <p className="vs-pop py-1 text-center font-display text-5xl leading-none text-amber md:self-center md:px-1 md:text-6xl">VS</p>
            <Corner fighter={right[0]!} team={bout.teamB} facing={-1} records={records} storeNames={storeNames} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {bout.kind === "bye" ? (
              <p className="font-display text-4xl text-amber md:col-span-2 md:text-center">BYE · counts as a win</p>
            ) : null}
            {corners.map((corner) => (
              <Corner key={corner.fighter.id} {...corner} records={records} storeNames={storeNames} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
