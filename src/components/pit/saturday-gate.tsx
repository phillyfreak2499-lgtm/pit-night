import { useState } from "react";
import { usePit } from "@/lib/pit/store";
import { openSaturdayTape, peekSaturday, publishSaturday, type SaturdayPeek } from "@/lib/pit/saturday-server";
import { SATURDAY_BELL_LABEL, saturdayFightKind, saturdayLockControls } from "@/lib/pit/saturday-seal";
import { takeLeagueSeason } from "@/lib/pit/sync";
import type { Bout, SaturdayFightName } from "@/lib/pit/types";
import { Broadcast } from "./broadcast";
import { Btn, SectionLabel, TextInput } from "./bits";

function fightCopy(fight: SaturdayFightName) {
  if (fight === "rumble") {
    return {
      title: "Third Place Royal Rumble",
      detail: "Twelve non-finalists. Last bot standing takes third. The finish stays off the site until this fight is played.",
      start: "Start the Royal Rumble",
      reveal: "Post the Rumble result",
    };
  }
  return {
    title: "Waterman Championship",
    detail: "Metro champion versus Frontier champion. The champion stays off the site until this fight is played.",
    start: "Start the Championship",
    reveal: "Post the Championship result",
  };
}

/**
 * Locked Championship Saturday playback.
 * Non-desk viewers get a PIN prompt and no tape. The Desk PIN is the existing
 * commissioner sign-in. Starting a fight fetches that one tape for this screen
 * only; the rest of the site updates when the fight ends or the Desk posts it.
 */
export function SaturdayGate({ held }: { held: Bout[] }) {
  const data = usePit();
  const signCommissioner = usePit((s) => s.signCommissioner);
  const fights = held.filter((bout) => saturdayFightKind(bout));
  const desk = data.session.role === "commissioner";
  const ready = Boolean(data.saturdayWatch) || data.phase === "fought" || data.phase === "inspected" || data.phase === "complete";
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tape, setTape] = useState<Bout | null>(null);
  const [playing, setPlaying] = useState(true);
  const [seek, setSeek] = useState(0);
  const [peek, setPeek] = useState<SaturdayPeek | null>(null);
  const [armed, setArmed] = useState<SaturdayFightName | null>(null);

  if (!fights.length) return null;
  const controls = saturdayLockControls(data.session.role);

  const start = async (fight: SaturdayFightName) => {
    setError("");
    setBusy(true);
    try {
      const res = await openSaturdayTape({ data: { fight } });
      setPeek(null);
      setSeek(0);
      setPlaying(true);
      setTape(res.bout);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The Desk could not start that fight.");
    } finally {
      setBusy(false);
    }
  };

  const post = async (fight: SaturdayFightName) => {
    setError("");
    setBusy(true);
    try {
      await publishSaturday({ data: { fight } });
      await takeLeagueSeason();
      setTape(null);
      setArmed(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The result stayed sealed.");
    } finally {
      setBusy(false);
    }
  };

  const look = async () => {
    setError("");
    setBusy(true);
    try {
      setPeek(await peekSaturday({ data: {} }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The Desk could not open that.");
    } finally {
      setBusy(false);
    }
  };

  if (tape?.result && desk) {
    const kind = saturdayFightKind(tape) ?? "rumble";
    return (
      <section className="border border-amber bg-deep" data-testid="saturday-desk-player">
        <div className="hazard h-2" />
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p className="font-display text-sm tracking-[0.18em] text-amber uppercase">Desk live watch · {fightCopy(kind).title}</p>
          <div className="flex flex-wrap gap-2">
            <Btn tone="line" onClick={() => setPlaying((on) => !on)}>{playing ? "Pause" : "Play"}</Btn>
            <Btn tone="line" onClick={() => { setPlaying(true); setSeek((n) => n + 1); }}>Skip to the decision</Btn>
          </div>
        </div>
        <Broadcast bout={tape} playing={playing} speed={2} seek={seek} chromeless kicker="Live from the Desk" onComplete={() => void post(kind)} />
        <p className="px-4 py-3 text-sm text-muted">The result posts for every store when this fight ends. Leaving early keeps it sealed.</p>
        {error ? <p className="px-4 pb-3 text-sm text-bad">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="border border-amber/70 bg-surface" data-testid="saturday-lock">
      <div className="hazard h-2" />
      <div className="flex flex-col gap-4 p-4 md:p-5">
        <div>
          <SectionLabel>Championship Saturday · sealed</SectionLabel>
          <h2 className="mt-1 font-display text-4xl leading-none">No spoilers until the live watch</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            The Royal Rumble and the Waterman Championship stay dark until the Desk starts them {SATURDAY_BELL_LABEL}. Winners, damage, and the tape are not on this site before then.
          </p>
        </div>
        <ul className="grid gap-3 md:grid-cols-2">
          {fights.map((bout) => {
            const kind = saturdayFightKind(bout)!;
            const copy = fightCopy(kind);
            const started = kind === "rumble" ? data.saturdayWatch?.rumbleStartedAt : data.saturdayWatch?.championshipStartedAt;
            const waitForRumble = kind === "championship" && !data.saturdayWatch?.rumbleRevealedAt;
            return (
              <li key={bout.id} className="border border-line bg-deep p-3" data-testid={`saturday-held-${kind}`}>
                <p className="text-xs tracking-widest text-amber uppercase">{copy.title}</p>
                <p className="mt-2 text-sm text-muted">{copy.detail}</p>
                {started ? <p className="mt-2 text-sm text-amber">The Desk has this fight on the big screen. The result posts when it ends.</p> : null}
                {waitForRumble ? <p className="mt-2 text-sm text-muted">The Royal Rumble posts first. This title stays sealed until that fight ends.</p> : null}
                {controls.showStart && ready && !waitForRumble ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn testId={`saturday-start-${kind}`} disabled={busy} onClick={() => void start(kind)}>{copy.start}</Btn>
                    {armed === kind ? (
                      <Btn testId={`saturday-reveal-${kind}`} tone="line" disabled={busy} onClick={() => void post(kind)}>Post it now</Btn>
                    ) : (
                      <Btn tone="line" disabled={busy} onClick={() => setArmed(kind)}>{copy.reveal}</Btn>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {!ready ? (
          <p className="text-sm text-muted">The Desk has not run this card yet. Running it early still keeps the result sealed.</p>
        ) : null}
        {controls.showPin ? (
          <form
            className="max-w-sm"
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              void signCommissioner(pin).then((ok) => {
                if (!ok) setError("That Desk PIN does not open the live watch.");
                setPin("");
              });
            }}
          >
            <label className="text-xs tracking-widest text-muted uppercase" htmlFor="saturday-pin">Desk PIN</label>
            <TextInput
              id="saturday-pin"
              data-testid="saturday-pin"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              inputMode="numeric"
              type="password"
              autoComplete="off"
              placeholder="Desk PIN"
              aria-label="Desk PIN"
              className="mt-2"
            />
            <Btn type="submit" testId="saturday-unlock" className="mt-3">Unlock with the Desk PIN</Btn>
          </form>
        ) : null}
        {controls.showPeek && ready ? (
          <div>
            {peek ? (
              <div className="border border-amber bg-deep p-3" data-testid="saturday-peek">
                <p className="font-display text-sm tracking-widest text-amber uppercase">Desk eyes only · not on the site</p>
                <p className="mt-2 text-sm">Rumble third place: {peek.rumble?.winner ?? "Not run yet"}</p>
                <p className="text-sm">Champion: {peek.championship?.winner ?? "Not run yet"}</p>
                <p className="text-sm">Runner-up: {peek.championship?.runnerUp ?? "Not run yet"}</p>
                <button type="button" className="mt-2 min-h-11 text-sm text-amber" onClick={() => setPeek(null)}>Hide this</button>
              </div>
            ) : (
              <Btn tone="line" testId="saturday-peek-open" disabled={busy} onClick={() => void look()}>Show the Desk the sealed result</Btn>
            )}
          </div>
        ) : null}
        {error ? <p className="text-sm text-bad" data-testid="saturday-error">{error}</p> : null}
      </div>
    </section>
  );
}
