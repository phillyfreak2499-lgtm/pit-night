import { Flame } from "lucide-react";
import { usePit } from "@/lib/pit/store";
import { STREAK_BADGE } from "@/lib/pit/training";
import { sparkStreak } from "@/lib/pit/week";

/** Flame next to a name once someone lands five perfect Sparks in a row. */
export function StreakBadge({ crewId, className = "" }: { crewId: string | undefined; className?: string }) {
  const sparkLog = usePit((s) => s.sparkLog);
  if (!crewId) return null;
  const streak = sparkStreak({ sparkLog }, crewId);
  if (!streak.badge) return null;
  return (
    <span
      className={`ml-1 inline-flex items-center gap-0.5 rounded-sm bg-spark/15 px-1 align-middle text-[11px] font-semibold text-spark ${className}`}
      title={`Spark streak: ${streak.best} perfect Daily Sparks in a row (badge at ${STREAK_BADGE})`}
      aria-label={`Spark streak badge, best ${streak.best} in a row`}
    >
      <Flame size={12} aria-hidden />
      {streak.best}
    </span>
  );
}
