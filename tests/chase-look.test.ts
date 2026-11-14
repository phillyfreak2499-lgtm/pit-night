import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createStore } from "zustand/vanilla";
import { drawPaintSkin, isPaintSkin } from "../src/components/pit/paint-skins.ts";
import { createGarageCosmetics } from "../src/components/pit/garage-3d/cosmetics.ts";
import { DEFAULT_STYLE } from "../src/lib/pit/catalog.ts";
import { cosmeticUnlocked } from "../src/lib/pit/cosmetics.ts";
import { simulateDuel } from "../src/lib/pit/engine.ts";
import { makeData } from "../src/lib/pit/seed.ts";
import {
  COLLEGE_CHASE_GIFT,
  ALLIANCE_GOLD_GIFT,
  TYLER_ROSES_GIFT,
  WEEK2_REPAIR_GIFT,
  grantOwnerGifts,
  ownerGiftDue,
  pitCreator,
} from "../src/lib/pit/store.ts";
import type { BotLookProps } from "../src/components/pit/bot-portrait.tsx";
import type { PitData, Session } from "../src/lib/pit/types.ts";

test("College Station already owns the free chase look before it is equipped", () => {
  const seed = makeData();
  assert.equal(seed.bots.find((bot) => bot.storeId === "college")?.look, "stripe");
  assert.equal(cosmeticUnlocked(seed, "college", "look", "chase"), true);
  for (const store of seed.stores) {
    assert.equal(cosmeticUnlocked(seed, store.id, "look", "chase"), true, store.id);
  }
});

test("the chase armor migration equips College Station once and leaves a captain free to change it", () => {
  const seed = makeData();
  const pastBout = seed.bouts;
  const pastReplay = [{ week: 1, bouts: pastBout }];
  const live = {
    ...seed,
    bouts: pastBout,
    replays: pastReplay,
    ownerEvents: [WEEK2_REPAIR_GIFT, TYLER_ROSES_GIFT, ALLIANCE_GOLD_GIFT],
  } as PitData;
  const now = new Date("2026-11-14T20:00:00Z");
  const due = ownerGiftDue(live, now);
  assert.deepEqual(due, { repairs: false, roses: false, gold: false, chase: true });

  const before = simulateDuel(live, "college", "plano", "chase-armor");
  const gifted = grantOwnerGifts(live, due);
  const college = gifted.bots.find((bot) => bot.storeId === "college")!;
  assert.equal(college.look, "chase");
  assert.equal(cosmeticUnlocked(gifted, "college", "look", "chase"), true);
  assert.ok(gifted.ownerEvents?.includes(COLLEGE_CHASE_GIFT));
  assert.equal(ownerGiftDue(gifted, now).chase, false);

  for (const bot of gifted.bots) {
    const original = live.bots.find((row) => row.storeId === bot.storeId)!;
    if (bot.storeId === "college") {
      assert.notEqual(bot, original);
      assert.equal(bot.coins, original.coins);
      assert.equal(bot.voucher, original.voucher);
      assert.equal(bot.repairSpent, original.repairSpent);
      assert.strictEqual(bot.equipped, original.equipped);
      assert.strictEqual(bot.style, original.style);
    } else {
      assert.equal(bot, original, bot.storeId);
      assert.equal(bot.look, original.look);
    }
  }
  assert.strictEqual(gifted.stores, live.stores);
  assert.strictEqual(gifted.bouts, pastBout);
  assert.strictEqual(gifted.replays, pastReplay);
  assert.strictEqual(gifted.picks, live.picks);
  assert.strictEqual(grantOwnerGifts(gifted, ownerGiftDue(gifted, now)), gifted);

  const after = simulateDuel(gifted, "college", "plano", "chase-armor");
  assert.deepEqual(after.winnerIds, before.winnerIds);
  assert.deepEqual(after.loserIds, before.loserIds);
  assert.equal(after.method, before.method);
  assert.deepEqual(after.hp, before.hp);
  assert.deepEqual(after.exchanges, before.exchanges);
  assert.equal(after.fighters.find((fighter) => fighter.id === "college")?.look, "chase");
  assert.equal(before.fighters.find((fighter) => fighter.id === "college")?.look, "stripe");

  const crew = gifted.crew.find((row) => row.storeId === "college" && row.role === "captain")!;
  const league = createStore(pitCreator);
  league.setState({
    ...gifted,
    session: { role: "captain", storeId: "college", crewId: crew.id } satisfies Session,
  });
  league.getState().setLook("college", "plain");
  const changed = league.getState();
  assert.equal(changed.bots.find((bot) => bot.storeId === "college")?.look, "plain");
  const settled = grantOwnerGifts(changed, ownerGiftDue(changed, now));
  assert.strictEqual(settled, changed);
  assert.equal(settled.bots.find((bot) => bot.storeId === "college")?.look, "plain");
});

test("chase armor draws its name and reaches the garage, broadcast, and overhead", () => {
  assert.equal(isPaintSkin("chase"), true);
  assert.equal(isPaintSkin("plain"), false);
  const texts: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(target, name: string) {
      if (name in target) return target[name];
      if (name === "fillText" || name === "strokeText")
        return (text: string) => {
          texts.push(text);
        };
      return () => {
        if (name.startsWith("create")) return { addColorStop() {} };
        if (name === "measureText") return { width: 8 };
        if (name === "getTransform") return { a: 1 };
      };
    },
  }) as unknown as CanvasRenderingContext2D;
  assert.doesNotThrow(() => drawPaintSkin(ctx, "chase", 0, 0, 120, 48, "#c47a3a", "#f3efe6"));
  assert.ok(texts.includes("CHASE"));

  const look: BotLookProps = {
    id: "college",
    storeName: "College Station",
    paint: "copper",
    classId: "striker",
    weapon: "saw",
    look: "chase",
    number: "5",
    hp: 100,
    style: { ...DEFAULT_STYLE, body: "shrike" },
  };
  const model = createGarageCosmetics(look, { roofY: 0.95, width: 1.5, depth: 2.1 });
  assert.ok(model.getObjectByName("chase roof skin"));
  assert.ok(model.getObjectByName("chase left skin"));
  assert.ok(model.getObjectByName("chase right skin"));
  const cage = readFileSync(new URL("../src/components/pit/cage-draw.ts", import.meta.url), "utf8");
  assert.equal(cage.match(/isPaintSkin\(/g)?.length, 2);
});
