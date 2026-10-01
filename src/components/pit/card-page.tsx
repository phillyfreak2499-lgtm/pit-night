import { Link } from "@tanstack/react-router";
import { CLASS_META } from "@/lib/pit/catalog";
import { botFor } from "@/lib/pit/engine";
import { usePit, type PitState } from "@/lib/pit/store";
import type { Bout, ClassId } from "@/lib/pit/types";
import { BoutWatch, Panel, ResultLine, SectionLabel } from "./bits";

export function CardPage() {
  const data = usePit();
  const week = data.week;
  const meta = data.weeks.find((w) => w.number === week);
  const bouts = data.bouts.filter((b) => b.week === week);
  const groups = week === 2 ? groupByClass(data, bouts) : null;

  return (
    <div className="mx-auto max-w-6xl">
      <SectionLabel>Fight day card</SectionLabel>
      <h1 className="font-display text-5xl leading-none">{meta?.name ?? `Week ${week}`}</h1>
      <p className="mt-3 max-w-2xl text-muted">{meta?.blurb}</p>
      <Link to="/broadcast" className="mt-4 inline-flex min-h-11 items-center text-amber">
        Watch the Monday broadcast
      </Link>
      {bouts.length === 0 ? (
        <p className="mt-6 border border-line bg-surface p-4">
          The card is not printed yet. Captains lock Saturday at close. Sunday the desk clicks in the official colors. Monday morning the desk hits Run the card.
        </p>
      ) : groups ? (
        <div className="mt-6 flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="font-display text-2xl">{group.label}</h2>
              <div className="mt-2 flex flex-col gap-3">
                {group.bouts.map((bout) => (
                  <BoutRow key={bout.id} bout={bout} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {bouts.map((bout) => (
            <BoutRow key={bout.id} bout={bout} />
          ))}
        </div>
      )}
    </div>
  );
}

function groupByClass(data: PitState, bouts: Bout[]) {
  const bucket = (classId: ClassId | "cross", label: string) => ({
    label,
    bouts: bouts.filter((bout) => {
      if (bout.kind === "bye" || bout.kind === "melee" || bout.kind === "tag") return classId === "cross";
      const a = botFor(data, bout.teamA[0]!).classId;
      const b = botFor(data, bout.teamB[0]!).classId;
      if (classId === "cross") return a !== b;
      return a === classId && b === classId;
    }),
  });
  return [
    bucket("striker", "Strikers"),
    bucket("tank", "Tanks"),
    bucket("specialist", "Specialists"),
    bucket("cross", "Mixed-class fights"),
  ].filter((g) => g.bouts.length);
}

function BoutRow({ bout }: { bout: Bout }) {
  const data = usePit();
  const name = (id: string) => {
    const store = data.stores.find((s) => s.id === id);
    const bot = data.bots.find((b) => b.storeId === id);
    if (!store || !bot) return id;
    return `${store.name} ${bot.name}`;
  };
  const left = bout.teamA.map(name).join(" + ") || "—";
  const right = bout.teamB.map(name).join(" + ");
  const classLine =
    bout.teamA[0] && bout.teamB[0]
      ? `${CLASS_META[botFor(data, bout.teamA[0]).classId].label} vs ${CLASS_META[botFor(data, bout.teamB[0]).classId].label}`
      : bout.kind === "bye"
        ? "Bye · counts as a win"
        : bout.kind;

  return (
    <Panel className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs tracking-widest text-amber uppercase">
          {bout.slot}. {bout.title}
        </p>
        <h2 className="font-display text-2xl leading-tight md:text-3xl">
          {left}
          {right ? ` vs ${right}` : ""}
        </h2>
        <p className="mt-1 text-sm text-muted">{classLine}</p>
        <p className="mt-1 text-sm">
          <ResultLine bout={bout} />
        </p>
      </div>
      {bout.result ? <BoutWatch bout={bout} /> : null}
    </Panel>
  );
}
