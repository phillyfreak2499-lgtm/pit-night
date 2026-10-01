import { BOLTS, DAY_ORDER, allJobs, programWeek } from "./training";
import type { Crew, PitData } from "./types";

/** Specialists who count toward a bay's week: everyone not marked off. */
export function countedCrew(data: Pick<PitData, "crew">, storeId: string, week: number): Crew[] {
  return data.crew.filter((c) => c.storeId === storeId && c.role === "specialist" && !(c.offWeeks ?? []).includes(week));
}

export function captainOf(data: Pick<PitData, "crew">, storeId: string): Crew | undefined {
  return data.crew.find((c) => c.storeId === storeId && c.role === "captain");
}

export type CrewProgress = {
  crew: Crew;
  jobsDone: number;
  jobsPending: number;
  sparksDone: number;
  jobsTotal: number;
  sparksTotal: number;
  complete: boolean;
};

export type WeekProgress = {
  week: number;
  crew: CrewProgress[];
  careDone: boolean;
  carePending: boolean;
  /** Every counted specialist finished every job and Spark, and the captain finished CARE. */
  tuned: boolean;
  done: number;
  total: number;
  pct: number;
};

export function weekProgress(data: Pick<PitData, "crew" | "jobLog" | "sparkLog">, storeId: string, week: number): WeekProgress {
  const plan = programWeek(week);
  const empty: WeekProgress = { week, crew: [], careDone: false, carePending: false, tuned: false, done: 0, total: 0, pct: 0 };
  if (!plan) return empty;
  const jobs = allJobs(plan);
  const crew = countedCrew(data, storeId, week).map((c): CrewProgress => {
    const mine = data.jobLog.filter((e) => e.week === week && e.crewId === c.id);
    const jobsDone = jobs.filter((j) => mine.some((e) => e.jobId === j.id && e.status === "approved")).length;
    const jobsPending = jobs.filter((j) => mine.some((e) => e.jobId === j.id && e.status === "pending")).length;
    const sparksDone = DAY_ORDER.filter((d) => data.sparkLog.some((e) => e.week === week && e.day === d && e.crewId === c.id)).length;
    return {
      crew: c,
      jobsDone,
      jobsPending,
      sparksDone,
      jobsTotal: jobs.length,
      sparksTotal: DAY_ORDER.length,
      complete: jobsDone === jobs.length && sparksDone === DAY_ORDER.length,
    };
  });
  const cap = captainOf(data, storeId);
  const care = cap ? data.jobLog.find((e) => e.week === week && e.jobId === plan.care.id && e.crewId === cap.id) : undefined;
  const careDone = care?.status === "approved";
  const done = crew.reduce((n, c) => n + c.jobsDone + c.sparksDone, 0) + (careDone ? 1 : 0);
  const total = crew.reduce((n, c) => n + c.jobsTotal + c.sparksTotal, 0) + 1;
  return {
    week,
    crew,
    careDone,
    carePending: care?.status === "pending",
    tuned: crew.length > 0 && crew.every((c) => c.complete) && careDone,
    done,
    total,
    pct: total ? Math.round((done / total) * 100) : 0,
  };
}

export function tunedUp(data: Pick<PitData, "crew" | "jobLog" | "sparkLog">, storeId: string, week: number) {
  return weekProgress(data, storeId, week).tuned;
}

/** Bolts earned by a bay across the season, minus what it spent in the Bolt Locker. */
export function boltsOf(data: Pick<PitData, "jobLog" | "sparkLog" | "picks" | "bouts" | "stores">, storeId: string) {
  const jobs = data.jobLog.filter((e) => e.storeId === storeId && e.status === "approved").length * BOLTS.job;
  const sparks = data.sparkLog.filter((e) => e.storeId === storeId).reduce((n, e) => n + e.correct * BOLTS.sparkCorrect, 0);
  const picks =
    data.picks.filter((p) => {
      if (p.storeId !== storeId) return false;
      const bout = data.bouts.find((b) => b.id === p.boutId && b.result);
      return Boolean(bout?.result?.winnerIds.includes(p.pick));
    }).length * BOLTS.pickCorrect;
  const spent = data.stores.find((s) => s.id === storeId)?.boltsSpent ?? 0;
  return { earned: jobs + sparks + picks, spent, balance: jobs + sparks + picks - spent, jobs, sparks, picks };
}

/** Bolt Locker. Looks only. */
export type LockerItem = {
  id: string;
  kind: "walkout" | "victory" | "paint";
  name: string;
  price: number;
  blurb: string;
  /** For paints. */
  hex?: string;
};

export const LOCKER: LockerItem[] = [
  { id: "walkout-pyro", kind: "walkout", name: "Pyro walk-out", price: 12, blurb: "Flame columns fire on both sides when your bot is introduced." },
  { id: "walkout-smoke", kind: "walkout", name: "Smoke & lights", price: 10, blurb: "Your bot rolls out through a wall of lit smoke." },
  { id: "walkout-sparks", kind: "walkout", name: "Spark shower", price: 10, blurb: "Sparks rain from the truss on your introduction." },
  { id: "victory-confetti", kind: "victory", name: "Confetti cannon", price: 8, blurb: "Your colors rain down when you win." },
  { id: "victory-fireworks", kind: "victory", name: "Fireworks", price: 14, blurb: "Fireworks over the cage on every win." },
  { id: "paint-neon", kind: "paint", name: "Neon Green", price: 6, blurb: "A paint only the Locker sells.", hex: "#39ff6a" },
  { id: "paint-candy", kind: "paint", name: "Candy Red", price: 6, blurb: "Deep candy-apple red.", hex: "#e3123f" },
  { id: "paint-ice", kind: "paint", name: "Glacier", price: 6, blurb: "Pale ice blue.", hex: "#bfe8ff" },
  { id: "paint-royal", kind: "paint", name: "Royal Purple", price: 6, blurb: "For bays that act like they own the place.", hex: "#6a2bd9" },
];

export function lockerItem(id: string | undefined) {
  return LOCKER.find((i) => i.id === id);
}
