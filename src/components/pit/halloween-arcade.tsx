import { useEffect, useRef, useState } from "react";
import { SLOT_LABEL } from "@/lib/pit/catalog";
import { usePit } from "@/lib/pit/store";
import { centralDay } from "@/lib/pit/time";
import { playHalloweenArcade, useSyncStatus } from "@/lib/pit/secure-sync";
import type {
  HalloweenArcadeInput,
  HalloweenArcadeView,
  HalloweenChallenge,
  HalloweenGame,
} from "@/lib/pit/halloween-arcade";
import { Modal } from "./modal";
import { useNow } from "./bits";
import "./halloween-arcade.css";

const GAME_COPY: Record<HalloweenGame, { title: string; instruction: string; day: string }> = {
  hats: {
    title: "The Witch’s Lucky Hat",
    instruction:
      "Watch the coin disappear under a witch’s hat. Follow that hat as the three swap places, then choose where the coin is hiding.",
    day: "Thursday · October 29",
  },
  pumpkins: {
    title: "Pumpkin Patch Memory",
    instruction:
      "Some pumpkins will glow. Remember them together, then pick those same pumpkins after the lights go out.",
    day: "Friday · October 30",
  },
  potions: {
    title: "The Midnight Potion",
    instruction:
      "Watch the potion bottles light up. Repeat their order to finish the Halloween brew.",
    day: "Saturday · October 31",
  },
};

const button =
  "min-h-12 border border-line px-4 py-2 font-display text-sm tracking-wide uppercase disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber";
const primary = `${button} border-amber bg-amber text-deep hover:brightness-110`;

/** The server grants the daily invitation; browser storage is never the daily-play limit. */
export default function HalloweenArcade({ blocked }: { blocked: boolean }) {
  const session = usePit((state) => state.session);
  const storeName = usePit(
    (state) => state.stores.find((row) => row.id === state.session.storeId)?.name ?? "Your store",
  );
  const sync = useSyncStatus();
  const clockTick = useNow();
  const identity =
    session.role === "captain" && session.storeId ? `${session.storeId}:${session.crewId}` : null;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const claimedIdentity = useRef<string | null>(null);
  const mounted = useRef(true);
  const busyRef = useRef(false);
  const requestVersion = useRef(0);
  const receivedAt = useRef<number | null>(null);
  const viewIdentity = useRef<string | null>(null);
  const [view, setView] = useState<HalloweenArcadeView | null>(null);
  const [open, setOpen] = useState(false);
  const [invitation, setInvitation] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    requestVersion.current++;
    claimedIdentity.current = null;
    busyRef.current = false;
    setBusy(false);
    setOpen(false);
    setView(null);
    receivedAt.current = null;
    viewIdentity.current = null;
    setError("");
  }, [identity]);

  const run = async (input: HalloweenArcadeInput) => {
    if (!identity || busyRef.current) return null;
    const owner = identity;
    const version = ++requestVersion.current;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await playHalloweenArcade(input);
      if (!mounted.current || identityRef.current !== owner || requestVersion.current !== version)
        return null;
      receivedAt.current = performance.now();
      viewIdentity.current = owner;
      setView(result.view);
      if (!result.view) setOpen(false);
      return result;
    } catch (caught) {
      if (mounted.current && identityRef.current === owner && requestVersion.current === version) {
        setError(
          caught instanceof Error
            ? caught.message
            : "The table could not reach the league. Please try again.",
        );
      }
      return null;
    } finally {
      if (requestVersion.current === version) {
        busyRef.current = false;
        if (mounted.current && identityRef.current === owner) setBusy(false);
      }
    }
  };

  useEffect(() => {
    if (!identity || blocked || (sync.mode !== "live" && sync.mode !== "preview")) return;
    if (claimedIdentity.current === identity || busyRef.current) return;
    claimedIdentity.current = identity;
    void run({ action: "claimPrompt" }).then((result) => {
      if (
        mounted.current &&
        result?.showPrompt &&
        result.view &&
        identityRef.current === identity
      ) {
        setInvitation(true);
        setOpen(true);
      }
    });
    // A verified identity becoming active is the trigger, not each league poll or clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, blocked, sync.mode]);

  const serverTime =
    clockTick && view && receivedAt.current != null
      ? new Date(view.serverNow + Math.max(0, performance.now() - receivedAt.current))
      : null;
  const day = serverTime ? centralDay(serverTime) : null;
  const expired = Boolean(
    day && (day.y > 2026 || (day.y === 2026 && (day.m > 10 || (day.m === 10 && day.d > 31)))),
  );
  if (!identity || expired || (view && viewIdentity.current !== identity)) return null;
  const copy = view ? GAME_COPY[view.game] : null;
  const retry = view?.status === "lost";
  const resume = view?.status === "playing";
  const canStart = Boolean(view && (view.status === "ready" || resume || (retry && view.canRetry)));
  const start = async () => {
    if (!view || !canStart) return;
    if (view.status === "playing") {
      setInvitation(false);
      return;
    }
    const result = await run({ action: "start", previousAttemptId: view.attemptId });
    if (result?.view?.status === "playing") setInvitation(false);
  };
  const submit = async (answer: number[]) => {
    if (!view?.attemptId || busy || view.status !== "playing") return;
    await run({ action: "answer", attemptId: view.attemptId, answer });
  };

  return (
    <>
      {(view && view.status !== "won") || error ? (
        <div
          className="no-print mx-4 mb-3 flex flex-wrap items-center justify-between gap-2 border border-violet-400/40 bg-violet-950/30 px-3 py-2 md:mx-6"
          data-testid="halloween-arcade-entry"
        >
          <p className="text-sm">
            <span aria-hidden>✦ </span>
            <span className="font-display text-violet-200">Halloween team challenge</span>
            <span className="ml-2 text-xs text-muted">Through Saturday · captains only</span>
          </p>
          <button
            type="button"
            className={`${button} min-h-11 border-violet-400/60 text-violet-100`}
            disabled={busy}
            onClick={async () => {
              const result = await run({ action: "status" });
              if (result?.view) {
                setInvitation(true);
                setOpen(true);
              }
            }}
          >
            {busy ? "Opening…" : resume ? "Resume game" : "Halloween game"}
          </button>
          {!open && error ? (
            <p role="alert" className="w-full text-sm text-amber">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
      {open && !blocked && view && copy ? (
        <Modal
          title={`${copy.title} — Halloween team challenge`}
          onClose={() => setOpen(false)}
          testId="halloween-arcade-modal"
        >
          <section className="halloween-arcade relative max-h-[90svh] w-full max-w-2xl overflow-y-auto border border-violet-400/50 bg-deep p-4 shadow-2xl sm:p-6">
            <header className="relative flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-xs tracking-[0.2em] text-violet-200 uppercase">
                  {storeName} · Halloween after hours
                </p>
                <h2 className="mt-2 font-display text-3xl leading-none sm:text-4xl">
                  {copy.title}
                </h2>
                <p className="mt-2 text-xs text-muted">{copy.day} · Central time</p>
              </div>
              <button
                type="button"
                className="relative min-h-11 min-w-11 shrink-0 border border-line px-2 text-sm text-muted"
                onClick={() => setOpen(false)}
                aria-label="Close Halloween game"
              >
                Close
              </button>
            </header>
            <div className="relative mt-4 flex flex-wrap gap-2 text-xs">
              <span className="border border-violet-400/40 bg-violet-950/40 px-2 py-1">
                Difficulty:{" "}
                <strong className="capitalize text-violet-100">
                  {view.difficulty ?? "Surprise"}
                </strong>
              </span>
              <span className="border border-line px-2 py-1">
                {view.boltsBalance} Bolts available
              </span>
              <span className="border border-line px-2 py-1">One winning prize today</span>
            </div>
            {error ? (
              <p
                className="relative mt-4 border border-amber/50 bg-amber/10 p-3 text-sm text-amber"
                role="alert"
              >
                {error} Your saved attempt is still here.
              </p>
            ) : null}
            {view.status === "won" ? (
              <div className="relative py-7 text-center" role="status">
                <div
                  className="arcade-prize mx-auto grid size-24 place-items-center rounded-full border-2 border-amber text-5xl text-amber"
                  aria-hidden
                >
                  ✦
                </div>
                <p className="mt-5 font-display text-4xl text-amber">A treat for the team!</p>
                <p className="mt-3 text-lg">
                  {view.reward ? (
                    <>
                      +{view.reward.amount} <strong>{SLOT_LABEL[view.reward.category]}</strong>{" "}
                      coins
                    </>
                  ) : (
                    "Today’s prize is already in your store’s wallet."
                  )}
                </p>
                <p className="mx-auto mt-3 max-w-md text-sm text-muted">
                  Saved to your store’s upgrade wallet. Your captain can spend these coins on bot
                  parts.
                </p>
                <p className="mt-2 text-sm text-violet-200">
                  {view.date === "2026-10-31"
                    ? "That’s the final Halloween game. Happy Halloween!"
                    : "A different team challenge arrives tomorrow."}
                </p>
                <button type="button" className={`${primary} mt-6`} onClick={() => setOpen(false)}>
                  Back to the Pit
                </button>
              </div>
            ) : invitation ? (
              <div className="relative mt-5">
                <div
                  className="arcade-invite-art flex items-end justify-center gap-2 overflow-hidden rounded-t-full px-5 pt-6"
                  aria-hidden
                >
                  {view.game === "hats" ? (
                    <>
                      <HatArt className="h-20 w-24 -rotate-12" />
                      <span className="mb-4 text-4xl text-amber">●</span>
                      <HatArt className="h-24 w-28 rotate-12" />
                    </>
                  ) : view.game === "pumpkins" ? (
                    <>
                      <PumpkinArt lit className="h-20 w-24 -rotate-6" />
                      <PumpkinArt lit className="h-28 w-28" />
                      <PumpkinArt lit className="h-20 w-24 rotate-6" />
                    </>
                  ) : (
                    <>
                      {POTIONS.map((p, index) => (
                        <PotionArt key={p.name} index={index} lit className="h-24 w-16" />
                      ))}
                    </>
                  )}
                </div>
                <h3 className="mt-5 font-display text-3xl text-amber">
                  Get the rest of your team so they can help!
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-fg">{copy.instruction}</p>
                <div className="mt-4 border border-line bg-surface/80 p-3 text-sm">
                  <p>
                    Win <strong className="text-amber">2–4 coins</strong> in a random bot upgrade
                    category.
                  </p>
                  <p className="mt-2 text-muted">
                    {resume
                      ? "You have an unfinished attempt. Resume the same challenge at no extra cost."
                      : retry
                        ? "The last attempt missed. Another try costs 10 Bolts from your store’s balance."
                        : "Your store’s first attempt today is free. After a loss, each retry costs 10 Bolts."}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    The day’s difficulty stays the same on retries. One prize per store per day.
                    Games close after Saturday, October 31.
                  </p>
                </div>
                {retry && !view.canRetry ? (
                  <p className="mt-3 text-sm text-amber">
                    {view.boltsBalance < 10
                      ? "You need 10 Bolts to retry. Complete Pit Week jobs or Daily Sparks to earn more."
                      : "Tonight’s table is closing. There isn’t enough time to begin another round before midnight Central."}
                  </p>
                ) : null}
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    className={primary}
                    disabled={busy || !canStart}
                    onClick={() => void start()}
                  >
                    {busy
                      ? "Opening the table…"
                      : resume
                        ? "Team’s here · resume"
                        : retry
                          ? "Team’s here · retry for 10 Bolts"
                          : "Team’s here · play free"}
                  </button>
                  <button type="button" className={button} onClick={() => setOpen(false)}>
                    Gather the team first
                  </button>
                </div>
              </div>
            ) : view.status === "lost" ? (
              <div className="relative py-7 text-center" role="status">
                <p aria-hidden className="text-6xl">
                  ☾
                </p>
                <h3 className="mt-4 font-display text-4xl text-violet-200">
                  The witches fooled us!
                </h3>
                <p className="mt-3 text-sm text-muted">
                  No coins this time. Your team can try a new challenge at the same difficulty for
                  10 Bolts.
                </p>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    className={primary}
                    disabled={busy || !view.canRetry}
                    onClick={() => setInvitation(true)}
                  >
                    Try again · 10 Bolts
                  </button>
                  <button type="button" className={button} onClick={() => setOpen(false)}>
                    Done for now
                  </button>
                </div>
                {!view.canRetry ? (
                  <p className="mt-3 text-sm text-amber">
                    {view.boltsBalance < 10
                      ? "Not enough Bolts yet. Earn more in Pit Week, then return here."
                      : "Tonight’s table is closing. There isn’t enough time for another round before midnight Central."}
                  </p>
                ) : null}
              </div>
            ) : view.status === "playing" && view.challenge && view.attemptId ? (
              <HalloweenGameBoard
                key={view.attemptId}
                view={view}
                challenge={view.challenge}
                busy={busy}
                onAnswer={submit}
              />
            ) : null}
          </section>
        </Modal>
      ) : null}
    </>
  );
}

function useElapsed(duration: number) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = performance.now();
    setElapsed(0);
    const timer = window.setInterval(() => {
      const next = performance.now() - started;
      setElapsed(Math.min(next, duration));
      if (next >= duration) window.clearInterval(timer);
    }, 60);
    return () => window.clearInterval(timer);
  }, [duration]);
  return elapsed;
}

export function HalloweenGameBoard({
  view,
  challenge,
  busy,
  onAnswer,
}: {
  view: HalloweenArcadeView;
  challenge: HalloweenChallenge;
  busy: boolean;
  onAnswer: (answer: number[]) => void;
}) {
  const presentation =
    challenge.kind === "hats"
      ? challenge.revealMs + challenge.swaps.length * challenge.stepMs + 450
      : challenge.kind === "pumpkins"
        ? challenge.revealMs + 300
        : challenge.sequence.length * (challenge.stepMs + challenge.gapMs) + 450;
  const duration = Math.max(presentation, (view.answerAfter ?? view.serverNow) - view.serverNow);
  const elapsed = useElapsed(duration);
  const ready = elapsed >= duration;
  const [selected, setSelected] = useState<number[]>([]);
  const waiting = busy
    ? "Checking your answer with the league…"
    : ready
      ? "Your team’s turn."
      : "Watch closely together…";

  if (challenge.kind === "hats") {
    const completed = Math.max(
      0,
      Math.min(
        challenge.swaps.length,
        Math.floor((elapsed - challenge.revealMs) / challenge.stepMs) + 1,
      ),
    );
    const order = [0, 1, 2];
    for (const [a, b] of challenge.swaps.slice(0, completed))
      [order[a], order[b]] = [order[b]!, order[a]!];
    const revealing = elapsed < challenge.revealMs;
    return (
      <div className="relative mt-5">
        <p className="text-sm text-violet-100" role="status" aria-live="polite">
          {revealing
            ? `The coin starts under the ${["left", "middle", "right"][challenge.coinAtStart]} hat. Follow it!`
            : waiting}
        </p>
        <div
          className="arcade-hat-table relative mt-4 h-52 overflow-hidden rounded-[50%_50%_16px_16px/20%_20%_16px_16px] border border-amber/30 sm:h-60"
          aria-label="Three witch hats on a table"
        >
          <div className="absolute inset-x-0 bottom-4 border-t border-amber/20" />
          {revealing ? (
            <span
              aria-hidden
              className="arcade-coin absolute bottom-8 z-0 grid size-8 -translate-x-1/2 place-items-center rounded-full border-2 border-yellow-200 bg-amber font-bold text-deep shadow-lg"
              style={{ left: `${((challenge.coinAtStart + 0.5) * 100) / 3}%` }}
            >
              ✦
            </span>
          ) : null}
          {[0, 1, 2].map((hat) => {
            const slot = order.indexOf(hat);
            return (
              <button
                key={hat}
                type="button"
                disabled={!ready || busy}
                onClick={() => onAnswer([slot])}
                aria-label={`Choose ${["left", "middle", "right"][slot]} witch’s hat`}
                className={`arcade-moving-hat absolute bottom-7 w-[32%] max-w-44 rounded-lg px-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber ${ready ? "cursor-pointer hover:brightness-125" : "cursor-default"}`}
                style={{
                  left: `${((slot + 0.5) * 100) / 3}%`,
                  transitionDuration: `${challenge.stepMs}ms`,
                  transform: `translateX(-50%) translateY(${revealing ? -29 : 0}px)`,
                }}
              >
                <HatArt className="w-full" />
                <span className="sr-only">{["Left", "Middle", "Right"][slot]} hat</span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          {ready
            ? "Choose the hat hiding the coin."
            : revealing
              ? "The coin goes under the hat, then the hats trade places."
              : "Keep your eyes on the hat. Your choice opens after the shuffle."}
        </p>
        <p className="mt-2 text-center text-xs text-muted">
          Keyboard: Tab to a hat, then press Enter.
        </p>
        <div
          className="arcade-reduced-guide mt-4 border border-violet-400/30 bg-deep/70 p-3 text-sm"
          aria-label="Hat shuffle directions"
        >
          <p>
            The coin starts under the{" "}
            <strong>{["left", "middle", "right"][challenge.coinAtStart]}</strong> hat. Follow it
            through the swaps below.
          </p>
          <ol
            className="mt-2 list-decimal space-y-1 pl-5"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {challenge.swaps.slice(0, completed).map(([a, b], index) => (
              <li key={index}>
                {["Left", "Middle", "Right"][a]} and {["left", "middle", "right"][b]} hats trade
                places.
              </li>
            ))}
          </ol>
          {completed === 0 ? (
            <p className="mt-2 text-muted">The shuffle is about to start.</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (challenge.kind === "pumpkins") {
    const revealing = elapsed < challenge.revealMs;
    return (
      <div className="relative mt-5">
        <p className="text-sm text-violet-100" role="status" aria-live="polite">
          {revealing ? `Remember the ${challenge.lit.length} glowing pumpkins.` : waiting}
        </p>
        <div
          className="arcade-pumpkin-patch mt-4 grid grid-cols-3 gap-2 rounded-xl border border-violet-400/25 p-2 sm:gap-3 sm:p-4"
          role="group"
          aria-label="Pumpkin memory patch"
        >
          {Array.from({ length: challenge.size }, (_, index) => {
            const picked = selected.includes(index);
            const lit = revealing && challenge.lit.includes(index);
            return (
              <button
                type="button"
                key={index}
                disabled={!ready || busy}
                aria-label={`Pumpkin ${index + 1}${revealing && lit ? ", glowing" : ""}`}
                aria-pressed={picked}
                className={`relative min-h-20 rounded-lg border-2 p-1 sm:min-h-28 ${picked ? "border-amber bg-amber/15" : "border-transparent"} focus-visible:outline-2 focus-visible:outline-amber disabled:cursor-default`}
                onClick={() =>
                  setSelected((old) =>
                    old.includes(index)
                      ? old.filter((value) => value !== index)
                      : old.length < challenge.lit.length
                        ? [...old, index]
                        : old,
                  )
                }
              >
                <PumpkinArt lit={lit} className="mx-auto w-full max-w-28" />
                <span
                  className={`absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-deep/90 px-2 text-xs ${picked ? "text-amber" : "text-muted"}`}
                >
                  {picked ? "✓ " : ""}
                  {index + 1}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-center text-sm text-muted">
          {ready
            ? `${selected.length} of ${challenge.lit.length} pumpkins selected. Tap again to change a choice.`
            : "Remember the positions. The glow will disappear."}
        </p>
        <button
          type="button"
          className={`${primary} mt-4 w-full`}
          disabled={!ready || busy || selected.length !== challenge.lit.length}
          onClick={() => onAnswer([...selected].sort((a, b) => a - b))}
        >
          {busy ? "Checking…" : "Check our pumpkins"}
        </button>
      </div>
    );
  }

  const step = Math.floor(elapsed / (challenge.stepMs + challenge.gapMs));
  const glowing =
    !ready &&
    step < challenge.sequence.length &&
    elapsed % (challenge.stepMs + challenge.gapMs) < challenge.stepMs
      ? challenge.sequence[step]
      : null;
  return (
    <div className="relative mt-5">
      <p className="text-sm text-violet-100" role="status" aria-live="polite">
        {ready ? waiting : `Watch the recipe: ${challenge.sequence.length} potion flashes.`}
      </p>
      <div
        className="arcade-potion-shelf mt-4 grid grid-cols-2 gap-3 rounded-xl border border-violet-400/25 p-3 sm:grid-cols-4"
        role="group"
        aria-label="Potion bottles"
      >
        {POTIONS.map((potion, index) => (
          <button
            type="button"
            key={potion.name}
            disabled={!ready || busy || selected.length >= challenge.sequence.length}
            onClick={() => setSelected((old) => [...old, index])}
            aria-label={`${potion.name} potion${glowing === index ? ", glowing" : ""}`}
            className={`rounded-lg border-2 p-2 transition-colors focus-visible:outline-2 focus-visible:outline-amber disabled:cursor-default ${glowing === index ? "border-amber bg-amber/15" : "border-line bg-deep/40"}`}
          >
            <PotionArt
              index={index}
              lit={glowing === index}
              className="mx-auto h-24 w-20 sm:h-32"
            />
            <span className="mt-1 block font-display text-sm" style={{ color: potion.color }}>
              {potion.name}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-sm text-muted">
        {ready
          ? "Tap the bottles in the same order. A bottle can appear more than once."
          : glowing == null
            ? "Keep watching…"
            : `${POTIONS[glowing]!.name} potion is glowing.`}
      </p>
      <ol
        className="mt-3 flex min-h-11 flex-wrap items-center justify-center gap-1.5"
        aria-label="Your potion sequence"
      >
        {Array.from({ length: challenge.sequence.length }, (_, index) => (
          <li
            key={index}
            className="grid min-h-9 min-w-9 place-items-center border border-line bg-surface px-2 text-xs"
            style={{
              color: selected[index] == null ? undefined : POTIONS[selected[index]!]!.color,
            }}
          >
            {selected[index] == null ? `${index + 1} ·` : POTIONS[selected[index]!]!.name}
          </li>
        ))}
      </ol>
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          className={primary}
          disabled={!ready || busy || selected.length !== challenge.sequence.length}
          onClick={() => onAnswer(selected)}
        >
          {busy ? "Checking…" : "Brew our potion"}
        </button>
        <button
          type="button"
          className={button}
          disabled={!ready || busy || selected.length === 0}
          onClick={() => setSelected((old) => old.slice(0, -1))}
        >
          Undo
        </button>
      </div>
    </div>
  );
}

function HatArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 150" className={className} aria-hidden="true">
      <ellipse cx="80" cy="134" rx="72" ry="12" fill="#06030c" opacity=".55" />
      <path
        d="M20 116 Q76 101 143 117 Q155 135 84 142 Q14 141 7 127Z"
        fill="#271039"
        stroke="#b482e8"
        strokeWidth="2"
      />
      <path
        d="M36 119 Q49 84 63 42 Q73 13 112 6 Q94 28 95 40 Q101 80 125 120 Q80 134 36 119Z"
        fill="#59307a"
        stroke="#b482e8"
        strokeWidth="2"
      />
      <path
        d="M63 42 Q73 13 112 6 Q88 35 82 72 Q78 103 88 128 Q63 130 36 119 Q49 84 63 42Z"
        fill="#402055"
      />
      <path d="M43 100 Q81 116 116 103 L124 120 Q79 134 36 119Z" fill="#d88429" />
      <rect
        x="70"
        y="108"
        width="25"
        height="18"
        rx="2"
        fill="#f9d578"
        stroke="#241121"
        strokeWidth="2"
      />
      <rect x="77" y="112" width="11" height="10" fill="#7a3e22" />
      <path d="m71 65 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="#d7b3ff" opacity=".8" />
    </svg>
  );
}

function PumpkinArt({ lit, className = "" }: { lit: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 120 110" className={className} aria-hidden="true">
      <ellipse cx="60" cy="101" rx="45" ry="6" fill="#05020a" opacity=".6" />
      <path
        d="M56 25 Q48 12 60 4 L71 6 Q59 13 67 26"
        fill="#4d6732"
        stroke="#85984c"
        strokeWidth="3"
      />
      <ellipse
        cx="38"
        cy="62"
        rx="27"
        ry="38"
        fill={lit ? "#f5a539" : "#8e4321"}
        stroke="#c46a26"
        strokeWidth="2"
      />
      <ellipse
        cx="82"
        cy="62"
        rx="27"
        ry="38"
        fill={lit ? "#f5a539" : "#8e4321"}
        stroke="#c46a26"
        strokeWidth="2"
      />
      <ellipse
        cx="60"
        cy="62"
        rx="28"
        ry="40"
        fill={lit ? "#f7a13b" : "#a34a25"}
        stroke="#cf7026"
        strokeWidth="2"
      />
      <g fill={lit ? "#fcf493" : "#26151a"} className={lit ? "arcade-pumpkin-glow" : undefined}>
        <path d="m31 58 15-14 8 17Z M66 61l8-17 15 14Z M53 69l7-10 7 10Z" />
        <path d="M29 74 Q60 101 92 74 L78 78 73 85 65 81 57 87 47 81 40 82Z" />
      </g>
    </svg>
  );
}

const POTIONS = [
  { name: "Moon", symbol: "☾", color: "#c4a4fb" },
  { name: "Star", symbol: "✦", color: "#ffc36c" },
  { name: "Leaf", symbol: "♧", color: "#a4df8c" },
  { name: "Heart", symbol: "♥", color: "#f597ba" },
];

function PotionArt({
  index,
  lit,
  className = "",
}: {
  index: number;
  lit: boolean;
  className?: string;
}) {
  const potion = POTIONS[index]!;
  return (
    <svg viewBox="0 0 90 130" className={className} aria-hidden="true">
      <ellipse cx="45" cy="121" rx="34" ry="6" fill="#07050c" />
      <path
        d="M32 19H58V44Q76 58 77 83V106Q76 119 45 119Q14 119 13 106V83Q14 58 32 44Z"
        fill={lit ? "#473549" : "#211e2a"}
        stroke={lit ? "#ffe4a1" : "#8a8096"}
        strokeWidth="2"
      />
      <path
        d="M18 76 Q43 69 72 76 V104 Q72 113 45 113 Q18 113 18 104Z"
        fill={potion.color}
        opacity={lit ? "1" : ".4"}
      />
      <path
        d="M24 62 Q19 75 21 100"
        stroke="#fff"
        strokeWidth="4"
        opacity={lit ? ".55" : ".15"}
        fill="none"
      />
      <rect
        x="29"
        y="8"
        width="32"
        height="18"
        rx="3"
        fill="#9b673e"
        stroke="#d3a77e"
        strokeWidth="2"
      />
      <rect x="28" y="24" width="34" height="9" rx="3" fill="#c9b2d6" />
      <text x="45" y="98" textAnchor="middle" fontSize="31" fill={lit ? "#fff6d5" : "#dfd3e8"}>
        {potion.symbol}
      </text>
      {lit ? (
        <>
          <circle cx="31" cy="65" r="3" fill={potion.color} />
          <circle cx="57" cy="57" r="4" fill={potion.color} />
          <path d="m74 29 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#ffe8a7" />
        </>
      ) : null}
    </svg>
  );
}
