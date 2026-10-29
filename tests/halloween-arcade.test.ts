import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { createStore } from "zustand/vanilla";
import { makeData } from "../src/lib/pit/seed.ts";
import { boltsOf } from "../src/lib/pit/week.ts";
import {
  halloweenArcadeInputSchema,
  runHalloweenArcade,
  type HalloweenArcadeInput,
} from "../src/lib/pit/halloween-arcade.ts";
import type { PitData, Session } from "../src/lib/pit/types.ts";
import {
  executeHalloweenArcade,
  type HalloweenArcadeSnapshot,
} from "../src/lib/pit/halloween-arcade-transaction.ts";
import { pitCreator, sharedDoc } from "../src/lib/pit/store.ts";

const THU = Date.parse("2026-10-29T15:00:00Z");
const FRI = Date.parse("2026-10-30T15:00:00Z");
const SAT = Date.parse("2026-10-31T15:00:00Z");
function fixture() {
  let data = makeData();
  const captain = data.crew.find((c) => c.storeId === "plano" && c.role === "captain")!;
  const session: Session = { role: "captain", storeId: "plano", crewId: captain.id };
  data = {
    ...data,
    session,
    sparkLog: [
      {
        id: "funded",
        week: 1,
        day: "thu",
        storeId: "plano",
        crewId: captain.id,
        correct: 30,
        total: 30,
        at: THU,
      },
    ],
  };
  let serial = 0;
  const run = (input: HalloweenArcadeInput, now = THU, randomInt = (_max: number) => 0) => {
    const next = runHalloweenArcade(data, session, input, {
      now,
      randomInt,
      newId: () => `attempt-${++serial}`,
    });
    data = next.data;
    return next;
  };
  return {
    run,
    get data() {
      return data;
    },
    set data(value: PitData) {
      data = value;
    },
    session,
  };
}

test("daily prompt can be claimed only once across reloads and devices", () => {
  const f = fixture();
  assert.equal(f.run({ action: "status" }).changed, false);
  const first = f.run({ action: "claimPrompt" });
  assert.equal(first.result.showPrompt, true);
  assert.equal(first.result.view?.status, "ready");
  assert.equal(first.result.view?.difficulty, "easy");
  const repeated = f.run({ action: "claimPrompt" });
  assert.equal(repeated.result.showPrompt, false);
  assert.equal(repeated.changed, false);
  const restored = JSON.parse(JSON.stringify(f.data));
  assert.equal(
    runHalloweenArcade(
      restored,
      f.session,
      { action: "claimPrompt" },
      { now: THU, randomInt: () => 2, newId: () => "duplicate" },
    ).result.showPrompt,
    false,
  );
});

test("Central dates select three different games and stop at Saturday midnight", () => {
  const f = fixture();
  const examples = [
    ["2026-10-29T04:59:59.999Z", null],
    ["2026-10-29T05:00:00.000Z", "hats"],
    ["2026-10-30T04:59:59.999Z", "hats"],
    ["2026-10-30T05:00:00.000Z", "pumpkins"],
    ["2026-10-31T05:00:00.000Z", "potions"],
    ["2026-11-01T04:59:59.999Z", "potions"],
    ["2026-11-01T05:00:00.000Z", null],
  ] as const;
  for (const [iso, game] of examples) {
    assert.equal(f.run({ action: "status" }, Date.parse(iso)).result.view?.game ?? null, game, iso);
  }
  assert.throws(
    () => f.run({ action: "start", previousAttemptId: null }, Date.parse("2026-11-01T05:00:00Z")),
    /ended|available/i,
  );
});

test("public, crew, commissioner and mismatched roster identities cannot play", () => {
  const f = fixture();
  const crew = f.data.crew.find((c) => c.storeId === "plano" && c.role === "specialist")!;
  const other = f.data.crew.find((c) => c.storeId === "allen" && c.role === "captain")!;
  const contexts: Session[] = [
    { role: "public", storeId: null, crewId: null },
    { role: "crew", storeId: "plano", crewId: crew.id },
    { role: "commissioner", storeId: null, crewId: null },
    { role: "captain", storeId: "plano", crewId: other.id },
  ];
  const options = { now: THU, randomInt: () => 0, newId: () => "invalid" };
  for (const session of contexts) {
    assert.equal(
      runHalloweenArcade(f.data, session, { action: "status" }, options).result.view,
      null,
    );
    assert.throws(
      () =>
        runHalloweenArcade(f.data, session, { action: "start", previousAttemptId: null }, options),
      /captain|sign in/i,
    );
  }
});

test("free start and duplicate start resume the same attempt without charging Bolts", () => {
  const f = fixture();
  const balance = boltsOf(f.data, "plano").balance;
  const first = f.run({ action: "start", previousAttemptId: null }).result.view!;
  assert.equal(first.status, "playing");
  assert.equal(first.attemptNumber, 1);
  assert.equal(first.boltsBalance, balance);
  const again = f.run({ action: "start", previousAttemptId: null }, THU + 50);
  assert.equal(again.changed, false);
  assert.equal(again.result.view?.attemptId, first.attemptId);
  assert.equal(boltsOf(f.data, "plano").balance, balance);
  assert.equal(f.run({ action: "claimPrompt" }).result.showPrompt, false);
});

test("answers are rejected before the reveal and shuffle complete", () => {
  const f = fixture();
  const view = f.run({ action: "start", previousAttemptId: null }).result.view!;
  assert.ok(view.answerAfter! > THU);
  assert.throws(
    () =>
      f.run({ action: "answer", attemptId: view.attemptId!, answer: [0] }, view.answerAfter! - 1),
    /watch|ready|finish/i,
  );
  assert.equal(f.run({ action: "status" }).result.view?.status, "playing");
});

test("a correct hat pick awards spendable category coins exactly once", () => {
  const f = fixture();
  const before = structuredClone(f.data);
  const view = f.run({ action: "start", previousAttemptId: null }).result.view!;
  const won = f.run(
    { action: "answer", attemptId: view.attemptId!, answer: [0] },
    view.answerAfter!,
  ).result.view!;
  assert.equal(won.status, "won");
  assert.deepEqual(won.reward, { category: "chassis", amount: 2 });
  const oldBot = before.bots.find((b) => b.storeId === "plano")!;
  const bot = f.data.bots.find((b) => b.storeId === "plano")!;
  assert.equal(bot.coins.chassis, oldBot.coins.chassis + 2);
  assert.deepEqual({ ...bot, coins: oldBot.coins }, oldBot);
  assert.deepEqual(f.data.bouts, before.bouts);
  assert.deepEqual(
    f.data.bots.filter((b) => b.storeId !== "plano"),
    before.bots.filter((b) => b.storeId !== "plano"),
  );
  const duplicate = f.run(
    { action: "answer", attemptId: view.attemptId!, answer: [1] },
    view.answerAfter! + 1,
  );
  assert.equal(duplicate.changed, false);
  assert.equal(duplicate.result.view?.status, "won");
  assert.equal(
    f.data.bots.find((b) => b.storeId === "plano")!.coins.chassis,
    oldBot.coins.chassis + 2,
  );
  assert.throws(
    () => f.run({ action: "start", previousAttemptId: view.attemptId! }, view.answerAfter! + 2),
    /won|complete/i,
  );
});

test("a loss can retry for exactly ten Bolts, with duplicate requests charging once", () => {
  const f = fixture();
  const initial = boltsOf(f.data, "plano").balance;
  const first = f.run({ action: "start", previousAttemptId: null }).result.view!;
  f.run({ action: "answer", attemptId: first.attemptId!, answer: [1] }, first.answerAfter!);
  const retry = f.run(
    { action: "start", previousAttemptId: first.attemptId! },
    first.answerAfter! + 1,
    (max) => max - 1,
  ).result.view!;
  assert.equal(retry.attemptNumber, 2);
  assert.notEqual(retry.attemptId, first.attemptId);
  assert.equal(retry.boltsBalance, initial - 10);
  assert.equal(retry.difficulty, first.difficulty);
  assert.notDeepEqual(retry.challenge, first.challenge);
  const duplicate = f.run(
    { action: "start", previousAttemptId: first.attemptId! },
    retry.startedAt! + 1,
  );
  assert.equal(duplicate.changed, false);
  assert.equal(duplicate.result.view?.attemptId, retry.attemptId);
  assert.equal(boltsOf(f.data, "plano").balance, initial - 10);
  assert.throws(
    () => f.run({ action: "answer", attemptId: first.attemptId!, answer: [0] }, retry.answerAfter!),
    /current|stale|attempt/i,
  );
  assert.throws(
    () => f.run({ action: "start", previousAttemptId: null }, retry.answerAfter!),
    /current|stale|attempt/i,
  );
});

test("insufficient Bolts cannot buy a retry or alter a lost result", () => {
  const f = fixture();
  f.data = { ...f.data, sparkLog: [] };
  const first = f.run({ action: "start", previousAttemptId: null }).result.view!;
  const lost = f.run(
    { action: "answer", attemptId: first.attemptId!, answer: [1] },
    first.answerAfter!,
  ).result.view!;
  assert.equal(lost.canRetry, false);
  const before = structuredClone(f.data);
  assert.throws(
    () => f.run({ action: "start", previousAttemptId: first.attemptId! }, first.answerAfter! + 1),
    /10|Bolts/i,
  );
  assert.deepEqual(f.data, before);
});

test("next day gives a new free game without reopening yesterday's reward", () => {
  const f = fixture();
  const first = f.run({ action: "start", previousAttemptId: null }).result.view!;
  f.run({ action: "answer", attemptId: first.attemptId!, answer: [0] }, first.answerAfter!);
  assert.equal(f.run({ action: "claimPrompt" }, FRI).result.showPrompt, true);
  const second = f.run({ action: "start", previousAttemptId: null }, FRI).result.view!;
  assert.equal(second.game, "pumpkins");
  assert.equal(second.attemptNumber, 1);
  assert.equal(f.data.halloweenArcade?.length, 2);
  assert.throws(
    () => f.run({ action: "answer", attemptId: first.attemptId!, answer: [0] }, FRI + 10_000),
    /current|stale|attempt/i,
  );
});

test("pumpkin memory requires the exact set of lit pumpkins", () => {
  const f = fixture();
  const start = f.run({ action: "start", previousAttemptId: null }, FRI).result.view!;
  assert.deepEqual(start.challenge, { kind: "pumpkins", lit: [1, 2], size: 9, revealMs: 3000 });
  const result = f.run(
    { action: "answer", attemptId: start.attemptId!, answer: [2, 1] },
    start.answerAfter!,
  );
  assert.equal(result.result.view?.status, "won");
});

test("potion memory validates sequence order and records the failed choice", () => {
  const f = fixture();
  let n = 0;
  const start = f.run({ action: "start", previousAttemptId: null }, SAT, (max) => n++ % max).result
    .view!;
  assert.equal(start.challenge?.kind, "potions");
  if (start.challenge?.kind !== "potions") throw new Error("Missing potion sequence");
  const wrong = start.challenge.sequence.map((x) => (x + 1) % 4);
  const result = f.run(
    { action: "answer", attemptId: start.attemptId!, answer: wrong },
    start.answerAfter!,
  );
  assert.equal(result.result.view?.status, "lost");
  assert.deepEqual(f.data.halloweenArcade?.[0]?.attempts[0]?.selection, wrong);
  assert.equal(result.result.view?.reward, null);
});

test("hard difficulty and the maximum reward come from server randomness", () => {
  const f = fixture();
  const start = f.run({ action: "start", previousAttemptId: null }, THU, (max) => max - 1).result
    .view!;
  assert.equal(start.difficulty, "hard");
  const result = f.run(
    { action: "answer", attemptId: start.attemptId!, answer: [2] },
    start.answerAfter!,
    (max) => max - 1,
  );
  assert.deepEqual(result.result.view?.reward, { category: "brain", amount: 4 });
  assert.equal("answer" in result.result.view!, false);
  assert.equal("attempts" in result.result.view!, false);
});

test("request validation excludes client dates, outcomes, rewards and invalid choices", () => {
  for (const bad of [
    { action: "status", storeId: "allen" },
    { action: "start", previousAttemptId: null, difficulty: "easy" },
    { action: "start", previousAttemptId: null, date: "2026-10-30" },
    { action: "answer", attemptId: "x", answer: [0], won: true },
    { action: "answer", attemptId: "x", answer: [0], reward: { amount: 99 } },
    { action: "answer", attemptId: "x", answer: [NaN] },
    { action: "answer", attemptId: "x", answer: [Infinity] },
    { action: "answer", attemptId: "x", answer: [-1] },
    { action: "answer", attemptId: "x", answer: [0.5] },
  ])
    assert.equal(halloweenArcadeInputSchema.safeParse(bad).success, false);
  const f = fixture();
  const start = f.run({ action: "start", previousAttemptId: null }).result.view!;
  assert.throws(
    () => f.run({ action: "answer", attemptId: start.attemptId!, answer: [8] }, start.answerAfter!),
    /choice|answer/i,
  );
});

test("the kernel does not mutate its original season or expose stored private answers", () => {
  const f = fixture();
  const before = structuredClone(f.data);
  const source = f.data;
  const changed = f.run({ action: "start", previousAttemptId: null });
  assert.deepEqual(source, before);
  assert.equal(changed.data.halloweenArcade?.[0]?.attempts[0]?.answer.length, 1);
  assert.equal(JSON.stringify(changed.result).includes('"answer":'), false);
});

test("a retry too close to Central midnight is rejected before spending Bolts", () => {
  for (const [startAt, almostMidnight] of [
    [THU, Date.parse("2026-10-30T04:59:55Z")],
    [SAT, Date.parse("2026-11-01T04:59:55Z")],
  ]) {
    const f = fixture();
    const start = f.run({ action: "start", previousAttemptId: null }, startAt).result.view!;
    f.run({ action: "answer", attemptId: start.attemptId!, answer: [1] }, start.answerAfter!);
    const before = structuredClone(f.data);
    assert.equal(f.run({ action: "status" }, almostMidnight).result.view?.canRetry, false);
    assert.throws(
      () => f.run({ action: "start", previousAttemptId: start.attemptId! }, almostMidnight),
      /midnight|enough time/i,
    );
    assert.deepEqual(f.data, before);
  }
});

test("concurrent database requests claim one prompt, charge one retry and award one prize", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      readFileSync(new URL("../migrations/0002_pit_season.sql", import.meta.url), "utf8"),
    );
    const f = fixture();
    await db.query("insert into pit_season(id,rev,doc) values ('main',1,$1)", [
      JSON.stringify(sharedDoc(f.data)),
    ]);
    const sql = {
      query: async <T>(text: string, params: unknown[] = []) =>
        (await db.query(text, params)).rows as T[],
    };
    const snapshot = async (): Promise<HalloweenArcadeSnapshot> => {
      const row = (
        await db.query<{ rev: number; doc: string }>(
          "select rev,doc from pit_season where id='main'",
        )
      ).rows[0]!;
      return {
        sql,
        data: { ...makeData(), ...JSON.parse(row.doc) },
        rev: Number(row.rev),
        session: f.session,
        mode: "preview",
      };
    };
    let now = THU;
    let serial = 0;
    const context = () => ({
      now,
      randomInt: (_max: number) => 0,
      newId: () => `race-${++serial}`,
    });
    const race = async (input: HalloweenArcadeInput) => {
      let entered = 0;
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const simultaneousLoad = async () => {
        const loaded = await snapshot();
        if (entered < 2) {
          entered++;
          if (entered === 2) release();
          await gate;
        }
        return loaded;
      };
      return Promise.all([
        executeHalloweenArcade(input, simultaneousLoad, context),
        executeHalloweenArcade(input, simultaneousLoad, context),
      ]);
    };
    const prompts = await race({ action: "claimPrompt" });
    assert.equal(prompts.filter((r) => r.showPrompt).length, 1);
    assert.equal((await snapshot()).rev, 2);
    const free = await race({ action: "start", previousAttemptId: null });
    assert.equal(free[0]!.view!.attemptId, free[1]!.view!.attemptId);
    assert.equal((await snapshot()).rev, 3);
    now = free[0]!.view!.answerAfter!;
    await executeHalloweenArcade(
      { action: "answer", attemptId: free[0]!.view!.attemptId!, answer: [1] },
      snapshot,
      context,
    );
    now++;
    const paid = await race({ action: "start", previousAttemptId: free[0]!.view!.attemptId! });
    assert.equal(paid[0]!.view!.attemptId, paid[1]!.view!.attemptId);
    const afterRetry = await snapshot();
    assert.equal(afterRetry.rev, 5);
    assert.equal(boltsOf(afterRetry.data, "plano").balance, boltsOf(f.data, "plano").balance - 10);
    assert.equal(afterRetry.data.halloweenArcade?.[0]?.attempts.length, 2);
    now = paid[0]!.view!.answerAfter!;
    const wins = await race({
      action: "answer",
      attemptId: paid[0]!.view!.attemptId!,
      answer: [0],
    });
    assert.deepEqual(wins[0]!.view!.reward, wins[1]!.view!.reward);
    const final = await snapshot();
    assert.equal(final.rev, 6);
    assert.equal(
      final.data.bots.find((b) => b.storeId === "plano")!.coins.chassis,
      f.data.bots.find((b) => b.storeId === "plano")!.coins.chassis + 2,
    );
    assert.deepEqual(
      final.data.halloweenArcade?.[0]?.attempts.map((a) => a.paidBolts),
      [0, 10],
    );
    assert.deepEqual(JSON.parse(wins[0]!.doc).halloweenArcade, []);
  } finally {
    await db.close();
  }
});

test("a retry racing a Locker purchase rechecks the depleted Bolt wallet after losing CAS", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      readFileSync(new URL("../migrations/0002_pit_season.sql", import.meta.url), "utf8"),
    );
    const f = fixture();
    f.data = {
      ...f.data,
      sparkLog: f.data.sparkLog.map((entry) => ({ ...entry, correct: 10, total: 10 })),
    };
    assert.equal(boltsOf(f.data, "plano").balance, 10);
    const first = f.run({ action: "start", previousAttemptId: null }).result.view!;
    f.run({ action: "answer", attemptId: first.attemptId!, answer: [1] }, first.answerAfter!);
    await db.query("insert into pit_season(id,rev,doc) values ('main',1,$1)", [
      JSON.stringify(sharedDoc(f.data)),
    ]);
    const sql = {
      query: async <T>(text: string, params: unknown[] = []) =>
        (await db.query(text, params)).rows as T[],
    };
    const snapshot = async (): Promise<HalloweenArcadeSnapshot> => {
      const row = (
        await db.query<{ rev: number; doc: string }>(
          "select rev,doc from pit_season where id='main'",
        )
      ).rows[0]!;
      return {
        sql,
        data: { ...makeData(), ...JSON.parse(row.doc) },
        rev: Number(row.rev),
        session: f.session,
        mode: "preview",
      };
    };
    let releasePurchase!: () => void;
    const arcadeRead = new Promise<void>((resolve) => {
      releasePurchase = resolve;
    });
    let releaseArcade!: () => void;
    const purchaseCommitted = new Promise<void>((resolve) => {
      releaseArcade = resolve;
    });
    let firstRead = true;
    const retry = executeHalloweenArcade(
      { action: "start", previousAttemptId: first.attemptId! },
      async () => {
        const loaded = await snapshot();
        if (firstRead) {
          firstRead = false;
          releasePurchase();
          await purchaseCommitted;
        }
        return loaded;
      },
      () => ({ now: first.answerAfter! + 1, randomInt: () => 0, newId: () => "must-not-commit" }),
    );
    const purchase = (async () => {
      await arcadeRead;
      try {
        const loaded = await snapshot();
        assert.equal(loaded.rev, 1, "both requests began at the same season revision");
        const store = createStore(pitCreator);
        store.setState({ ...loaded.data, session: loaded.session });
        store.getState().buyLocker("plano", "walkout-smoke");
        assert.ok(
          store
            .getState()
            .stores.find((row) => row.id === "plano")!
            .unlocks?.includes("walkout-smoke"),
        );
        // Persist the ordinary store action exactly as the normal league command path does.
        const committed = await db.query<{ rev: number }>(
          "update pit_season set rev=rev+1,doc=$1,updated_at=now() where id='main' and rev=$2 returning rev",
          [JSON.stringify(sharedDoc(store.getState())), loaded.rev],
        );
        assert.equal(Number(committed.rows[0]?.rev), 2);
      } finally {
        releaseArcade();
      }
    })();
    const [retryResult, purchaseResult] = await Promise.allSettled([retry, purchase]);
    assert.equal(purchaseResult.status, "fulfilled");
    assert.equal(retryResult.status, "rejected");
    if (retryResult.status !== "rejected")
      throw new Error("The depleted wallet funded another retry");
    assert.match(String(retryResult.reason), /10 Bolts|enough/i);
    const final = await snapshot();
    assert.equal(final.rev, 2);
    assert.equal(boltsOf(final.data, "plano").balance, 0);
    assert.ok(
      final.data.stores.find((row) => row.id === "plano")!.unlocks?.includes("walkout-smoke"),
    );
    assert.equal(final.data.halloweenArcade?.[0]?.attempts.length, 1);
    assert.equal(final.data.halloweenArcade?.[0]?.attempts[0]?.status, "lost");
    assert.equal(final.data.halloweenArcade?.[0]?.attempts[0]?.paidBolts, 0);
    assert.deepEqual(final.data.bots, f.data.bots);
  } finally {
    await db.close();
  }
});
