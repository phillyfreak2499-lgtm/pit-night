import { fanSplit } from "@/lib/pit/fan-picks";
import { usePit } from "@/lib/pit/store";
import type { Bout } from "@/lib/pit/types";

export function FanPicks({ bout }: { bout: Bout }) {
  const picks = usePit(s => s.picks);
  const bots = usePit(s => s.bots);
  const split = fanSplit(bout, picks ?? []);
  if (!split) return null;
  const name = (id: string) => bout.result?.fighters.find(f => f.id === id)?.botName ??
    bots.find(b => b.storeId === id)?.name ?? id;
  return <div className="border-t border-line px-4 py-2 text-sm" data-testid="fan-pick-share">
    <p className="text-xs tracking-wide text-muted uppercase">Fan picks</p>
    {split.total ? <div className="mt-1 flex flex-wrap justify-between gap-x-3 font-display tabular-nums">
      {split.sides.map(side => <span key={side.id}>{name(side.id)} <strong className="text-amber">{side.percent}%</strong></span>)}
    </div> : <p>No picks yet</p>}
  </div>;
}
