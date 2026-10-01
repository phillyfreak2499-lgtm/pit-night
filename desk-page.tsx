import { useState } from "react";
import { paintHex, usePit } from "@/lib/pit/store";
import { Btn, Field, SectionLabel, TextInput } from "./bits";
import { ScoreInputs } from "./score-card";
import { sendThisSeason, takeLeagueSeason, useSyncStatus } from "@/lib/pit/sync";

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
              aria-label="Commissioner PIN"
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
  const updateCard = usePit((s) => s.updateCard);
  const setPasscode = usePit((s) => s.setPasscode);
  const setTagline = usePit((s) => s.setTagline);
  const setTags = usePit((s) => s.setTags);
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
      <SyncPanel />
      <TrainingSwitch />
      <HousePin />
      <section className="border border-line p-4">
        <SectionLabel>Theme</SectionLabel>
        <div className="mt-3 flex flex-col gap-2 md:flex-row">
          <TextInput value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Season theme" />
          <Btn tone="line" onClick={() => setTagline(theme)}>
            Post theme
          </Btn>
        </div>
        {data.week === 3 ? (
          <label className="mt-3 flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={meta?.tagsEnabled ?? false} onChange={(e) => setTags(3, e.target.checked)} />
            Allied tag on the grudge card
          </label>
        ) : null}
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
      <section className="border border-amber/60 bg-surface p-4">
        <SectionLabel>Official numbers · Monday morning</SectionLabel>
        <p className="mt-2 text-sm text-muted">
          Lock the bots, then type each store&apos;s official week here and run the card. Colors update as you type. Each grade pays that part&apos;s coin jar when you advance the week.
        </p>
        <div className="mt-4 flex flex-col gap-4">
          {data.stores.map((store) => {
            const card = data.storeCards.find((c) => c.storeId === store.id && c.week === data.week);
            if (!card) return null;
            return (
              <div key={store.id}>
                <p className="mb-1 flex items-center gap-2 font-display text-lg leading-none">
                  <span className="h-3 w-3" style={{ background: paintHex(store.paint) }} />
                  {store.name}
                  {card.projected ? <span className="text-xs tracking-widest text-warn uppercase">projection</span> : <span className="text-xs tracking-widest text-ok uppercase">entered</span>}
                </p>
                <ScoreInputs compact card={card} disabled={data.phase === "fought" || data.phase === "inspected" || data.phase === "complete"} onChange={(patch) => updateCard(store.id, patch)} />
              </div>
            );
          })}
        </div>
      </section>
      <section>
        <SectionLabel>Eleven stores</SectionLabel>
        <div className="mt-3 flex flex-col gap-3">
          {data.stores.map((store) => {
            const bot = data.bots.find((b) => b.storeId === store.id);
            const card = data.storeCards.find((c) => c.storeId === store.id && c.week === data.week);
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
                    <TextInput defaultValue={bot?.name} onBlur={(e) => renameBot(store.id, e.target.value)} />
                  </Field>
                  <Field label="Captain">
                    <TextInput defaultValue={store.captain} onBlur={(e) => renameCaptain(store.id, e.target.value)} />
                  </Field>
                  <Field label="Clipboard code">
                    <TextInput defaultValue={store.passcode} onBlur={(e) => setPasscode(store.id, e.target.value)} />
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
          <Btn
            tone="ghost"
            onClick={() => {
              resetSeason();
              void sendThisSeason().catch(() => undefined);
            }}
          >
            Reset season
          </Btn>
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
      <SectionLabel>House PIN</SectionLabel>
      <p className="mt-2 text-sm text-muted">Only the desk sees this. Bay codes live in the store list below. Nothing on the public side prints a code.</p>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          setPin(next);
          setNext("");
        }}
      >
        <TextInput value={next} onChange={(e) => setNext(e.target.value)} inputMode="numeric" type="password" placeholder="New PIN, 4 to 8 digits" aria-label="New house PIN" />
        <Btn type="submit" tone="line">
          Change PIN
        </Btn>
      </form>
    </section>
  );
}

function SyncPanel() {
  const sync = useSyncStatus();
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [armed, setArmed] = useState(false);
  const shared = sync.mode === "live" || sync.mode === "preview";
  const run = async (what: string, fn: () => Promise<void>) => {
    setBusy(what);
    setNote("");
    try {
      await fn();
      setNote(what === "send" ? "Every device now has this season." : "This device now matches the league.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "That did not go through.");
    } finally {
      setBusy("");
    }
  };
  return (
    <section id="sync" className="border border-line p-4">
      <SectionLabel>One season, every device</SectionLabel>
      {shared ? (
        <p className="mt-2 text-sm text-muted">
          {sync.mode === "live" ? "Live." : "Preview database (resets when the preview restarts)."} Every phone and laptop pulls the same season every few
          seconds. Two bays saving at once both land.
          {sync.lastSync ? ` Last sync ${new Date(sync.lastSync).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}.` : ""}
          {sync.error ? <span className="block text-bad">{sync.error}</span> : null}
        </p>
      ) : (
        <div className="mt-2 text-sm text-muted">
          <p className="text-warn">
            {sync.mode === "starting" ? "Checking for the league database…" : "This device only. Jobs, Sparks, picks and builds stay on the phone that made them."}
          </p>
          <p className="mt-2">To share one season with every store, connect a database in Vercel once:</p>
          <ol className="mt-1 list-decimal pl-5">
            <li>Vercel → your pit-night project → Storage → Create Database → Neon (free plan is plenty).</li>
            <li>Connect it to the project for Production. Vercel adds DATABASE_URL by itself.</li>
            <li>Redeploy. The dot at the top turns green.</li>
            <li>Open the Desk on the device with the real season first and press Send this season to everyone.</li>
          </ol>
        </div>
      )}
      {shared ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn
            tone={armed ? "spark" : "line"}
            disabled={Boolean(busy)}
            onClick={() => {
              if (!armed) {
                setArmed(true);
                setNote("This replaces the league copy for every store. Press again to send.");
                return;
              }
              setArmed(false);
              void run("send", sendThisSeason);
            }}
          >
            {busy === "send" ? "Sending…" : armed ? "Yes, replace the league copy" : "Send this season to everyone"}
          </Btn>
          <Btn tone="ghost" disabled={Boolean(busy)} onClick={() => void run("take", takeLeagueSeason)}>
            {busy === "take" ? "Pulling…" : "Take the league copy"}
          </Btn>
        </div>
      ) : null}
      {note ? <p className="mt-2 text-sm text-amber">{note}</p> : null}
    </section>
  );
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
