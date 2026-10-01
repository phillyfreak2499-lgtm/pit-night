import { Link } from "@tanstack/react-router";
import { Lock, LockOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { paintHex, usePit } from "@/lib/pit/store";
import type { PitData } from "@/lib/pit/types";
import { SectionLabel } from "./bits";

/** Who may walk into a bay: that store's captain or crew, or the desk. */
export function canEnterBay(data: Pick<PitData, "session">, storeId: string) {
  const { role, storeId: mine } = data.session;
  if (role === "commissioner") return true;
  return (role === "captain" || role === "crew") && mine === storeId;
}

export function useCanEnterBay(storeId: string) {
  const session = usePit((s) => s.session);
  return canEnterBay({ session }, storeId);
}

/** Padlock badge for a door. */
export function DoorLock({ open, color }: { open: boolean; color: string }) {
  return (
    <span
      className={`grid h-10 w-10 place-items-center border-2 bg-deep/90 shadow-[0_4px_12px_rgb(0_0_0/0.6)] ${open ? "border-ok text-ok" : "text-fg"}`}
      style={open ? undefined : { borderColor: color }}
      aria-hidden
    >
      {open ? <LockOpen size={20} /> : <Lock size={20} />}
    </span>
  );
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clr", "0", "go"] as const;

/**
 * The bay keypad. Right code signs the viewer onto that store's clipboard.
 * Physical keyboards work too: digits, Backspace, Enter, Escape.
 */
export function BayKeypad({
  storeId,
  onUnlock,
  onCancel,
}: {
  storeId: string;
  onUnlock: () => void;
  onCancel?: () => void;
}) {
  const store = usePit((s) => s.stores.find((row) => row.id === storeId));
  const signCaptain = usePit((s) => s.signCaptain);
  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "bad" | "good">("idle");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  if (!store) return null;
  const color = paintHex(store.paint);

  const submit = (value = code) => {
    if (!value) return;
    if (signCaptain(storeId, value)) {
      setState("good");
      window.setTimeout(onUnlock, 380);
    } else {
      setState("bad");
      setCode("");
      window.setTimeout(() => setState("idle"), 900);
    }
  };
  const press = (key: (typeof KEYS)[number]) => {
    if (key === "clr") setCode("");
    else if (key === "go") submit();
    else {
      const next = (code + key).slice(0, 8);
      setCode(next);
    }
    inputRef.current?.focus();
  };

  return (
    <div
      className={`control-panel w-full max-w-sm border border-line ${state === "bad" ? "keypad-shake" : ""}`}
    >
      <div className="h-2" style={{ background: color }} />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-xs tracking-[0.25em] text-muted uppercase">
              {store.region} bay
            </p>
            <p className="font-display text-3xl leading-none">{store.name}</p>
          </div>
          <span
            className={`flex items-center gap-2 font-display text-xs tracking-widest uppercase ${state === "good" ? "text-ok" : "text-bad"}`}
          >
            {state === "good" ? <LockOpen size={14} /> : <Lock size={14} />}
            {state === "good" ? "Open" : "Locked"}
          </span>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            ref={inputRef}
            data-testid="lock-passcode"
            value={code}
            onChange={(e) => setCode(e.target.value.slice(0, 8))}
            onKeyDown={(e) => {
              if (e.key === "Escape") onCancel?.();
            }}
            inputMode="numeric"
            type="password"
            autoComplete="off"
            placeholder={state === "bad" ? "WRONG CODE" : "BAY CODE"}
            aria-label={`${store.name} bay code`}
            className={`lcd h-16 w-full border text-center font-display text-3xl tracking-[0.4em] outline-none placeholder:text-base placeholder:tracking-[0.3em] ${state === "bad" ? "lcd-bad" : ""}`}
          />
        </form>
        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={`key min-h-14 font-display text-2xl uppercase ${key === "go" ? "key-go" : ""}`}
              onClick={() => press(key)}
              aria-label={key === "clr" ? "Clear" : key === "go" ? "Open the bay" : key}
            >
              {key === "clr" ? (
                <span className="text-sm tracking-widest">Clr</span>
              ) : key === "go" ? (
                <span className="text-sm tracking-widest">Open</span>
              ) : (
                key
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          Four digits from your captain or the desk. Wrong codes do nothing but blink.
        </p>
      </div>
    </div>
  );
}

/** Keypad in a dialog, for the Pit Map. */
export function BayKeypadDialog({
  storeId,
  onUnlock,
  onClose,
}: {
  storeId: string;
  onUnlock: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm md:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Bay keypad"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="page-in flex w-full max-w-sm flex-col items-end gap-2">
        <button
          type="button"
          className="min-h-11 px-3 font-display text-sm tracking-widest text-muted uppercase hover:text-fg"
          onClick={onClose}
        >
          Close ✕
        </button>
        <BayKeypad storeId={storeId} onUnlock={onUnlock} onCancel={onClose} />
      </div>
    </div>
  );
}

/** Full-page locked door for garage and shop routes. */
export function LockedBay({ storeId, onUnlock }: { storeId: string; onUnlock?: () => void }) {
  const store = usePit((s) => s.stores.find((row) => row.id === storeId));
  if (!store) return <p>That bay does not exist.</p>;
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div>
        <SectionLabel>{store.region} bay</SectionLabel>
        <h1 className="font-display text-4xl leading-tight md:text-5xl">{store.name}</h1>
        <p className="mt-2 max-w-xl text-muted">
          This door is locked. The garage, the shop, and the loadout are for this store&apos;s crew.
          Everyone else gets the public card.
        </p>
      </div>
      <div className="grid items-start gap-5 md:grid-cols-[1fr_auto]">
        <div className="relative hidden h-full min-h-72 overflow-hidden border border-line md:block">
          <div className="bay-door absolute inset-0" />
          <div
            className="absolute inset-x-0 bottom-0 h-3"
            style={{ background: paintHex(store.paint) }}
          />
          <div className="absolute inset-0 grid place-items-center">
            <span
              className="grid h-24 w-24 place-items-center border-4 bg-deep/90 text-fg shadow-[0_10px_30px_rgb(0_0_0/0.7)]"
              style={{ borderColor: paintHex(store.paint) }}
            >
              <Lock size={44} />
            </span>
          </div>
        </div>
        <BayKeypad storeId={storeId} onUnlock={onUnlock ?? (() => undefined)} />
      </div>
      <Link to="/stores/$storeId" params={{ storeId }} className="text-sm text-amber">
        See {store.name}&apos;s public card →
      </Link>
    </div>
  );
}
