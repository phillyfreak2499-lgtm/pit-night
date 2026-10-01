import { Link } from "@tanstack/react-router";
import { Flame, Maximize, Minimize, Package, Pause, Play, SkipForward, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CLASS_META } from "@/lib/pit/catalog";
import { botFor, recordOf } from "@/lib/pit/engine";
import { paintHex, usePit } from "@/lib/pit/store";
import { TUNE_UP_BONUS, crateFor } from "@/lib/pit/training";
import type { Bout, PitData } from "@/lib/pit/types";
import { streakHolders, tunedUp } from "@/lib/pit/week";
import { ResultLine } from "./bits";
import { BotPortrait, useBotLook } from "./bot-portrait";
import { armBroadcastAudio, Broadcast } from "./broadcast";
import { buildTape, matchup, methodWord } from "./show-page";

type Stage = "lobby" | "intro" | "fight" | "result" | "final";

const INTRO_MS = 7000;
const RESULT_MS = 6500;
const BYE_MS = 6000;

/** Monday watch party: the whole card on one screen, back to back, with a live table. */
export function WatchPage() {
  const data = usePit();
  const postedWeeks = useMemo(() => [...new Set(data.bouts.filter((b) => b.result).map((b) => b.week))].sort((a, b) => a - b), [data.bouts]);
  const [week, setWeek] = useState(() => (postedWeeks.includes(data.week) || !postedWeeks.length ? data.week : postedWeeks.at(-1)!));
  // Freeze the tape when the party starts so a sync mid-show never reshuffles it.
  const liveTape = useMemo(() => buildTape(data, week), [data, week]);
  const [tape, setTape] = useState<{ live: boolean; bouts: Bout[] } | null>(null);
  const bouts = (tape ?? liveTape).bouts;
  const [stage, setStage] = useState<Stage>("lobby");
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [full, setFull] = useState(false);
  const bout = bouts[index] ?? null;

  const next = useCallback(() => {
    if (stage === "intro") setStage(bout?.kind === "bye" ? "result" : "fight");
    else if (stage === "fight") setStage("result");
    else if (stage === "result") {
      if (index + 1 >= bouts.length) setStage("final");
      else {
        setIndex(index + 1);
        setStage("intro");
      }
    }
  }, [stage, bout, index, bouts.length]);

  useEffect(() => {
    if (paused || stage === "lobby" || stage === "final" || stage === "fight") return;
    const ms = stage === "intro" ? (bout?.kind === "bye" ? BYE_MS : INTRO_MS) : RESULT_MS;
    const id = window.setTimeout(next, ms);
    return () => window.clearTimeout(id);
  }, [stage, index, paused, next, bout]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (stage === "lobby") return;
      if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === "ArrowRight") next();
    };
    const onFull = () => setFull(Boolean(document.fullscreenElement));
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFull);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFull);
    };
  }, [stage, next]);

  const start = (goFull: boolean) => {
    armBroadcastAudio();
    setTape(liveTape);
    setIndex(0);
    setPaused(false);
    setStage(liveTape.bouts.length ? "intro" : "final");
    if (goFull) void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  // Records as the room has seen them: earlier weeks, plus this card up to the fight on screen.
  const shown = new Set(bouts.slice(0, stage === "result" || stage === "final" ? index + 1 : index).map((b) => b.id));
  if (stage === "final") for (const b of bouts) shown.add(b.id);
  const seen: PitData = { ...data, bouts: [...data.bouts.filter((b) => b.week !== week), ...bouts.filter((b) => shown.has(b.id))] };
  const weekName = data.weeks.find((w) => w.number === week)?.name ?? `Week ${week}`;

  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  if (!host) return null;
  // Portal to <body>: the page wrapper animates, which would trap a fixed layer inside it.
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-deep text-fg" data-testid="watch-party">
      <div className="hazard h-2 shrink-0" />
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-2 md:px-6">
        <div className="min-w-0">
          <p className="truncate font-display text-xs tracking-[0.3em] text-amber uppercase">Waterman Battle Bot League · Watch party</p>
          <p className="truncate font-display text-2xl leading-none md:text-3xl">
            Week {week} · {weekName}
            {stage !== "lobby" && stage !== "final" && bouts.length ? (
              <span className="ml-3 text-base text-muted">
                Fight {index + 1} of {bouts.length}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {stage !== "lobby" && stage !== "final" ? (
            <>
              <IconBtn label={paused ? "Play" : "Pause"} onClick={() => setPaused((p) => !p)}>
                {paused ? <Play size={18} /> : <Pause size={18} />}
              </IconBtn>
              <IconBtn label="Skip ahead" onClick={next}>
                <SkipForward size={18} />
              </IconBtn>
            </>
          ) : null}
          <IconBtn label={full ? "Leave full screen" : "Full screen"} onClick={toggleFull}>
            {full ? <Minimize size={18} /> : <Maximize size={18} />}
          </IconBtn>
          <Link to="/broadcast" aria-label="Leave the watch party" className="inline-flex min-h-11 min-w-11 items-center justify-center border border-line">
            <X size={18} />
          </Link>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] xl:grid-cols-[1fr_22rem]">
        <main className="relative flex min-h-0 flex-col overflow-y-auto p-3 md:p-5">
          {stage === "lobby" ? (
            <Lobby data={data} week={week} weeks={postedWeeks} setWeek={setWeek} tape={liveTape} onStart={start} />
          ) : null}
          {stage === "intro" && bout ? <Intro key={bout.id} data={data} bout={bout} seen={seen} order={index + 1} total={bouts.length} /> : null}
          {stage === "fight" && bout ? (
            <div className="mx-auto w-full max-w-6xl">
              <Broadcast key={bout.id} bout={bout} playing={!paused} speed={2} chromeless kicker={(tape ?? liveTape).live ? "Live card" : "House tape"} onComplete={next} />
            </div>
          ) : null}
          {stage === "result" && bout ? <Result key={bout.id} data={data} bout={bout} seen={seen} next={bouts[index + 1] ?? null} /> : null}
          {stage === "final" ? <Final data={data} seen={seen} bouts={bouts} onAgain={() => setStage("lobby")} /> : null}
          {paused && stage !== "lobby" && stage !== "final" ? (
            <p className="pointer-events-none absolute inset-x-0 top-4 text-center font-display text-sm tracking-[0.3em] text-amber uppercase">Paused · space to resume</p>
          ) : null}
        </main>
        <aside className="hidden min-h-0 overflow-y-auto border-l border-line bg-surface xl:block">
          <Scoreboard data={seen} highlight={stage !== "lobby" && stage !== "final" && bout ? bout.storeIds : []} />
        </aside>
      </div>

      <Ticker data={data} week={week} />
    </div>,
    host,
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="inline-flex min-h-11 min-w-11 items-center justify-center border border-line hover:border-amber">
      {children}
    </button>
  );
}

function Lobby({
  data,
  week,
  weeks,
  setWeek,
  tape,
  onStart,
}: {
  data: PitData;
  week: number;
  weeks: number[];
  setWeek: (w: number) => void;
  tape: { live: boolean; bouts: Bout[] };
  onStart: (full: boolean) => void;
}) {
  const choices = [...new Set([...weeks, data.week])].sort((a, b) => a - b);
  const tuned = data.stores.filter((s) => tunedUp(data, s.id, week));
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-6 py-6">
      <div>
        <p className="font-display text-sm tracking-[0.3em] text-amber uppercase">{tape.live ? "The card is posted" : "House tape · card not posted yet"}</p>
        <h1 className="mt-2 font-display text-6xl leading-[0.85] md:text-8xl">
          Monday
          <span className="block text-amber">watch party</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          Put this on the big screen. Every fight plays back to back with a walk-out, the tape, and the call. The live table updates after every fight.
        </p>
      </div>
      {choices.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {choices.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWeek(w)}
              className={`min-h-11 border px-4 font-display uppercase ${w === week ? "border-amber text-amber" : "border-line text-muted"}`}
            >
              Week {w}
            </button>
          ))}
        </div>
      ) : null}
      <ol className="grid gap-2 md:grid-cols-2">
        {tape.bouts.map((b) => (
          <li key={b.id} className="border border-line bg-surface px-3 py-2">
            <span className="block text-[11px] tracking-widest text-amber uppercase">{b.title}</span>
            <span className="font-display text-lg leading-tight">{matchup(data, b)}</span>
          </li>
        ))}
      </ol>
      {tuned.length ? (
        <p className="inline-flex flex-wrap items-center gap-2 text-spark">
          <Flame size={18} aria-hidden /> Tuned up for this card (+{TUNE_UP_BONUS}): {tuned.map((s) => s.name).join(", ")}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          data-testid="watch-start"
          disabled={!tape.bouts.length}
          onClick={() => onStart(true)}
          className="min-h-14 bg-amber px-6 font-display text-xl tracking-wide text-deep uppercase disabled:opacity-40"
        >
          Start · full screen
        </button>
        <button type="button" disabled={!tape.bouts.length} onClick={() => onStart(false)} className="min-h-14 border border-line px-6 font-display text-xl tracking-wide uppercase disabled:opacity-40">
          Start in this window
        </button>
      </div>
      <p className="text-sm text-muted">Space pauses. The right arrow skips ahead. Turn the sound up.</p>
    </div>
  );
}

function Corner({ storeId, facing, seen, tuned, center = false }: { storeId: string; facing: 1 | -1; seen: PitData; tuned: boolean; center?: boolean }) {
  const data = usePit();
  const look = useBotLook(storeId);
  const store = data.stores.find((s) => s.id === storeId);
  if (!store) return null;
  const bot = botFor(data, storeId);
  const rec = recordOf(seen, storeId);
  const color = paintHex(store.paint);
  return (
    <div className={`flex w-full min-w-0 flex-1 flex-col ${center ? "items-center text-center" : facing === 1 ? "items-start text-left" : "items-end text-right"}`}>
      <div className="relative h-44 w-full md:h-64">
        <BotPortrait look={look} facing={facing} zoom={1} className="h-full w-full" />
      </div>
      <span className="mt-2 h-1.5 w-24" style={{ background: color }} />
      <p className="mt-2 text-xs tracking-[0.25em] text-muted uppercase">
        {CLASS_META[bot.classId].label} · Bay {bot.number}
      </p>
      <p className="font-display text-4xl leading-none md:text-6xl">{bot.name}</p>
      <p className="font-display text-xl text-muted md:text-2xl">{store.name}</p>
      <p className="mt-1 font-display text-2xl tabular-nums">
        {rec.w}–{rec.l}
      </p>
      {tuned ? (
        <span className="tuned-glow mt-2 inline-flex items-center gap-1 border border-spark px-2 py-1 font-display text-sm tracking-widest text-spark uppercase">
          <Flame size={14} aria-hidden /> Tuned +{TUNE_UP_BONUS}
        </span>
      ) : null}
    </div>
  );
}

function Intro({ data, bout, seen, order, total }: { data: PitData; bout: Bout; seen: PitData; order: number; total: number }) {
  const tunedId = (id: string) => Boolean(bout.result?.fighters.find((f) => f.id === id)?.tuned) || tunedUp(data, id, bout.week);
  const left = bout.teamA[0];
  const right = bout.teamB[0];
  return (
    <div className="watch-in mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-4 py-4">
      <p className="text-center font-display text-sm tracking-[0.35em] text-amber uppercase">
        {order === total ? "Main event" : `Fight ${order} of ${total}`} · {bout.title}
      </p>
      {bout.kind === "bye" && left ? (
        <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
          <Corner storeId={left} facing={1} seen={seen} tuned={tunedId(left)} center />
          <p className="mt-6 font-display text-5xl text-amber">BYE</p>
          <p className="text-lg text-muted">No opponent this week. A bye counts as a win.</p>
        </div>
      ) : bout.kind === "melee" ? (
        <p className="text-center font-display text-5xl">{matchup(data, bout)}</p>
      ) : (
        <div className="flex items-center gap-2 md:gap-6">
          {left ? <Corner storeId={left} facing={1} seen={seen} tuned={tunedId(left)} /> : null}
          <p className="vs-pop shrink-0 font-display text-5xl text-amber md:text-8xl">VS</p>
          {right ? <Corner storeId={right} facing={-1} seen={seen} tuned={tunedId(right)} /> : null}
        </div>
      )}
    </div>
  );
}

function Result({ data, bout, seen, next }: { data: PitData; bout: Bout; seen: PitData; next: Bout | null }) {
  const winner = bout.result?.winnerIds[0];
  const store = data.stores.find((s) => s.id === winner);
  const bot = winner ? data.bots.find((b) => b.storeId === winner) : undefined;
  const rec = winner ? recordOf(seen, winner) : null;
  return (
    <div className="watch-in mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-3 py-6 text-center">
      <p className="font-display text-sm tracking-[0.35em] text-amber uppercase">{bout.title}</p>
      <p className="vs-pop font-display text-8xl leading-none md:text-[10rem]">{methodWord(bout)}</p>
      {store ? (
        <p className="font-display text-4xl leading-none md:text-6xl" style={{ color: paintHex(store.paint) }}>
          {bot?.name ?? store.name}
          <span className="block text-2xl text-fg md:text-3xl">
            {store.name} {rec ? `· ${rec.w}–${rec.l}` : ""}
          </span>
        </p>
      ) : null}
      <p className="max-w-2xl text-lg text-muted">
        <ResultLine bout={bout} />
      </p>
      <p className="mt-4 text-sm tracking-widest text-muted uppercase">{next ? `Up next · ${matchup(data, next)}` : "That was the last fight"}</p>
    </div>
  );
}

function Final({ data, seen, bouts, onAgain }: { data: PitData; seen: PitData; bouts: Bout[]; onAgain: () => void }) {
  const flames = streakHolders(data).slice(0, 6);
  return (
    <div className="watch-in mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-5 py-6">
      <p className="font-display text-sm tracking-[0.35em] text-amber uppercase">Lights up</p>
      <h2 className="font-display text-6xl leading-none md:text-7xl">That is the card.</h2>
      <ul className="grid gap-2 md:grid-cols-2">
        {bouts.map((b) => (
          <li key={b.id} className="border-l-2 border-amber pl-3">
            <p className="text-[11px] tracking-widest text-muted uppercase">{b.title}</p>
            <p>
              <ResultLine bout={b} />
            </p>
          </li>
        ))}
      </ul>
      <div className="xl:hidden">
        <Scoreboard data={seen} highlight={[]} compact />
      </div>
      {flames.length ? (
        <p className="inline-flex flex-wrap items-center gap-2 text-spark">
          <Flame size={18} aria-hidden /> Spark streaks: {flames.map((f) => `${f.crew.name} (${f.best})`).join(", ")}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onAgain} className="min-h-11 border border-line px-4 font-display uppercase">
          Back to the lobby
        </button>
        <Link to="/week" className="inline-flex min-h-11 items-center bg-amber px-4 font-display text-deep uppercase">
          Pit Week starts tomorrow →
        </Link>
      </div>
    </div>
  );
}

function Scoreboard({ data, highlight, compact = false }: { data: PitData; highlight: string[]; compact?: boolean }) {
  const rows = data.stores
    .map((s) => ({ store: s, rec: recordOf(data, s.id) }))
    .sort((a, b) => b.rec.w - a.rec.w || a.rec.l - b.rec.l || a.store.seed - b.store.seed);
  return (
    <div className={compact ? "" : "p-4"}>
      <p className="font-display text-xs tracking-[0.3em] text-amber uppercase">Live table</p>
      <ol className="mt-2 flex flex-col gap-1">
        {rows.map((r, i) => {
          const hot = highlight.includes(r.store.id);
          return (
            <li
              key={r.store.id}
              className={`flex items-center gap-2 border px-2 py-1.5 transition-colors ${hot ? "border-amber bg-amber/10" : "border-line bg-deep"}`}
              style={{ order: i }}
            >
              <span className="w-5 font-display text-muted">{i + 1}</span>
              <span className="h-3 w-3 shrink-0" style={{ background: paintHex(r.store.paint) }} aria-hidden />
              <span className="min-w-0 flex-1 truncate font-display">{r.store.name}</span>
              <span className="font-display tabular-nums">
                {r.rec.w}–{r.rec.l}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Ticker({ data, week }: { data: PitData; week: number }) {
  const shouts = data.shouts.filter((s) => s.week === week).slice(-8);
  const tuned = data.stores.filter((s) => tunedUp(data, s.id, week)).map((s) => s.name);
  const flames = streakHolders(data).slice(0, 5);
  const crate = crateFor(week);
  const crateDone = data.jobLog.filter((e) => e.jobId === crate.id && e.status === "approved").length;
  const items = [
    ...shouts.map((s) => `Shout-out · ${s.to}: ${s.text} — ${s.fromName}`),
    tuned.length ? `Full Tune-Up · ${tuned.join(", ")}` : "",
    ...flames.map((f) => `Spark streak · ${f.crew.name} ${f.best} perfect in a row`),
    crateDone ? `Mystery Crate · ${crate.title} opened ${crateDone} time${crateDone === 1 ? "" : "s"}` : "",
    "Pit Week opens Tuesday · Jobs, Sparks, and a Wednesday Mystery Crate",
  ].filter(Boolean);
  const line = (
    <p className="flex shrink-0 items-center gap-10 px-6 text-sm">
      {items.map((t, i) => (
        <span key={i} className="inline-flex items-center gap-2 text-muted">
          {t.startsWith("Mystery") ? <Package size={14} className="text-spark" aria-hidden /> : <span className="h-1.5 w-1.5 bg-amber" aria-hidden />}
          {t}
        </span>
      ))}
    </p>
  );
  return (
    <div className="shrink-0 overflow-hidden border-t border-line bg-surface">
      <div className="ticker flex w-max py-2 whitespace-nowrap">
        {line}
        {line}
      </div>
    </div>
  );
}
