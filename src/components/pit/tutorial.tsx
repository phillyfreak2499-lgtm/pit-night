import { useState } from "react";
import { SectionLabel } from "./bits";

const STEPS = [
  {
    kicker: "Period 12",
    title: "Eleven stores. Four Saturdays.",
    body: "October 25 through November 21. Waco, Arlington, Rockwall, Southlake, College Station, Fort Worth — Hulen, Allen, Plano, Temple, Alliance, and Waxahachie. One store is one bot. Specialists are pit crew. They do not get a personal bot.",
  },
  {
    kicker: "Your door",
    title: "Open a bay. The code is four digits.",
    body: "Pit Map, then your door. The desk gives each bay its own number. It is not the store name. The commissioner PIN stays on the desk.",
  },
  {
    kicker: "The bay",
    title: "Dress the bot. Name the crew. Then lock Friday.",
    body: "Paint, garage floor, stripes, and the bay number are decoration. They do not change the fight. Edit staff names. Bolt a Scry on utility, then call the weapon you think they are running. The spy does not talk until that call is in. Friday lock is the loadout.",
  },
  {
    kicker: "Saturday",
    title: "Hit Play. Five fights and a bye.",
    body: "Saturday is the whole card. Eleven stores means one bye, and the bye counts as a win. The main event is last. Week 1 that is Plano against Waxahachie. After four Saturdays the best record takes the trophy. If that record is tied, those stores fight for it.",
  },
  {
    kicker: "The trophy",
    title: "Hardware stays in the winning store.",
    body: "After four Saturdays the best record hangs the trophy in one building. If two or more stores finish with the same wins and losses, they battle for it. A plate goes to the runner-up. Weekly MVP is a name on the titantron. It is not a personal bracket and it is not hardware.",
  },
];

export function Tutorial({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const card = STEPS[step]!;
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-deep/80 p-3 sm:items-center" data-testid="tutorial">
      <div className="w-full max-w-lg border border-line bg-surface p-4 shadow-none md:p-6" role="dialog" aria-labelledby="tutorial-title">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>
            Step {step + 1} of {STEPS.length}
          </SectionLabel>
          <button type="button" className="min-h-11 px-2 text-sm text-muted" onClick={onClose}>
            Skip
          </button>
        </div>
        <p className="mt-3 text-xs tracking-widest text-amber uppercase">{card.kicker}</p>
        <h2 id="tutorial-title" className="mt-1 font-display text-3xl leading-tight">
          {card.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">{card.body}</p>
        <div className="mt-4 flex gap-1" aria-hidden>
          {STEPS.map((item, i) => (
            <span key={item.kicker} className={`h-1 flex-1 ${i <= step ? "bg-amber" : "bg-line"}`} />
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="min-h-11 flex-1 border border-line font-display text-sm tracking-wide uppercase disabled:opacity-40"
            disabled={step === 0}
            onClick={() => setStep((n) => Math.max(0, n - 1))}
          >
            Back
          </button>
          {last ? (
            <button
              type="button"
              data-testid="tutorial-done"
              className="min-h-11 flex-1 bg-amber font-display text-sm tracking-wide text-deep uppercase"
              onClick={onClose}
            >
              Got it
            </button>
          ) : (
            <button
              type="button"
              data-testid="tutorial-next"
              className="min-h-11 flex-1 bg-amber font-display text-sm tracking-wide text-deep uppercase"
              onClick={() => setStep((n) => Math.min(STEPS.length - 1, n + 1))}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
