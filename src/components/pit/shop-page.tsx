import { useState } from "react";
import { KEY_SOURCE, PARTS, SLOT_LABEL, tierWord } from "@/lib/pit/catalog";
import { buyCheck, canSeeLoadout, shopOpen } from "@/lib/pit/engine";
import { usePit } from "@/lib/pit/store";
import type { Slot } from "@/lib/pit/types";
import { Btn, SectionLabel } from "./bits";
import { KeyLadder, KeyPips, UpgradeHowTo } from "./key-ladder";
import { canEnterBay, LockedBay } from "./bay-lock";

const SLOTS: Slot[] = ["chassis", "drive", "weapon", "armor", "utility"];

export function ShopPage({ storeId }: { storeId: string }) {
  const data = usePit();
  const buyPart = usePit((s) => s.buyPart);
  const propose = usePit((s) => s.propose);
  const [slot, setSlot] = useState<Slot>("weapon");
  const store = data.stores.find((s) => s.id === storeId);
  const bot = data.bots.find((b) => b.storeId === storeId);
  if (!store || !bot) return <p>No bay.</p>;
  if (!canEnterBay(data, storeId)) return <LockedBay storeId={storeId} />;
  const see = canSeeLoadout(data, storeId) || data.session.role === "commissioner";
  const open = shopOpen(data);
  const parts = PARTS.filter(
    (part) => part.slot === slot && part.tier !== "stock" && part.tier !== "championship" && (!part.classLock || part.slot === "chassis"),
  );

  return (
    <div className="mx-auto max-w-6xl">
      <SectionLabel>{store.name} wallet</SectionLabel>
      <h1 className="font-display text-5xl leading-none">Shop</h1>
      <p className="mt-3 max-w-2xl text-muted">
        {open ? "The pegs are live." : "Shuttered until after the first Monday fight, and shut again once the bot locks Saturday."} Championship iron is never sold.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="border border-line bg-surface px-4 py-2 font-display text-2xl leading-none">
          {bot.scrap}
          <span className="ml-1 text-sm text-muted">/ 18 scrap</span>
        </span>
        <span className={`px-3 py-2 font-display text-sm tracking-widest uppercase ${open ? "bg-ok/15 text-ok" : "bg-bad/15 text-bad"}`}>{open ? "Shop open" : "Shop shut"}</span>
      </div>
      <div className="mt-5">
        <UpgradeHowTo />
      </div>
      {!see ? (
        <p className="mt-6 border border-line p-4 text-muted">Crew only. The catalog stays in the garage until you are on this store's clipboard.</p>
      ) : (
        <>
          <div className="mt-5">
            <KeyLadder keys={bot.keys} highlight={slot} />
          </div>
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
              const haveKeys = bot.keys[part.key];
              const keysOk = haveKeys >= part.keys;
              const price = Math.max(check.cost, part.scrap);
              const scrapOk = bot.scrap >= price;
              const src = KEY_SOURCE[part.key];
              return (
                <li key={part.id} className={`border p-4 ${owned ? "border-ok/50 bg-surface" : check.ok ? "border-amber/60 bg-surface" : "border-line bg-deep"}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-display text-2xl leading-none">{part.name}</h2>
                    <p className="font-display text-sm tracking-widest text-amber uppercase">{tierWord(part.tier)}</p>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm text-muted">{part.job}</p>
                  <ul className="mt-3 flex flex-wrap gap-2 text-sm">
                    <li className={`flex items-center gap-2 border px-2 py-1 ${keysOk ? "border-ok/50 text-ok" : "border-line text-muted"}`}>
                      <span>{keysOk ? "✓" : "✗"}</span>
                      <KeyPips have={Math.min(haveKeys, 3)} need={part.keys} size="sm" />
                      <span>
                        {haveKeys}/{part.keys} {SLOT_LABEL[part.key].toLowerCase()} keys
                      </span>
                    </li>
                    <li className={`flex items-center gap-2 border px-2 py-1 ${scrapOk ? "border-ok/50 text-ok" : "border-line text-muted"}`}>
                      <span>{scrapOk ? "✓" : "✗"}</span>
                      <span>
                        {price} scrap <span className="text-muted">(bank {bot.scrap})</span>
                      </span>
                    </li>
                    {part.classLock ? <li className="border border-line px-2 py-1 text-muted">{part.classLock} chassis</li> : null}
                  </ul>
                  <p className={`mt-2 text-sm ${owned ? "text-ok" : check.ok ? "text-amber" : "text-muted"}`}>
                    {owned
                      ? "Already in the cage. Equip it from the garage."
                      : check.ok
                        ? "Ready to buy."
                        : !keysOk
                          ? `Earn ${part.keys - haveKeys} more with green ${src.label} weeks (${src.green}).`
                          : check.reason}
                  </p>
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
