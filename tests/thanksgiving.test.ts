import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createStore } from "zustand/vanilla";
import { pitCreator } from "../src/lib/pit/store.ts";
import { makeData, WEEK_META } from "../src/lib/pit/seed.ts";
import { PARTS, TIER_PRICE, partById, stockPart } from "../src/lib/pit/catalog.ts";
import { programWeek } from "../src/lib/pit/training.ts";
import { cosmeticUnlocked, earnedRewardIds, THANKSGIVING_REWARD_IDS } from "../src/lib/pit/cosmetics.ts";
import { authorize, commandArgs } from "../src/lib/pit/commands.ts";
import { buyCheck, championshipFinalists, showCheck, simulateDuel } from "../src/lib/pit/engine.ts";
import { central } from "../src/lib/pit/time.ts";
import { SHOW_PRICE } from "../src/lib/pit/halloween.ts";
import {
  THANKSGIVING_CLOSE,
  THANKSGIVING_CLOSED_REASON,
  THANKSGIVING_FINALIST_REASON,
  THANKSGIVING_OPEN,
  THANKSGIVING_PART_IDS,
  THANKSGIVING_SHOW_CLOSED_REASON,
  THANKSGIVING_SHOW_EFFECTS,
  THANKSGIVING_VISUAL_START,
  THANKSGIVING_WEEK_START,
  isThanksgivingPart,
  thanksgivingOpen,
  thanksgivingVisuals,
} from "../src/lib/pit/thanksgiving.ts";
import type { Bot, Bout, ClassId, FightResult, Loadout, PitData, Session } from "../src/lib/pit/types.ts";

const NAMES: Record<(typeof THANKSGIVING_PART_IDS)[number], string> = {
  "weapon-carver-super": "Turkey Carver",
  "weapon-yamcannon-super": "Sweet Potato Cannon",
  "chassis-harvesttable-super": "Harvest Table",
  "armor-platter-super": "Serving Platter",
  "drive-haywagon-super": "Hay Wagon",
};

const NUDGES: Record<(typeof THANKSGIVING_PART_IDS)[number], [number, number, number, number]> = {
  "weapon-carver-super": [4, 0, -1, 0],
  "weapon-yamcannon-super": [2, -1, 1, 2],
  "chassis-harvesttable-super": [1, -1, 4, -1],
  "armor-platter-super": [0, 0, 4, 1],
  "drive-haywagon-super": [1, 3, -2, 0],
};

test("Thanksgiving dates follow Championship Week (programWeek 5)", () => {
  const week5 = programWeek(5)!;
  assert.equal(week5.start, "2026-11-24");
  assert.equal(THANKSGIVING_WEEK_START.toISOString(), "2026-11-24T06:00:00.000Z");
  assert.equal(THANKSGIVING_OPEN.toISOString(), THANKSGIVING_WEEK_START.toISOString());
  assert.equal(THANKSGIVING_VISUAL_START.toISOString(), "2026-11-23T06:00:00.000Z");
  assert.equal(THANKSGIVING_CLOSE.toISOString(), "2026-11-29T06:00:00.000Z");

  // Parts: closed the night before, open Tuesday midnight, open Saturday evening, shut Sunday.
  assert.equal(thanksgivingOpen(central(2026, 11, 23, 23, 59)), false);
  assert.equal(thanksgivingOpen(THANKSGIVING_OPEN), true);
  assert.equal(thanksgivingOpen(central(2026, 11, 28, 18)), true);
  assert.equal(thanksgivingOpen(new Date(THANKSGIVING_CLOSE.getTime() - 1)), true);
  assert.equal(thanksgivingOpen(THANKSGIVING_CLOSE), false);

  // Decorations: off Sunday Nov 22, on Monday Nov 23, off Sunday Nov 29.
  assert.equal(thanksgivingVisuals(central(2026, 11, 22, 12)), false);
  assert.equal(thanksgivingVisuals(THANKSGIVING_VISUAL_START), true);
  assert.equal(thanksgivingVisuals(central(2026, 11, 28, 23)), true);
  assert.equal(thanksgivingVisuals(THANKSGIVING_CLOSE), false);

  // Standing owner rule: no "Nov 23" strings in week meta copy.
  for (const meta of WEEK_META) assert.doesNotMatch(meta.blurb, /Nov 23|November 23/);
});

test("catalog integrity: five Super parts, 8 coins, windowed, ungated, unlocked class", () => {
  for (const id of THANKSGIVING_PART_IDS) {
    const part = partById(id)!;
    assert.ok(part, id);
    assert.equal(isThanksgivingPart(id), true);
    assert.equal(part.name, NAMES[id]);
    assert.equal(part.tier, "super");
    assert.equal(part.price, 8);
    assert.equal(part.price, TIER_PRICE.super);
    assert.equal(part.classLock, undefined);
    assert.equal(part.greenWeeks, undefined);
    assert.deepEqual(part.window, { start: [11, 24], end: [11, 28] });
    assert.ok(part.tags.includes("thanksgiving"));
    const [power, speed, armor, heat] = NUDGES[id];
    assert.deepEqual(part.nudge, { power, speed, armor, heat });
    assert.match(part.job, /Championship Week only\. Eight/);
  }
  assert.equal(partById("chassis-harvesttable-super")!.battery, 80);
  assert.equal(isThanksgivingPart("weapon-chainsaw-super"), false);
  assert.equal(isThanksgivingPart("weapon-saw-super"), false);

  const leaves = THANKSGIVING_SHOW_EFFECTS.find((effect) => effect.id === "leaves")!;
  assert.equal(leaves.name, "Falling Leaves");
  assert.equal(leaves.price, SHOW_PRICE);
  assert.equal(leaves.price, 8);
  assert.equal(leaves.key, "utility");
});

test("no Thanksgiving nudge strictly dominates a same-slot super, and names stay clean", () => {
  const keys = ["power", "speed", "armor", "heat"] as const;
  const dominates = (
    a: { power: number; speed: number; armor: number; heat: number },
    b: typeof a,
  ) => {
    let better = false;
    for (const key of keys) {
      if (a[key] < b[key]) return false;
      if (a[key] > b[key]) better = true;
    }
    return better;
  };
  for (const id of THANKSGIVING_PART_IDS) {
    const part = partById(id)!;
    const peers = PARTS.filter((other) => other.slot === part.slot && other.tier === "super" && other.id !== part.id);
    assert.ok(peers.length > 0, part.name);
    for (const other of peers) assert.equal(dominates(part.nudge, other.nudge), false, `${part.name} vs ${other.name}`);
  }
  const banned = /jason|voorhees|myers|ghostbusters|ecto|skynet|macy|charlie brown|snoopy/i;
  for (const id of THANKSGIVING_PART_IDS) {
    const part = partById(id)!;
    assert.equal(banned.test(`${part.name} ${part.job}`), false, part.name);
  }
  for (const effect of THANKSGIVING_SHOW_EFFECTS) assert.equal(banned.test(`${effect.name} ${effect.blurb}`), false);
});

test("buy gate: closed before Nov 24, finalist-only in Week 5, owned parts stay owned after close", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: central(2026, 11, 23, 12).getTime() });
  const league = state();
  fund(league);

  // Monday Nov 23: decorations are up, but no Thanksgiving part can be bought yet.
  assert.equal(thanksgivingVisuals(), true);
  for (const id of THANKSGIVING_PART_IDS) {
    const check = buyCheck(league.getState(), "plano", partById(id)!);
    assert.equal(check.ok, false, id);
    assert.equal(check.reason, THANKSGIVING_CLOSED_REASON);
  }
  assert.equal(showCheck(league.getState(), "plano", "leaves").ok, false);
  assert.equal(showCheck(league.getState(), "plano", "leaves").reason, THANKSGIVING_SHOW_CLOSED_REASON);
  // Halloween show effects are untouched by the Thanksgiving gate.
  assert.equal(showCheck(league.getState(), "plano", "fog").ok, true);
  assert.equal(showCheck(league.getState(), "plano", "blacklight").ok, true);

  // Week 5, inside the window: plano is a finalist, allen is not.
  const season = week5Season(league);
  assert.deepEqual(championshipFinalists(season), expectFinalists(season));
  const finalist = championshipFinalists(season).includes("plano") ? "plano" : championshipFinalists(season)[0]!;
  const outsider = season.stores.find((s) => !championshipFinalists(season).includes(s.id))!.id;
  t.mock.timers.setTime(central(2026, 11, 25, 12).getTime());

  for (const id of THANKSGIVING_PART_IDS) {
    const part = partById(id)!;
    const refused = buyCheck(season, outsider, part);
    assert.equal(refused.ok, false, `${outsider} ${id}`);
    assert.equal(refused.reason, THANKSGIVING_FINALIST_REASON);
    const open = buyCheck(season, finalist, part);
    assert.equal(open.ok, true, `${finalist} ${id}`);
    assert.equal(open.cost, 8);
  }

  // The outsider's store-level buy is refused too, and no coins move.
  const outsiderCaptain = season.crew.find((c) => c.storeId === outsider && c.role === "captain")!;
  league.setState({ session: { role: "captain", storeId: outsider, crewId: outsiderCaptain.id } satisfies Session });
  const outsiderCoins = JSON.stringify(botOf(league, outsider).coins);
  league.getState().buyPart(outsider, "weapon-carver-super");
  assert.equal(JSON.stringify(botOf(league, outsider).coins), outsiderCoins);
  assert.equal(botOf(league, outsider).owned.includes("weapon-carver-super"), false);

  // The finalist buys at exactly 8 from the right jar.
  const finalistCaptain = season.crew.find((c) => c.storeId === finalist && c.role === "captain")!;
  league.setState({ session: { role: "captain", storeId: finalist, crewId: finalistCaptain.id } satisfies Session });
  const weaponBefore = botOf(league, finalist).coins.weapon;
  const chassisBefore = botOf(league, finalist).coins.chassis;
  league.getState().buyPart(finalist, "weapon-carver-super");
  league.getState().buyPart(finalist, "chassis-harvesttable-super");
  assert.equal(botOf(league, finalist).coins.weapon, weaponBefore - 8);
  assert.equal(botOf(league, finalist).coins.chassis, chassisBefore - 8);
  assert.ok(botOf(league, finalist).owned.includes("weapon-carver-super"));

  // After the close, new purchases fail with the closed reason, but owned iron stays owned.
  t.mock.timers.setTime(THANKSGIVING_CLOSE.getTime());
  const late = buyCheck(league.getState(), finalist, partById("weapon-yamcannon-super")!);
  assert.equal(late.ok, false);
  assert.equal(late.reason, THANKSGIVING_CLOSED_REASON);
  assert.ok(botOf(league, finalist).owned.includes("weapon-carver-super"));
  assert.ok(botOf(league, finalist).owned.includes("chassis-harvesttable-super"));
});

test("Falling Leaves sells league-wide in Week 5, finalist or not", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: central(2026, 11, 25, 12).getTime() });
  const league = state();
  fund(league);
  const season = week5Season(league);
  const outsider = season.stores.find((s) => !championshipFinalists(season).includes(s.id))!.id;

  assert.equal(showCheck(season, outsider, "leaves").ok, true);

  // Store level: the Week 5 prep guard must not block a show purchase.
  const outsiderCaptain = season.crew.find((c) => c.storeId === outsider && c.role === "captain")!;
  league.setState({ session: { role: "captain", storeId: outsider, crewId: outsiderCaptain.id } satisfies Session });
  const utilityBefore = botOf(league, outsider).coins.utility;
  league.getState().buyShow(outsider, "leaves");
  assert.deepEqual(botOf(league, outsider).shows, ["leaves"]);
  assert.equal(botOf(league, outsider).coins.utility, utilityBefore - 8);
  assert.match(league.getState().flash, /Falling Leaves is in the rafters/);

  const session = league.getState().session;
  assert.doesNotThrow(() => authorize(league.getState(), session, "buyShow", [outsider, "leaves"]));
  assert.equal(commandArgs.buyShow.safeParse([outsider, "leaves"]).success, true);
  assert.equal(commandArgs.buyShow.safeParse([outsider, "gore"]).success, false);

  // Fog and Blacklight keep their pre-existing Week 5 behaviour: the prep
  // guard still turns a non-finalist away, and a finalist buys as before.
  league.getState().buyShow(outsider, "fog");
  assert.deepEqual(botOf(league, outsider).shows, ["leaves"]);
  assert.match(league.getState().flash, /conference champions/);

  const finalist = championshipFinalists(season)[0]!;
  const finalistCaptain = season.crew.find((c) => c.storeId === finalist && c.role === "captain")!;
  league.setState({ session: { role: "captain", storeId: finalist, crewId: finalistCaptain.id } satisfies Session });
  league.getState().buyShow(finalist, "fog");
  assert.deepEqual(botOf(league, finalist).shows, ["fog"]);
  assert.match(league.getState().flash, /Fog Machine is in the rafters/);
});

test("Week 5 activity earns the four Thanksgiving looks; Week 4 activity does not", () => {
  const data = makeData();
  const shout = (id: string, week: number): PitData["shouts"][number] => ({
    id,
    week,
    storeId: "plano",
    fromCrewId: "plano-captain",
    fromName: "Dana Ruiz",
    to: "Allen",
    text: "Rally!",
    at: 1,
  });

  assert.equal(cosmeticUnlocked(data, "plano", "decal", "turkey"), false);
  data.shouts.push(shout("s-w4", 4));
  assert.equal(cosmeticUnlocked(data, "plano", "decal", "turkey"), false);
  data.shouts.push(shout("s-w5-a", 5));
  assert.equal(cosmeticUnlocked(data, "plano", "decal", "turkey"), true);
  assert.equal(cosmeticUnlocked(data, "plano", "topper", "pilgrimhat"), false);
  data.shouts.push(shout("s-w5-b", 5), shout("s-w5-c", 5));
  assert.equal(cosmeticUnlocked(data, "plano", "topper", "pilgrimhat"), true);

  const spark = (id: string, week: number, correct: number, total: number): PitData["sparkLog"][number] => ({
    id,
    week,
    day: "tue",
    storeId: "plano",
    crewId: "plano-captain",
    correct,
    total,
    at: 1,
  });
  data.sparkLog.push(spark("sp-w4", 4, 3, 3));
  assert.equal(cosmeticUnlocked(data, "plano", "topper", "wreath"), false);
  data.sparkLog.push(spark("sp-w5-short", 5, 2, 3));
  assert.equal(cosmeticUnlocked(data, "plano", "topper", "wreath"), false);
  data.sparkLog.push(spark("sp-w5", 5, 3, 3));
  assert.equal(cosmeticUnlocked(data, "plano", "topper", "wreath"), true);

  // Wishbone: the pick must hit the Week 5 final itself.
  const result: FightResult = {
    winnerIds: ["plano"],
    loserIds: ["waco"],
    method: "ko",
    blowout: false,
    exchanges: [],
    finisher: null,
    hp: {},
    fighters: [],
    wear: {},
    seed: "synthetic-final",
  };
  const finalBout: Bout = {
    id: "w5-final",
    week: 5,
    slot: 0,
    kind: "final",
    title: "Waterman Championship",
    storeIds: ["plano", "waco"],
    teamA: ["plano"],
    teamB: ["waco"],
    result,
  };
  const semiBout: Bout = { ...finalBout, id: "w5-semi", kind: "semi", title: "Semifinal" };
  data.bouts.push(finalBout, semiBout);
  const pick = (id: string, boutId: string, picked: string): PitData["picks"][number] => ({
    id,
    week: 5,
    boutId,
    storeId: "allen",
    crewId: "allen-captain",
    pick: picked,
    at: 1,
  });
  data.picks.push(pick("pk-semi", "w5-semi", "plano"));
  assert.equal(cosmeticUnlocked(data, "allen", "decal", "wishbone"), false);
  data.picks.push(pick("pk-wrong", "w5-final", "waco"));
  assert.equal(cosmeticUnlocked(data, "allen", "decal", "wishbone"), false);
  data.picks.push(pick("pk-right", "w5-final", "plano"));
  assert.equal(cosmeticUnlocked(data, "allen", "decal", "wishbone"), true);

  for (const id of THANKSGIVING_REWARD_IDS) assert.ok(earnedRewardIds(data, id === "reward-wishbone" ? "allen" : "plano").has(id), id);

  // Unlocks persist in a synthetic later state: the logs, not the calendar, carry them.
  const later = { ...data, week: 6 } as PitData;
  assert.equal(cosmeticUnlocked(later, "plano", "decal", "turkey"), true);
  assert.equal(cosmeticUnlocked(later, "plano", "topper", "pilgrimhat"), true);
  assert.equal(cosmeticUnlocked(later, "plano", "topper", "wreath"), true);
  assert.equal(cosmeticUnlocked(later, "allen", "decal", "wishbone"), true);
});

test("shout and Spark unlocks announce with the does-not-change-the-fight line", () => {
  const league = state();
  league.setState({ week: 5, phase: "open" });
  league.getState().postShout("Allen", "Rally behind the finalists!");
  assert.match(league.getState().flash, /Turkey Sticker/);
  assert.match(league.getState().flash, /does not change the fight/);
  assert.equal(cosmeticUnlocked(league.getState(), "plano", "decal", "turkey"), true);
});

test("owning or wearing Thanksgiving looks and leaves never changes a duel", () => {
  const plain = makeData();
  const dressed = structuredClone(plain) as PitData;
  dressed.bots = dressed.bots.map((b) =>
    b.storeId === "plano"
      ? {
          ...b,
          owned: [...b.owned, ...THANKSGIVING_PART_IDS],
          shows: ["leaves"],
          style: {
            ...b.style,
            topper: "wreath" as const,
            stickers: { left: "turkey" as const, right: "wishbone" as const, hood: "none" as const, rear: "none" as const },
          },
        }
      : b,
  );
  const before = simulateDuel(plain, "plano", "allen", "thanksgiving-looks");
  const after = simulateDuel(dressed, "plano", "allen", "thanksgiving-looks");
  assert.deepEqual(after.exchanges, before.exchanges);
  assert.deepEqual(after.winnerIds, before.winnerIds);

  // Swapped-in Thanksgiving iron fights deterministically: same seed, same fight, 40 seeds.
  for (const id of THANKSGIVING_PART_IDS) {
    const part = partById(id)!;
    for (let seed = 0; seed < 40; seed++) {
      const data = dress(base0(), "striker", id, stockPart(part.slot, "striker").id);
      const first = simulateDuel(data, "plano", "allen", `tg:${id}:${seed}`);
      const second = simulateDuel(data, "plano", "allen", `tg:${id}:${seed}`);
      assert.deepEqual(second.exchanges, first.exchanges);
      assert.deepEqual(second.winnerIds, first.winnerIds);
      assert.ok(first.exchanges.length > 0);
    }
  }
});

test("seeded class matchups of each Thanksgiving part against existing supers", () => {
  const classes: ClassId[] = ["striker", "tank", "specialist"];
  const seeds = 24;
  const lines: string[] = [];
  for (const classId of classes) {
    for (const tgId of THANKSGIVING_PART_IDS) {
      const tg = partById(tgId)!;
      const peers = PARTS.filter(
        (part) =>
          part.slot === tg.slot &&
          part.tier === "super" &&
          part.id !== tg.id &&
          !part.tags.includes("thanksgiving") &&
          (part.classLock == null || part.classLock === classId),
      );
      assert.ok(peers.length > 0, `${classId} ${tg.name}`);
      let wins = 0;
      let fights = 0;
      for (const peer of peers) {
        for (let seed = 0; seed < seeds; seed++) {
          const data = dress(base0(), classId, tg.id, peer.id);
          const result = simulateDuel(data, "plano", "allen", `tg:${classId}:${tg.id}:${peer.id}:${seed}`);
          fights += 1;
          if (result.winnerIds.includes("plano")) wins += 1;
        }
      }
      lines.push(`${classId} ${tg.name} vs ${peers.length} ${tg.slot} supers: ${((wins / fights) * 100).toFixed(1)}% (${wins}/${fights})`);
    }
  }
  console.log(["Thanksgiving balance (plano win rate, report-only)", ...lines].join("\n"));
  assert.equal(lines.length, classes.length * THANKSGIVING_PART_IDS.length);
});

test("shop copy: no November 1–28 claim survives, and the leaves section carries its own dates", () => {
  const shop = readFileSync(new URL("../src/components/pit/shop-page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(shop, /November 1–28 only/);
  assert.match(shop, /Tuesday November 24 through Saturday November 28/);
  assert.match(shop, /League-wide — finalist or not/);
  const rules = readFileSync(new URL("../src/components/pit/rules-page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(rules, /Nov 23|November 23/);
});

/* ------------------------------------------------------------ helpers */

function state() {
  const store = createStore(pitCreator);
  const crew = store.getState().crew.find((c) => c.storeId === "plano" && c.role === "captain")!;
  store.setState({
    trainingOpenAll: true,
    session: { role: "captain", storeId: "plano", crewId: crew.id } satisfies Session,
  });
  store.getState().chooseStarterBody("plano", "striker", "shrike");
  return store;
}

function fullCoins(n: number): Bot["coins"] {
  return { chassis: n, armor: n, drive: n, weapon: n, utility: n, brain: n };
}

function fund(store: ReturnType<typeof state>) {
  store.setState({
    week: 2,
    phase: "open",
    bots: store.getState().bots.map((b) => ({ ...b, locked: null, coins: fullCoins(40) })),
  });
}

function botOf(store: ReturnType<typeof state>, storeId: string) {
  return store.getState().bots.find((b) => b.storeId === storeId)!;
}

function base0() {
  return makeData();
}

/**
 * Synthetic completed regular season: each conference gets one clear
 * champion (4 conference wins), everyone else at most 2 wins overall, so
 * championshipFinalists resolves exactly two stores.
 */
function syntheticSeasonBouts(data: PitData): Bout[] {
  const result = (winner: string, loser: string): FightResult => ({
    winnerIds: [winner],
    loserIds: [loser],
    method: "decision",
    blowout: false,
    exchanges: [],
    finisher: null,
    hp: {},
    fighters: [],
    wear: {},
    seed: `synthetic-${winner}-${loser}`,
  });
  const pairs: [string, string][] = [];
  for (const conference of ["metro", "frontier"] as const) {
    const stores = data.stores.filter((s) => s.conference === conference).map((s) => s.id);
    const champion = stores[0]!;
    const rest = stores.slice(1);
    for (const rival of rest.slice(0, 4)) pairs.push([champion, rival]);
    const cycle: [number, number][] = [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 3]];
    for (const [a, b] of cycle) pairs.push([rest[a]!, rest[b]!]);
  }
  const metroRest = data.stores.filter((s) => s.conference === "metro").map((s) => s.id).slice(1);
  const frontierRest = data.stores.filter((s) => s.conference === "frontier").map((s) => s.id).slice(1);
  for (let i = 0; i < 8; i++) pairs.push([metroRest[i % metroRest.length]!, frontierRest[(i + 3) % frontierRest.length]!]);
  return pairs.map(([winner, loser], i) => ({
    id: `synthetic-${i}`,
    week: (i % 4) + 1,
    slot: Math.floor(i / 4),
    kind: "bout" as const,
    title: "Synthetic card",
    storeIds: [winner, loser],
    teamA: [winner],
    teamB: [loser],
    result: result(winner, loser),
  }));
}

function week5Season(store: ReturnType<typeof state>): PitData {
  const bouts = syntheticSeasonBouts(store.getState());
  store.setState({ week: 5, phase: "open", bouts });
  return store.getState();
}

function expectFinalists(data: PitData): string[] {
  return ["metro", "frontier"].map(
    (conference) => data.stores.find((s) => s.conference === conference)!.id,
  );
}

function dress(base: PitData, classId: ClassId, partId: string, peerId: string): PitData {
  const part = partById(partId)!;
  const peer = partById(peerId)!;
  const data = structuredClone(base) as PitData;
  const apply = (storeId: string, id: string, slot: typeof part.slot) => {
    const bot = data.bots.find((row) => row.storeId === storeId)!;
    const draft: Loadout = {
      chassis: stockPart("chassis", classId).id,
      armor: stockPart("armor", classId).id,
      drive: stockPart("drive", classId).id,
      weapon: stockPart("weapon", classId).id,
      utility: stockPart("utility", classId).id,
      brain: stockPart("brain", classId).id,
    };
    draft[slot] = id;
    bot.classId = classId;
    bot.draft = draft;
    bot.locked = null;
    bot.equipped = { ...draft };
    bot.owned = [...new Set([...bot.owned, id])];
  };
  apply("plano", part.id, part.slot);
  apply("allen", peer.id, peer.slot);
  return data;
}
