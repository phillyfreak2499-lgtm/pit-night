import { cosmeticProgress } from "@/lib/pit/cosmetics";
import { championshipFinalists } from "@/lib/pit/engine";
import { usePit } from "@/lib/pit/store";
import { BotPortrait, useBotLook } from "./bot-portrait";
import { Btn, SectionLabel } from "./bits";

const THEMES = [
  {
    name: "IDENTITY",
    categories: "Starter class & body · base paint · bay number · stripes & panels",
    kinds: ["body", "paint", "look"],
  },
  {
    name: "ATTITUDE",
    categories: "Decals & stickers · visor & eyes · trim · light strips",
    kinds: ["decal", "eye", "trim", "leds"],
  },
  { name: "SHOWMANSHIP", categories: "Toppers · flags · walkouts · banners", kinds: ["topper", "banner"] },
  {
    name: "BATTLE READY",
    categories: "Rare finishes · battle-worn & rivalry looks · victory effects · smoke",
    kinds: ["finish", "decal", "smoke"],
  },
  {
    name: "CHAMPIONSHIP",
    categories: "Finalist prestige shells & gold trim · Rally visuals",
    kinds: ["body", "trim"],
  },
];

export function CosmeticTheme({ storeId }: { storeId: string }) {
  const data = usePit();
  const theme = THEMES[Math.min(4, Math.max(0, data.week - 1))]!;
  const rows = cosmeticProgress(data, storeId).filter((r) => theme.kinds.includes(r.reward.kind));
  const earned = rows.filter((r) => r.earned);
  const chase = rows
    .filter((r) => !r.earned)
    .sort((a, b) => b.current / b.target - a.current / a.target)
    .slice(0, 3);
  return (
    <section className="border border-amber/40 bg-surface p-4" data-testid="weekly-cosmetic-theme">
      <SectionLabel>
        Week {data.week} · {theme.name}
      </SectionLabel>
      <p className="mt-2">{theme.categories}</p>
      <p className="mt-2 text-sm text-muted">
        Weekly inspiration: existing achievement requirements and Bolt prices still apply. Every
        look is cosmetic only.
      </p>
      <p className="mt-2 text-sm">
        Unlocked in featured categories:{" "}
        {earned.length
          ? earned.map((r) => r.reward.label).join(" · ")
          : "Starter options available; earn more through Pit Week."}
      </p>
      <ul className="mt-2 text-sm text-muted">
        {chase.map((r) => (
          <li key={r.reward.id}>
            Chasing {r.reward.label}: {r.reward.requirement} ({Math.min(r.current, r.target)}/
            {r.target})
          </li>
        ))}
      </ul>
      {data.week === 3 ? (
        <p className="mt-2 text-sm">
          Flags are available now. Walkout effects are purchased in the Bolt Locker.
        </p>
      ) : null}
      {data.week === 5 ? (
        <p className="mt-2 text-sm text-amber">
          {championshipFinalists(data).includes(storeId)
            ? "Conference champion: prestige shells and gold trim are yours to equip."
            : "Rally behind a finalist in Pit Week. Crowd visuals carry your support; they add no fight bonus."}
        </p>
      ) : null}
      <p className="mt-3 text-xs text-muted">
        {THEMES.map((t, i) => `${i + 1}: ${t.name}`).join(" → ")}
      </p>
    </section>
  );
}

export function CosmeticBoard({ storeId, captain }: { storeId: string; captain: boolean }) {
  const data = usePit();
  const look = useBotLook(storeId);
  const rows = (data.cosmeticProposals ?? [])
    .filter((p) => p.storeId === storeId && p.status === "open")
    .sort((a, b) => b.voters.length - a.voters.length || a.at - b.at || a.id.localeCompare(b.id));
  return (
    <section className="border border-line bg-surface p-4" data-testid="cosmetic-board">
      <SectionLabel>Crew design board</SectionLabel>
      <p className="mt-2 text-sm text-muted">
        One current design per person. One vote per person per proposal; you may support several
        looks. A replacement starts with no votes. Only the captain or Desk can apply a look.
      </p>
      {!rows.length ? (
        <p className="mt-3 text-sm">No proposals yet. Draft a look in the Bot Locker below.</p>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {rows.map((p) => (
          <article key={p.id} className="min-w-0 border border-line p-3">
            <p className="font-display text-xl">
              {p.crewName} · {p.voters.length} {p.voters.length === 1 ? "vote" : "votes"}
            </p>
            <BotPortrait
              className="h-40 w-full"
              look={
                look
                  ? {
                      ...look,
                      paint: p.loadout.paint,
                      look: p.loadout.look,
                      number: p.loadout.number,
                      style: p.loadout.style,
                    }
                  : null
              }
            />
            <p className="text-xs text-muted">
              Bay {p.loadout.number || "—"} · {p.loadout.paint} · {p.loadout.style.finish} ·{" "}
              {p.loadout.look}
            </p>
            <p className="mt-1 text-xs text-muted">
              {Object.entries(p.loadout.style.stickers ?? {})
                .map(([slot, decal]) => `${slot}: ${decal}`)
                .join(" · ")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn
                tone="line"
                disabled={
                  p.voters.includes(data.session.crewId ?? "") ||
                  data.session.role === "commissioner"
                }
                onClick={() => data.voteCosmetic(p.id)}
              >
                {p.voters.includes(data.session.crewId ?? "") ? "Voted" : "Vote for this look"}
              </Btn>
              {captain ? <Btn onClick={() => data.acceptCosmetic(p.id)}>Accept & apply</Btn> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
