import { Link } from "@tanstack/react-router";
import { partById } from "@/lib/pit/catalog";
import { usePit } from "@/lib/pit/store";
import { SectionLabel } from "./bits";

export function HonorsPage() {
  const data = usePit();
  const name = (id: string | null) => data.stores.find((s) => s.id === id)?.name ?? "Still on the hook";
  const bot = (id: string | null) => data.bots.find((b) => b.storeId === id)?.name ?? "";
  const pace = [...data.craft].sort((a, b) => b.score - a.score)[0];
  const drop = data.honors.titleDrop ? partById(data.honors.titleDrop) : undefined;

  return (
    <div className="mx-auto max-w-3xl">
      <SectionLabel>Hardware</SectionLabel>
      <h1 className="font-display text-5xl leading-none">Honors</h1>
      <p className="mt-3 text-muted">The only championship table is the store standings. These are the things that hang on a wall.</p>
      <div className="mt-6 grid gap-3">
        <Plate kicker="Period trophy" title={name(data.honors.pitBelt)} detail={bot(data.honors.pitBelt)} href={data.honors.pitBelt} />
        <Plate kicker="Runner-up plate" title={name(data.honors.plate)} detail={bot(data.honors.plate)} href={data.honors.plate} />
        <Plate
          kicker="Best Build"
          title={name(data.honors.bestBuild ?? pace?.storeId ?? null)}
          detail={data.honors.bestBuildWhy || (pace ? `Pace through week ${pace.week}. Not locked until Title Saturday.` : "Nobody has fought yet.")}
          href={data.honors.bestBuild ?? pace?.storeId ?? null}
        />
      </div>
      {drop ? <p className="mt-4 text-sm text-amber">Title drop in the champion bay: {drop.name}. Not for sale.</p> : null}
      <section className="mt-8">
        <SectionLabel>Weekly pit-crew MVP</SectionLabel>
        {data.mvps.length === 0 ? <p className="mt-2 text-sm text-muted">No names yet. A captain or the desk can put one up. It is not a win-loss.</p> : null}
        <ul className="mt-3 flex flex-col gap-2">
          {data.mvps.map((mvp) => (
            <li key={`${mvp.week}-${mvp.storeId}`} className="border border-line px-3 py-3">
              <p className="text-xs tracking-widest text-muted uppercase">Week {mvp.week}</p>
              <p className="font-display text-2xl">{mvp.name}</p>
              <p className="text-sm text-muted">{name(mvp.storeId)} pit crew</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Plate({ kicker, title, detail, href }: { kicker: string; title: string; detail: string; href: string | null }) {
  const body = (
    <div className="border border-line bg-surface p-4">
      <p className="text-xs tracking-widest text-amber uppercase">{kicker}</p>
      <p className="font-display text-4xl leading-none">{title}</p>
      <p className="mt-2 text-sm text-muted">{detail}</p>
    </div>
  );
  if (!href) return body;
  return (
    <Link to="/stores/$storeId" params={{ storeId: href }}>
      {body}
    </Link>
  );
}
