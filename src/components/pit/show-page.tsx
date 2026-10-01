import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { previewSaturday, cardKey } from "@/lib/pit/engine";
import { usePit } from "@/lib/pit/store";
import type { Bout, PitData } from "@/lib/pit/types";
import { ResultLine, SectionLabel } from "./bits";
import { armBroadcastAudio, Broadcast } from "./broadcast";

type Segment =
  | { id: string; kind: "open" }
  | { id: string; kind: "fight"; bout: Bout }
  | { id: string; kind: "sting"; bout: Bout }
  | { id: string; kind: "close" };

export function ShowPage() {
  const data = usePit();
  const [weekPick, setWeekPick] = useState(data.week);
  const key = tapeSignature(data, weekPick);
  const tape = useMemo(() => buildTape(data, weekPick), [key]);
  const segments = useMemo(() => buildSegments(tape.bouts), [tape]);
  const [index, setIndex] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [seek, setSeek] = useState(0);
  const [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    setIndex(0);
    setRolling(false);
  }

  const segment = segments[index] ?? segments[0]!;
  const fightCount = tape.bouts.length;
  const fightOrdinal = segment.kind === "fight" || segment.kind === "sting" ? tape.bouts.indexOf(segment.bout) + 1 : 0;

  useEffect(() => {
    const current = segments[index];
    if (!rolling || current?.kind !== "sting") return;
    const id = window.setTimeout(() => {
      setIndex((i) => Math.min(segments.length - 1, i + 1));
    }, 4800);
    return () => window.clearTimeout(id);
  }, [rolling, index, segments]);

  useEffect(() => {
    if (segments[index]?.kind === "close") setRolling(false);
  }, [index, segments]);

  const onFightDone = useCallback(() => {
    setIndex((i) => {
      if (segments[i]?.kind !== "fight") return i;
      return Math.min(segments.length - 1, i + 1);
    });
  }, [segments]);

  const postedWeeks = useMemo(() => {
    const weeks = new Set<number>();
    for (const bout of data.bouts) if (bout.result) weeks.add(bout.week);
    return [...weeks].sort((a, b) => a - b);
  }, [data.bouts]);
  const showWeeks = postedWeeks.length > 1 || (postedWeeks.length > 0 && !postedWeeks.includes(data.week));

  const start = () => {
    armBroadcastAudio();
    if (segment.kind === "open" || segment.kind === "close") {
      const first = segments.findIndex((item) => item.kind === "fight");
      setIndex(first >= 0 ? first : 0);
      setRolling(first >= 0);
      return;
    }
    setRolling((on) => !on);
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4" data-testid="saturday-broadcast">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel>Monday broadcast</SectionLabel>
          <h1 className="font-display text-5xl leading-none">{weekName(data, weekPick)}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            {tape.live
              ? "Posted card. This is the tape the stores get."
              : tape.bouts.length
                ? "House tape. The gazette does not have this yet. A lock can still change it. The desk posts the card."
                : "That fight day was never posted."}
          </p>
        </div>
        <Link to="/card" className="inline-flex min-h-11 items-center text-sm text-amber">
          Printed card
        </Link>
      </div>

      {showWeeks ? (
        <div className="flex gap-2 overflow-x-auto">
          {!postedWeeks.includes(data.week) ? (
            <WeekChip active={weekPick === data.week} label="This week" onClick={() => setWeekPick(data.week)} />
          ) : null}
          {postedWeeks.map((week) => (
            <WeekChip key={week} active={weekPick === week} label={`Week ${week}`} onClick={() => setWeekPick(week)} />
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="play-saturday"
          className="min-h-11 bg-amber px-4 font-display tracking-wide text-deep uppercase"
          onClick={start}
          disabled={!fightCount && segment.kind !== "close"}
        >
          {segment.kind === "open" ? "Play broadcast" : rolling ? "Pause" : segment.kind === "close" ? "Play again" : "Play"}
        </button>
        <button type="button" className="min-h-11 border border-line px-3 font-display text-muted" onClick={() => setIndex((i) => Math.max(0, i - 1))}>
          Back
        </button>
        <button
          type="button"
          className="min-h-11 border border-line px-3 font-display text-muted"
          onClick={() => {
            armBroadcastAudio();
            setRolling(true);
            setIndex((i) => Math.min(segments.length - 1, i + 1));
          }}
        >
          Next
        </button>
        {segment.kind === "fight" ? (
          <button
            type="button"
            className="min-h-11 border border-line px-3 font-display text-muted"
            onClick={() => {
              armBroadcastAudio();
              setRolling(true);
              setSeek((n) => n + 1);
            }}
          >
            Decision
          </button>
        ) : null}
        {[1, 2, 4].map((n) => (
          <button
            key={n}
            type="button"
            className={`min-h-11 border px-3 font-display ${speed === n ? "border-amber text-amber" : "border-line text-muted"}`}
            onClick={() => setSpeed(n)}
          >
            {n}×
          </button>
        ))}
        {fightOrdinal > 0 ? (
          <p className="flex min-h-11 items-center px-1 text-sm text-muted">
            Tape {fightOrdinal} of {fightCount}
          </p>
        ) : null}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {segments.map((item, i) =>
          item.kind === "sting" ? null : (
            <button
              key={item.id}
              type="button"
              className={`min-h-11 shrink-0 border px-3 font-display text-sm tracking-wide uppercase ${i === index || (item.kind === "fight" && segment.kind === "sting" && segment.bout.id === item.bout.id) ? "border-amber text-amber" : "border-line text-muted"}`}
              onClick={() => {
                setIndex(i);
                if (item.kind === "fight") setRolling(true);
              }}
            >
              {railLabel(data, item)}
            </button>
          ),
        )}
      </div>

      {segment.kind === "open" ? <ColdOpen data={data} bouts={tape.bouts} live={tape.live} /> : null}
      {segment.kind === "fight" ? (
        <Broadcast
          key={segment.bout.id}
          bout={segment.bout}
          playing={rolling}
          speed={speed}
          seek={seek}
          chromeless
          kicker={tape.live ? "On air" : "House tape"}
          onComplete={onFightDone}
        />
      ) : null}
      {segment.kind === "sting" ? <Sting bout={segment.bout} next={nextFight(segments, index)} data={data} /> : null}
      {segment.kind === "close" ? <SignOff bouts={tape.bouts} live={tape.live} /> : null}
    </div>
  );
}

function WeekChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`min-h-11 shrink-0 border px-3 font-display text-sm uppercase ${active ? "border-amber text-amber" : "border-line text-muted"}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ColdOpen({ data, bouts, live }: { data: PitData; bouts: Bout[]; live: boolean }) {
  return (
    <section className="border border-line bg-deep">
      <div className="hazard h-2" />
      <div className="px-4 py-6 md:px-8 md:py-8">
        <p className="font-display text-sm tracking-[0.28em] text-amber uppercase">{live ? "Posted" : "Not posted"}</p>
        <h2 className="mt-2 font-display text-5xl leading-[0.85] md:text-6xl">
          THE WATERMAN
          <span className="block">BATTLE BOT</span>
          <span className="block">LEAGUE</span>
        </h2>
        <p className="mt-3 max-w-xl text-muted">
          {bouts.length
            ? bouts.some((b) => b.kind === "bye")
              ? `${bouts.length} tapes. A bye counts as a win. The main event is last.`
              : `${bouts.length} tapes. No bye. The main event is last.`
            : "No tape on this week."}
        </p>
        <ol className="mt-6 flex flex-col gap-2">
          {bouts.map((bout) => (
            <li key={bout.id} className="grid grid-cols-[auto_1fr] gap-3 border border-line bg-surface px-3 py-3">
              <span className="font-display text-2xl leading-none text-muted">{bout.slot}</span>
              <span>
                <span className="block text-xs tracking-widest text-amber uppercase">{bout.title}</span>
                <span className="font-display text-xl leading-tight">{matchup(data, bout)}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Sting({ bout, next, data }: { bout: Bout; next: Bout | null; data: PitData }) {
  return (
    <section className="flex min-h-80 flex-col items-center justify-center border border-line bg-deep px-6 py-10 text-center">
      <p className="font-display text-sm tracking-[0.28em] text-amber uppercase">{bout.title}</p>
      <p className="mt-3 font-display text-6xl leading-none md:text-7xl">{methodWord(bout)}</p>
      <p className="mt-4 max-w-lg text-lg">
        <ResultLine bout={bout} />
      </p>
      {next ? <p className="mt-6 text-sm text-muted">Next · {matchup(data, next)}</p> : <p className="mt-6 text-sm text-muted">Last tape.</p>}
    </section>
  );
}

function SignOff({ bouts, live }: { bouts: Bout[]; live: boolean }) {
  return (
    <section className="border border-line bg-deep">
      <div className="hazard h-2" />
      <div className="px-4 py-6 md:px-8">
        <p className="font-display text-sm tracking-[0.28em] text-amber uppercase">Sign-off</p>
        <h2 className="mt-2 font-display text-5xl leading-none">Lights up.</h2>
        <p className="mt-3 max-w-xl text-muted">
          {live ? "The card is on the wall. Damage waits on the desk." : "Nothing on the wall moved. Post it from the desk if this is the card you want."}
        </p>
        <ul className="mt-6 flex flex-col gap-2">
          {bouts.map((bout) => (
            <li key={bout.id} className="border-l-2 border-amber pl-3">
              <p className="text-xs tracking-widest text-muted uppercase">{bout.title}</p>
              <p>
                <ResultLine bout={bout} />
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-4">
          <Link to="/gazette" className="inline-flex min-h-11 items-center text-amber">
            Gazette
          </Link>
          <Link to="/desk" className="inline-flex min-h-11 items-center text-amber">
            Desk
          </Link>
          <Link to="/card" className="inline-flex min-h-11 items-center text-muted">
            Printed card
          </Link>
        </div>
      </div>
    </section>
  );
}

function buildTape(data: PitData, week: number): { live: boolean; bouts: Bout[] } {
  const posted = data.bouts.filter((b) => b.week === week && b.result).sort((a, b) => a.slot - b.slot);
  if (posted.length) return { live: true, bouts: posted };
  if (week !== data.week) return { live: false, bouts: [] };
  return { live: false, bouts: previewSaturday(data) };
}

function buildSegments(bouts: Bout[]): Segment[] {
  const segments: Segment[] = [{ id: "open", kind: "open" }];
  for (const bout of bouts) {
    segments.push({ id: `f-${bout.id}`, kind: "fight", bout });
    segments.push({ id: `s-${bout.id}`, kind: "sting", bout });
  }
  segments.push({ id: "close", kind: "close" });
  return segments;
}

function tapeSignature(data: PitData, week: number) {
  const posted = data.bouts.filter((b) => b.week === week && b.result);
  if (posted.length) return `p:${week}:${posted.map((b) => b.result?.seed ?? b.id).join(",")}`;
  if (week !== data.week) return `empty:${week}`;
  const tags = data.weeks.find((w) => w.number === week)?.tagsEnabled ?? false;
  const locks = data.bots
    .map((bot) => {
      const loadout = bot.locked ?? bot.draft;
      const card = data.storeCards.find((item) => item.storeId === bot.storeId && item.week === week);
      return [
        bot.storeId,
        bot.classId,
        loadout.chassis,
        loadout.drive,
        loadout.weapon,
        loadout.armor,
        loadout.utility ?? "",
        loadout.brain,
        cardKey(card),
      ].join(":");
    })
    .join("|");
  const prior = data.bouts
    .filter((b) => b.result && b.week !== week)
    .map((b) => `${b.id}:${b.result?.winnerIds.join("+")}`)
    .join(",");
  return `h:${week}:${tags}:${locks}:${prior}`;
}

function weekName(data: PitData, week: number) {
  return data.weeks.find((w) => w.number === week)?.name ?? `Week ${week}`;
}

function storeBot(data: PitData, id: string) {
  const store = data.stores.find((s) => s.id === id);
  const bot = data.bots.find((b) => b.storeId === id);
  if (!store) return id;
  return bot ? `${store.name} ${bot.name}` : store.name;
}

function matchup(data: PitData, bout: Bout) {
  if (bout.kind === "bye") return `${storeBot(data, bout.teamA[0] ?? "")} · bye, counts as a win`;
  if (bout.kind === "melee") return `${bout.teamA.length} stores battle the tie`;
  const left = bout.teamA.map((id) => storeBot(data, id)).join(" + ");
  const right = bout.teamB.map((id) => storeBot(data, id)).join(" + ");
  return right ? `${left} vs ${right}` : left;
}

function railLabel(data: PitData, segment: Segment) {
  if (segment.kind === "open") return "Open";
  if (segment.kind === "close") return "Sign-off";
  if (segment.kind === "sting") return "Call";
  if (segment.bout.kind === "bye") return "Bye";
  if (segment.bout.kind === "melee") return "Melee";
  if (segment.bout.kind === "tag") return "Tag";
  if (segment.bout.kind === "final") return "Title";
  const a = data.stores.find((s) => s.id === segment.bout.teamA[0])?.name ?? "A";
  const b = data.stores.find((s) => s.id === segment.bout.teamB[0])?.name ?? "B";
  return `${a}–${b}`;
}

function nextFight(segments: Segment[], index: number) {
  for (let i = index + 1; i < segments.length; i++) {
    const item = segments[i];
    if (item?.kind === "fight") return item.bout;
  }
  return null;
}

function methodWord(bout: Bout) {
  const method = bout.result?.method;
  if (bout.kind === "bye" || method === "bye") return "BYE";
  if (method === "scrimmage") return "SCRIMMAGE";
  if (method === "ko") return "KO";
  if (method === "dump") return "DUMP";
  if (method === "melee") return "LAST BOT";
  return "DECISION";
}
