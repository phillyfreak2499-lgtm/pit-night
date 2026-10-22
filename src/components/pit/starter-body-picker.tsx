import { useState } from "react";
import { CLASS_META, starterBodies } from "@/lib/pit/catalog";
import type { BotBody, ClassId } from "@/lib/pit/types";
import { usePit } from "@/lib/pit/store";
import { BotPortrait } from "./bot-portrait";
export default function StarterBodyPicker({
  storeId,
  onDone,
}: {
  storeId: string;
  onDone: () => void;
}) {
  const data = usePit();
  const chooseStarterBody = usePit((state) => state.chooseStarterBody);
  const store = data.stores.find((row) => row.id === storeId);
  const [classId, setClassId] = useState<ClassId>("striker");
  const [body, setBody] = useState<BotBody>("shrike");
  const bodies = starterBodies(classId);
  const selected = bodies.find((row) => row.id === body) ?? bodies[0]!;
  const chooseClass = (next: ClassId) => {
    setClassId(next);
    setBody(starterBodies(next)[0]!.id);
  };
  if (!store) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-deep p-3 md:p-6">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col justify-center">
        <p className="font-display text-xs tracking-[0.3em] text-amber uppercase">
          First entry · {store.name}
        </p>
        <h2 className="mt-2 font-display text-5xl leading-none md:text-7xl">
          Choose your Week 1 bot
        </h2>
        <p className="mt-3 max-w-3xl text-muted">
          Pick a fighting style, then a body shell. The body is visual; the fighting style controls
          the class. Once confirmed, this store&apos;s choice is frozen through the first Monday
          fight.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {(["striker", "tank", "specialist"] as ClassId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => chooseClass(id)}
              className={`min-h-24 border p-4 text-left ${classId === id ? "border-amber bg-amber/10" : "border-line bg-surface"}`}
            >
              <span className="font-display text-3xl">{CLASS_META[id].label}</span>
              <span className="mt-1 block text-sm text-muted">{CLASS_META[id].blurb}</span>
            </button>
          ))}
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {bodies.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setBody(row.id)}
                className={`border p-4 text-left ${selected.id === row.id ? "border-spark bg-spark/10" : "border-line bg-surface"}`}
              >
                <span className="font-display text-2xl">{row.label}</span>
                <span className="mt-1 block text-sm text-muted">{row.note}</span>
              </button>
            ))}
          </div>
          <div
            data-bot-hover
            className="relative min-h-80 overflow-hidden border border-line bg-surface"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-surface to-deep" />
            <BotPortrait
              look={{
                id: `starter-${storeId}-${selected.id}`,
                paint: store.paint,
                classId,
                weapon: "none",
                look: "plain",
                number: data.bots.find((bot) => bot.storeId === storeId)?.number ?? "",
                hp: 100,
                style: {
                  finish: "factory",
                  decal: "none",
                  trim: "steel",
                  eye: "green",
                  flag: false,
                  topper: "none",
                  body: selected.id,
                },
                storeName: store.name,
              }}
              facing={-1}
              zoom={0.85}
              className="relative h-80 w-full md:h-[28rem]"
            />
            <div className="absolute inset-x-0 bottom-0 bg-deep/85 p-4">
              <p className="font-display text-3xl">
                {selected.label} · {CLASS_META[classId].label}
              </p>
              <p className="text-sm text-muted">{selected.note}</p>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="mt-5 min-h-14 bg-amber px-6 font-display text-xl tracking-wide text-deep uppercase"
          onClick={() => {
            chooseStarterBody(storeId, classId, selected.id);
            onDone();
          }}
        >
          Lock {selected.label} for Week 1
        </button>
        <p className="mt-2 text-center text-xs text-muted">
          After the first fight, class changes follow the normal chassis-coin rule.
        </p>
      </div>
    </div>
  );
}
