import { Link } from "@tanstack/react-router";
import { SLOT_LABEL } from "@/lib/pit/catalog";
import { quotesForBot, wonThisWeek } from "@/lib/pit/engine";
import { usePit } from "@/lib/pit/store";
import type { Condition, Slot } from "@/lib/pit/types";
import { SectionLabel } from "./bits";

const SLOTS: Slot[] = ["chassis", "drive", "weapon", "armor", "utility", "brain"];

const TONE: Record<Condition, string> = {
  clean: "text-ok",
  scratched: "text-info",
  bent: "text-warn",
  disabled: "text-bad",
};

export function DamagePage() {
  const data = usePit();
  const posted = data.phase === "inspected" || data.phase === "complete" || data.phase === "fought";
  return (
    <div className="mx-auto max-w-6xl">
      <SectionLabel>Monday afternoon</SectionLabel>
      <h1 className="font-display text-5xl leading-none">Damage report</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Winners still take scratches. Blowouts kill weapon and drive. A disabled slot fights on loaner stock until the quote is paid. Emergency weld buys one Bent week.
      </p>
      {data.phase === "fought" ? (
        <p className="mt-4 border border-warn p-4 text-warn">The card has been fought. Drop damage from the desk to hang the quotes.</p>
      ) : null}
      {!posted ? <p className="mt-4 text-muted">No inspections yet. The floor is still open.</p> : null}
      <ul className="mt-6 flex flex-col gap-3">
        {data.stores.map((store) => {
          const bot = data.bots.find((b) => b.storeId === store.id);
          if (!bot) return null;
          const quotes = quotesForBot(bot, wonThisWeek(data, store.id));
          const weapon = bot.wear.weapon;
          return (
            <li key={store.id} className="border border-line bg-surface p-4" data-testid={`damage-${store.id}`}>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="font-display text-2xl leading-none">{store.name}</p>
                  <p className="text-sm text-muted">{bot.name}</p>
                </div>
                <Link to="/garage/$storeId" params={{ storeId: store.id }} className="text-sm text-amber">
                  Open bay
                </Link>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
                {SLOTS.map((slot) => (
                  <div key={slot} data-testid={store.id === "allen" && slot === "weapon" ? "allen-weapon-state" : undefined}>
                    <p className="text-xs tracking-widest text-muted uppercase">{SLOT_LABEL[slot]}</p>
                    <p className={`font-display text-lg uppercase ${TONE[bot.wear[slot]]}`}>{bot.wear[slot]}</p>
                  </div>
                ))}
              </div>
              {weapon === "disabled" ? <p className="mt-2 text-sm text-bad">Weapon is dead. The quote stays on the bay after you leave.</p> : null}
              {quotes.length ? (
                <ul className="mt-3 flex flex-col gap-2">
                  {quotes.map((quote) => (
                    <li key={quote.slot} className="text-sm text-muted">
                      {quote.partName} · {quote.repairCost} {quote.slot} coins{quote.weldCost ? ` · weld ${quote.weldCost}` : ""} — {quote.line}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-ok">Clean enough to roll.</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
