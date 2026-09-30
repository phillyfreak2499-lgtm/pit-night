import { Link } from "@tanstack/react-router";
import { usePit } from "@/lib/pit/store";
import { ResultLine, SectionLabel, StatStrip } from "./bits";
import { Broadcast } from "./broadcast";

export function BoutPage({ boutId }: { boutId: string }) {
  const bout = usePit((s) => s.bouts.find((b) => b.id === boutId));
  if (!bout || !bout.result) {
    return (
      <div>
        <h1 className="font-display text-4xl">Tape missing</h1>
        <Link to="/card" className="mt-3 inline-block text-amber">
          Back to the card
        </Link>
      </div>
    );
  }
  const result = bout.result;
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div>
        <SectionLabel>
          Week {bout.week} · {bout.title}
        </SectionLabel>
        <h1 className="font-display text-4xl leading-none md:text-5xl">
          <ResultLine bout={bout} />
        </h1>
      </div>
      <Broadcast bout={bout} />
      <div className="grid gap-3 md:grid-cols-2">
        {result.fighters
          .filter((f) => f.id !== "house")
          .map((f) => (
            <div key={f.id} className="border border-line bg-surface p-3">
              <p className="text-xs tracking-widest text-muted uppercase">{f.storeName}</p>
              <p className="font-display text-2xl">{f.botName}</p>
              <p className="text-sm text-muted">
                {f.chassisName} · {f.weaponName} · {f.driveName}
              </p>
              <div className="mt-3">
                <StatStrip {...f.stats} />
              </div>
            </div>
          ))}
      </div>
      <ol className="flex flex-col gap-2">
        {result.exchanges.map((ex) => (
          <li key={ex.index} className="border-l-2 border-amber pl-3 text-sm text-muted">
            Exchange {ex.index}. {ex.call}
          </li>
        ))}
      </ol>
    </div>
  );
}
