import { BuildLockBanner } from "./build-lock-banner";
import { useState } from "react";
import { KEY_SOURCE, PARTS, SLOT_LABEL, partById, tierWord, type Part } from "@/lib/pit/catalog";
import { SHOW_EFFECTS } from "@/lib/pit/halloween";
import { THANKSGIVING_SHOW_EFFECTS, isThanksgivingPart } from "@/lib/pit/thanksgiving";
import { isElectionPart } from "@/lib/pit/election";
import { isVeteransPart } from "@/lib/pit/veterans";
import { isRecyclesPart } from "@/lib/pit/recycles";
import { SELL_BACK, buyCheck, canSeeLoadout, sellCheck, shopOpen, showCheck } from "@/lib/pit/engine";
import { usePit } from "@/lib/pit/store";
import type { Slot } from "@/lib/pit/types";
import { Btn, SectionLabel } from "./bits";
import { CoinStack, KeyLadder, UpgradeHowTo } from "./key-ladder";
import { canEnterBay, LockedBay } from "./bay-lock";
import { PartDetails, TryOnPanel } from "./try-on";
import { PartIcon, TIER_STYLE } from "./part-icon";

const SLOTS: Slot[] = ["chassis", "drive", "weapon", "armor", "utility", "brain"];

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Render a part's actual peg window instead of assuming one season's dates. */
function windowLabel(window: NonNullable<Part["window"]>) {
  const [sm, sd] = window.start;
  const [em, ed] = window.end;
  return sm === em
    ? `${MONTH_NAMES[sm - 1]} ${sd}–${ed} only`
    : `${MONTH_NAMES[sm - 1]} ${sd} – ${MONTH_NAMES[em - 1]} ${ed} only`;
}

export function ShopPage({ storeId }: { storeId: string }) {
  const data = usePit();
  const buyPart = usePit((s) => s.buyPart);
  const sellPart = usePit((s) => s.sellPart);
  // Two taps to sell: the first arms the button, the second sells.
  const [selling, setSelling] = useState<string | null>(null);
  // Try a part on before buying: a side-by-side preview, nothing is spent.
  const [trying, setTrying] = useState<string | null>(null);
  const buyShow = usePit((s) => s.buyShow);
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
      <BuildLockBanner storeId={storeId} />
      <SectionLabel>{store.name} wallet</SectionLabel>
      <h1 className="font-display text-5xl leading-none">Shop</h1>
      <p className="mt-3 max-w-2xl text-muted">
        {open ? "The pegs are live." : "Shuttered until after the first Monday fight, and shut again once the bot locks Saturday."} Championship iron is never sold.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 border border-line bg-surface px-3 py-2">
          <CoinStack n={bot.coins[slot] ?? 0} />
          <span className="font-display text-sm tracking-wide text-muted uppercase">{SLOT_LABEL[slot]} coins</span>
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
            <KeyLadder coins={bot.coins} highlight={slot} />
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
          {trying && partById(trying)?.slot === slot ? (
            <TryOnPanel data={data} storeId={storeId} part={partById(trying)!} onClose={() => setTrying(null)} />
          ) : null}
          <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {parts.map((part) => {
              const check = buyCheck(data, storeId, part);
              const owned = bot.owned.includes(part.id);
              const sell = owned ? sellCheck(data, storeId, part) : null;
              const have = bot.coins[part.key] ?? 0;
              const price = Math.max(check.cost, part.price);
              const coinsOk = have >= price;
              const src = KEY_SOURCE[part.key];
              return (
                <li key={part.id} className={`lift flex flex-col border p-4 ${owned ? "border-ok/50 bg-surface" : check.ok ? "border-amber/60 bg-surface" : "border-line bg-deep"}`}>
                  <div className="flex items-start gap-3">
                    <PartIcon part={part} />
                    <div className="min-w-0 flex-1">
                      <span className={`inline-block px-2 py-0.5 font-display text-xs tracking-widest uppercase ${TIER_STYLE[part.tier].badge}`}>
                        {tierWord(part.tier)}
                      </span>
                      {owned ? <span className="ml-2 inline-block bg-ok/20 px-2 py-0.5 font-display text-xs tracking-widest text-ok uppercase">Owned</span> : null}
                      <h2 className="mt-1 font-display text-2xl leading-none">{part.name}</h2>
                    </div>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm text-muted">{part.job}</p>
                  <PartDetails part={part} />
                  <ul className="mt-3 flex flex-wrap gap-2 text-sm">
                    <li className={`flex items-center gap-2 border px-2 py-1 ${coinsOk ? "border-ok/50 text-ok" : "border-line text-muted"}`}>
                      <span>{coinsOk ? "✓" : "✗"}</span>
                      <CoinStack n={price} size="sm" />
                      <span>
                        {SLOT_LABEL[part.key].toLowerCase()} coins <span className="text-muted">(jar has {have})</span>
                      </span>
                    </li>
                    {part.classLock ? <li className="border border-line px-2 py-1 text-muted">{part.classLock} chassis</li> : null}
                    {part.greenWeeks ? <li className="border border-line px-2 py-1 text-muted">{part.straight ? `${part.greenWeeks} straight green weeks` : `${part.greenWeeks} green week${part.greenWeeks === 1 ? "" : "s"}`}</li> : null}
                    {part.window ? <li className="border border-line px-2 py-1 text-muted">{windowLabel(part.window)}</li> : null}
                    {isElectionPart(part.id) ? <li className="border border-amber/60 px-2 py-1 text-amber">Election Week</li> : null}
                    {isThanksgivingPart(part.id) ? <li className="border border-amber/60 px-2 py-1 text-amber">Championship Week</li> : null}
                    {isVeteransPart(part.id) ? <li className="border border-amber/60 px-2 py-1 text-amber">Veterans Day week</li> : null}
                    {isRecyclesPart(part.id) ? <li className="border border-amber/60 px-2 py-1 text-amber">America Recycles Day week</li> : null}
                    {part.battery ? <li className="border border-line px-2 py-1 text-muted">Battery {part.battery}</li> : null}
                  </ul>
                  <p className={`mt-2 text-sm ${owned ? "text-ok" : check.ok ? "text-amber" : "text-muted"}`}>
                    {owned
                      ? `Already in the cage. Equip it from the garage, or sell it back for ${SELL_BACK} ${SLOT_LABEL[part.key].toLowerCase()} coins.`
                      : check.ok
                        ? "Ready to buy."
                        : !coinsOk
                          ? `${price - have} more ${SLOT_LABEL[part.key].toLowerCase()} coins. ${src.label} pays them: green 3, blue 2, orange 1, red 0.`
                          : check.reason}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn disabled={!check.ok} onClick={() => buyPart(storeId, part.id)}>
                      Buy
                    </Btn>
                    {sell ? (
                      <Btn
                        tone={selling === part.id ? "spark" : "line"}
                        disabled={!sell.ok}
                        testId={`sell-${part.id}`}
                        onClick={() => {
                          if (selling !== part.id) {
                            setSelling(part.id);
                            return;
                          }
                          setSelling(null);
                          sellPart(storeId, part.id);
                        }}
                      >
                        {selling === part.id ? `Tap again: sell for ${SELL_BACK}` : `Sell for ${SELL_BACK}`}
                      </Btn>
                    ) : null}
                    <Btn
                      tone={trying === part.id ? "spark" : "line"}
                      testId={`try-${part.id}`}
                      onClick={() => setTrying(trying === part.id ? null : part.id)}
                    >
                      {trying === part.id ? "Take it off" : "Try on"}
                    </Btn>
                    <Btn tone="ghost" onClick={() => propose(storeId, part.id, part.job)}>
                      Propose
                    </Btn>
                  </div>
                </li>
              );
            })}
          </ul>
          <section className="mt-6 border border-line bg-surface p-4" data-testid="halloween-show-shop">
            <SectionLabel>Show effects</SectionLabel>
            <p className="mt-2 text-sm text-muted">
              Fog Machine and Blacklight Mode cost 8 utility coins, the same as a Super. They are light only. On the peg all season.
            </p>
            <ul className="mt-3 flex flex-col gap-3">
              {SHOW_EFFECTS.map((effect) => {
                const check = showCheck(data, storeId, effect.id);
                const owned = bot.shows?.includes(effect.id) ?? false;
                const have = bot.coins.utility ?? 0;
                return (
                  <li key={effect.id} className="border border-line bg-deep p-4">
                    <h2 className="font-display text-2xl leading-none">{effect.name}</h2>
                    <p className="mt-2 text-sm text-muted">{effect.blurb}</p>
                    <p className="mt-2 text-sm">8 utility coins. Jar has {have}.</p>
                    <p className={`mt-2 text-sm ${owned ? "text-ok" : check.ok ? "text-amber" : "text-muted"}`}>
                      {owned ? "Already in the rafters." : check.reason}
                    </p>
                    <Btn className="mt-3" disabled={!check.ok} onClick={() => buyShow(storeId, effect.id)}>
                      Buy
                    </Btn>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="mt-6 border border-line bg-surface p-4" data-testid="thanksgiving-show-shop">
            <SectionLabel>Championship Week show</SectionLabel>
            <p className="mt-2 text-sm text-muted">
              Falling Leaves costs 8 utility coins, the same as a Super. It is light and paper only. On sale Championship Week, Tuesday November 24 through Saturday November 28. League-wide — finalist or not.
            </p>
            <ul className="mt-3 flex flex-col gap-3">
              {THANKSGIVING_SHOW_EFFECTS.map((effect) => {
                const check = showCheck(data, storeId, effect.id);
                const owned = bot.shows?.includes(effect.id) ?? false;
                const have = bot.coins.utility ?? 0;
                return (
                  <li key={effect.id} className="border border-line bg-deep p-4">
                    <h2 className="font-display text-2xl leading-none">{effect.name}</h2>
                    <p className="mt-2 text-sm text-muted">{effect.blurb}</p>
                    <p className="mt-2 text-sm">8 utility coins. Jar has {have}.</p>
                    <p className={`mt-2 text-sm ${owned ? "text-ok" : check.ok ? "text-amber" : "text-muted"}`}>
                      {owned ? "Already in the rafters." : check.reason}
                    </p>
                    <Btn className="mt-3" disabled={!check.ok} onClick={() => buyShow(storeId, effect.id)}>
                      Buy
                    </Btn>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
