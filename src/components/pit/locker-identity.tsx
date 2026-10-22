import { useEffect, useState } from "react";
import { usePit } from "@/lib/pit/store";
import { Btn, Field, SectionLabel, TextInput } from "./bits";

export function LockerIdentity({ storeId }: { storeId: string }) {
  const store = usePit((s) => s.stores.find((row) => row.id === storeId))!;
  const bot = usePit((s) => s.bots.find((row) => row.storeId === storeId))!;
  const canEdit = usePit(
    (s) =>
      s.session.role === "commissioner" ||
      (s.session.role === "captain" && s.session.storeId === storeId),
  );
  const renameIdentity = usePit((s) => s.renameIdentity);
  const [botName, setBotName] = useState(bot.name);
  const [teamName, setTeamName] = useState(store.teamName ?? store.name);
  useEffect(() => {
    setBotName(bot.name);
    setTeamName(store.teamName ?? store.name);
  }, [bot.name, store.teamName, store.name]);
  return (
    <section className="border-b border-line bg-deep/40 p-4" data-testid="locker-identity">
      <SectionLabel>Your team. Your bot.</SectionLabel>
      {canEdit ? (
        <form
          className="mt-3 grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            renameIdentity(storeId, botName, teamName);
          }}
        >
          <Field label="Bot name">
            <TextInput
              aria-label="Bot name"
              value={botName}
              onChange={(event) => setBotName(event.target.value)}
              maxLength={22}
              required
            />
          </Field>
          <Field label="Team name">
            <TextInput
              aria-label="Team name"
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              maxLength={40}
              required
            />
          </Field>
          <Btn
            type="submit"
            disabled={
              !botName.trim() ||
              !teamName.trim() ||
              (botName === bot.name && teamName === (store.teamName ?? store.name))
            }
          >
            Save names
          </Btn>
        </form>
      ) : (
        <p className="mt-2 break-words text-sm">
          {store.teamName ?? store.name} · {bot.name}. Your captain can update both names here.
        </p>
      )}
      <p className="mt-2 text-xs text-muted">
        Bot: up to 22 characters. Team: up to 40. Official store: {store.name}. Names do not change
        combat stats, damage, rewards or past fight records.
      </p>
    </section>
  );
}
