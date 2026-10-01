import { KEY_ORDER, KEY_SOURCE, SLOT_LABEL } from "@/lib/pit/catalog";
import type { KeyName } from "@/lib/pit/types";

const TIERS = ["Sport", "Pro", "Super"] as const;

export function tierFromKeys(n: number) {
  if (n >= 3) return "Super";
  if (n >= 2) return "Pro";
  if (n >= 1) return "Sport";
  return "Stock";
}

/** Three pips: one per key, labelled with the tier each one opens. */
export function KeyPips({
  have,
  need,
  size = "md",
}: {
  have: number;
  need?: number;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-2.5 w-5" : "h-3 w-8";
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${have} of 3 keys`}>
      {[1, 2, 3].map((n) => {
        const got = have >= n;
        const wanted = need !== undefined && n <= need;
        return (
          <span
            key={n}
            className={`${box} border ${got ? "border-amber bg-amber" : wanted ? "border-amber/70 bg-transparent" : "border-line bg-deep"}`}
            style={
              got
                ? { boxShadow: "0 0 8px color-mix(in oklab, var(--color-amber) 60%, transparent)" }
                : undefined
            }
          />
        );
      })}
    </span>
  );
}

/** The whole upgrade system in three steps. */
export function UpgradeHowTo({ compact = false }: { compact?: boolean }) {
  const steps = [
    {
      n: "1",
      title: "Hit green",
      body: "Every green grade on a Monday card earns 1 key for that part of the bot.",
    },
    {
      n: "2",
      title: "Keys unlock tiers",
      body: "1 key opens Sport. 2 open Pro. 3 open Super. Keys are never spent. They only go up.",
    },
    {
      n: "3",
      title: "Scrap pays",
      body: "Sport 4, Pro 7, Super 12 scrap. Every grade pays scrap. The bank holds 18.",
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

/** Where each key comes from, and how far along this bay is. */
export function KeyLadder({
  keys,
  highlight,
}: {
  keys?: Record<KeyName, number>;
  highlight?: KeyName;
}) {
  return (
    <div className="border border-line bg-surface">
      {keys && KEY_ORDER.every((k) => (keys[k] ?? 0) === 0) ? (
        <p className="border-b border-line bg-amber/10 px-3 py-2 text-sm">
          <span className="font-display tracking-wide text-amber uppercase">No keys yet — that&apos;s normal.</span>{" "}
          <span className="text-muted">
            Week 1 everyone fights stock. Pick any stock weapon, paint the bot, and lock it. Your first keys land after the
            first Monday fight.
          </span>
        </p>
      ) : null}
      <div className="hidden grid-cols-[7rem_1fr_auto] gap-3 border-b border-line px-3 py-2 text-[11px] tracking-widest text-muted uppercase sm:grid">
        <span>Part</span>
        <span>Earn a key with a green week in</span>
        <span className="text-right">{keys ? "Keys · unlocked" : "Keys"}</span>
      </div>
      <ul>
        {KEY_ORDER.map((key) => {
          const src = KEY_SOURCE[key];
          const have = keys?.[key] ?? 0;
          return (
            <li
              key={key}
              className={`grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-line px-3 py-2.5 last:border-b-0 sm:grid-cols-[7rem_1fr_auto] ${highlight === key ? "bg-amber/10" : ""}`}
            >
              <span className="col-start-1 row-start-1 font-display text-lg leading-none tracking-wide uppercase">
                {SLOT_LABEL[key]}
              </span>
              <span className="col-span-2 row-start-2 text-sm text-muted sm:col-span-1 sm:row-start-auto">
                <span className="text-fg">{src.label}</span> · green is {src.green}
              </span>
              <span className="col-start-2 row-start-1 flex items-center justify-end gap-3 sm:col-start-3">
                <KeyPips have={have} />
                {keys ? (
                  <span
                    className={`w-12 text-right font-display text-sm uppercase ${have > 0 ? "text-amber" : "text-muted"}`}
                  >
                    {tierFromKeys(have)}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap justify-end gap-4 border-t border-line px-3 py-2 text-[11px] tracking-widest text-muted uppercase">
        {TIERS.map((tier, i) => (
          <span key={tier} className="flex items-center gap-1.5">
            <KeyPips have={i + 1} size="sm" /> {tier}
          </span>
        ))}
      </div>
    </div>
  );
}
