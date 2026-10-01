import { buildCard } from "@/lib/pit/engine";
import { usePit } from "@/lib/pit/store";
export function BuildLockBanner({ storeId }: { storeId: string }) {
  const data = usePit();
  const bot = data.bots.find((b) => b.storeId === storeId);
  if (!["open", "locked"].includes(data.phase) || !bot?.locked) return null;
  const lockedAt = data.weeks.find((w) => w.number === data.week)?.lockedAt;
  const card = data.storeCards.find((c) => c.storeId === storeId && c.week === data.week);
  const entered = card?.grades && Object.keys(card.grades).length === 6;
  const opponent = buildCard(data)
    .find((b) => b.storeIds.includes(storeId))
    ?.storeIds.filter((id) => id !== storeId)
    .map((id) => data.stores.find((s) => s.id === id)?.name)
    .join(" / ");
  return (
    <div
      className="border border-amber/60 bg-amber/10 px-4 py-3"
      role="status"
      data-testid="build-frozen"
    >
      <p className="font-display tracking-wide text-amber">SATURDAY LOCK — BUILD FROZEN</p>
      <p className="mt-1 text-sm">
        {lockedAt
          ? `Locked ${new Date(lockedAt).toLocaleString("en-US", { timeZone: "America/Chicago" })} Central. `
          : "Captain's loadout is locked. "}
        Sunday colors: {entered ? "entered" : "pending"}. Monday: {opponent || "bye"}.
      </p>
    </div>
  );
}
