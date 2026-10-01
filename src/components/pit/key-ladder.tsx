import {
  GRADE_COINS,
  KEY_ORDER,
  SLOT_LABEL,
  TIER_PRICE,
  bandText,
  metricForSlot,
} from "@/lib/pit/catalog";
import type { KeyName } from "@/lib/pit/types";

const TIERS = [
  { tier: "sport", label: "Sport" },
  { tier: "pro", label: "Pro" },
  { tier: "super", label: "Super" },
] as const;

/** A stack of coins, drawn. */
export function CoinStack({ n, size = "md" }: { n: number; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-5 min-w-5 text-[11px]" : "h-8 min-w-8 text-base";
  return (
    <span
      className={`coin inline-grid place-items-center rounded-full px-1.5 font-display leading-none text-deep ${box}`}
      aria-label={`${n} coins`}
    >
      {n}
    </span>
  );
}

/** The whole economy in three steps. */
export function UpgradeHowTo({ compact = false }: { compact?: boolean }) {
  const steps = [
    {
      n: "1",
      title: "Six numbers, six parts",
      body: "NSNU feeds the chassis. Conv % the armor. Demo Rate the drive. Demo Close % the weapon. Arch Supports the utility. Demo Ticket the brain.",
    },
    {
      n: "2",
      title: "Grades pay coins",
      body: `Every Monday each number pays its part's jar: green ${GRADE_COINS.green}, blue ${GRADE_COINS.blue}, orange ${GRADE_COINS.orange}, red 0.`,
    },
    {
      n: "3",
      title: "Spend on that part",
      body: `Sport ${TIER_PRICE.sport}, Pro ${TIER_PRICE.pro}, Super ${TIER_PRICE.super} coins. Repairs come out of the same jar.`,
    },
  ];
  return (
    <ol
      className={`grid gap-px border border-line bg-line ${compact ? "sm:grid-cols-3" : "md:grid-cols-3"}`}
    >
      {steps.map((step) => (
        <li key={step.n} className="flex gap-3 bg-surface p-3">
          <span className="font-display text-3xl leading-none text-amber">{step.n}</span>
          <span>
            <span className="block font-display text-lg leading-tight tracking-wide uppercase">
              {step.title}
            </span>
            <span className="mt-1 block text-sm text-muted">{step.body}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** One jar per part: where its coins come from, how many it holds, what it can buy. */
export function KeyLadder({
  coins,
  highlight,
}: {
  coins?: Record<KeyName, number>;
  highlight?: KeyName;
}) {
  const empty = coins && KEY_ORDER.every((k) => (coins[k] ?? 0) === 0);
  return (
    <div className="border border-line bg-surface">
      {empty ? (
        <p className="border-b border-line bg-amber/10 px-3 py-2 text-sm">
          <span className="font-display tracking-wide text-amber uppercase">
            No coins yet — that&apos;s normal.
          </span>{" "}
          <span className="text-muted">
            Your first coins come from your Period 11 colors. The desk pays them before Week 1,
            and the shop opens the moment they land. Until then, pick a stock weapon and brain and paint the bot.
          </span>
        </p>
      ) : null}
      <div className="hidden grid-cols-[7rem_1fr_auto] gap-3 border-b border-line px-3 py-2 text-[11px] tracking-widest text-muted uppercase sm:grid">
        <span>Part</span>
        <span>Fed by</span>
        <span className="text-right">{coins ? "Coins · can buy" : "Prices"}</span>
      </div>
      <ul>
        {KEY_ORDER.map((key) => {
          const m = metricForSlot(key);
          const have = coins?.[key] ?? 0;
          const bands = bandText(m);
          return (
            <li
              key={key}
              className={`grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-line px-3 py-2.5 last:border-b-0 sm:grid-cols-[7rem_1fr_auto] ${highlight === key ? "bg-amber/10" : ""}`}
            >
              <span className="col-start-1 row-start-1 font-display text-lg leading-none tracking-wide uppercase">
                {SLOT_LABEL[key]}
              </span>
              <span className="col-span-2 row-start-2 text-sm text-muted sm:col-span-1 sm:row-start-auto">
                <span className="text-fg">{m.label}</span> · green {bands.green}, blue {bands.blue},
                orange {bands.orange}
              </span>
              <span className="col-start-2 row-start-1 flex items-center justify-end gap-2 sm:col-start-3">
                {coins ? <CoinStack n={have} /> : null}
                {TIERS.map((t) => {
                  const price = TIER_PRICE[t.tier];
                  const ok = coins ? have >= price : false;
                  return (
                    <span
                      key={t.tier}
                      className={`border px-1.5 py-0.5 font-display text-[11px] tracking-wide uppercase ${coins ? (ok ? "border-ok/60 text-ok" : "border-line text-muted") : "border-line text-muted"}`}
                      title={`${t.label} costs ${price}`}
                    >
                      {t.label} {price}
                    </span>
                  );
                })}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
