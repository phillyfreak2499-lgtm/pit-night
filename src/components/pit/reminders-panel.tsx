import { useEffect, useState } from "react";
import { reminderStatus, saveStoreEmail, sendTestReminder, setRemindersPaused } from "@/lib/pit/nudge-desk";
import { usePit } from "@/lib/pit/store";
import { Btn, SectionLabel } from "./bits";

type Status = Awaited<ReturnType<typeof reminderStatus>>;

/** Desk: the 8 a.m. store reminder emails. Addresses stay on the server. */
export function RemindersPanel() {
  const stores = usePit((s) => s.stores);
  const [status, setStatus] = useState<Status | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");

  const refresh = () =>
    reminderStatus()
      .then((s) => {
        setStatus(s);
        setDrafts(s.contacts);
      })
      .catch((e: unknown) => setNote(e instanceof Error ? e.message : "Could not load reminders."));
  useEffect(() => {
    void refresh();
  }, []);

  const run = async (key: string, task: () => Promise<string>) => {
    setBusy(key);
    setNote("");
    try {
      setNote(await task());
      await refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy("");
    }
  };

  const tick = (ok: boolean) => (ok ? "✔" : "✖");
  return (
    <section className="border border-line p-4" data-testid="reminders-panel">
      <SectionLabel>Daily store reminders</SectionLabel>
      <p className="mt-2 text-sm text-muted">
        At 8 a.m. Central on Pit Week days, each store with an address gets one short email: jobs left today, the Daily Spark, coins waiting in the Shop, and lock day. Nothing is sent when a store has nothing to do.
      </p>
      {status ? (
        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-3">
          <li>{tick(status.email.ok)} Email {status.email.ok ? "set up" : `missing ${status.email.missing.join(", ")}`}</li>
          <li>{tick(status.cronSecret)} Daily schedule secret</li>
          <li>{status.paused ? "⏸ Paused" : "▶ Running"}</li>
        </ul>
      ) : null}
      <div className="mt-3 flex flex-col gap-2">
        {stores.map((s) => (
          <div key={s.id} className="grid items-center gap-2 sm:grid-cols-[10rem_1fr_auto_auto]">
            <span className="text-sm">{s.name}</span>
            <input
              type="email"
              value={drafts[s.id] ?? ""}
              placeholder="store@example.com"
              aria-label={`${s.name} reminder email`}
              onChange={(e) => setDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
              className="min-h-11 border border-line bg-deep px-2 text-sm"
            />
            <Btn
              tone="line"
              disabled={busy !== "" || (drafts[s.id] ?? "") === (status?.contacts[s.id] ?? "")}
              onClick={() => void run(`save-${s.id}`, async () => {
                await saveStoreEmail({ data: { storeId: s.id, email: drafts[s.id] ?? "" } });
                return `${s.name} saved.`;
              })}
            >
              Save
            </Btn>
            <Btn
              tone="ghost"
              disabled={busy !== "" || !status?.contacts[s.id] || !status.email.ok}
              onClick={() => void run(`test-${s.id}`, async () => {
                const res = await sendTestReminder({ data: { storeId: s.id } });
                return `Test sent to ${res.to}.`;
              })}
            >
              Send test
            </Btn>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {status ? (
          <Btn
            tone="line"
            disabled={busy !== ""}
            onClick={() => void run("pause", async () => {
              const res = await setRemindersPaused({ data: { paused: !status.paused } });
              return res.paused ? "Reminders paused." : "Reminders running.";
            })}
          >
            {status.paused ? "Resume reminders" : "Pause reminders"}
          </Btn>
        ) : null}
        {note ? <p className="text-sm" aria-live="polite">{note}</p> : null}
      </div>
      {status?.log.length ? (
        <details className="mt-3 border border-line">
          <summary className="cursor-pointer px-3 py-2 text-sm">Recent sends ({status.log.length})</summary>
          <ul className="px-3 pb-3 text-xs text-muted">
            {status.log.map((row) => (
              <li key={`${row.day}-${row.store_id}`}>
                {row.day} · {stores.find((s) => s.id === row.store_id)?.name ?? row.store_id} · {row.status}
                {row.detail ? ` · ${row.detail}` : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
