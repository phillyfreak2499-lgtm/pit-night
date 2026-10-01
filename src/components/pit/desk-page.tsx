import { useState } from "react";
import { usePit } from "@/lib/pit/store";
import { Btn, Field, SectionLabel, TextInput } from "./bits";
import { ScoreInputs } from "./score-card";
import { GradeGrid } from "./grade-grid";
import { buildCard, gradeMetric, cardValue, coinMath, gradesOf, kickoffRank } from "@/lib/pit/engine";
import { METRICS } from "@/lib/pit/catalog";
import type { Grade, StatKey } from "@/lib/pit/types";
import { takeLeagueSeason, useSyncStatus } from "@/lib/pit/sync";
import { DeskCodes } from "./desk-codes";

export function DeskPage() {
  const data = usePit();
  const signCommissioner = usePit((s) => s.signCommissioner);
  const [pin, setPin] = useState("");
  const boss = data.session.role === "commissioner";

  if (!boss) {
    const press = (key: string) => {
      if (key === "clr") setPin("");
      else if (key === "del") setPin((p) => p.slice(0, -1));
      else setPin((p) => (p + key).slice(0, 8));
    };
    return (
      <div className="mx-auto max-w-md">
        <SectionLabel>House desk</SectionLabel>
        <h1 className="font-display text-5xl leading-none">Commissioner</h1>
        <p className="mt-3 text-sm text-muted">This clipboard runs the season. It does not belong to a salesperson.</p>
        <form
          className="control-panel mt-5 border border-line"
          onSubmit={(e) => {
            e.preventDefault();
            signCommissioner(pin);
          }}
        >
          <div className="hazard h-2" />
          <div className="flex flex-col gap-4 p-4 md:p-5">
            <div className="flex items-center justify-between">
              <span className="font-display text-xs tracking-[0.25em] text-muted uppercase">Arena control</span>
              <span className="flex items-center gap-2 font-display text-xs tracking-widest text-bad uppercase">
                <span className="live-dot h-2 w-2 rounded-full bg-bad" /> Locked
              </span>
            </div>
            <TextInput
              data-testid="desk-pin"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              inputMode="numeric"
              type="password"
              autoComplete="off"
              placeholder="ENTER PIN"
              aria-label="Admin code"
              className="lcd h-16 text-center font-display text-3xl tracking-[0.4em] placeholder:text-base placeholder:tracking-[0.3em]"
            />
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clr", "0", "del"].map((key) => (
                <button key={key} type="button" className="key min-h-14 font-display text-2xl uppercase" onClick={() => press(key)} aria-label={key === "clr" ? "Clear" : key === "del" ? "Delete" : key}>
                  {key === "clr" ? <span className="text-sm tracking-widest">Clr</span> : key === "del" ? <span className="text-sm tracking-widest">Del</span> : key}
                </button>
              ))}
            </div>
            <Btn type="submit" testId="desk-unlock">
              Unlock the desk
            </Btn>
          </div>
        </form>
      </div>
    );
  }

  return <DeskLive />;
}

function DeskLive() {
  const data = usePit();
  const lockFriday = usePit((s) => s.lockFriday);
  const runSaturday = usePit((s) => s.runSaturday);
  const dropDamage = usePit((s) => s.dropDamage);
  const advanceWeek = usePit((s) => s.advanceWeek);
  const resetSeason = usePit((s) => s.resetSeason);
  const unlockStore = usePit((s) => s.unlockStore);
  const renameBot = usePit((s) => s.renameBot);
  const renameCaptain = usePit((s) => s.renameCaptain);
  const setTagline = usePit((s) => s.setTagline);
  const houseCall = usePit((s) => s.houseCall);
  const [call, setCall] = useState("");
  const [theme, setTheme] = useState(data.tagline);
  const meta = data.weeks.find((w) => w.number === data.week);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <SectionLabel>House desk</SectionLabel>
        <h1 className="font-display text-5xl leading-none">Run the season</h1>
        <p className="mt-2 text-muted">
          Week {data.week} · {meta?.name} · {data.phase}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Btn testId="lock-friday" onClick={lockFriday}>
          Lock the bots (Sat close)
        </Btn>
        <Btn testId="run-saturday" tone="spark" onClick={runSaturday}>
          Run the card (Monday)
        </Btn>
        <Btn testId="drop-damage" tone="line" onClick={dropDamage}>
          Drop damage
        </Btn>
        <Btn testId="advance-week" tone="line" onClick={advanceWeek}>
          Advance week
        </Btn>
      </div>
      <KickoffPanel />
      <SyncPanel />
      <TrainingSwitch />
      <HousePin />
      <DeskCodes />
      <section className="border border-line p-4">
        <SectionLabel>Theme</SectionLabel>
        <div className="mt-3 flex flex-col gap-2 md:flex-row">
          <TextInput value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Season theme" />
          <Btn tone="line" onClick={() => setTagline(theme)}>
            Post theme
          </Btn>
        </div>
      </section>
      <section className="border border-line p-4">
        <SectionLabel>House call</SectionLabel>
        <div className="mt-3 flex flex-col gap-2 md:flex-row">
          <TextInput value={call} onChange={(e) => setCall(e.target.value)} placeholder="A note for every bay" aria-label="House call" />
          <Btn
            tone="line"
            onClick={() => {
              houseCall(call);
              setCall("");
            }}
          >
            Post
          </Btn>
        </div>
      </section>
      <SundayScores />
      <section>
        <SectionLabel>Eleven stores</SectionLabel>
        <div className="mt-3 flex flex-col gap-3">
          {data.stores.map((store) => {
            const bot = data.bots.find((b) => b.storeId === store.id);
            return (
              <div key={store.id} className="grid gap-2 border border-line bg-surface p-3 md:grid-cols-2">
                <div>
                  <p className="font-display text-xl leading-tight">{store.name}</p>
                  <p className="text-sm text-muted">{bot?.locked ? "Locked" : "Unlocked"} · {bot?.name}</p>
                  <button type="button" className="mt-2 min-h-11 text-sm text-amber" onClick={() => unlockStore(store.id)}>
                    Lock override
                  </button>
                </div>
                <div className="grid gap-2">
                  <Field label="Bot name">
                    <TextInput key={bot?.name} defaultValue={bot?.name} onBlur={(e) => e.target.value.trim() !== bot?.name && renameBot(store.id, e.target.value)} />
                  </Field>
                  <Field label="Captain">
                    <TextInput key={store.captain} defaultValue={store.captain} onBlur={(e) => e.target.value.trim() !== store.captain && renameCaptain(store.id, e.target.value)} />
                  </Field>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="border border-line p-4">
        <SectionLabel>Paper tape</SectionLabel>
        <ul className="mt-2 text-sm text-muted">
          {data.log.map((line, i) => (
            <li key={`${line}-${i}`}>{line}</li>
          ))}
        </ul>
        <div className="mt-4">
          <ResetSeason onReset={() => {
            resetSeason();
          }} />
        </div>
      </section>
    </div>
  );
}

function HousePin() {
  const setPin = usePit((s) => s.setPin);
  const [next, setNext] = useState("");
  return (
    <section className="border border-line p-4">
      <SectionLabel>Admin code</SectionLabel>
      <p className="mt-2 text-sm text-muted">Your one admin code opens this Desk. Changing it signs every admin session out. Store codes are managed below.</p>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          setPin(next);
          setNext("");
        }}
      >
        <TextInput value={next} onChange={(e) => setNext(e.target.value)} inputMode="numeric" type="password" placeholder="New admin code, 4 to 8 digits" aria-label="New admin code" />
        <Btn type="submit" tone="line">
          Change admin code
        </Btn>
      </form>
    </section>
  );
}

function ResetSeason({ onReset }: { onReset: () => void }) {
  const [typed, setTyped] = useState("");
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Btn tone="ghost" onClick={() => setOpen(true)}>
        Reset season…
      </Btn>
    );
  }
  return (
    <div className="flex max-w-xl flex-col gap-2 border border-bad/60 p-3">
      <p className="text-sm text-bad">
        This wipes every fight, coin, job, Spark and pick for all eleven stores, on every device. Bay codes, captains, crews and the house PIN are kept. Type RESET to confirm.
      </p>
      <TextInput value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type RESET to confirm" placeholder="RESET" />
      <div className="flex gap-2">
        <Btn
          tone="spark"
          disabled={typed.trim().toUpperCase() !== "RESET"}
          onClick={() => {
            onReset();
            setOpen(false);
            setTyped("");
          }}
        >
          Wipe the season
        </Btn>
        <Btn tone="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Btn>
      </div>
    </div>
  );
}

function SundayScores() {
  const data = usePit();
  const setGrade = usePit((s) => s.setGrade);
  const updateCard = usePit((s) => s.updateCard);
  const [typing, setTyping] = useState<string | null>(null);
  const frozen = data.phase !== "open" && data.phase !== "locked";
  const cards = data.stores.map((store) => ({ store, card: data.storeCards.find((c) => c.storeId === store.id && c.week === data.week) }));
  const doneCount = cards.filter(({ card }) => card && METRICS.every((m) => card.grades?.[m.stat])).length;
  return (
    <section id="sunday" className="border border-amber/60 bg-surface p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <SectionLabel>Sunday scorecard · week {data.week}</SectionLabel>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Click each store&apos;s color for all six numbers. Green pays 3 coins, blue 2, orange 1, red 0, into that part&apos;s jar when you advance the week. Record actual NSNU dollars as well for the standings tiebreak; this leaves your clicked colors unchanged. Click a color again to clear it. A dashed box is the house projection until you click.
          </p>
        </div>
        <p className="font-display text-2xl leading-none" data-testid="sunday-progress">
          {doneCount}<span className="text-muted">/{data.stores.length} done</span>
        </p>
      </div>
      {frozen ? <p className="mt-3 text-sm text-warn">This week&apos;s card already ran. Colors are frozen until you advance.</p> : null}
      <div className="mt-4">
        <GradeGrid
          testId="sunday-grid"
          disabled={frozen}
          rows={cards.flatMap(({ store, card }) => {
            if (!card) return [];
            const fallback = Object.fromEntries(METRICS.map((m) => [m.stat, gradeMetric(m.stat, cardValue(card, m.stat))])) as Record<StatKey, Grade>;
            return [{ id: store.id, name: store.name, paint: store.paint, grades: card.grades ?? {}, fallback, coins: coinMath(gradesOf(card)).total }];
          })}
          onPick={(storeId, stat, grade) => setGrade(storeId, stat, grade)}
          aside={(row) => (<div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs">Official NSNU $
              <input key={`${data.week}-${row.id}`} type="number" min="0" max="1000000" step="0.01" aria-label={`${row.name} official NSNU`} disabled={frozen} defaultValue={cards.find(c => c.store.id === row.id)?.card?.nsnuOfficial ? cards.find(c => c.store.id === row.id)?.card?.nsnu : ""} onBlur={e => { if (e.currentTarget.value !== "") data.setOfficialNsnu(row.id, Number(e.currentTarget.value)); }} className="w-24 border border-line bg-deep px-2 py-2" placeholder="Required" />
            </label>
            <button type="button" className="min-h-9 text-xs text-muted underline-offset-2 hover:underline" onClick={() => setTyping(typing === row.id ? null : row.id)}>
              {typing === row.id ? "Hide numbers" : "Type numbers"}
            </button></div>
          )}
        />
        {typing
          ? (() => {
              const card = data.storeCards.find((c) => c.storeId === typing && c.week === data.week);
              const store = data.stores.find((s) => s.id === typing);
              if (!card || !store) return null;
              return (
                <div className="mt-3 border border-line p-3">
                  <p className="mb-2 text-sm text-muted">Exact numbers for {store.name}. Typing a number replaces the clicked color for that metric.</p>
                  <ScoreInputs compact card={card} disabled={frozen} onChange={(patch) => updateCard(store.id, patch)} />
                </div>
              );
            })()
          : null}
      </div>
    </section>
  );
}

function KickoffPanel() {
  const data = usePit();
  const setKickoffGrade = usePit((s) => s.setKickoffGrade);
  const applyKickoff = usePit((s) => s.applyKickoff);
  const open = data.week === 1 && !data.bouts.some((b) => b.week === 1 && b.result);
  if (!open && !data.kickoff.appliedAt) return null;
  const ranked = kickoffRank(data);
  const filled = ranked.filter((r) => r.filled === METRICS.length).length;
  const preview = buildCard({ ...data, week: 1, stores: data.stores.map((s) => ({ ...s, seed: ranked.find((r) => r.store.id === s.id)?.seed ?? s.seed })) });
  const name = (id: string | undefined) => data.stores.find((s) => s.id === id)?.name ?? "";
  const ready = filled === data.stores.length;
  return (
    <section id="kickoff" className="border border-spark/60 bg-surface p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <SectionLabel>Week 1 kickoff · Period 11</SectionLabel>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Click each store&apos;s Period 11 colors. They pay the first coins, so every bay has something to spend in week 1, and they set the week 1 seeds. The top seed takes the bye; 2 fights 11, 3 fights 10, and so on.
            {data.kickoff.appliedAt ? " Already paid. Fix a color and press it again; it only pays the difference." : ""}
          </p>
        </div>
        <p className="font-display text-2xl leading-none">
          {filled}<span className="text-muted">/{data.stores.length} done</span>
        </p>
      </div>
      {open ? (
        <div className="mt-4">
          <GradeGrid
            testId="kickoff-grid"
            rows={data.stores.map((store) => ({ id: store.id, name: store.name, paint: store.paint, grades: data.kickoff.grades[store.id] ?? {} }))}
            onPick={(storeId, stat, grade) => setKickoffGrade(storeId, stat, grade)}
          />
        </div>
      ) : null}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs tracking-widest text-muted uppercase">Seeds {ready ? "" : "(so far)"}</p>
          <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {ranked.map((r) => (
              <li key={r.store.id} className="flex items-center justify-between gap-2 border border-line px-2 py-1">
                <span>
                  <span className="mr-2 font-display text-amber">{r.seed}</span>
                  {r.store.name}
                </span>
                <span className="text-muted">{r.coins} coins</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <p className="text-xs tracking-widest text-muted uppercase">Week 1 card</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {preview.map((b) => (
              <li key={b.id} className="border border-line px-2 py-1">
                <span className="mr-2 text-xs tracking-widest text-muted uppercase">{b.kind === "bye" ? "Bye" : b.title}</span>
                {b.kind === "bye" ? name(b.teamA[0]) : `${name(b.teamA[0])} vs ${name(b.teamB[0])}`}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {open ? (
        <div className="mt-4">
          <Btn testId="apply-kickoff" tone="spark" disabled={!ready} onClick={applyKickoff}>
            {data.kickoff.appliedAt ? "Update coins and seeds" : "Pay the coins and set the seeds"}
          </Btn>
          {!ready ? <p className="mt-2 text-sm text-muted">Every store needs all six colors first.</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function SyncPanel() {
  const sync = useSyncStatus();
  return <section id="sync" className="border border-line p-4">
    <SectionLabel>One season, every device</SectionLabel>
    <p className="mt-2 text-sm text-muted">Every action is checked by the league. Phones refresh from the shared season every few seconds. Wait for Saved before closing the page.</p>
    {sync.error ? <p className="mt-2 text-bad">{sync.error}</p> : null}
    <Btn tone="ghost" onClick={() => void takeLeagueSeason()}>Refresh league</Btn>
  </section>;
}

function TrainingSwitch() {
  const on = usePit((s) => s.trainingOpenAll);
  const setTrainingOpenAll = usePit((s) => s.setTrainingOpenAll);
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 border border-line p-4">
      <div className="max-w-xl">
        <SectionLabel>Pit Week days</SectionLabel>
        <p className="mt-2 text-sm text-muted">
          {on
            ? "Practice mode: every training day is open right now, whatever the date."
            : "Training days open on their dates, Tuesday through Saturday of each week. Turn this on to preview or start early."}
        </p>
      </div>
      <Btn tone={on ? "spark" : "line"} onClick={() => setTrainingOpenAll(!on)}>
        {on ? "Close to dates" : "Open every day"}
      </Btn>
    </section>
  );
}
