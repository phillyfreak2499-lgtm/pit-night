import { useEffect, useRef } from "react";
import { featuredBouts, matchupName } from "@/lib/pit/booth";
import type { Bout } from "@/lib/pit/types";
import { BoothSegment } from "./booth-segment";
import { FanPicks } from "./fan-picks";

export function Pregame({ week, title, bouts, playing, mic, onComplete }: {
  week: number; title: string; bouts: Bout[]; playing: boolean; mic: boolean; onComplete: () => void;
}) {
  const next = useRef(onComplete);
  next.current = onComplete;
  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => next.current(), mic ? 45000 : 6500);
    return () => clearTimeout(id);
  }, [playing, mic]);
  return <section data-testid="pregame-show" className="cage-floor mx-auto my-auto w-full max-w-5xl border border-line bg-deep">
    <div className="hazard h-2" />
    <div className="p-5 md:p-10">
      <p className="font-display tracking-widest text-amber uppercase">Week {week} · Pregame with Jim and Cathy</p>
      <h2 className="my-3 font-display text-5xl leading-none md:text-7xl">Waterman Battle Bot League</h2>
      <p className="mb-5 font-display text-2xl text-muted">{title}</p>
      <div className="grid gap-3 md:grid-cols-2">{featuredBouts(bouts).map(b =>
        <article key={b.id} className="border border-line bg-surface"><p className="p-3 font-display text-xl">{matchupName(b)}</p><FanPicks bout={b}/></article>)}</div>
      {playing && mic && <BoothSegment scene="pregame" id={String(week)} label="Pregame" automatic onComplete={onComplete}/>}
      <button type="button" onClick={onComplete} className="mt-3 min-h-11 border border-line px-4 font-display text-amber">Skip pregame</button>
    </div>
  </section>;
}
