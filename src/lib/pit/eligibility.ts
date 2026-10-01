import { central } from "./time";
import { programWeek } from "./training";
import type { PitData } from "./types";

/** Availability is fixed at Tuesday midnight Central, or first training in test mode. */
export function eligibilityClosed(
  data: Pick<PitData, "week" | "phase" | "jobLog" | "sparkLog" | "trainingOpenAll">,
  week: number,
  now = new Date(),
): string | null {
  const plan = programWeek(week);
  if (!plan || week < data.week || (week === data.week && data.phase !== "open"))
    return "This week's eligibility is frozen.";
  const [y, m, d] = plan.start.split("-").map(Number);
  const began = now >= central(y!, m!, d!);
  const trained =
    data.jobLog.some((e) => e.week === week) || data.sparkLog.some((e) => e.week === week);
  return began || trained
    ? "Eligibility froze when Pit Week began. Ask the Desk to record a legitimate absence."
    : null;
}
