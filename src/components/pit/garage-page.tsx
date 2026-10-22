import { Modal } from "./modal";
import { LockerIdentity } from "./locker-identity";
import { CosmeticBoard, CosmeticTheme } from "./cosmetic-board";
import { EffectLockerPreview } from "./effect-locker-preview";
import type { CosmeticLoadout, StickerSlot } from "@/lib/pit/types";
import { BuildLockBanner } from "./build-lock-banner";
import { Link } from "@tanstack/react-router";
import { createContext, useContext, useState } from "react";
import { BODY_STYLES, CLASS_META, DECALS, EYES, FINISHES, PAINT, TOPPERS, partById, partsFor, SLOT_LABEL, styleOf, TRIM } from "@/lib/pit/catalog";
import {
  buyCheck,
  canSeeLoadout,
  cardFor,
  gradesOf,
  printedStats,
  quotesForBot,
  shopOpen,
  weekQuality,
  wonThisWeek,
} from "@/lib/pit/engine";
import { paintHex, usePit, type PitState } from "@/lib/pit/store";
import { cosmeticProgress, cosmeticUnlocked, rewardFor, type CosmeticKind } from "@/lib/pit/cosmetics";
import type { BotLook, GarageLook, Slot, StoreCard } from "@/lib/pit/types";
import { BotPortrait, useBotLook } from "./bot-portrait";
import { KeyLadder } from "./key-ladder";
import { ScoreInputs } from "./score-card";
import { canEnterBay, LockedBay } from "./bay-lock";
import { Btn, Field, GradeRow, SectionLabel, StatStrip, TextInput } from "./bits";
import { ScrimmagePanel } from "./scrimmage-panel";
import { SpyPanel } from "./spy-panel";
import { StreakBadge } from "./streak-badge";

const SLOTS: Slot[] = ["chassis", "drive", "weapon", "armor", "utility", "brain"];

export function GaragePage({ storeId }: { storeId: string }) {
  const data = usePit();
  const store = data.stores.find((s) => s.id === storeId);
  const signCaptain = usePit((s) => s.signCaptain);
  const lockStore = usePit((s) => s.lockStore);
  const setDraftPart = usePit((s) => s.setDraftPart);
  const updateCard = usePit((s) => s.updateCard);
  const nameMvp = usePit((s) => s.nameMvp);
  const renameCrew = usePit((s) => s.renameCrew);
  const addCrew = usePit((s) => s.addCrew);
  const removeCrew = usePit((s) => s.removeCrew);
  const acceptProposal = usePit((s) => s.acceptProposal);
  const dismissProposal = usePit((s) => s.dismissProposal);
  const repairSlot = usePit((s) => s.repairSlot);
  const [code, setCode] = useState("");
  const [hire, setHire] = useState("");
  const [openSlot, setOpenSlot] = useState<Slot | null>(null);

  if (!store) return <p>That bay does not exist.</p>;
  if (!canEnterBay(data, storeId)) return <LockedBay storeId={storeId} />;
  const bot = data.bots.find((b) => b.storeId === storeId);
  if (!bot) return null;
  const card = cardFor(data, storeId);
  const see = canSeeLoadout(data, storeId);
  const captain = data.session.role === "commissioner" || (data.session.role === "captain" && data.session.storeId === storeId);
  const crewHere = (data.session.role === "crew" || captain) && (data.session.role === "commissioner" || data.session.storeId === storeId);
  const loadout = bot.locked ?? bot.draft;
  const grades = card ? gradesOf(card) : null;
  const printed = grades ? printedStats(bot, loadout, weekQuality(grades)) : null;
  const showStats = Boolean(printed && (data.phase !== "open" || see));
  // Once a part is fixed its bill goes away.
  const quotes = (data.phase === "inspected" || data.phase === "complete" ? quotesForBot(bot, wonThisWeek(data, storeId)) : data.quotes[storeId] ?? []).filter(
    (q) => (bot.partWear[q.partId] ?? "clean") !== "clean",
  );
  const crew = data.crew.filter((c) => c.storeId === storeId);
  const proposals = data.proposals.filter((p) => p.storeId === storeId);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5" data-testid={`garage-${storeId}`}>
      <BuildLockBanner storeId={storeId} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel>{store.region} bay</SectionLabel>
          <h1 className="font-display text-4xl leading-tight md:text-5xl">{store.name}</h1>
          {store.teamName ? <p className="mt-1 font-display text-xl text-amber [overflow-wrap:anywhere]">Team {store.teamName}</p> : null}
          <p className="mt-2 text-muted">
            {see ? bot.name : "Bot under the tarp"} · {CLASS_META[bot.classId].label} · Captain {store.captain}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/shop/$storeId" params={{ storeId }} className="inline-flex min-h-11 items-center border border-line px-4 font-display text-sm tracking-wide uppercase">
            Shop
          </Link>
          <Link to="/stores/$storeId" params={{ storeId }} className="inline-flex min-h-11 items-center border border-line px-4 font-display text-sm tracking-wide uppercase">
            Public card
          </Link>
        </div>
      </div>

      <div className="h-2" style={{ background: paintHex(store.paint) }} />

      <section className={`relative overflow-hidden border border-line ${garageClass(store.garage)}`} data-testid="bay-decor">
        <div className="absolute inset-0 bg-deep/60" />
        <div className="relative flex items-end justify-between gap-3 p-4">
          <div>
            <p className="text-xs tracking-widest text-amber uppercase">Bay {bot.number || "—"}</p>
            <p className="font-display text-4xl leading-none">{bot.name}</p>
            <p className="mt-1 text-sm text-muted">
              {lookLabel(bot.look)} · {garageLabel(store.garage)} floor
            </p>
          </div>
          <GarageBot storeId={storeId} />
        </div>
      </section>

      <CosmeticTheme storeId={storeId} />
      <WearSummary storeId={storeId} />
      <CosmeticBoard storeId={storeId} captain={captain} />
      <DecoratePanel key={storeId} storeId={storeId} proposalMode={!captain} />
      <EffectLockerPreview storeId={storeId} canBuy={captain} />

      <section className="grid gap-3 md:grid-cols-4">
        <Meter label="Coins" value={`${Object.values(bot.coins).reduce((a, b) => a + b, 0)}`} hint="Across all six jars. Each jar only buys its own part." />
        <Meter label="Repair voucher" value={`${bot.voucher}`} hint="Last-place money. Fixes any part." />
        <Meter label="Class" value={CLASS_META[bot.classId].chassis} hint={CLASS_META[bot.classId].blurb} />
        <Meter label="Lock" value={bot.locked ? "Locked" : "Still drafting"} hint={bot.locked ? "Frozen until the commissioner overrides." : "One lock. Then the cage."} />
      </section>

      <section>
        <div className="mb-2 flex items-end justify-between gap-3">
          <SectionLabel>Coin jars</SectionLabel>
          <Link to="/shop/$storeId" params={{ storeId }} className="text-sm text-amber">
            Open the shop →
          </Link>
        </div>
        <KeyLadder coins={bot.coins} />
        <p className="mt-2 text-xs text-muted">Each number pays its part&apos;s jar every Monday: green 3, blue 2, orange 1, red 0. Sport parts cost 3, Pro 5, Super 8. Repairs come out of the same jar.</p>
      </section>

      {showStats && printed ? <StatStrip {...printed.stats} /> : <p className="text-sm text-muted">Power, Speed, Armor, and Heat print when the bot locks Saturday.</p>}

      <section className="grid gap-3 md:grid-cols-2">
        {SLOTS.map((slot) => {
          const id = loadout[slot];
          const part = id ? partById(id) : undefined;
          const cond = bot.wear[slot];
          return (
            <button
              key={slot}
              type="button"
              data-testid={slot === "weapon" ? `slot-weapon-${storeId}` : undefined}
              className="border border-line bg-surface p-4 text-left"
              onClick={() => setOpenSlot(openSlot === slot ? null : slot)}
            >
              <p className="text-xs tracking-widest text-muted uppercase">{SLOT_LABEL[slot]}</p>
              {see ? (
                <>
                  <p className="font-display text-2xl leading-none">{part?.name ?? "Empty"}</p>
                  <p className="mt-1 text-sm text-amber">{part ? part.tier : "—"} · {cond}</p>
                  {part ? <p className="mt-2 text-sm text-muted">{part.job}</p> : <p className="mt-2 text-sm text-muted">Utility can stay empty.</p>}
                </>
              ) : (
                <p className="font-display text-2xl leading-none">Under the tarp</p>
              )}
            </button>
          );
        })}
      </section>

      {openSlot && see && captain && !bot.locked ? (
        <section className="border border-amber bg-deep p-4">
          <p className="font-display text-xl">{SLOT_LABEL[openSlot]} in the cage</p>
          <div className="mt-3 flex flex-col gap-2">
            {openSlot === "utility" ? (
              <Btn tone="line" onClick={() => setDraftPart(storeId, "utility", null)}>
                Run empty
              </Btn>
            ) : null}
            {partsFor(openSlot, bot.classId)
              .filter((part) => part.tier === "stock" || bot.owned.includes(part.id))
              .filter((part) => !part.classLock || part.classLock === bot.classId || data.week > 1)
              .map((part) => (
                <button
                  key={part.id}
                  type="button"
                  className="min-h-11 border border-line px-3 text-left"
                  onClick={() => setDraftPart(storeId, openSlot, part.id)}
                >
                  <span className="font-medium">{part.name}</span>
                  <span className="ml-2 text-xs tracking-widest text-amber uppercase">{part.tier}</span>
                  <span className="mt-1 block text-sm text-muted">{part.job}</span>
                </button>
              ))}
          </div>
          {!shopOpen(data) ? <p className="mt-3 text-sm text-muted">The Desk applies Period 11 colors to open the first shop. Later weeks open after Monday&apos;s payout.</p> : null}
        </section>
      ) : null}

      {!captain ? (
        <section className="border border-line bg-surface p-4">
          <SectionLabel>Captain clipboard</SectionLabel>
          <p className="mt-2 text-sm text-muted">You are in as pit crew. Enter the bay code again to take the captain&apos;s clipboard.</p>
          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              signCaptain(storeId, code);
            }}
          >
            <TextInput
              data-testid="lock-passcode"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Passcode"
              aria-label="Bay code"
            />
            <Btn type="submit">Enter</Btn>
          </form>
        </section>
      ) : (
        <section className="flex flex-wrap gap-2">
          <Btn testId="lock-button" onClick={() => lockStore(storeId)} disabled={Boolean(bot.locked) || (data.phase !== "open" && data.phase !== "locked")}>
            {bot.locked ? "Locked" : "Lock for Monday"}
          </Btn>
          <p className="self-center text-sm text-muted">{store.captain} is on the clipboard.</p>
        </section>
      )}

      {see ? <SpyPanel storeId={storeId} /> : null}
      {see ? (
        <ScrimmagePanel storeId={storeId} />
      ) : (
        <p className="text-sm text-muted">Sign in with the bay code to test this build against the house drills. The tape does not damage the bot.</p>
      )}

      {card && captain ? <CardForm storeId={storeId} card={card} frozen={data.phase !== "open" && data.session.role !== "commissioner"} onChange={(patch) => updateCard(storeId, patch)} /> : null}
      {card && !captain ? (
        <section className="border border-line p-4">
          <SectionLabel>This week's card</SectionLabel>
          <div className="mt-3">
            <GradeRow card={card} />
          </div>
        </section>
      ) : null}

      {quotes.length ? (
        <section className="border border-line p-4">
          <SectionLabel>Repair quotes</SectionLabel>
          <ul className="mt-3 flex flex-col gap-3">
            {quotes.map((quote) => (
              <li key={quote.slot} className="border border-line bg-deep p-3" data-testid={storeId === "allen" && quote.slot === "weapon" ? "allen-weapon-quote" : undefined}>
                <p className="font-display text-xl">{quote.partName} · {quote.condition}</p>
                <p className="mt-1 text-sm text-muted">{quote.line}</p>
                {captain ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Btn tone="line" onClick={() => repairSlot(storeId, quote.slot, "full")}>
                      Repair {quote.repairCost}
                    </Btn>
                    {quote.weldCost ? (
                      <Btn tone="line" onClick={() => repairSlot(storeId, quote.slot, "weld")}>
                        Weld {quote.weldCost}
                      </Btn>
                    ) : null}
                    {quote.salvageScrap ? (
                      <Btn tone="ghost" onClick={() => repairSlot(storeId, quote.slot, "salvage")}>
                        Salvage +{quote.salvageScrap} coins
                      </Btn>
                    ) : null}
                    {quote.crown ? (
                      <Btn onClick={() => repairSlot(storeId, quote.slot, "crown")}>Crown the wreck</Btn>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="border border-line p-4" data-testid="staff-editor">
        <SectionLabel>Pit crew</SectionLabel>
        <p className="mt-2 text-sm text-muted">Names on the titantron. Every specialist here counts toward Pit Week and the Full Tune-Up.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {crew.map((member) => (
            <li key={member.id} className="border border-line px-3 py-2">
              {captain ? (
                <TextInput
                  aria-label={`${member.role} name`}
                  defaultValue={member.name}
                  key={`${member.id}-${member.name}`}
                  onBlur={(e) => renameCrew(member.id, e.target.value)}
                />
              ) : (
                <span className="block py-2">
                  {member.name}
                  <StreakBadge crewId={member.id} />
                </span>
              )}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs tracking-widest text-muted uppercase">
                  {member.role}
                  {captain ? <StreakBadge crewId={member.id} /> : null}
                </span>
                <span className="flex gap-2">
                  {captain && member.role === "specialist" && crew.filter((c) => c.role === "specialist").length > 1 ? (
                    <button type="button" className="min-h-11 text-sm text-bad" onClick={() => removeCrew(storeId, member.id)}>
                      Remove
                    </button>
                  ) : null}
                  {captain ? (
                    <button type="button" className="min-h-11 text-sm text-amber" onClick={() => nameMvp(storeId, member.id)}>
                      Name MVP
                    </button>
                  ) : null}
                </span>
              </div>
            </li>
          ))}
        </ul>
        {captain && crew.filter((c) => c.role === "specialist").length < 8 ? (
          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              addCrew(storeId, hire);
              setHire("");
            }}
          >
            <TextInput value={hire} onChange={(e) => setHire(e.target.value)} placeholder="Specialist name" aria-label="New specialist" />
            <Btn type="submit">Add to the clock</Btn>
          </form>
        ) : null}
      </section>

      {proposals.length && (captain || crewHere) ? (
        <section className="border border-line p-4">
          <SectionLabel>Proposals</SectionLabel>
          <ul className="mt-3 flex flex-col gap-2">
            {proposals.map((proposal) => {
              const part = partById(proposal.partId);
              return (
                <li key={proposal.id} className="border border-line p-3">
                  <p>
                    {proposal.crewName} wants {part?.name}
                  </p>
                  <p className="text-sm text-muted">{proposal.note}</p>
                  {captain ? (
                    <div className="mt-2 flex gap-2">
                      <Btn tone="line" onClick={() => acceptProposal(proposal.id)}>
                        Bolt it on
                      </Btn>
                      <Btn tone="ghost" onClick={() => dismissProposal(proposal.id)}>
                        Dismiss
                      </Btn>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {captain && openSlot ? null : null}
      <p className="text-xs text-muted">
        {grades ? `Week quality is the range. The lock decides where ${bot.name} lands inside it.` : ""}
        {openSlot && partById(loadout[openSlot] ?? "") ? "" : ""}
        {captain && shopOpen(data) && openSlot ? buyHint(data, storeId, loadout[openSlot]) : ""}
      </p>
    </div>
  );
}

function buyHint(data: PitState, storeId: string, partId: string | null) {
  if (!partId) return "";
  const part = partById(partId);
  if (!part) return "";
  return buyCheck(data, storeId, part).reason;
}

function Meter({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="border border-line bg-surface p-3">
      <p className="text-xs tracking-widest text-muted uppercase">{label}</p>
      <p className="font-display text-2xl leading-none">{value}</p>
      <p className="mt-2 text-xs text-muted">{hint}</p>
    </div>
  );
}

function CardForm({
  storeId,
  card,
  frozen,
  onChange,
}: {
  storeId: string;
  card: StoreCard;
  frozen: boolean;
  onChange: (patch: Partial<StoreCard>) => void;
}) {
  return (
    <section className="border border-line bg-surface p-4">
      <SectionLabel>Weekly store card</SectionLabel>
      <p className="mt-2 text-sm text-muted">Six numbers. Each one pays coins to one part of the bot: green 3, blue 2, orange 1, red 0.</p>
      <div className="mt-3">
        <GradeRow card={card} />
      </div>
      <div className="mt-4">
        <ScoreInputs card={card} disabled={frozen} onChange={onChange} />
      </div>
      {card.projected ? <p className="mt-3 text-sm text-amber">House projection. The desk clicks in the official colors Sunday, before Monday's fights.</p> : null}
      <p className="mt-2 text-xs text-muted" data-testid={`card-${storeId}`}>
        NSNU → chassis · Conv → armor · Demo Rate → drive · Demo Close → weapon · Arch Supports → utility · Demo Ticket → brain.
      </p>
    </section>
  );
}

function Num({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <Field label={label} hint={hint}>
      <TextInput
        type="number"
        disabled={disabled}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </Field>
  );
}

const GARAGES: { id: GarageLook; label: string }[] = [
  { id: "hazard", label: "Hazard" },
  { id: "concrete", label: "Concrete" },
  { id: "night", label: "Night" },
  { id: "bone", label: "Bone" },
  { id: "checker", label: "Checker" },
];

const LOOKS: { id: BotLook; label: string }[] = [
  { id: "plain", label: "Plain" },
  { id: "stripe", label: "Stripe" },
  { id: "chevron", label: "Chevron" },
  { id: "rivets", label: "Rivets" },
];

function garageClass(look: GarageLook) {
  return `garage-${look}`;
}

function garageLabel(look: GarageLook) {
  return GARAGES.find((row) => row.id === look)?.label ?? "Concrete";
}

function lookLabel(look: BotLook) {
  return LOOKS.find((row) => row.id === look)?.label ?? "Plain";
}

function GarageBot({ storeId }: { storeId: string }) {
  const look = useBotLook(storeId);
  return (
    <span data-bot-hover className="block h-36 w-40 max-w-full shrink md:h-44 md:w-80">
      <BotPortrait look={look} facing={-1} className="h-full w-full" />
    </span>
  );
}

const OwnedOnly = createContext(false);

function Swatch({
  color,
  active,
  label,
  onClick,
  glow,
  disabled = false,
  title,
}: {
  color: string;
  active: boolean;
  label: string;
  onClick: () => void;
  glow?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  const ownedOnly = useContext(OwnedOnly);
  const [inspect, setInspect] = useState(false);
  if (disabled && ownedOnly) return null;
  return (<>
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      data-locked={disabled || undefined}
      title={title ?? label}
      className={`relative min-h-11 min-w-11 border-2 transition-transform ${disabled ? "cursor-help opacity-70" : "hover:scale-105"} ${active ? "border-amber" : "border-line"}`}
      style={{ background: color, boxShadow: glow && !disabled ? `0 0 12px ${color}` : undefined }}
      onClick={() => disabled ? setInspect(true) : onClick()}
    >
      {active ? <span className="absolute inset-0 grid place-items-center font-display text-lg text-deep mix-blend-difference">✓</span> : null}
      {disabled ? <span className="absolute inset-0 grid place-items-center bg-deep/55 font-display text-[9px] tracking-widest text-fg">LOCK</span> : null}
    </button>
    {inspect ? <Modal title="Unlock requirement" onClose={() => setInspect(false)}><div className="w-full max-w-sm border border-line bg-surface p-5"><h3 className="font-display text-2xl">Unlock requirement</h3><p className="mt-3 leading-relaxed text-muted">{title}</p><p className="mt-3 text-xs text-amber">Keep building your crew’s progress. Locked cosmetics cannot be equipped.</p><button type="button" className="mt-4 min-h-11 border border-line px-4" onClick={() => setInspect(false)}>Close</button></div></Modal> : null}
    </>);

}

function Chip({
  active,
  onClick,
  children,
  disabled = false,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  const ownedOnly = useContext(OwnedOnly);
  const [inspect, setInspect] = useState(false);
  if (disabled && ownedOnly) return null;
  return (<>
    <button
      type="button"
      aria-pressed={active}
      data-locked={disabled || undefined}
      title={title}
      className={`min-h-11 border px-3 font-display text-sm tracking-wide uppercase transition-colors ${disabled ? "cursor-help border-line text-muted opacity-70" : active ? "border-amber bg-amber/10 text-amber" : "border-line hover:border-muted"}`}
      onClick={() => disabled ? setInspect(true) : onClick()}
    >
      {children}
    </button>
    {inspect ? <Modal title="Unlock requirement" onClose={() => setInspect(false)}><div className="w-full max-w-sm border border-line bg-surface p-5"><h3 className="font-display text-2xl">Unlock requirement</h3><p className="mt-3 leading-relaxed text-muted">{title}</p><p className="mt-3 text-xs text-amber">Keep building your crew’s progress. Locked cosmetics cannot be equipped.</p><button type="button" className="mt-4 min-h-11 border border-line px-4" onClick={() => setInspect(false)}>Close</button></div></Modal> : null}
    </>);

}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return <details className="border border-line bg-deep/35" open={undefined}>
    <summary className="min-h-12 cursor-pointer px-3 py-3 font-display text-sm tracking-widest text-fg uppercase">{label}</summary>
    <div className="flex flex-wrap gap-2 border-t border-line p-3">{children}</div>
  </details>;
}

function DecoratePanel({ storeId, proposalMode }: { storeId: string; proposalMode: boolean }) {
  const data = usePit();
  const activeStore = data.stores.find(row => row.id === storeId)!;
  const activeBot = data.bots.find(row => row.storeId === storeId)!;
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [draft, setDraft] = useState<CosmeticLoadout | null>(null);
  const [camera, setCamera] = useState<"left" | "right" | "top">("left");
  const live = { paint: activeStore.paint, look: activeBot.look, number: activeBot.number, style: styleOf(activeBot, activeBot.classId) };
  const current = proposalMode ? (draft ?? live) : live;
  const store = { ...activeStore, paint: current.paint };
  const bot = { ...activeBot, look: current.look, number: current.number, style: current.style };
  const style = styleOf(bot, bot.classId);
  const baseLook = useBotLook(storeId);
  const look = baseLook ? { ...baseLook, paint: current.paint, look: current.look, number: current.number, style } : null;
  const setPaint = (_: string, paint: string) => proposalMode ? setDraft({ ...current, paint }) : data.setPaint(storeId, paint);
  const setLook = (_: string, look: BotLook) => proposalMode ? setDraft({ ...current, look }) : data.setLook(storeId, look);
  const setNumber = (_: string, number: string) => proposalMode ? setDraft({ ...current, number }) : data.setNumber(storeId, number);
  const setStyle = (_: string, patch: Partial<typeof style>) => proposalMode ? setDraft({ ...current, style: { ...style, ...patch } }) : data.setStyle(storeId, patch);
  const setGarage = data.setGarage;
  const progress = cosmeticProgress(data, storeId);
  const earnedCount = progress.filter((row) => row.earned).length;
  const nextRewards = progress
    .filter((row) => !row.earned)
    .sort((a, b) => b.current / b.target - a.current / a.target || a.target - b.target)
    .slice(0, 6);
  const unlocked = (kind: CosmeticKind, value: string) => cosmeticUnlocked(data, storeId, kind, value);
  const lockTitle = (kind: CosmeticKind, value: string) => {
    if (kind === "body") {
      if (["viper", "fortress", "phantom"].includes(value)) return "Earn one Full Tune-Up";
      if (["warhawk", "colossus", "reaper"].includes(value)) return "Reach Championship Saturday";
      if (data.week === 1) return "Starter shell is locked after your first choice until Week 1 ends";
      return "Starter shell";
    }
    const reward = rewardFor(kind, value);
    if (!reward) return "Locked";
    const row = progress.find((item) => item.reward.id === reward.id);
    return row
      ? `${reward.requirement} · ${Math.min(row.current, row.target)}/${row.target}`
      : reward.requirement;
  };
  const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!;
  const availablePaint = Object.keys(PAINT).filter((key) => unlocked("paint", key));
  const availableFinish = FINISHES.filter((row) => unlocked("finish", row.id));
  const availableDecal = DECALS.filter((row) => unlocked("decal", row.id));
  const availableTrim = Object.keys(TRIM).filter((key) => unlocked("trim", key));
  const availableEye = Object.keys(EYES).filter((key) => unlocked("eye", key));
  const availableTopper = TOPPERS.filter((row) => unlocked("topper", row.id));
  const surprise = () => {
    if (proposalMode) {
      setDraft({ ...current, paint: pick(availablePaint), look: pick(LOOKS).id, style: { ...style, finish: pick(availableFinish).id, trim: pick(availableTrim), eye: pick(availableEye), topper: pick(availableTopper).id, stickers: { left: pick(availableDecal).id, right: pick(availableDecal).id, hood: pick(availableDecal).id, rear: pick(availableDecal).id } } });
      return;
    }
    if (availablePaint.length) setPaint(storeId, pick(availablePaint));
    setLook(storeId, pick(LOOKS).id);
    setStyle(storeId, {
      finish: pick(availableFinish).id,
      decal: pick(availableDecal).id,
      trim: pick(availableTrim),
      eye: pick(availableEye),
      topper: pick(availableTopper).id,
      flag: Math.random() > 0.4,
    });
  };

  return (<OwnedOnly.Provider value={ownedOnly}>
    <section className="border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <SectionLabel>Bot Locker · {proposalMode ? "draft a crew proposal" : "earn the look"}</SectionLabel>
          <p className="text-sm text-muted">Jobs, Sparks, Mystery Crates, picks and wins unlock more looks. Cosmetics never change Power, Speed, Armor, Heat, HP or fight odds.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">{earnedCount}/{progress.length} achievement unlocks</span>
          <Btn tone="line" onClick={surprise}>Surprise me</Btn>
          {proposalMode ? <Btn onClick={() => data.proposeCosmetic(storeId, current)}>Submit look for voting</Btn> : null}
        </div>
      </div>

      <LockerIdentity key={storeId} storeId={storeId} />
      {nextRewards.length ? (
        <div className="border-b border-line bg-deep/60 p-4">
          <p className="text-xs tracking-widest text-amber uppercase">Closest unlocks</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {nextRewards.map(({ reward, current, target }) => {
              const pct = Math.min(100, Math.round((current / target) * 100));
              return (
                <div key={reward.id} className="border border-line bg-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-lg">{reward.label}</span>
                    <span className="text-xs text-muted">{Math.min(current, target)}/{target}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{reward.requirement}</p>
                  <span className="mt-2 block h-1.5 bg-deep">
                    <span className="block h-full bg-amber" style={{ width: `${pct}%` }} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div data-bot-hover tabIndex={0} aria-label="Bot preview; focus to rev" className={`relative h-64 overflow-hidden border border-line md:h-72 ${garageClass(store.garage)}`}>
            <div className="absolute inset-0 bg-deep/55" />
            <BotPortrait look={look ? { ...look, weapon: look.weapon === "hidden" ? "none" : look.weapon } : null} facing={camera === "right" ? 1 : -1} camera={camera === "top" ? "top" : "side"} zoom={0.74} className="relative h-full w-full" />
          </div>
          <p className="mt-2 text-xs text-muted">Hover or focus the preview to rev it. Open a category; tap any locked item to see its requirement.</p>
          <div className="mt-2 flex flex-wrap gap-2">{(["left", "right", "top"] as const).map(view => <Chip key={view} active={camera === view} onClick={() => setCamera(view)}>{view} view</Chip>)}</div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="border border-line bg-deep p-3"><p className="text-xs tracking-widest text-amber uppercase">Current look</p><p className="mt-1 text-sm">{style.body} · {store.paint} · {style.finish} · #{bot.number || "—"}</p><p className="mt-1 text-xs text-muted">{style.trim} trim · {style.eye} visor · {style.topper ?? "none"} topper</p></div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={ownedOnly} onChange={e => setOwnedOnly(e.target.checked)} className="h-5 w-5 accent-amber"/>Show owned / unlocked items only</label>
          <Group label="Body shell">
            {BODY_STYLES.filter((row) => row.classId === bot.classId).map((row) => {
              const open = unlocked("body", row.id);
              return (
                <Chip
                  key={row.id}
                  active={style.body === row.id}
                  disabled={!open}
                  title={open ? row.note : lockTitle("body", row.id)}
                  onClick={() => setStyle(storeId, { body: row.id })}
                >
                  {row.label}{!open ? " 🔒" : ""}
                </Chip>
              );
            })}
          </Group>

          <Group label="Paint">
            {Object.keys(PAINT).map((key) => {
              const open = unlocked("paint", key);
              return (
                <Swatch
                  key={key}
                  color={paintHex(key)}
                  active={store.paint === key}
                  label={`${key} paint`}
                  disabled={!open}
                  title={open ? `${key} paint` : lockTitle("paint", key)}
                  onClick={() => setPaint(storeId, key)}
                />
              );
            })}
          </Group>

          <Group label="Finish">
            {FINISHES.map((row) => {
              const open = unlocked("finish", row.id);
              return (
                <Chip key={row.id} active={style.finish === row.id} disabled={!open} title={open ? row.note : lockTitle("finish", row.id)} onClick={() => setStyle(storeId, { finish: row.id })}>
                  {row.label}{!open ? " 🔒" : ""}
                </Chip>
              );
            })}
          </Group>

          {([['left','Left armor'],['right','Right armor'],['hood','Top / hood'],['rear','Rear panel']] as [StickerSlot,string][]).map(([slot,label]) => (
            <Group key={slot} label={label + ' sticker'}>
              {DECALS.map(row => {
                const open = unlocked('decal', row.id);
                return <Chip key={row.id} active={style.stickers?.[slot] === row.id} disabled={!open} title={open ? row.label : lockTitle('decal',row.id)} onClick={() => proposalMode ? setStyle(storeId, { stickers: { ...style.stickers!, [slot]: row.id } }) : data.setSticker(storeId, slot, row.id)}>{row.label}{!open ? ' 🔒' : ''}</Chip>;
              })}
            </Group>
          ))}

          <Group label="Stripes & panels">
            {LOOKS.map((row) => (
              <Chip key={row.id} active={bot.look === row.id} onClick={() => setLook(storeId, row.id)}>
                {row.label}
              </Chip>
            ))}
          </Group>

          <Group label="Trim">
            {Object.entries(TRIM).map(([key, hex]) => {
              const open = unlocked("trim", key);
              return (
                <Swatch key={key} color={hex} active={style.trim === key} label={`${key} trim`} disabled={!open} title={open ? `${key} trim` : lockTitle("trim", key)} onClick={() => setStyle(storeId, { trim: key })} />
              );
            })}
          </Group>

          <Group label="Eyes / visor">
            {Object.entries(EYES).map(([key, hex]) => {
              const open = unlocked("eye", key);
              return (
                <Swatch key={key} color={hex} glow active={style.eye === key} label={`${key} eye`} disabled={!open} title={open ? `${key} visor` : lockTitle("eye", key)} onClick={() => setStyle(storeId, { eye: key })} />
              );
            })}
          </Group>

          <Group label="Topper">
            {TOPPERS.map((row) => {
              const open = unlocked("topper", row.id);
              return (
                <Chip key={row.id} active={(style.topper ?? "none") === row.id} disabled={!open} title={open ? row.label : lockTitle("topper", row.id)} onClick={() => setStyle(storeId, { topper: row.id })}>
                  {row.label}{!open ? " 🔒" : ""}
                </Chip>
              );
            })}
          </Group>

          <Group label="Flag">
            <Chip active={style.flag} onClick={() => setStyle(storeId, { flag: true })}>Flag up</Chip>
            <Chip active={!style.flag} onClick={() => setStyle(storeId, { flag: false })}>No flag</Chip>
          </Group>

          {!proposalMode ? <Group label="Garage floor">
            {GARAGES.map((row) => (
              <Chip key={row.id} active={store.garage === row.id} onClick={() => setGarage(storeId, row.id)}>{row.label}</Chip>
            ))}
          </Group> : null}

          {(["walkout", "victory"] as const).map(kind => <Group key={kind} label={kind}>
            <Chip active={!style[kind]} onClick={() => setStyle(storeId, { [kind]: "" })}>None</Chip>
            {(activeStore.unlocks ?? []).filter(id => id.startsWith(kind + '-')).map(id => <Chip key={id} active={style[kind] === id} onClick={() => setStyle(storeId, { [kind]: id })}>{id.replace(kind + '-', '')}</Chip>)}
          </Group>)}

          <div className="max-w-xs">
            <Field label="Bay number">
              <TextInput value={bot.number} aria-label="Bay number" maxLength={3} onChange={(e) => setNumber(storeId, e.target.value)} />
            </Field>
          </div>
        </div>
      </div>
    </section>
  </OwnedOnly.Provider>);
}

function WearSummary({ storeId }: { storeId: string }) {
  const bot = usePit(s => s.bots.find(b => b.storeId === storeId))!;
  const wear = Object.values(bot.wear);
  const scratched = wear.filter(w => w === 'scratched').length;
  const bent = wear.filter(w => w === 'bent').length;
  const disabled = wear.filter(w => w === 'disabled').length;
  return <section className="border border-line bg-surface p-4" data-testid="wear-summary">
    <SectionLabel>{disabled || bent > 1 ? 'Heavily damaged' : scratched || bent ? 'Battle-worn' : 'Clean'}</SectionLabel>
    <p className="mt-2 text-sm">{scratched} scratched · {bent} bent · {disabled} disabled</p>
    <p className="mt-1 text-sm text-muted">Battle history stays on the bot until repaired. Paint, stickers and crew proposals never erase damage. The Garage preview shows your unrepaired wear.</p>
  </section>;
}
