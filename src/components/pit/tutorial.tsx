import { Modal } from "./modal";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { SectionLabel } from "./bits";

const STEPS = [
  {
    kicker: "Period 12",
    title: "Fourteen stores. Two conferences. Four fight Mondays.",
    body: "Regular season runs October 25 through November 23. Every store fights all four Mondays: seven fights per card, no byes. Metro and Frontier each send one conference champion to Championship Saturday, November 28.",
  },
  {
    kicker: "Sign in",
    title: "Tap Clipboard. Pick your store. Enter the bay code.",
    body: "Your captain or the desk gives you the four-digit bay code. Choose I'm pit crew and tap your name, or I'm the captain. Pit crew can suggest parts, draft unlocked cosmetic looks, vote for crew designs and do Pit Week. The captain accepts the final look. The captain locks the bot and approves jobs.",
  },
  {
    kicker: "Pit Week",
    title: "Tuesday to Saturday, two jobs and a Spark.",
    body: "Every day has one culture job, one skill job, and a three-question Daily Spark. Write one line of proof and your captain approves it. Jobs, right answers, and good Monday picks earn Bolts. Wednesday hides a Mystery Crate worth 5 extra. Five perfect Sparks in a row puts a flame on your name.",
  },
  {
    kicker: "Full Tune-Up",
    title: "Everyone finishes, the bot gets +4.",
    body: "If every specialist finishes all ten jobs and all five Sparks, and the captain finishes CARE, by Saturday close, your bot gets +4 Power, Speed, Armor, and Heat for Monday. One person short and nobody gets it, so pull each other along. Championship Prep has eight jobs and four Sparks (Tuesday–Friday), plus captain CARE, for finalists only. Other stores Rally. Captains plan vacation before Tuesday.",
  },
  {
    kicker: "The numbers",
    title: "Six numbers. Six parts. Colors pay coins.",
    body: "NSNU builds the chassis, Conv % the armor, Demo Rate the drive, Demo Close % the weapon, Arch Supports the utility, and Demo Ticket Avg the brain. Each week green pays 3 coins into that part's jar, blue 2, orange 1, red 0. Week 1 coins come from your Period 11 colors.",
  },
  {
    kicker: "The garage",
    title: "Spend coins. Build smart. Lock by Saturday close.",
    body: "Sport parts cost 3 coins, Pro 5, Super 8, from that part's own jar. Repairs come from the same jar. Paint and decals are just for looks. Bolt a Scry on the utility slot to scout your opponent. Whatever is on the bot at Saturday close is what fights Monday.",
  },
  {
    kicker: "Monday morning",
    title: "Three rounds, live. Then the damage report.",
    body: "Sunday the Desk enters every store's six colors. Monday the whole card plays: seven fights and no byes. Regular-season fights are three rounds, with a slow-motion replay on a knockout. Put the Watch Party on the big screen for the huddle.",
  },
  {
    kicker: "The trophy",
    title: "Win your conference. Then survive Championship Saturday.",
    body: "After four Mondays, Metro and Frontier each crown one champion using record, head-to-head when applicable, conference record, cumulative NSNU, green grades, then Bolts earned. A still-unresolved berth tie goes to the cage. In Week 5 only the two finalists can prepare their bots; everybody else can Rally behind either side. Saturday has no judges: the Waterman Championship continues until knockout.",
  },
];

export function Tutorial({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const card = STEPS[step]!;
  const last = step === STEPS.length - 1;

  return (
    <Modal title="How Pit Night works" testId="tutorial" onClose={onClose}>
      <div className="w-full max-w-lg border border-line bg-surface p-4 shadow-none md:p-6">
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
        {last ? (
          <Link to="/faq" onClick={onClose} className="mt-3 inline-flex min-h-11 items-center text-sm text-amber">
            Read the FAQ →
          </Link>
        ) : null}
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
    </Modal>
  );
}
