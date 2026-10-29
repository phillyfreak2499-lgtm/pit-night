import { z } from "zod";
import type { PitData, Session, Slot } from "./types";
import type { SyncMode } from "./authoritative";
import { central, centralDay } from "./time";
import { boltsOf } from "./week";

export type HalloweenGame = "hats" | "pumpkins" | "potions";
export type HalloweenDifficulty = "easy" | "medium" | "hard";
export type HalloweenChallenge =
  | {
      kind: "hats";
      coinAtStart: number;
      swaps: [number, number][];
      revealMs: number;
      stepMs: number;
    }
  | { kind: "pumpkins"; lit: number[]; size: 9; revealMs: number }
  | { kind: "potions"; sequence: number[]; stepMs: number; gapMs: number };
export type HalloweenReward = { category: Slot; amount: number };
export type HalloweenArcadeAttempt = {
  id: string;
  previousAttemptId: string | null;
  challenge: HalloweenChallenge;
  answer: number[];
  startedAt: number;
  answerAfter: number;
  status: "playing" | "lost" | "won";
  answeredAt: number | null;
  selection: number[] | null;
  paidBolts: number;
  reward: HalloweenReward | null;
};
/** Private server ledger. Generic client season projections must omit this entire field. */
export type HalloweenArcadeRecord = {
  storeId: string;
  date: string;
  game: HalloweenGame;
  difficulty: HalloweenDifficulty;
  promptClaimedAt: number | null;
  attempts: HalloweenArcadeAttempt[];
};
export type HalloweenArcadeView = {
  date: string;
  game: HalloweenGame;
  difficulty: HalloweenDifficulty | null;
  status: "ready" | "playing" | "lost" | "won";
  attemptId: string | null;
  challenge: HalloweenChallenge | null;
  startedAt: number | null;
  answerAfter: number | null;
  attemptNumber: number;
  canRetry: boolean;
  retryCost: 10;
  boltsBalance: number;
  reward: HalloweenReward | null;
  serverNow: number;
};
export type HalloweenArcadeResult = {
  view: HalloweenArcadeView | null;
  showPrompt: boolean;
  doc: string;
  rev: number;
  session: Session;
  mode: SyncMode;
};
const attemptId = z.string().min(1).max(120);
export const halloweenArcadeInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status") }).strict(),
  z.object({ action: z.literal("claimPrompt") }).strict(),
  z.object({ action: z.literal("start"), previousAttemptId: attemptId.nullable() }).strict(),
  z
    .object({
      action: z.literal("answer"),
      attemptId,
      answer: z.array(z.number().int().min(0).max(8)).min(1).max(9),
    })
    .strict(),
]);
export type HalloweenArcadeInput = z.infer<typeof halloweenArcadeInputSchema>;
export type HalloweenArcadeContext = {
  now: number;
  randomInt: (exclusiveMax: number) => number;
  newId: () => string;
};
export type HalloweenArcadeTransition = {
  data: PitData;
  changed: boolean;
  result: Pick<HalloweenArcadeResult, "view" | "showPrompt">;
};

const DIFFICULTIES: readonly HalloweenDifficulty[] = ["easy", "medium", "hard"];
const CATEGORIES: readonly Slot[] = ["chassis", "armor", "drive", "weapon", "utility", "brain"];
const GAMES: Record<string, HalloweenGame> = {
  "2026-10-29": "hats",
  "2026-10-30": "pumpkins",
  "2026-10-31": "potions",
};

/** This finite event follows the league's Central calendar, including all of Saturday. */
export function halloweenArcadeDay(now: number) {
  const day = centralDay(new Date(now));
  const date = `${day.y}-${String(day.m).padStart(2, "0")}-${String(day.d).padStart(2, "0")}`;
  const game = GAMES[date];
  return game ? { date, game } : null;
}

function presentation(
  game: HalloweenGame,
  difficulty: HalloweenDifficulty,
  randomInt: HalloweenArcadeContext["randomInt"],
): { challenge: HalloweenChallenge; answer: number[]; duration: number } {
  const level = DIFFICULTIES.indexOf(difficulty);
  if (game === "hats") {
    const coinAtStart = randomInt(3);
    let coin = coinAtStart;
    const swaps: [number, number][] = [];
    for (let i = 0; i < [6, 10, 14][level]!; i++) {
      const a = randomInt(3);
      const b = (a + 1 + randomInt(2)) % 3;
      swaps.push([a, b]);
      if (coin === a) coin = b;
      else if (coin === b) coin = a;
    }
    const revealMs = 1800;
    const stepMs = [850, 650, 450][level]!;
    return {
      challenge: { kind: "hats", coinAtStart, swaps, revealMs, stepMs },
      answer: [coin],
      duration: revealMs + swaps.length * stepMs,
    };
  }
  if (game === "pumpkins") {
    const positions = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    // Bounded Fisher–Yates also terminates for deterministic test RNGs.
    for (let i = positions.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [positions[i], positions[j]] = [positions[j]!, positions[i]!];
    }
    const lit = positions.slice(0, [2, 3, 4][level]!);
    const revealMs = [3000, 2200, 1500][level]!;
    return {
      challenge: { kind: "pumpkins", lit, size: 9, revealMs },
      answer: [...lit].sort((a, b) => a - b),
      duration: revealMs,
    };
  }
  const sequence = Array.from({ length: [3, 5, 7][level]! }, () => randomInt(4));
  const stepMs = [750, 600, 450][level]!;
  const gapMs = 220;
  return {
    challenge: { kind: "potions", sequence, stepMs, gapMs },
    answer: [...sequence],
    duration: sequence.length * (stepMs + gapMs),
  };
}

function viewFor(
  data: PitData,
  storeId: string,
  day: { date: string; game: HalloweenGame },
  record: HalloweenArcadeRecord | undefined,
  now: number,
): HalloweenArcadeView {
  const latest = record?.attempts.at(-1);
  const balance = boltsOf(data, storeId).balance;
  return {
    ...day,
    difficulty: record?.difficulty ?? null,
    status: latest?.status ?? "ready",
    attemptId: latest?.id ?? null,
    challenge: latest?.challenge ? structuredClone(latest.challenge) : null,
    startedAt: latest?.startedAt ?? null,
    answerAfter: latest?.answerAfter ?? null,
    attemptNumber: record?.attempts.length ?? 0,
    canRetry:
      latest?.status === "lost" &&
      balance >= 10 &&
      timeForRound(now, latest.answerAfter - latest.startedAt),
    retryCost: 10,
    boltsBalance: balance,
    reward: latest?.reward ? { ...latest.reward } : null,
    serverNow: now,
  };
}

function timeForRound(now: number, duration: number) {
  const calendar = centralDay(new Date(now));
  const midnight = central(calendar.y, calendar.m, calendar.d + 1).getTime();
  return now + duration + 30_000 <= midnight;
}

function validChoice(game: HalloweenGame, answer: number[]) {
  if (game === "hats") return answer.length === 1 && answer[0]! < 3;
  if (game === "pumpkins") return new Set(answer).size === answer.length;
  return answer.every((value) => value < 4);
}

/** Pure transition. Only the server supplies the clock, random source and attempt IDs. */
export function runHalloweenArcade(
  data: PitData,
  session: Session,
  rawInput: HalloweenArcadeInput,
  context: HalloweenArcadeContext,
): HalloweenArcadeTransition {
  const input = halloweenArcadeInputSchema.parse(rawInput);
  const empty = (): HalloweenArcadeTransition => ({
    data,
    changed: false,
    result: { view: null, showPrompt: false },
  });
  const member = data.crew.find(
    (c) => c.id === session.crewId && c.storeId === session.storeId && c.role === "captain",
  );
  const storeId = session.storeId;
  const bot = data.bots.find((b) => b.storeId === storeId);
  if (
    session.role !== "captain" ||
    !storeId ||
    !member ||
    !bot ||
    !data.stores.some((s) => s.id === storeId)
  ) {
    if (input.action === "status" || input.action === "claimPrompt") return empty();
    throw new Error("Only this store's signed-in captain can play its Halloween game.");
  }
  const { now, randomInt, newId } = context;
  const day = halloweenArcadeDay(now);
  if (!day) {
    if (input.action === "status" || input.action === "claimPrompt") return empty();
    throw new Error(
      "Halloween games are available October 29–31, Central time, and ended Saturday at midnight.",
    );
  }
  const records = data.halloweenArcade ?? [];
  const existing = records.find((entry) => entry.storeId === storeId && entry.date === day.date);
  const unchanged = (): HalloweenArcadeTransition => ({
    data,
    changed: false,
    result: { view: viewFor(data, storeId, day, existing, now), showPrompt: false },
  });
  if (input.action === "status") return unchanged();
  if (input.action === "claimPrompt" && existing?.promptClaimedAt != null) return unchanged();

  let record: HalloweenArcadeRecord = existing ?? {
    storeId,
    ...day,
    difficulty: DIFFICULTIES[randomInt(DIFFICULTIES.length)]!,
    promptClaimedAt: null,
    attempts: [],
  };
  let next = data;
  let showPrompt = false;
  const last = record.attempts.at(-1);
  if (input.action === "claimPrompt") {
    record = { ...record, promptClaimedAt: now };
    showPrompt = true;
  } else if (input.action === "start") {
    // A repeated click or lost response resumes precisely the attempt created by that request.
    if (last && last.previousAttemptId === input.previousAttemptId) return unchanged();
    if (last?.status === "won")
      throw new Error("Today's game is complete. Your store already won its daily coins.");
    if (last && (last.status !== "lost" || last.id !== input.previousAttemptId))
      throw new Error("Finish the current attempt, then retry from that result.");
    if (!last && input.previousAttemptId !== null)
      throw new Error("That attempt is stale. Open today's game again.");
    const paidBolts = last ? 10 : 0;
    if (paidBolts && boltsOf(data, storeId).balance < paidBolts)
      throw new Error("A retry costs 10 Bolts. Your store does not have enough yet.");
    const generated = presentation(record.game, record.difficulty, randomInt);
    // Never sell an attempt that cannot finish its required presentation and allow an answer.
    if (!timeForRound(now, generated.duration))
      throw new Error(
        "There is not enough time before Central midnight to play another round. No Bolts were spent.",
      );
    const attempt: HalloweenArcadeAttempt = {
      id: newId(),
      previousAttemptId: input.previousAttemptId,
      challenge: generated.challenge,
      answer: generated.answer,
      startedAt: now,
      answerAfter: now + generated.duration,
      status: "playing",
      answeredAt: null,
      selection: null,
      paidBolts,
      reward: null,
    };
    record = {
      ...record,
      promptClaimedAt: record.promptClaimedAt ?? now,
      attempts: [...record.attempts, attempt],
    };
    if (paidBolts)
      next = {
        ...next,
        stores: next.stores.map((store) =>
          store.id === storeId
            ? { ...store, boltsSpent: (store.boltsSpent ?? 0) + paidBolts }
            : store,
        ),
      };
  } else {
    if (!last || last.id !== input.attemptId)
      throw new Error("That is not today's current attempt. Open the game again.");
    if (last.status !== "playing") return unchanged();
    if (now < last.answerAfter)
      throw new Error("Watch the full game presentation before choosing your answer.");
    if (!validChoice(record.game, input.answer))
      throw new Error("That answer is not a valid choice for this game.");
    const selected =
      record.game === "pumpkins" ? [...input.answer].sort((a, b) => a - b) : [...input.answer];
    const won =
      selected.length === last.answer.length &&
      selected.every((value, index) => value === last.answer[index]);
    const reward = won
      ? { category: CATEGORIES[randomInt(CATEGORIES.length)]!, amount: 2 + randomInt(3) }
      : null;
    const answered: HalloweenArcadeAttempt = {
      ...last,
      status: won ? "won" : "lost",
      answeredAt: now,
      selection: [...input.answer],
      reward,
    };
    record = { ...record, attempts: [...record.attempts.slice(0, -1), answered] };
    if (reward) {
      next = {
        ...next,
        bots: next.bots.map((row) =>
          row.storeId === storeId
            ? {
                ...row,
                coins: {
                  ...row.coins,
                  [reward.category]: (row.coins[reward.category] ?? 0) + reward.amount,
                },
              }
            : row,
        ),
        log: [
          `${data.stores.find((store) => store.id === storeId)!.name} won ${reward.amount} ${reward.category} coins in the Halloween game on ${day.date}.`,
          ...next.log,
        ].slice(0, 24),
      };
    }
  }
  next = {
    ...next,
    halloweenArcade: [
      ...records.filter((entry) => entry.storeId !== storeId || entry.date !== day.date),
      record,
    ],
  };
  return {
    data: next,
    changed: true,
    result: { view: viewFor(next, storeId, day, record, now), showPrompt },
  };
}
