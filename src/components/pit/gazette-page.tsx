import { Link } from "@tanstack/react-router";
import { usePit } from "@/lib/pit/store";
import { SectionLabel } from "./bits";

export function GazettePage() {
  const gazette = usePit((s) => s.gazette);
  return (
    <div className="mx-auto max-w-3xl">
      <SectionLabel>The sheet</SectionLabel>
      <h1 className="font-display text-5xl leading-none">Gazette</h1>
      <p className="mt-3 text-muted">Store versus store. No personal records in the column inches.</p>
      <div className="mt-6 flex flex-col gap-4">
        {gazette.map((entry) => (
          <article key={entry.id} className="border border-line bg-surface p-4">
            <p className="text-xs tracking-widest text-amber uppercase">
              Week {entry.week} · {entry.kicker}
            </p>
            <h2 className="mt-1 font-display text-3xl leading-tight">{entry.headline}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{entry.body}</p>
            {entry.boutId ? (
              <Link to="/bout/$boutId" params={{ boutId: entry.boutId }} className="mt-3 inline-block text-sm text-amber">
                Watch the tape
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
