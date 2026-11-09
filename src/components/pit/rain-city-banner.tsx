import { RAIN_CITY } from "@/lib/pit/rain-city";

/** House banner for the Rain City bay theme. Original cloud and feather, painted in the bay palette. */
export function RainCityBanner({ flair = false }: { flair?: boolean }) {
  return (
    <div
      className="rain-city-banner mt-3 flex items-center gap-3 px-3 py-3"
      data-testid="rain-city-banner"
    >
      <svg viewBox="0 0 88 64" className="rain-city-mark" aria-hidden="true">
        <ellipse cx="30" cy="18" rx="14" ry="8" fill={RAIN_CITY.gray} />
        <ellipse cx="44" cy="15" rx="12" ry="9" fill={RAIN_CITY.gray} />
        <ellipse cx="56" cy="19" rx="10" ry="7" fill={RAIN_CITY.gray} />
        <path d="M22 24 Q44 30 64 22" fill="none" stroke={RAIN_CITY.green} strokeWidth="3" strokeLinecap="round" />
        <path d="M18 50 Q40 28 70 22" fill="none" stroke={RAIN_CITY.green} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M28 46 L18 40 M34 40 L24 30 M40 36 L32 24 M46 33 L42 22 M52 31 L52 20 M58 32 L64 22" fill="none" stroke={RAIN_CITY.gray} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M24 54c-2 3-1.5 6 0 7 1.5-1 2-4 0-7zM40 56c-2 3-1.5 6 0 7 1.5-1 2-4 0-7zM56 52c-2 3-1.5 6 0 7 1.5-1 2-4 0-7z" fill={RAIN_CITY.gray} />
      </svg>
      <div className="min-w-0">
        <p className="font-display text-2xl leading-none tracking-[0.16em]" style={{ color: RAIN_CITY.gray }}>
          {RAIN_CITY.scheme.toUpperCase()}
        </p>
        <p
          className="mt-1 text-sm leading-snug"
          style={{ color: RAIN_CITY.green }}
          data-testid={flair ? "loudest-flair" : "rain-city-caption"}
        >
          {flair ? RAIN_CITY.flair : "Southlake bay colors"}
        </p>
      </div>
    </div>
  );
}
