import { equippedScry, foesThisWeek, spyRead, weaponFamilyOf } from "@/lib/pit/engine";
import { usePit } from "@/lib/pit/store";
import { Btn, SectionLabel } from "./bits";

const CALLS = [
  ["saw", "Saw"],
  ["drum", "Drum"],
  ["wedge", "Wedge"],
  ["hammer", "Hammer"],
  ["claw", "Claw"],
  ["disc", "Disc"],
] as const;

export function SpyPanel({ storeId }: { storeId: string }) {
  const data = usePit();
  const pullSpy = usePit((s) => s.pullSpy);
  const callSpy = usePit((s) => s.callSpy);
  const bot = data.bots.find((row) => row.storeId === storeId);
  const scry = bot ? equippedScry(bot) : null;
  const captain =
    data.session.role === "commissioner" || (data.session.role === "captain" && data.session.storeId === storeId);
  const open = data.phase === "open" || data.phase === "locked";
  const foes = foesThisWeek(data, storeId);

  return (
    <section className="border border-line bg-surface p-4" data-testid="bay-spy">
      <SectionLabel>Spy</SectionLabel>
      {open ? (
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Bolt a Scry on utility. Then call the weapon family out loud. The read stays shut until that call is in. One call. It does not name the part.
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted">The bell already rang. Watch the tape.</p>
      )}
      {!scry && open ? <p className="mt-3 text-sm text-amber">Put a Scry in the utility slot to scout your opponent. Other utility parts help you fight instead.</p> : null}
      <ul className="mt-3 flex flex-col gap-3">
        {foes.map((id) => {
          const foe = data.stores.find((row) => row.id === id);
          const foeBot = data.bots.find((row) => row.storeId === id);
          const note = data.intel.find((row) => row.week === data.week && row.from === storeId && row.target === id);
          const live = scry ? spyRead(data, id, scry.tier) : null;
          const fresh = Boolean(note && note.lines.length && live && note.signature === live.signature);
          const stale = Boolean(note && note.lines.length && live && note.signature !== live.signature);
          const guess = note?.guess ?? "";
          const earned = Boolean(guess) || Boolean(note?.lines.length);
          const family = foeBot ? weaponFamilyOf(foeBot) : "";
          const hit = Boolean(guess) && guess === family;
          return (
            <li key={id} className="border border-line bg-deep p-3" data-testid={`spy-card-${id}`}>
              <p className="font-display text-xl leading-none">
                {foe?.name ?? id}
                <span className="text-muted"> · {foeBot?.name}</span>
              </p>
              {captain && open && scry && !note?.lines.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {CALLS.map(([familyId, label]) => (
                    <button
                      key={familyId}
                      type="button"
                      data-testid={`spy-call-${familyId}`}
                      className={`min-h-11 border px-3 font-display text-sm tracking-wide uppercase ${guess === familyId ? "border-amber text-amber" : "border-line text-fg"}`}
                      onClick={() => callSpy(storeId, id, familyId)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
              {guess && !fresh ? <p className="mt-3 text-sm">Call is in: {guess}.</p> : null}
              {scry && !guess && !note?.lines.length ? <p className="mt-3 text-sm text-muted">Call the weapon. That is how you earn the spy.</p> : null}
              {fresh && note ? (
                <div className="mt-3" data-testid={`spy-read-${id}`}>
                  {guess ? (
                    <p className={hit ? "text-sm text-ok" : "text-sm text-bad"}>
                      {hit ? `You called ${guess}. That was the weapon.` : `You called ${guess}. That was not the weapon.`}
                    </p>
                  ) : null}
                  {note.lines.map((line) => (
                    <p key={line} className="text-sm">
                      {line}
                    </p>
                  ))}
                  <p className="mt-2 text-xs tracking-widest text-muted uppercase">{live?.locked ? "Saturday lock" : "Still a draft"}</p>
                </div>
              ) : null}
              {stale ? <p className="mt-2 text-sm text-amber">They moved the iron. The old read is dead. Your call still stands.</p> : null}
              {captain && open ? (
                <div className="mt-3">
                  <Btn testId={`spy-${id}`} tone="line" disabled={!scry || !earned} onClick={() => pullSpy(storeId, id)}>
                    Read {foeBot?.name ?? "them"}
                  </Btn>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {open && foes.length === 0 ? <p className="mt-3 text-sm text-muted">No one is booked against this bay.</p> : null}
    </section>
  );
}
