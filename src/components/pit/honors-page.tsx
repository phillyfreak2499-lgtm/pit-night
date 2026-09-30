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
    <div className="mx-auto max-w-5xl">
      <SectionLabel>Hardware</SectionLabel>
      <h1 className="font-display text-5xl leading-none">Honors</h1>
      <p className="mt-3 text-muted">The only championship table is the store standings. These are the things that hang on a wall.</p>
      <div className="pegboard mt-6 grid gap-4 border border-line p-4 md:grid-cols-3 md:p-6">
        <Plate kind="trophy" kicker="Period trophy" title={name(data.honors.pitBelt)} detail={bot(data.honors.pitBelt)} href={data.honors.pitBelt} />
        <Plate kind="plate" kicker="Runner-up plate" title={name(data.honors.plate)} detail={bot(data.honors.plate)} href={data.honors.plate} />
        <Plate
          kind="build"
          kicker="Best Build"
          title={name(data.honors.bestBuild ?? pace?.storeId ?? null)}
          detail={data.honors.bestBuildWhy || (pace ? `Pace through week ${pace.week}. Not locked until Title Monday.` : "Nobody has fought yet.")}
          href={data.honors.bestBuild ?? pace?.storeId ?? null}
          claimed={Boolean(data.honors.bestBuild)}
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

type Kind = "trophy" | "plate" | "build";

function Plate({
  kind,
  kicker,
  title,
  detail,
  href,
  claimed,
}: {
  kind: Kind;
  kicker: string;
  title: string;
  detail: string;
  href: string | null;
  claimed?: boolean;
}) {
  const won = claimed ?? Boolean(href);
  const body = (
    <div className={`lift relative flex h-full flex-col items-center border border-line bg-surface/90 px-4 pt-2 pb-4 text-center ${won ? "" : "opacity-95"}`}>
      <Hook />
      <div className={`mt-1 h-40 w-full ${won ? "honor-shine" : "honor-dim"}`}>
        {kind === "trophy" ? <TrophyArt /> : kind === "plate" ? <PlateArt /> : <BuildArt />}
      </div>
      <p className="mt-3 text-xs tracking-widest text-amber uppercase">{kicker}</p>
      <p className="font-display text-3xl leading-none">{title}</p>
      <p className="mt-2 text-sm text-muted">{detail || (won ? "" : "Unclaimed. Four fight days to go.")}</p>
    </div>
  );
  if (!href) return body;
  return (
    <Link to="/stores/$storeId" params={{ storeId: href }} className="block h-full">
      {body}
    </Link>
  );
}

function Hook() {
  return (
    <svg viewBox="0 0 40 28" className="-mt-5 h-7 w-10" aria-hidden>
      <circle cx="20" cy="6" r="4" fill="#6d6a64" stroke="#1a1918" strokeWidth="1.5" />
      <path d="M20 9 V18 Q20 25 13 25" fill="none" stroke="#9a948a" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function TrophyArt() {
  return (
    <svg viewBox="0 0 160 160" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="gold" x1="0" x2="1">
          <stop offset="0" stopColor="#8a5a08" />
          <stop offset="0.35" stopColor="#ffd56a" />
          <stop offset="0.55" stopColor="#f0a202" />
          <stop offset="1" stopColor="#7a4c05" />
        </linearGradient>
        <linearGradient id="base" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#3a3733" />
          <stop offset="1" stopColor="#141312" />
        </linearGradient>
      </defs>
      <path d="M44 30 Q18 30 20 52 Q23 72 50 74" fill="none" stroke="url(#gold)" strokeWidth="7" />
      <path d="M116 30 Q142 30 140 52 Q137 72 110 74" fill="none" stroke="url(#gold)" strokeWidth="7" />
      <path d="M40 22 H120 Q120 78 92 92 V108 H68 V92 Q40 78 40 22 Z" fill="url(#gold)" />
      <path d="M52 30 Q54 70 74 84" fill="none" stroke="#fff4c9" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round" />
      <g transform="translate(80 50)">
        <circle r="15" fill="#7a4c05" />
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x="-3" y="-20" width="6" height="8" fill="#7a4c05" transform={`rotate(${i * 45})`} />
        ))}
        <circle r="7" fill="url(#gold)" />
      </g>
      <rect x="58" y="108" width="44" height="10" fill="url(#gold)" />
      <rect x="44" y="118" width="72" height="26" fill="url(#base)" stroke="#000" />
      <rect x="56" y="124" width="48" height="12" fill="#b9a24a" opacity="0.8" />
      <circle cx="50" cy="131" r="2" fill="#9a948a" />
      <circle cx="110" cy="131" r="2" fill="#9a948a" />
    </svg>
  );
}

function PlateArt() {
  return (
    <svg viewBox="0 0 160 160" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="steelplate" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#d9d5cc" />
          <stop offset="0.5" stopColor="#8e8a82" />
          <stop offset="1" stopColor="#4a4843" />
        </linearGradient>
      </defs>
      <path d="M58 22 L80 8 L102 22" fill="none" stroke="#6d6a64" strokeWidth="2" />
      <rect x="22" y="22" width="116" height="116" rx="6" fill="#1a1918" />
      <rect x="28" y="28" width="104" height="104" rx="4" fill="url(#steelplate)" />
      <path d="M36 34 L124 34" stroke="#fff" strokeOpacity="0.4" strokeWidth="2" />
      {[
        [38, 38],
        [122, 38],
        [38, 122],
        [122, 122],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="5" fill="#3a3733" />
          <path d={`M${x! - 3} ${y} H${x! + 3}`} stroke="#9a948a" strokeWidth="1.5" />
        </g>
      ))}
      <text x="80" y="78" textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize="30" fontWeight="700" fill="#2b2926">
        2ND
      </text>
      <rect x="44" y="88" width="72" height="3" fill="#2b2926" opacity="0.6" />
      <text x="80" y="108" textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize="11" letterSpacing="2" fill="#2b2926">
        PERIOD 12
      </text>
    </svg>
  );
}

function BuildArt() {
  return (
    <svg viewBox="0 0 160 160" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="wrench" x1="0" x2="1">
          <stop offset="0" stopColor="#5a5751" />
          <stop offset="0.5" stopColor="#e2ddd3" />
          <stop offset="1" stopColor="#5a5751" />
        </linearGradient>
        <radialGradient id="medal">
          <stop offset="0" stopColor="#ffd56a" />
          <stop offset="1" stopColor="#a86a05" />
        </radialGradient>
      </defs>
      <path d="M60 8 L80 50 L100 8" fill="none" stroke="#c4473a" strokeWidth="12" />
      <path d="M60 8 L80 50 L100 8" fill="none" stroke="#f3efe6" strokeWidth="3" />
      <g transform="translate(80 98) rotate(45)">
        <rect x="-6" y="-58" width="12" height="116" rx="4" fill="url(#wrench)" />
        <path d="M-15 -62 A15 15 0 1 1 15 -62 L7 -54 H-7 Z" fill="url(#wrench)" />
      </g>
      <g transform="translate(80 98) rotate(-45)">
        <rect x="-6" y="-58" width="12" height="116" rx="4" fill="url(#wrench)" />
        <path d="M-15 -62 A15 15 0 1 1 15 -62 L7 -54 H-7 Z" fill="url(#wrench)" />
      </g>
      <circle cx="80" cy="98" r="30" fill="url(#medal)" stroke="#6a4204" strokeWidth="3" />
      <circle cx="80" cy="98" r="22" fill="none" stroke="#fff4c9" strokeOpacity="0.5" strokeWidth="1.5" />
      <text x="80" y="104" textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize="15" fontWeight="700" fill="#5a3703">
        BEST
      </text>
    </svg>
  );
}
