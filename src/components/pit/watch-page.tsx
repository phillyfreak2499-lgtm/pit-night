import { TaleOfTape } from "./tale-of-tape";
import { Link } from "@tanstack/react-router";
import { Flame, HelpCircle, Maximize, Mic, MicOff, Minimize, Package, Pause, Play, SkipForward, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { setSoundMuted, soundMuted, subscribeSound } from "@/lib/pit/sound";
import { useFightAudio } from "./use-fight-audio";
import { createPortal } from "react-dom";
import { hasChampionshipOpening } from "@/lib/pit/championship-opening";
import { TeamJanelleOpening } from "./team-janelle-opening";
import { commercialAfter } from "@/lib/pit/commercials";
import { PROGRAM_HOLD_MS, programRecords, storeNameMap } from "@/lib/pit/fight-card";
import { recordOf } from "@/lib/pit/engine";
import { isLiveCard, replayWeeks } from "@/lib/pit/replay";
import { paintHex, usePit } from "@/lib/pit/store";
import { TUNE_UP_BONUS, crateFor } from "@/lib/pit/training";
import type { Bout, PitData } from "@/lib/pit/types";
import { streakHolders, tunedUp } from "@/lib/pit/week";
import { ResultLine } from "./bits";
import { armBroadcastAudio, Broadcast } from "./broadcast";
import { Commercial } from "./commercial";
import { FightProgram } from "./fight-program";
import { BoothSegment } from "./booth-segment";
import { buildTape, matchup, methodWord } from "./show-page";

type Stage = "lobby" | "opening" | "intro" | "fight" | "result" | "ad" | "final";

const RESULT_MS = 6500;
const BYE_MS = 6000;

/** Watch party: Monday regular-season cards plus Championship Saturday. */
export function WatchPage() {
  const data = usePit();
  const postedWeeks = useMemo(() => replayWeeks(data), [data.bouts, data.replays]);
  const [week, setWeek] = useState(() => (postedWeeks.includes(data.week) || !postedWeeks.length ? data.week : postedWeeks.at(-1)!));
  // Freeze the tape when the party starts so a sync mid-show never reshuffles it.
  const liveTape = useMemo(() => buildTape(data, week), [data, week]);
  const [tape, setTape] = useState<{ live: boolean; replay: boolean; bouts: Bout[] } | null>(null);
  const bouts = (tape ?? liveTape).bouts;
  const [stage, setStage] = useState<Stage>("lobby");
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [full, setFull] = useState(false);
  const bout = bouts[index] ?? null;
  const [commentaryEnabled, setCommentaryEnabled] = useState(true);
  const muted = useSyncExternalStore(subscribeSound, soundMuted, () => false);
  const walkout = Boolean(stage === "intro" && bout?.result && bout.kind !== "bye" && commentaryEnabled && !muted);
  const { line: commentaryLine, onNotableBeat } = useFightAudio(bout, stage === "fight" && !paused,
    index + week - 1, commentaryEnabled, muted, !tape?.live);

  const next = useCallback(() => {
    if (stage === "opening") setStage("intro");
    else if (stage === "intro") setStage(bout?.kind === "bye" ? "result" : "fight");
    else if (stage === "fight") setStage("result");
    else if (stage === "result") {
      if (index + 1 >= bouts.length) setStage("final");
      else if (commercialAfter(week, index + 1, bouts.length)) setStage("ad");
      else {
        setIndex(index + 1);
        setStage("intro");
      }
    } else if (stage === "ad") {
      if (index + 1 >= bouts.length) setStage("final");
      else {
        setIndex(index + 1);
        setStage("intro");
      }
    }
  }, [stage, bout, index, bouts.length, week]);

  useEffect(() => {
    if (paused || stage === "opening" || stage === "lobby" || stage === "final" || stage === "fight" || stage === "ad") return;
    const ms = stage === "intro" ? (bout?.kind === "bye" ? BYE_MS : walkout ? 16000 : PROGRAM_HOLD_MS) : RESULT_MS;
    const id = window.setTimeout(next, ms);
    return () => window.clearTimeout(id);
  }, [stage, index, paused, next, bout, walkout]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || (e.target instanceof Element && e.target.closest("button, a, input, textarea, select, [role=dialog]"))) return;
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
    if (soundMuted()) setSoundMuted(false);
    setCommentaryEnabled(true);
    armBroadcastAudio();
    setTape(liveTape);
    setIndex(0);
    setPaused(false);
    setStage(hasChampionshipOpening(week, liveTape.bouts.length) ? "opening" : liveTape.bouts.length ? "intro" : "final");
    if (goFull) void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  // Records as the room has seen them: earlier weeks, plus this card up to the fight on screen.
  const revealed = stage === "result" || stage === "ad" || stage === "final" ? index + 1 : index;
  const shown = new Set(bouts.slice(0, revealed).map((b) => b.id));
  if (stage === "final") for (const b of bouts) shown.add(b.id);
  const seen: PitData = { ...data, bouts: [...data.bouts.filter((b) => b.week < week && b.result), ...bouts.filter((b) => shown.has(b.id))] };
  const replaying = (tape ?? liveTape).replay;
  const weekName = data.weeks.find((w) => w.number === week)?.name ?? `Week ${week}`;
  const spot = stage === "ad" ? commercialAfter(week, index + 1, bouts.length) : null;

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
          <p className="font-display text-2xl leading-none md:text-3xl">
            <span className="block truncate md:inline">
              Week {week} · {weekName}
              {replaying ? <span className="ml-2 text-base tracking-[0.18em] text-amber uppercase">Replay</span> : null}
            </span>
            {stage === "opening" ? <span className="ml-3 text-base text-amber">Team Janelle · Before the bell</span> : stage === "ad" ? (
              <span className="mt-1 block text-sm tracking-[0.18em] text-muted uppercase md:mt-0 md:ml-3 md:inline md:text-base md:tracking-normal md:normal-case">
                Commercial
              </span>
            ) : stage !== "lobby" && stage !== "final" && bouts.length ? (
              <span className="mt-1 block text-sm text-muted md:mt-0 md:ml-3 md:inline md:text-base">
                Fight {index + 1} of {bouts.length}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" aria-pressed={commentaryEnabled} aria-label={commentaryEnabled ? "Turn AI commentary off" : "Turn AI commentary on"}
            title="Reactive AI color commentary" onClick={() => setCommentaryEnabled((on) => !on)}
            className={`inline-flex min-h-11 items-center gap-1.5 border px-2 font-display text-xs uppercase ${commentaryEnabled ? "border-amber text-amber" : "border-line text-muted"}`}>
            {commentaryEnabled ? <Mic size={17} /> : <MicOff size={17} />}
            <span className="hidden sm:inline">AI color {commentaryEnabled ? "on" : "off"}</span>
          </button>
          <IconBtn label="How to play" onClick={() => { setPaused(true); data.showTutorial(); }}>
            <HelpCircle size={18} />
          </IconBtn>
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

      <div className="relative grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] xl:grid-cols-[1fr_22rem]">
        {spot ? (
          <div className="absolute inset-0 z-10">
            <Commercial key={`${spot.slug}-${index}`} ad={spot} paused={paused} onEnded={next} />
          </div>
        ) : null}
        <main className="relative flex min-h-0 flex-col overflow-y-auto p-3 md:p-5">
          {stage === "lobby" ? (
            <Lobby data={data} week={week} weeks={postedWeeks} setWeek={setWeek} tape={liveTape} onStart={start} />
          ) : null}
          {stage === "opening" ? <TeamJanelleOpening data={data} playing={!paused} onComplete={next} /> : null}
          {stage === "intro" && bout ? <Intro key={bout.id} data={data} bout={bout} seen={seen} order={index + 1} total={bouts.length} /> : null}
          {walkout && bout && !paused && <BoothSegment key={bout.id} scene="walkout" id={bout.id} label="Bot introductions" automatic />}
          {stage === "result" && bout ? (
            <Result key={bout.id} data={data} bout={bout} seen={seen} next={bouts[index + 1] ?? null} commercialNext={Boolean(commercialAfter(week, index + 1, bouts.length))} />
          ) : null}
          {stage === "final" ? <Final data={data} seen={seen} bouts={bouts} replay={replaying} onAgain={() => setStage("lobby")} /> : null}
          {paused && stage !== "lobby" && stage !== "final" && stage !== "ad" ? (
            <p className="pointer-events-none absolute inset-x-0 top-4 text-center font-display text-sm tracking-[0.3em] text-amber uppercase">Paused · space to resume</p>
          ) : null}
        </main>
        <aside className="hidden min-h-0 overflow-y-auto border-l border-line bg-surface xl:block">
          <Scoreboard data={seen} highlight={stage !== "opening" && stage !== "lobby" && stage !== "final" && stage !== "ad" && bout ? bout.storeIds : []} />
        </aside>
      </div>

      <Ticker data={data} week={week} />
      {stage === "fight" && bout ? (
        <div className="absolute inset-0 z-30 flex flex-col bg-deep" data-testid="watch-fight">
          <Broadcast
            key={bout.id}
            bout={bout}
            playing={!paused}
            speed={1.5}
            chromeless
            stage
            kicker={replaying ? "Replay" : (tape ?? liveTape).live ? "Live card" : "House tape"}
            onComplete={next}
            onNotableBeat={onNotableBeat}
          />
          {commentaryEnabled && commentaryLine ? <p className="absolute bottom-32 left-2 z-40 max-w-lg border-l-2 border-amber bg-deep/90 px-3 py-2 text-base" aria-live="polite" data-testid="reactive-commentary"><span className="mr-2 font-display text-xs tracking-widest text-amber uppercase">AI color</span>{commentaryLine}</p> : null}
          <div className="absolute bottom-[4.75rem] left-2 z-40 flex gap-1 sm:bottom-20">
            <IconBtn label={muted ? "Unmute fight audio" : "Mute fight audio"} onClick={() => setSoundMuted(!muted)}>
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </IconBtn>
            <IconBtn label={commentaryEnabled ? "Turn AI commentary off" : "Turn AI commentary on"} onClick={() => setCommentaryEnabled((on) => !on)}>
              {commentaryEnabled ? <Mic size={18} /> : <MicOff size={18} />}
            </IconBtn>
            <IconBtn label={paused ? "Play" : "Pause"} onClick={() => setPaused((p) => !p)}>
              {paused ? <Play size={18} /> : <Pause size={18} />}
            </IconBtn>
            <IconBtn label="Skip ahead" onClick={next}>
              <SkipForward size={18} />
            </IconBtn>
            <IconBtn label={full ? "Leave full screen" : "Full screen"} onClick={toggleFull}>
              {full ? <Minimize size={18} /> : <Maximize size={18} />}
            </IconBtn>
            <Link to="/broadcast" aria-label="Leave the watch party" className="inline-flex min-h-11 min-w-11 items-center justify-center border border-line bg-deep/80">
              <X size={18} />
            </Link>
          </div>
          {paused ? (
            <p className="pointer-events-none absolute inset-x-0 top-3 z-40 text-center font-display text-sm tracking-[0.3em] text-amber uppercase">Paused · space to resume</p>
          ) : null}
        </div>
      ) : null}
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
  tape: { live: boolean; replay: boolean; bouts: Bout[] };
  onStart: (full: boolean) => void;
}) {
  const final = tape.bouts.find((bout) => bout.kind === "final");
  const choices = [...new Set([...weeks, data.week])].sort((a, b) => a - b);
  const tuned = data.stores.filter((s) => tunedUp(data, s.id, week));
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-6 py-6">
      <div>
        <p className="font-display text-sm tracking-[0.3em] text-amber uppercase">{tape.replay ? "Replay · read only" : tape.live ? "The card is posted" : "House tape · card not posted yet"}</p>
        <h1 className="mt-2 font-display text-6xl leading-[0.85] md:text-8xl">
          {week === 5 ? "Championship" : "Monday"}
          <span className="block text-amber">{week === 5 ? "Saturday" : "watch party"}</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          {tape.replay
            ? week === 5
              ? "Replay of Championship Saturday. Same tape as the night it posted. Watching it does not change coins, damage, records, or the week."
              : "Replay of that Monday's card. Same walk-out, tape, and call. A house commercial runs between every fight. Watching it does not change coins, damage, records, or the week."
            : week === 5
              ? "First, the nonfinalists meet in a last-bot-standing Royal Rumble for third place. Then the two conference champions fight for the title, with no round cap: it ends only when one bot is thrown into the pit. Rally support makes the room louder, never the bot stronger."
              : "Put this on the big screen. Every fight plays back to back with a walk-out, the tape, and the call. A house commercial runs between every fight. The live table updates after every fight."}
        </p>
      </div>
      {hasChampionshipOpening(week, tape.bouts.length) ? <p className="border-l-2 border-amber px-3 py-2 text-amber">Before the bell: a 30-second Team Janelle celebration with every store bot.</p> : null}
      {weeks.length > 0 ? (
        <div className="flex flex-wrap gap-2" data-testid="replay-archive" role="group" aria-label="Replay archive">
          {choices.map((w) => (
            <button
              key={w}
              type="button"
              data-testid={`replay-week-${w}`}
              aria-pressed={w === week}
              onClick={() => setWeek(w)}
              className={`min-h-11 border px-4 font-display uppercase ${w === week ? "border-amber text-amber" : "border-line text-muted"}`}
            >
              {weeks.includes(w) && !isLiveCard(data, w) ? `Week ${w} replay` : `Week ${w}`}
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
      {week === 5 && final ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {final.storeIds.map((id) => {
            const store = data.stores.find((row) => row.id === id);
            const supporters = (data.rallies ?? []).filter((row) => row.week === 5 && row.targetId === id);
            const stores = new Set(supporters.map((row) => row.storeId));
            return (
              <div key={id} className="border border-line bg-surface p-3">
                <span className="font-display text-xl">{store?.name}</span>
                <span className="ml-2 text-sm text-muted">Rally: {supporters.length} people · {stores.size} stores</span>
              </div>
            );
          })}
        </div>
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
      <p className="text-sm text-muted">Start with Jim, Cathy and full arena sound. During a fight, the mic switches commentary and the speaker mutes all audio. Space pauses and the right arrow skips ahead.</p>
    </div>
  );
}

function Intro({ data, bout, seen, order, total }: { data: PitData; bout: Bout; seen: PitData; order: number; total: number }) {
  return (
    <div className="watch-in mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center py-2">
      <FightProgram
        bout={bout}
        records={programRecords(seen, bout)}
        storeNames={storeNameMap(data)}
        kicker={order === total ? `Main event · fight ${order} of ${total}` : `Fight ${order} of ${total}`}
      />
    </div>
  );
}

function Result({ data, bout, seen, next, commercialNext }: { data: PitData; bout: Bout; seen: PitData; next: Bout | null; commercialNext: boolean }) {
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
      <TaleOfTape bout={bout} compact />
      <p className="mt-4 text-sm tracking-widest text-muted uppercase">
        {next ? `${commercialNext ? "Commercial break · then " : "Up next · "}${matchup(data, next)}` : "That was the last fight"}
      </p>
    </div>
  );
}

function Final({ data, seen, bouts, replay, onAgain }: { data: PitData; seen: PitData; bouts: Bout[]; replay: boolean; onAgain: () => void }) {
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
        <Link to={replay ? "/broadcast" : data.week === 5 ? "/honors" : "/week"} className="inline-flex min-h-11 items-center bg-amber px-4 font-display text-deep uppercase">
          {replay ? "Fight Day →" : data.week === 5 ? "Season honors →" : "Pit Week starts tomorrow →"}
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
    week === 5 ? "Championship Saturday · Royal Rumble for third · no round cap in the final · title decided in the pit" : "Pit Week opens Tuesday · Jobs, Sparks, and a Wednesday Mystery Crate",
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
