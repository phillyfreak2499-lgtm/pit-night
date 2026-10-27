import { useEffect, useRef, useState } from "react";
import { partById } from "@/lib/pit/catalog";
import { usePit } from "@/lib/pit/store";
import { PartIcon } from "./part-icon";

type Moment = { id: number; kind: "coins"; amount: number } | { id: number; kind: "part"; partId: string };

const COIN_SPOTS = [12, 22, 31, 40, 48, 57, 66, 75, 84, 90];

/**
 * A short celebration when the signed-in store gains coins (kickoff, a sale, a Desk gift,
 * a Monday payout) or a new part. Watches the store's own bot, so it plays for whoever
 * is looking at that store, and skips the first load so a page refresh never fires it.
 */
export function Celebrate() {
  const storeId = usePit((s) => (s.session.role === "captain" || s.session.role === "crew" ? s.session.storeId : null));
  const bot = usePit((s) => s.bots.find((b) => b.storeId === storeId));
  const coins = bot ? Object.values(bot.coins).reduce((sum, n) => sum + (n ?? 0), 0) : null;
  const owned = bot?.owned ?? null;
  const seen = useRef<{ storeId: string | null; coins: number | null; owned: string[] | null } | null>(null);
  const [moment, setMoment] = useState<Moment | null>(null);

  useEffect(() => {
    const prev = seen.current;
    seen.current = { storeId, coins, owned };
    if (!prev || prev.storeId !== storeId || prev.coins === null || coins === null || !owned || !prev.owned) return;
    const added = owned.find((id) => !prev.owned!.includes(id));
    if (added) setMoment({ id: Date.now(), kind: "part", partId: added });
    else if (coins > prev.coins) setMoment({ id: Date.now(), kind: "coins", amount: coins - prev.coins });
  }, [storeId, coins, owned]);

  useEffect(() => {
    if (!moment) return;
    const t = setTimeout(() => setMoment(null), 2000);
    return () => clearTimeout(t);
  }, [moment]);

  if (!moment) return null;
  const part = moment.kind === "part" ? partById(moment.partId) : null;
  return (
    <div className="celebrate" key={moment.id} role="status" aria-live="polite" data-testid="celebrate">
      {moment.kind === "coins"
        ? COIN_SPOTS.slice(0, Math.min(COIN_SPOTS.length, 3 + moment.amount)).map((left, i) => (
            <span
              key={i}
              className="celebrate-coin coin"
              style={{ left: `${left}%`, animationDelay: `${(i % 5) * 0.09}s` }}
              aria-hidden
            />
          ))
        : null}
      <div className="celebrate-card flex items-center gap-3 border border-amber bg-deep/95 px-5 py-4 shadow-2xl">
        {part ? (
          <span className="celebrate-part">
            <PartIcon part={part} className="h-16 w-16" />
          </span>
        ) : (
          <span className="coin inline-grid h-12 w-12 place-items-center rounded-full font-display text-xl text-deep">+</span>
        )}
        <span>
          <span className="block font-display text-3xl leading-none text-amber">
            {moment.kind === "coins" ? `+${moment.amount} coin${moment.amount === 1 ? "" : "s"}` : "New part!"}
          </span>
          <span className="mt-1 block text-sm text-muted">{part ? part.name : "In the jars and ready to spend"}</span>
        </span>
      </div>
    </div>
  );
}
