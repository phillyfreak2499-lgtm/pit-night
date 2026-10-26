import { TaleOfTape } from "./tale-of-tape";
import { Link } from "@tanstack/react-router";
import { programRecords, storeNameMap } from "@/lib/pit/fight-card";
import { usePit } from "@/lib/pit/store";
import { ResultLine, SectionLabel, StatStrip } from "./bits";
import { Broadcast } from "./broadcast";
import { ClaudeCopy, LiveCall } from "./claude-copy";
import { FightProgram } from "./fight-program";

export function BoutPage({ boutId }: { boutId: string }) {
  const data = usePit();
  const bout = data.bouts.find((b) => b.id === boutId);
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
      <FightProgram
        bout={bout}
        records={programRecords(data, bout)}
        storeNames={storeNameMap(data)}
        kicker={`Week ${bout.week} · record going in`}
      />
      <Broadcast bout={bout} />
      <TaleOfTape bout={bout} />
      <ClaudeCopy kind="bout" id={bout.id} label="Ringside call" />
      <LiveCall boutId={bout.id} />
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
                <StatStrip {...f.stats} battery={f.batteryMax} />
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
