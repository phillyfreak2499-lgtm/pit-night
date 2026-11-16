import { buildCard } from "@/lib/pit/engine";
import { usePit } from "@/lib/pit/store";
import { pendingApprovedFinale } from "@/lib/pit/period12-tape";
export function BuildLockBanner({ storeId }: { storeId: string }) {
  const data = usePit();
  if (pendingApprovedFinale(data)) return <div className="border border-amber/60 bg-amber/10 px-4 py-3" role="status"><p className="font-display text-amber">Week 4 finale complete</p><p className="text-sm">Rumble and Championship Prep opens Nov 17 after 10 AM CT. All fourteen builds lock Nov 27 at 6 PM CT for Nov 28.</p></div>;
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
      <p className="font-display tracking-wide text-amber">{data.week === 5 ? "FRIDAY RUMBLE & TITLE LOCK — BUILD FROZEN" : "SATURDAY LOCK — BUILD FROZEN"}</p>
      <p className="mt-1 text-sm">
        {lockedAt
          ? `Locked ${new Date(lockedAt).toLocaleString("en-US", { timeZone: "America/Chicago" })} Central. `
          : "Captain's loadout is locked. "}
        {data.week === 5 ? "Week 4 colors carry forward. Rumble and championship: Saturday, Nov 28 at 9:30 AM CT." : <>Sunday colors: {entered ? "entered" : "pending"}. Monday: {opponent || "bye"}.</>}
      </p>
    </div>
  );
}
