import { useMemo, useState } from "react";
import { BODY_STYLES, CLASS_META, DECALS, EYES, FINISHES, PAINT, SLOT_LABEL, TOPPERS, TRIM, partById, partsFor, stockPart, tierWord } from "@/lib/pit/catalog";
import { methodLabel, playgroundTape, type PlaygroundBuild } from "@/lib/pit/engine";
import { armSound } from "@/lib/pit/sound";
import { TOPPER_IDS, type ClassId, type Grade, type Loadout, type Slot } from "@/lib/pit/types";
import { Btn, SectionLabel } from "./bits";
import { BotPortrait, type BotLookProps } from "./bot-portrait";
import { Broadcast } from "./broadcast";

const SLOTS: Slot[] = ["chassis", "drive", "weapon", "armor", "utility", "brain"];
const CLASSES: ClassId[] = ["striker", "tank", "specialist"];
const WEEKS: { id: Grade; label: string }[] = [
  { id: "green", label: "Green week" },
  { id: "blue", label: "Blue week" },
  { id: "orange", label: "Orange week" },
  { id: "red", label: "Red week" },
];
const ROUNDS: { id: number | "ko"; label: string }[] = [
  { id: 1, label: "1 round" },
  { id: 3, label: "3 rounds" },
  { id: 5, label: "5 rounds" },
  { id: 7, label: "7 rounds" },
  { id: 10, label: "10 rounds" },
  { id: "ko", label: "Until knockout" },
];
const TOPPER_LABEL: Record<string, string> = {
  ...Object.fromEntries(TOPPERS.map((t) => [t.id, t.label])),
  pilgrimhat: "Pilgrim hat",
  wreath: "Harvest wreath",
  tophat: "Top hat",
};
const nice = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");

function stockLoadout(classId: ClassId): Loadout {
  return {
    chassis: stockPart("chassis", classId).id,
    drive: stockPart("drive", classId).id,
    weapon: stockPart("weapon", classId).id,
    armor: stockPart("armor", classId).id,
    utility: null,
    brain: stockPart("brain", classId).id,
  };
}

function starter(classId: ClassId, name: string, paint: string): PlaygroundBuild {
  return {
    name,
    classId,
    loadout: stockLoadout(classId),
    style: {
      body: BODY_STYLES.find((b) => b.classId === classId)!.id,
      finish: "factory",
      decal: "none",
      stickers: { left: "none", right: "none", hood: "none", rear: "none" },
      trim: "steel",
      eye: "green",
      flag: false,
      topper: "none",
    },
    paint,
    look: "plain",
    number: "1",
    week: "blue",
  };
}

function randomBuild(name: string): PlaygroundBuild {
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;
  const classId = pick(CLASSES);
  const gear = (slot: Slot) => pick(partsFor(slot, classId)).id;
  const sticker = () => pick(DECALS).id;
  return {
    name,
    classId,
    loadout: { chassis: gear("chassis"), drive: gear("drive"), weapon: gear("weapon"), armor: gear("armor"), utility: Math.random() < 0.2 ? null : gear("utility"), brain: gear("brain") },
    style: {
      body: pick(BODY_STYLES.filter((b) => b.classId === classId)).id,
      finish: pick(FINISHES).id,
      decal: sticker(),
      stickers: { left: sticker(), right: sticker(), hood: sticker(), rear: sticker() },
      trim: pick(Object.keys(TRIM)),
      eye: pick(Object.keys(EYES)),
      flag: Math.random() < 0.5,
      topper: pick(TOPPER_IDS),
    },
    paint: pick(Object.keys(PAINT)),
    look: pick(["plain", "stripe", "chevron", "rivets"] as const),
    number: String(1 + Math.floor(Math.random() * 99)),
    week: pick(WEEKS).id,
  };
}

function lookOf(b: PlaygroundBuild, id: string): BotLookProps {
  const part = (slot: Slot) => partById(b.loadout[slot]);
  return {
    id,
    paint: b.paint,
    classId: b.classId,
    weapon: part("weapon")?.family ?? "none",
    look: b.look,
    number: b.number,
    hp: 100,
    style: b.style,
    storeName: b.name,
    brainTier: part("brain")?.tier ?? "stock",
    armorFamily: part("armor")?.family,
    driveFamily: part("drive")?.family,
    chassisFamily: part("chassis")?.family,
    utilityFamily: part("utility")?.family ?? null,
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs tracking-wide text-muted uppercase">
      {label}
      {children}
    </label>
  );
}

const SELECT = "min-h-11 w-full border border-line bg-deep px-2 text-sm normal-case tracking-normal text-fg";

function Builder({ side, build, onChange }: { side: string; build: PlaygroundBuild; onChange: (b: PlaygroundBuild) => void }) {
  const set = (patch: Partial<PlaygroundBuild>) => onChange({ ...build, ...patch });
  const setStyle = (patch: Partial<PlaygroundBuild["style"]>) => onChange({ ...build, style: { ...build.style, ...patch } });
  const changeClass = (classId: ClassId) =>
    onChange({
      ...build,
      classId,
      loadout: stockLoadout(classId),
      style: { ...build.style, body: BODY_STYLES.find((b) => b.classId === classId)!.id },
    });
  return (
    <section className="flex flex-col gap-3 border border-line bg-surface p-4" data-testid={`builder-${side}`}>
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>{side} bot</SectionLabel>
        <Btn tone="ghost" onClick={() => onChange(randomBuild(build.name))}>
          Randomize
        </Btn>
      </div>
      <div className="relative h-40 overflow-hidden border border-line bg-deep">
        <BotPortrait look={lookOf(build, `pg-${side}`)} facing={side === "Left" ? 1 : -1} className="absolute inset-0 h-full w-full" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Name">
          <input value={build.name} maxLength={18} onChange={(e) => set({ name: e.target.value })} className={SELECT} />
        </Field>
        <Field label="Fighting style">
          <select value={build.classId} onChange={(e) => changeClass(e.target.value as ClassId)} className={SELECT}>
            {CLASSES.map((c) => (
              <option key={c} value={c}>{CLASS_META[c].label}</option>
            ))}
          </select>
        </Field>
        {SLOTS.map((slot) => (
          <Field key={slot} label={SLOT_LABEL[slot]}>
            <select
              value={build.loadout[slot] ?? ""}
              onChange={(e) => set({ loadout: { ...build.loadout, [slot]: e.target.value || null } })}
              className={SELECT}
            >
              {slot === "utility" ? <option value="">Empty</option> : null}
              {partsFor(slot, build.classId)
                .filter((p) => slot !== "chassis" || !p.classLock || p.classLock === build.classId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {tierWord(p.tier)}
                  </option>
                ))}
            </select>
          </Field>
        ))}
        <Field label="This week's colors">
          <select value={build.week} onChange={(e) => set({ week: e.target.value as Grade })} className={SELECT}>
            {WEEKS.map((w) => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Body">
          <select value={build.style.body} onChange={(e) => setStyle({ body: e.target.value as PlaygroundBuild["style"]["body"] })} className={SELECT}>
            {BODY_STYLES.filter((b) => b.classId === build.classId).map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Paint">
          <select value={build.paint} onChange={(e) => set({ paint: e.target.value })} className={SELECT}>
            {Object.keys(PAINT).map((p) => (
              <option key={p} value={p}>{nice(p)}</option>
            ))}
          </select>
        </Field>
        <Field label="Finish">
          <select value={build.style.finish} onChange={(e) => setStyle({ finish: e.target.value as PlaygroundBuild["style"]["finish"] })} className={SELECT}>
            {FINISHES.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Stickers">
          <select
            value={build.style.stickers?.hood ?? "none"}
            onChange={(e) => {
              const d = e.target.value as PlaygroundBuild["style"]["decal"];
              setStyle({ decal: d, stickers: { left: d, right: d, hood: d, rear: d } });
            }}
            className={SELECT}
          >
            {DECALS.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Topper">
          <select value={build.style.topper ?? "none"} onChange={(e) => setStyle({ topper: e.target.value as PlaygroundBuild["style"]["topper"] })} className={SELECT}>
            {TOPPER_IDS.map((t) => (
              <option key={t} value={t}>{TOPPER_LABEL[t] ?? nice(t)}</option>
            ))}
          </select>
        </Field>
        <Field label="Trim">
          <select value={build.style.trim} onChange={(e) => setStyle({ trim: e.target.value })} className={SELECT}>
            {Object.keys(TRIM).map((t) => (
              <option key={t} value={t}>{nice(t)}</option>
            ))}
          </select>
        </Field>
        <Field label="Eyes">
          <select value={build.style.eye} onChange={(e) => setStyle({ eye: e.target.value })} className={SELECT}>
            {Object.keys(EYES).map((t) => (
              <option key={t} value={t}>{nice(t)}</option>
            ))}
          </select>
        </Field>
      </div>
    </section>
  );
}

/** Build any two bots, everything unlocked, and watch them fight. Nothing posts or counts. */
export function PlaygroundPage() {
  const [left, setLeft] = useState(() => starter("striker", "LEFTY", "amber"));
  const [right, setRight] = useState(() => starter("tank", "RIGHTY", "teal"));
  const [rounds, setRounds] = useState<number | "ko">(3);
  const [fight, setFight] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const [snapshot, setSnapshot] = useState<{ left: PlaygroundBuild; right: PlaygroundBuild; rounds: number | "ko" } | null>(null);
  const bout = useMemo(
    () => (snapshot ? playgroundTape([snapshot.left, snapshot.right], snapshot.rounds, `${fight}`) : null),
    [snapshot, fight],
  );
  const winner = bout?.result?.fighters.find((f) => bout.result?.winnerIds.includes(f.id));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4" data-testid="playground">
      <div>
        <SectionLabel>Playground</SectionLabel>
        <h1 className="font-display text-5xl leading-none">Build any two bots</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Everything is unlocked: every part, every body, every look. Pick the rounds and hit Fight. It&apos;s the real fight engine, but nothing here posts, pays, damages or counts.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Builder side="Left" build={left} onChange={setLeft} />
        <Builder side="Right" build={right} onChange={setRight} />
      </div>
      <div className="flex flex-wrap items-end gap-3 border border-line bg-surface p-4">
        <Field label="Rounds">
          <select value={String(rounds)} onChange={(e) => setRounds(e.target.value === "ko" ? "ko" : Number(e.target.value))} className={SELECT} data-testid="pg-rounds">
            {ROUNDS.map((r) => (
              <option key={String(r.id)} value={String(r.id)}>{r.label}</option>
            ))}
          </select>
        </Field>
        <Btn
          testId="pg-fight"
          onClick={() => {
            armSound();
            setSnapshot({ left, right, rounds });
            setFight((n) => n + 1);
            setPlaying(true);
            setDone(false);
          }}
        >
          Fight!
        </Btn>
        <Btn tone="ghost" onClick={() => { setLeft(right); setRight(left); }}>
          Swap sides
        </Btn>
      </div>
      {done && bout?.result && winner ? (
        <p className="font-display text-3xl leading-none" data-testid="pg-winner">
          {winner.botName} wins <span className="text-base text-muted">by {methodLabel(bout.result.method)} · {bout.result.exchanges.length} exchanges</span>
        </p>
      ) : null}
      {bout ? (
        <Broadcast
          key={`pg-${fight}`}
          bout={bout}
          playing={playing}
          onPlayingChange={setPlaying}
          onComplete={() => setDone(true)}
          kicker="PLAYGROUND · NOTHING COUNTS"
          noDamage
        />
      ) : null}
    </div>
  );
}
