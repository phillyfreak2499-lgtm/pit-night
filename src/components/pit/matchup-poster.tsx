import { Link } from "@tanstack/react-router";
import { CLASS_META } from "@/lib/pit/catalog";
import { botFor, conferenceRecordOf, fightStreak, regularSeasonRecordOf } from "@/lib/pit/engine";
import { paintHex, usePit } from "@/lib/pit/store";
import type { Bout } from "@/lib/pit/types";
import { BoutWatch, ResultLine } from "./bits";
import { BotPortrait, useBotLook } from "./bot-portrait";
import { ClaudeCopy } from "./claude-copy";

/** One fighter's half of the poster. Builds stay under the tarp until the bell, as everywhere else. */
function Corner({ storeId, facing, won }: { storeId: string; facing: 1 | -1; won: boolean | null }) {
  const data = usePit();
  const look = useBotLook(storeId);
  const store = data.stores.find((s) => s.id === storeId);
  if (!store) return null;
  const bot = botFor(data, storeId);
  const rec = regularSeasonRecordOf(data, storeId);
  const conf = conferenceRecordOf(data, storeId);
  const streak = fightStreak(data, storeId);
  const color = paintHex(store.paint);
  const right = facing === -1;
  return (
    <div className={`flex min-w-0 flex-col ${right ? "items-end text-right" : "items-start"} ${won === false ? "opacity-60" : ""}`}>
      <div className="relative h-36 w-full overflow-hidden border-b-4" style={{ borderColor: color }}>
        <span className="absolute inset-0" style={{ background: `radial-gradient(ellipse at ${right ? "70%" : "30%"} 80%, color-mix(in oklab, ${color} 35%, transparent), transparent 70%)` }} />
        <BotPortrait look={look} facing={facing} zoom={0.95} className="absolute inset-0 h-full w-full" />
        {won ? <span className="absolute top-2 left-1/2 -translate-x-1/2 bg-amber px-2 font-display text-sm tracking-widest text-deep uppercase">Winner</span> : null}
      </div>
      <p className="mt-2 text-xs tracking-widest uppercase" style={{ color }}>
        {CLASS_META[bot.classId].label} · {store.conference === "metro" ? "Metro" : "Frontier"}
      </p>
      <p className="max-w-full font-display text-xl leading-tight break-words md:text-2xl">{store.name}</p>
      <p className="max-w-full truncate text-sm text-muted">{bot.name}{store.teamName ? ` · ${store.teamName}` : ""}</p>
      <p className={`mt-1 flex gap-3 font-display text-lg ${right ? "flex-row-reverse" : ""}`}>
        <span>{rec.w}–{rec.l}</span>
        <span className="text-muted">Conf {conf.w}–{conf.l}</span>
        {streak && streak.n >= 2 ? <span className={streak.kind === "W" ? "text-spark" : "text-muted"}>{streak.kind === "W" ? "🔥" : "❄"} {streak.kind}{streak.n}</span> : null}
      </p>
    </div>
  );
}

/** A fight-card poster: the two bots facing off, their records, then the hype or the result. */
export function MatchupPoster({ bout }: { bout: Bout }) {
  const a = bout.teamA[0];
  const b = bout.teamB[0];
  if (!a || !b || bout.teamA.length !== 1 || bout.teamB.length !== 1) return null;
  const result = bout.result;
  const won = (id: string) => (result ? result.winnerIds.includes(id) : null);
  return (
    <article className="poster relative overflow-hidden border border-line bg-surface" data-testid={`poster-${bout.id}`}>
      <div className="hazard h-1.5" />
      <p className="px-4 pt-3 text-center text-xs tracking-[0.3em] text-amber uppercase">
        {bout.slot}. {bout.title}
      </p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 px-3 pb-3 md:gap-4 md:px-5">
        <Corner storeId={a} facing={1} won={won(a)} />
        <span className="vs-badge mb-16 font-display text-4xl text-spark md:text-5xl" aria-label="versus">
          VS
        </span>
        <Corner storeId={b} facing={-1} won={won(b)} />
      </div>
      <div className="border-t border-line px-4 py-3">
        {result ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-lg">
              <ResultLine bout={bout} />
            </p>
            <BoutWatch bout={bout} />
          </div>
        ) : (
          <>
            <ClaudeCopy kind="hype" id={bout.id} label="Fight-card preview" />
            <p className="mt-2 text-xs text-muted">
              Builds stay under the tarp until the bell.{" "}
              <Link to="/rules" className="text-amber">
                How fights work
              </Link>
            </p>
          </>
        )}
      </div>
    </article>
  );
}
