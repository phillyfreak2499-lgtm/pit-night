import { useEffect, useRef, useState } from "react";
import { getStoreCodes, setAccessCode } from "@/lib/pit/sync-server";
import { usePit } from "@/lib/pit/store";
import { Btn, SectionLabel, TextInput } from "./bits";

type CodeRow = { storeId: string; captain: string | null; crew: string | null };
export function DeskCodes() {
  const stores = usePit((s) => s.stores);
  const [codes, setCodes] = useState<CodeRow[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  useEffect(() => {
    const tracker = request;
    const clear = () => {
      if (document.hidden) {
        tracker.current++;
        setCodes(null);
        setRevealed(false);
        setBusy(false);
      }
    };
    document.addEventListener("visibilitychange", clear);
    return () => {
      tracker.current++;
      document.removeEventListener("visibilitychange", clear);
    };
  }, []);
  async function load() {
    const ticket = ++request.current;
    setBusy(true);
    setError("");
    try {
      const rows = await getStoreCodes();
      if (ticket === request.current && !document.hidden) {
        setCodes(rows);
        setRevealed(false);
      }
    } catch (e) {
      if (ticket === request.current)
        setError(e instanceof Error ? e.message : "Could not load codes.");
    } finally {
      if (ticket === request.current) setBusy(false);
    }
  }
  return (
    <section className="border border-line p-4" id="store-codes">
      <SectionLabel>Store access codes</SectionLabel>
      <p className="mt-2 text-sm text-muted">
        One admin code opens the Desk. Each store has separate captain and crew codes. This list is
        visible only to the Desk. Changing a store code signs that role out on every device.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn tone="line" disabled={busy} onClick={() => void load()}>
          {busy ? "Loading…" : codes ? "Refresh codes" : "Load store codes"}
        </Btn>
        {codes && (
          <Btn tone="line" onClick={() => setRevealed((v) => !v)}>
            {revealed ? "Hide codes" : "Show codes"}
          </Btn>
        )}
        {codes && (
          <Btn
            tone="ghost"
            onClick={() => {
              request.current++;
              setCodes(null);
              setRevealed(false);
              setBusy(false);
            }}
          >
            Clear from screen
          </Btn>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-bad">
          {error}
        </p>
      )}
      {codes && (
        <div className="mt-4 grid gap-3">
          {stores.map((store) => {
            const row = codes.find((c) => c.storeId === store.id);
            return (
              <div key={store.id} className="border border-line p-3">
                <h3 className="font-display text-xl">{store.name}</h3>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <StoreCode
                    name={store.name}
                    role="Captain"
                    id={`captain:${store.id}`}
                    value={row?.captain ?? null}
                    revealed={revealed}
                    onSaved={load}
                  />
                  <StoreCode
                    name={store.name}
                    role="Crew"
                    id={`bay:${store.id}`}
                    value={row?.crew ?? null}
                    revealed={revealed}
                    onSaved={load}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
function StoreCode({
  name,
  role,
  id,
  value,
  revealed,
  onSaved,
}: {
  name: string;
  role: string;
  id: string;
  value: string | null;
  revealed: boolean;
  onSaved: () => Promise<void>;
}) {
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await setAccessCode({ data: { id, code: next } });
      setNext("");
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change code.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <p className="text-xs text-muted">{role}</p>
      {value ? (
        <TextInput
          readOnly
          type={revealed ? "text" : "password"}
          value={value}
          aria-label={`${name} ${role.toLowerCase()} current code`}
          autoComplete="off"
        />
      ) : (
        <p className="my-2 text-sm text-muted">Set a new code to make it viewable here.</p>
      )}
      <form onSubmit={(e) => void save(e)} className="mt-2 flex flex-wrap gap-2">
        <TextInput
          className="min-w-0 flex-1"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={8}
          pattern="[0-9]{4,8}"
          required
          value={next}
          onChange={(e) => setNext(e.target.value)}
          aria-label={`${name} new ${role.toLowerCase()} code`}
          placeholder="New code"
        />
        <Btn type="submit" tone="line" disabled={busy || !/^\d{4,8}$/.test(next)}>
          {busy ? "Saving…" : "Save"}
        </Btn>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
