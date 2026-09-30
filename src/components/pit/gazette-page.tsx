import { Link } from "@tanstack/react-router";
import { usePit } from "@/lib/pit/store";
import { SectionLabel } from "./bits";

export function GazettePage() {
  const gazette = usePit((s) => s.gazette);
  const week = usePit((s) => s.week);
  const [lead, ...rest] = gazette;
  return (
    <div className="mx-auto max-w-4xl">
      <SectionLabel>The sheet</SectionLabel>
      <h1 className="font-display text-5xl leading-none">Gazette</h1>
      <p className="mt-3 text-muted">
        Store versus store. No personal records in the column inches.
      </p>

      <div className="newsprint mt-6 px-4 py-5 md:px-8 md:py-7">
        <div className="flex items-center justify-between text-[10px] tracking-[0.2em] text-(--ink-soft) uppercase md:text-xs">
          <span>Period 12 · Week {week}</span>
          <span className="hidden sm:inline">Oct 25 – Nov 21, 2026</span>
          <span>Price: one bolt</span>
        </div>
        <div className="rule-double mt-2" />
        <p className="py-2 text-center font-display text-5xl leading-none tracking-tight md:text-7xl">
          THE PIT GAZETTE
        </p>
        <p className="text-center text-[10px] tracking-[0.3em] text-(--ink-soft) uppercase md:text-xs">
          All the steel that&apos;s fit to print · The Waterman Group
        </p>
        <div className="rule-double mt-2" />

        {lead ? (
          <article className="mt-5 border-b border-(--ink) pb-5">
            <p className="text-xs font-semibold tracking-[0.2em] text-[#9a3b12] uppercase">
              Week {lead.week} · {lead.kicker}
            </p>
            <h2 className="mt-1 font-display text-4xl leading-[0.95] md:text-6xl">
              {lead.headline}
            </h2>
            <p
              className={`dropcap mt-4 text-[15px] leading-relaxed ${lead.body.length > 320 ? "md:columns-2 md:gap-8" : "max-w-2xl"}`}
            >
              {lead.body}
            </p>
            {lead.boutId ? (
              <Link
                to="/bout/$boutId"
                params={{ boutId: lead.boutId }}
                className="mt-3 inline-block font-display text-sm tracking-wide text-[#9a3b12] uppercase underline-offset-4 hover:underline"
              >
                Watch the tape →
              </Link>
            ) : null}
          </article>
        ) : (
          <p className="mt-6 text-center font-display text-3xl">
            Presses are warm. No stories yet.
          </p>
        )}

        {rest.length > 0 ? (
          <div className="mt-5 grid gap-x-8 gap-y-6 md:grid-cols-2">
            {rest.map((entry) => (
              <article key={entry.id} className="border-t-2 border-(--ink) pt-3">
                <p className="text-[11px] font-semibold tracking-[0.2em] text-[#9a3b12] uppercase">
                  Week {entry.week} · {entry.kicker}
                </p>
                <h3 className="mt-1 font-display text-2xl leading-tight">{entry.headline}</h3>
                <p className="mt-2 text-sm leading-relaxed text-(--ink-soft)">{entry.body}</p>
                {entry.boutId ? (
                  <Link
                    to="/bout/$boutId"
                    params={{ boutId: entry.boutId }}
                    className="mt-2 inline-block font-display text-xs tracking-wide text-[#9a3b12] uppercase underline-offset-4 hover:underline"
                  >
                    Watch the tape →
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 border-t border-(--ink) pt-3 text-[11px] tracking-widest text-(--ink-soft) uppercase sm:grid-cols-3">
          <p>Classifieds: one wedge, lightly used. Ask for the captain.</p>
          <p className="sm:text-center">Weather: 100% chance of sparks Saturday.</p>
          <p className="sm:text-right">Corrections: none. The desk does not miss.</p>
        </div>
      </div>
    </div>
  );
}
