import { useState } from "react";
import { usePit } from "@/lib/pit/store";
import { Btn, Field, SectionLabel, TextInput } from "./bits";

export function DeskPage() {
  const data = usePit();
  const signCommissioner = usePit((s) => s.signCommissioner);
  const [pin, setPin] = useState("");
  const boss = data.session.role === "commissioner";

  if (!boss) {
    return (
      <div className="mx-auto max-w-md">
        <SectionLabel>House desk</SectionLabel>
        <h1 className="font-display text-5xl leading-none">Commissioner</h1>
        <p className="mt-3 text-sm text-muted">Demo house PIN is 8472. This clipboard runs the season. It does not belong to a salesperson.</p>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            signCommissioner(pin);
          }}
        >
          <TextInput data-testid="desk-pin" value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" placeholder="PIN" aria-label="Commissioner PIN" />
          <Btn type="submit" testId="desk-unlock">
            Unlock the desk
          </Btn>
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
  const setGoal = usePit((s) => s.setGoal);
  const setProrate = usePit((s) => s.setProrate);
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
          Lock Friday
        </Btn>
        <Btn testId="run-saturday" tone="spark" onClick={runSaturday}>
          Run Saturday
        </Btn>
        <Btn testId="drop-damage" tone="line" onClick={dropDamage}>
          Drop damage
        </Btn>
        <Btn testId="advance-week" tone="line" onClick={advanceWeek}>
          Advance week
        </Btn>
      </div>
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
      <section>
        <SectionLabel>Ten stores</SectionLabel>
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
                  <Field label="Weekly NSNU goal" hint="Desk only. The floor sees percent of goal.">
                    <TextInput type="number" defaultValue={store.nsnuGoal} onBlur={(e) => setGoal(store.id, Number(e.target.value))} />
                  </Field>
                  <Field label="Goal proration" hint="1 is a full week. 0.5 cuts the goal in half.">
                    <TextInput
                      type="number"
                      step="0.25"
                      value={card?.prorate ?? 1}
                      onChange={(e) => setProrate(store.id, Number(e.target.value) || 1)}
                    />
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
          <Btn tone="ghost" onClick={resetSeason}>
            Reset season
          </Btn>
        </div>
      </section>
    </div>
  );
}
