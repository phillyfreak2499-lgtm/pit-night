import { useState } from "react";
import { PARTS, SLOT_LABEL } from "@/lib/pit/catalog";
import { buyCheck, canSeeLoadout, shopOpen } from "@/lib/pit/engine";
import { usePit } from "@/lib/pit/store";
import type { Slot } from "@/lib/pit/types";
import { Btn, SectionLabel } from "./bits";

const SLOTS: Slot[] = ["chassis", "drive", "weapon", "armor", "utility"];

export function ShopPage({ storeId }: { storeId: string }) {
  const data = usePit();
  const buyPart = usePit((s) => s.buyPart);
  const propose = usePit((s) => s.propose);
  const [slot, setSlot] = useState<Slot>("weapon");
  const store = data.stores.find((s) => s.id === storeId);
  const bot = data.bots.find((b) => b.storeId === storeId);
  if (!store || !bot) return <p>No bay.</p>;
  const see = canSeeLoadout(data, storeId) || data.session.role === "commissioner";
  const open = shopOpen(data);
  const parts = PARTS.filter((part) => part.slot === slot && part.tier !== "stock" && part.tier !== "championship");

  return (
    <div className="mx-auto max-w-6xl">
      <SectionLabel>{store.name} wallet</SectionLabel>
      <h1 className="font-display text-5xl leading-none">Shop</h1>
      <p className="mt-3 max-w-2xl text-muted">
        {bot.scrap} scrap in the bank, cap 18. {open ? "The pegs are live." : "Shuttered until after Saturday 1, and shut again once Friday locks."} Championship iron is never sold.
      </p>
      {!see ? (
        <p className="mt-6 border border-line p-4 text-muted">Crew only. The catalog stays in the garage until you are on this store's clipboard.</p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            {SLOTS.map((item) => (
              <button
                key={item}
                type="button"
                className={`min-h-11 px-3 font-display tracking-wide uppercase ${item === slot ? "bg-amber text-deep" : "border border-line"}`}
                onClick={() => setSlot(item)}
              >
                {SLOT_LABEL[item]}
              </button>
            ))}
          </div>
          <ul className="mt-4 flex flex-col gap-3">
            {parts.map((part) => {
              const check = buyCheck(data, storeId, part);
              const owned = bot.owned.includes(part.id);
              return (
                <li key={part.id} className={`border border-line p-4 ${check.ok || owned ? "bg-surface" : "bg-deep opacity-80"}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-display text-2xl leading-none">{part.name}</h2>
                    <p className="text-xs tracking-widest text-amber uppercase">{part.tier} · {part.scrap} scrap</p>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm text-muted">{part.job}</p>
                  <p className="mt-2 text-sm">
                    {part.greens ? `${part.greens} green ${part.stat} week${part.greens > 1 ? "s" : ""}` : "No green gate"}
                    {part.keys ? ` · ${part.keys} ${part.key} key${part.keys > 1 ? "s" : ""}` : ""}
                    {part.classLock ? ` · ${part.classLock} chassis` : ""}
                  </p>
                  <p className="mt-1 text-sm text-warn">{owned ? "Already in the cage." : check.reason}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn disabled={!check.ok} onClick={() => buyPart(storeId, part.id)}>
                      Buy
                    </Btn>
                    <Btn tone="ghost" onClick={() => propose(storeId, part.id, part.job)}>
                      Propose
                    </Btn>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
