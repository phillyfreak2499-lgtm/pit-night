import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { CLASS_META, DECALS, EYES, FINISHES, LOCKER_PAINTS, PAINT, partById, partsFor, SLOT_LABEL, styleOf, TRIM } from "@/lib/pit/catalog";
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
import type { BotLook, GarageLook, Slot, StoreCard } from "@/lib/pit/types";
import { BotPortrait, useBotLook } from "./bot-portrait";
import { KeyLadder } from "./key-ladder";
import { ScoreInputs } from "./score-card";
import { canEnterBay, LockedBay } from "./bay-lock";
import { Btn, Field, GradeRow, SectionLabel, StatStrip, TextInput } from "./bits";
import { ScrimmagePanel } from "./scrimmage-panel";
import { SpyPanel } from "./spy-panel";

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
  const quotes = data.phase === "inspected" || data.phase === "complete" ? quotesForBot(bot, wonThisWeek(data, storeId)) : data.quotes[storeId] ?? [];
  const crew = data.crew.filter((c) => c.storeId === storeId);
  const proposals = data.proposals.filter((p) => p.storeId === storeId);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5" data-testid={`garage-${storeId}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel>{store.region} bay</SectionLabel>
          <h1 className="font-display text-4xl leading-tight md:text-5xl">{store.name}</h1>
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

      {captain ? (
        <DecoratePanel storeId={storeId} />
      ) : (
        <p className="text-sm text-muted">Decoration is on the door. It does not change the fight. The captain dresses the bay.</p>
      )}

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
        <p className="mt-2 text-xs text-muted">Each number pays its part&apos;s jar every Monday: green 3, blue 2, orange 1. Sport 3, Pro 5, Super 8. Repairs come out of the same jar.</p>
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
          {!shopOpen(data) ? <p className="mt-3 text-sm text-muted">Sport and up stay in the shop until after the first Monday fight.</p> : null}
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
              aria-label="Store passcode"
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
        <p className="mt-2 text-sm text-muted">Names on the titantron. Not a personal record. Specialists on the clock set the review cap.</p>
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
                <span className="block py-2">{member.name}</span>
              )}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs tracking-widest text-muted uppercase">{member.role}</span>
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
      <p className="mt-2 text-sm text-muted">Six numbers. Each one pays coins to one part of the bot: green 3, blue 2, orange 1.</p>
      <div className="mt-3">
        <GradeRow card={card} />
      </div>
      <div className="mt-4">
        <ScoreInputs card={card} disabled={frozen} onChange={onChange} />
      </div>
      {card.projected ? <p className="mt-3 text-sm text-amber">House projection. The desk puts the official numbers in Monday morning before the fights.</p> : null}
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
    <span data-bot-hover className="block h-36 w-60 shrink-0 md:h-44 md:w-80">
      <BotPortrait look={look} facing={-1} className="h-full w-full" />
    </span>
  );
}

function Swatch({ color, active, label, onClick, glow }: { color: string; active: boolean; label: string; onClick: () => void; glow?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`relative min-h-11 min-w-11 border-2 transition-transform hover:scale-105 ${active ? "border-amber" : "border-line"}`}
      style={{ background: color, boxShadow: glow ? `0 0 12px ${color}` : undefined }}
      onClick={onClick}
    >
      {active ? <span className="absolute inset-0 grid place-items-center font-display text-lg text-deep mix-blend-difference">✓</span> : null}
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`min-h-11 border px-3 font-display text-sm tracking-wide uppercase transition-colors ${active ? "border-amber bg-amber/10 text-amber" : "border-line hover:border-muted"}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs tracking-widest text-muted uppercase">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function DecoratePanel({ storeId }: { storeId: string }) {
  const data = usePit();
  const setPaint = usePit((s) => s.setPaint);
  const setGarage = usePit((s) => s.setGarage);
  const setLook = usePit((s) => s.setLook);
  const setNumber = usePit((s) => s.setNumber);
  const setStyle = usePit((s) => s.setStyle);
  const store = data.stores.find((s) => s.id === storeId)!;
  const bot = data.bots.find((b) => b.storeId === storeId)!;
  const style = styleOf(bot);
  const look = useBotLook(storeId);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!;
  const surprise = () => {
    setPaint(storeId, pick(Object.keys(PAINT).filter((key) => !LOCKER_PAINTS[key] || (store.unlocks ?? []).includes(LOCKER_PAINTS[key]!))));
    setLook(storeId, pick(LOOKS).id);
    setStyle(storeId, {
      finish: pick(FINISHES).id,
      decal: pick(DECALS).id,
      trim: pick(Object.keys(TRIM)),
      eye: pick(Object.keys(EYES)),
      flag: Math.random() > 0.4,
    });
  };

  return (
    <section className="border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <SectionLabel>Paint shop</SectionLabel>
          <p className="text-sm text-muted">Looks only. None of this changes Power, Speed, Armor, or Heat.</p>
        </div>
        <Btn tone="line" onClick={surprise}>
          Surprise me
        </Btn>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div data-bot-hover className={`relative h-64 overflow-hidden border border-line md:h-72 ${garageClass(store.garage)}`}>
            <div className="absolute inset-0 bg-deep/55" />
            <BotPortrait look={look ? { ...look, weapon: look.weapon === "hidden" ? "none" : look.weapon } : null} facing={-1} zoom={0.74} className="relative h-full w-full" />
          </div>
          <p className="mt-2 text-xs text-muted">Hover the preview to rev it.</p>
        </div>
        <div className="flex flex-col gap-4">
          <Group label="Paint">
            {Object.keys(PAINT)
              .filter((key) => !LOCKER_PAINTS[key] || (store.unlocks ?? []).includes(LOCKER_PAINTS[key]!))
              .map((key) => (
                <Swatch key={key} color={paintHex(key)} active={store.paint === key} label={`${key} paint`} onClick={() => setPaint(storeId, key)} />
              ))}
          </Group>
          <Group label="Finish">
            {FINISHES.map((row) => (
              <Chip key={row.id} active={style.finish === row.id} onClick={() => setStyle(storeId, { finish: row.id })}>
                {row.label}
              </Chip>
            ))}
          </Group>
          <Group label="Decal">
            {DECALS.map((row) => (
              <Chip key={row.id} active={style.decal === row.id} onClick={() => setStyle(storeId, { decal: row.id })}>
                {row.label}
              </Chip>
            ))}
          </Group>
          <Group label="Stripes">
            {LOOKS.map((row) => (
              <Chip key={row.id} active={bot.look === row.id} onClick={() => setLook(storeId, row.id)}>
                {row.label}
              </Chip>
            ))}
          </Group>
          <Group label="Trim">
            {Object.entries(TRIM).map(([key, hex]) => (
              <Swatch key={key} color={hex} active={style.trim === key} label={`${key} trim`} onClick={() => setStyle(storeId, { trim: key })} />
            ))}
          </Group>
          <Group label="Eye">
            {Object.entries(EYES).map(([key, hex]) => (
              <Swatch key={key} color={hex} glow active={style.eye === key} label={`${key} eye`} onClick={() => setStyle(storeId, { eye: key })} />
            ))}
          </Group>
          <Group label="Flag">
            <Chip active={style.flag} onClick={() => setStyle(storeId, { flag: true })}>
              Flag up
            </Chip>
            <Chip active={!style.flag} onClick={() => setStyle(storeId, { flag: false })}>
              No flag
            </Chip>
          </Group>
          <Group label="Garage floor">
            {GARAGES.map((row) => (
              <Chip key={row.id} active={store.garage === row.id} onClick={() => setGarage(storeId, row.id)}>
                {row.label}
              </Chip>
            ))}
          </Group>
          <div className="max-w-xs">
            <Field label="Bay number">
              <TextInput value={bot.number} aria-label="Bay number" maxLength={3} onChange={(e) => setNumber(storeId, e.target.value)} />
            </Field>
          </div>
        </div>
      </div>
    </section>
  );
}
