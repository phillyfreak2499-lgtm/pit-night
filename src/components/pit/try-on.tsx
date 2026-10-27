import { CLASS_META, SLOT_LABEL, batteryOf, partById, tierWord, type Part } from "@/lib/pit/catalog";
import { cardFor, gradesOf, printedStats, weekQuality } from "@/lib/pit/engine";
import type { PitData, Slot, StatBlock } from "@/lib/pit/types";
import { BotPortrait, useBotLook } from "./bot-portrait";
import { Btn, SectionLabel } from "./bits";

/** What each slot does in the cage, in plain words. */
export const SLOT_NOTES: Record<Slot, string> = {
  chassis:
    "The body and the battery. It sets the bot's shape, how much punishment it can carry, and how long it has power before it fades.",
  drive:
    "The wheels, treads, casters or skirt underneath. Drive decides how fast you close in, whether you can dodge, and how hard you are to push around.",
  weapon:
    "What does the damage. Saws, drums and discs reward a fast week; hammers and wedges hit slow and heavy; claws and flames win with Heat.",
  armor: "The skin. Armor soaks hits so the bot lasts longer. Some kinds are better against certain weapons.",
  utility:
    "An extra gadget: speed boosts, repairs during the fight, tricks that blind or trip the other bot. Optional; a bot can fight with this slot empty.",
  brain:
    "How the bot fights: careful or aggressive, how well it aims and avoids hazards. Brains change behavior, not the four printed numbers.",
};

const STAT_WORD: Record<keyof StatBlock, string> = { power: "Power", speed: "Speed", armor: "Armor", heat: "Heat" };
const STAT_NOTE: Record<keyof StatBlock, string> = {
  power: "how hard it hits",
  speed: "how fast it moves and strikes first",
  armor: "how much damage it can take",
  heat: "grip, grabs and burn",
};

/** The fighting style a part leans toward, from its biggest stat. */
export function fitsClass(part: Part) {
  if (part.classLock) return CLASS_META[part.classLock].label;
  const { power, speed, armor, heat } = part.nudge;
  const best = Math.max(power, speed, armor, heat);
  if (best <= 0) return null;
  if (heat === best) return CLASS_META.specialist.label;
  if (armor === best) return CLASS_META.tank.label;
  return CLASS_META.striker.label;
}

/** Plain-language facts about a part: what it does, its numbers and what it needs. */
export function PartDetails({ part }: { part: Part }) {
  const stats = (Object.keys(STAT_WORD) as (keyof StatBlock)[]).filter((k) => part.nudge[k] !== 0);
  const fit = fitsClass(part);
  return (
    <details className="mt-3 border border-line bg-deep/60" data-testid={`details-${part.id}`}>
      <summary className="flex min-h-11 cursor-pointer items-center px-3 font-display text-sm tracking-wide uppercase">
        What it does
      </summary>
      <div className="flex flex-col gap-2 px-3 pb-3 text-sm">
        <p>{part.job}</p>
        <p className="text-muted">
          <span className="font-semibold text-fg">{SLOT_LABEL[part.slot]}:</span> {SLOT_NOTES[part.slot]}
        </p>
        {stats.length ? (
          <ul className="flex flex-wrap gap-2">
            {stats.map((k) => (
              <li key={k} className={`border px-2 py-1 ${part.nudge[k] > 0 ? "border-ok/50 text-ok" : "border-bad/50 text-bad"}`}>
                {part.nudge[k] > 0 ? "+" : "−"}
                {Math.abs(part.nudge[k])} {STAT_WORD[k]} <span className="text-muted">({STAT_NOTE[k]})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">No change to Power, Speed, Armor or Heat. It changes how the bot behaves in the fight.</p>
        )}
        <p className="text-muted">
          {tierWord(part.tier)} tier
          {fit ? ` · Best on a ${fit}` : ""}
          {part.slot === "chassis" ? ` · Battery ${batteryOf(part)}` : ""}
          {part.classLock ? ` · ${CLASS_META[part.classLock].label} chassis only (changing class costs 3 chassis coins after Week 1)` : ""}
        </p>
      </div>
    </details>
  );
}

function statsFor(data: PitData, storeId: string, part: Part | null) {
  const bot = data.bots.find((b) => b.storeId === storeId);
  const card = cardFor(data, storeId);
  if (!bot || !card) return null;
  const loadout = part ? { ...bot.draft, [part.slot]: part.id } : bot.draft;
  const who = part?.slot === "chassis" && part.classLock ? { ...bot, classId: part.classLock } : bot;
  return printedStats(who, loadout, weekQuality(gradesOf(card))).stats;
}

/** Your bot now beside your bot wearing the part, with the four numbers compared. Nothing is bought. */
export function TryOnPanel({ data, storeId, part, onClose }: { data: PitData; storeId: string; part: Part; onClose: () => void }) {
  const base = useBotLook(storeId);
  if (!base) return null;
  const tried = {
    ...base,
    classId: part.slot === "chassis" && part.classLock ? part.classLock : base.classId,
    weapon: part.slot === "weapon" ? part.family : base.weapon,
    armorFamily: part.slot === "armor" ? part.family : base.armorFamily,
    driveFamily: part.slot === "drive" ? part.family : base.driveFamily,
    chassisFamily: part.slot === "chassis" ? part.family : base.chassisFamily,
    utilityFamily: part.slot === "utility" ? part.family : base.utilityFamily,
    brainTier: part.slot === "brain" ? part.tier : base.brainTier,
  };
  const now = statsFor(data, storeId, null);
  const next = statsFor(data, storeId, part);
  const bot = data.bots.find((b) => b.storeId === storeId);
  const current = partById(bot?.draft[part.slot] ?? null);
  return (
    <section className="sticky top-2 z-10 mt-4 border border-amber/60 bg-surface p-4 shadow-lg" data-testid="try-on" aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SectionLabel>Trying on · not bought</SectionLabel>
        <Btn tone="ghost" onClick={onClose}>
          Take it off
        </Btn>
      </div>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <figure>
          <BotPortrait look={base} className="h-40 w-full" />
          <figcaption className="mt-1 text-center text-xs tracking-widest text-muted uppercase">
            Now · {current?.name ?? (part.slot === "utility" ? "empty" : "stock")}
          </figcaption>
        </figure>
        <figure>
          <BotPortrait look={tried} className="h-40 w-full" />
          <figcaption className="mt-1 text-center text-xs tracking-widest text-amber uppercase">With {part.name}</figcaption>
        </figure>
      </div>
      {now && next ? (
        <ul className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {(Object.keys(STAT_WORD) as (keyof StatBlock)[]).map((k) => {
            const diff = next[k] - now[k];
            return (
              <li key={k} className="border border-line px-2 py-1">
                <span className="text-muted">{STAT_WORD[k]}</span>{" "}
                <span className="font-display text-lg">{now[k]}</span>
                {" → "}
                <span className={`font-display text-lg ${diff > 0 ? "text-ok" : diff < 0 ? "text-bad" : ""}`}>{next[k]}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">The numbers show once this week&apos;s card is on file.</p>
      )}
      <p className="mt-2 text-xs text-muted">
        Numbers use this week&apos;s colors and your current build with only the {SLOT_LABEL[part.slot].toLowerCase()} swapped.
        {part.slot === "chassis" ? ` Battery ${batteryOf(current ?? null)} → ${batteryOf(part)}.` : ""}
      </p>
    </section>
  );
}
