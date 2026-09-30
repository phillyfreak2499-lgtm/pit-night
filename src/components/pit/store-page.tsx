import { Link } from "@tanstack/react-router";
import { CLASS_META, partById, SLOT_LABEL } from "@/lib/pit/catalog";
import { canSeeLoadout, cardFor, loadSignature, printedStats, recordOf, weaponFamilyOf, weekQuality, gradesOf } from "@/lib/pit/engine";
import { paintHex, usePit } from "@/lib/pit/store";
import type { Slot } from "@/lib/pit/types";
import { ClassTag, GradeRow, SectionLabel, StatStrip } from "./bits";
import { BotPortrait, useBotLook } from "./bot-portrait";

const SLOTS: Slot[] = ["chassis", "drive", "weapon", "armor", "utility"];

export function StorePage({ storeId }: { storeId: string }) {
  const data = usePit();
  const store = data.stores.find((s) => s.id === storeId);
  const bot = data.bots.find((b) => b.storeId === storeId);
  if (!store || !bot) return <p>Unknown store.</p>;
  const rec = recordOf(data, storeId);
  const card = cardFor(data, storeId);
  const see = canSeeLoadout(data, storeId);
  const loadout = bot.locked ?? bot.draft;
  const grades = card ? gradesOf(card) : null;
  const printed = grades && data.phase !== "open" ? printedStats(bot, loadout, weekQuality(grades)) : null;
  const crew = data.crew.filter((c) => c.storeId === storeId);
  const mvps = data.mvps.filter((m) => m.storeId === storeId);
  const mine = data.session.storeId;
  const note =
    mine && mine !== storeId
      ? data.intel.find((row) => row.week === data.week && row.from === mine && row.target === storeId)
      : undefined;
  const freshSpy = Boolean(note && note.signature === loadSignature(loadout));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="h-2" style={{ background: paintHex(store.paint) }} />
      <SectionLabel>{store.region}</SectionLabel>
      <h1 className="font-display text-4xl leading-tight md:text-5xl">{store.name}</h1>
      <p className="mt-2 font-display text-2xl leading-tight text-muted">
        Bay {bot.number} · {bot.name}
      </p>
      <StoreBot storeId={storeId} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <ClassTag classId={bot.classId} />
        <span className="font-display text-2xl">
          {rec.w}–{rec.l}
        </span>
      </div>
      <p className="mt-3 text-muted">{CLASS_META[bot.classId].blurb}</p>
      <p className="text-sm text-muted">{CLASS_META[bot.classId].threat}</p>
      {printed ? (
        <div className="mt-4">
          <StatStrip {...printed.stats} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">Stats print when Friday locks. Parts stay hidden until the bell.</p>
      )}
      {freshSpy && note ? (
        <section className="mt-4 border border-line bg-deep p-3" data-testid="spy-note">
          <SectionLabel>Your scry</SectionLabel>
          <div className="mt-2">
            {note.guess ? (
              <p className={weaponFamilyOf(bot) === note.guess ? "text-sm text-ok" : "text-sm text-bad"}>
                {weaponFamilyOf(bot) === note.guess ? `You called ${note.guess}. That was the weapon.` : `You called ${note.guess}. That was not the weapon.`}
              </p>
            ) : null}
            {note.lines.map((line) => (
              <p key={line} className="text-sm">
                {line}
              </p>
            ))}
          </div>
        </section>
      ) : null}
      <section className="mt-5 border border-line">
        {SLOTS.map((slot) => {
          const part = loadout[slot] ? partById(loadout[slot]) : undefined;
          return (
            <div key={slot} className="flex items-center justify-between border-b border-line px-3 py-3 last:border-b-0">
              <span className="text-xs tracking-widest text-muted uppercase">{SLOT_LABEL[slot]}</span>
              <span>{see ? (part?.name ?? "Empty") : "Hidden"}</span>
            </div>
          );
        })}
      </section>
      {card ? (
        <div className="mt-4">
          <GradeRow card={card} />
        </div>
      ) : null}
      <section className="mt-6">
        <SectionLabel>Pit crew</SectionLabel>
        <ul className="mt-2">
          {crew.map((member) => (
            <li key={member.id} className="flex justify-between border-b border-line py-2">
              <span>{member.name}</span>
              <span className="text-xs tracking-widest text-muted uppercase">{member.role}</span>
            </li>
          ))}
        </ul>
        {mvps.length ? (
          <p className="mt-3 text-sm text-amber">
            MVP {mvps.map((m) => `Week ${m.week}: ${m.name}`).join(" · ")}
          </p>
        ) : null}
      </section>
      <Link to="/garage/$storeId" params={{ storeId }} className="mt-6 inline-flex min-h-11 items-center bg-amber px-4 font-display text-sm tracking-wide text-deep uppercase">
        Enter the bay
      </Link>
    </div>
  );
}

function StoreBot({ storeId }: { storeId: string }) {
  const look = useBotLook(storeId);
  return (
    <div data-bot-hover className="cage-floor relative mt-4 h-44 overflow-hidden border border-line bg-deep md:h-52">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/50" />
      <BotPortrait look={look} zoom={0.8} className="relative h-full w-full" />
    </div>
  );
}
