import { useMemo, useState } from "react";
import { HOUSE_CARDS, houseTape, methodLabel } from "@/lib/pit/engine";
import { armSound } from "@/lib/pit/sound";
import { Broadcast } from "./broadcast";
import { SectionLabel } from "./bits";

export function PreviewPage() {
  const [cardId, setCardId] = useState<(typeof HOUSE_CARDS)[number]["id"] | null>(null);
  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const card = HOUSE_CARDS.find((row) => row.id === cardId) ?? null;
  const bout = useMemo(() => (cardId ? houseTape(cardId) : null), [cardId]);
  const winner = bout?.result?.fighters.find((fighter) => bout.result?.winnerIds.includes(fighter.id));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4" data-testid="house-preview">
      <div>
        <SectionLabel>House preview</SectionLabel>
        <h1 className="font-display text-5xl leading-none">Watch the cage first</h1>
        <p className="mt-3 max-w-2xl text-muted">
          These are not your stores. Three house bots on a blue week, with the right weapon, then one tank that bolted on a disc. Nothing posts. No damage, no scrap, no record.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {HOUSE_CARDS.map((row) => (
          <button
            key={row.id}
            type="button"
            data-testid={`preview-${row.id}`}
            className={`min-h-11 border px-3 font-display text-sm tracking-wide uppercase ${cardId === row.id ? "border-amber text-amber" : "border-line"}`}
            onClick={() => {
              armSound();
              setCardId(row.id);
              setRun((n) => n + 1);
              setPlaying(true);
              setDone(false);
            }}
          >
            {row.title}
          </button>
        ))}
      </div>
      {card ? <p className="max-w-2xl text-sm text-muted">{card.line}</p> : <p className="text-sm text-muted">Pick a fight. The tape has a bell, hits, and a decision. Mute sits in the header.</p>}
      {done && bout?.result && winner ? (
        <p className="font-display text-2xl leading-none" data-testid="preview-winner">
          {winner.botName} <span className="text-base text-muted">by {methodLabel(bout.result.method)}</span>
        </p>
      ) : null}
      {bout ? (
        <Broadcast
          key={`${cardId}-${run}`}
          bout={bout}
          playing={playing}
          onPlayingChange={setPlaying}
          onComplete={() => setDone(true)}
          kicker="HOUSE PREVIEW · NO DAMAGE"
          noDamage
        />
      ) : null}
    </div>
  );
}
