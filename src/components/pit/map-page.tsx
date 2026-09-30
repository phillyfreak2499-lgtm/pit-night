import { Link } from "@tanstack/react-router";
import { CLASS_META } from "@/lib/pit/catalog";
import { botFor, recordOf } from "@/lib/pit/engine";
import { paintHex, usePit } from "@/lib/pit/store";
import { SectionLabel } from "./bits";

export function PitMap() {
  const data = usePit();
  return (
    <div className="mx-auto max-w-6xl" data-testid="pit-map">
      <SectionLabel>The pit map</SectionLabel>
      <h1 className="mt-1 font-display text-5xl leading-none">Ten doors</h1>
      <p className="mt-3 max-w-2xl text-muted">
        One bay, one bot, one Friday lock. Click a door. The people inside are pit crew. They do not have bots of their own.
      </p>
      <ul className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {data.stores.map((store) => {
          const bot = botFor(data, store.id);
          const rec = recordOf(data, store.id);
          const locked = Boolean(bot.locked);
          const hurt = Object.values(bot.wear).some((w) => w === "disabled" || w === "bent");
          return (
            <li key={store.id}>
              <Link
                to="/garage/$storeId"
                params={{ storeId: store.id }}
                data-testid={`door-${store.id}`}
                className="relative flex min-h-56 flex-col justify-between overflow-hidden border border-line bg-deep p-3"
              >
                <span className="bay-door pointer-events-none absolute inset-0 opacity-70" />
                <span className="relative flex items-center justify-between text-xs tracking-widest uppercase">
                  <span style={{ color: paintHex(store.paint) }}>{store.region}</span>
                  <span className="font-display text-lg" style={{ color: paintHex(store.paint) }}>
                    {bot.number}
                  </span>
                </span>
                <span className="relative">
                  <span className="block text-xs tracking-widest text-muted uppercase">{CLASS_META[bot.classId].label}</span>
                  <span className="block font-display text-2xl leading-tight">{store.name}</span>
                  <span className="mt-1 block text-sm text-fg">{bot.name}</span>
                  <span className={`mt-2 block text-xs tracking-widest uppercase ${locked ? "text-amber" : hurt ? "text-bad" : "text-muted"}`}>
                    {locked ? "Locked" : hurt ? "Damaged" : "Open"} · {rec.w}–{rec.l}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
