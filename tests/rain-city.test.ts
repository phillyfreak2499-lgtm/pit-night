import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { createStore } from "zustand/vanilla";
import { createGarageCosmetics } from "../src/components/pit/garage-3d/cosmetics.ts";
import { drawPaintSkin } from "../src/components/pit/paint-skins.ts";
import { stickerBadge } from "../src/components/pit/cage-draw.ts";
import type { BotLookProps } from "../src/components/pit/bot-portrait.tsx";
import { DEFAULT_STYLE, styleOf } from "../src/lib/pit/catalog.ts";
import { commandArgs } from "../src/lib/pit/commands.ts";
import { checkedCosmeticLoadout } from "../src/lib/pit/cosmetic-loadout.ts";
import { cosmeticOffered, cosmeticUnlocked, garageThemeUnlocked } from "../src/lib/pit/cosmetics.ts";
import { simulateDuel } from "../src/lib/pit/engine.ts";
import { RAIN_CITY } from "../src/lib/pit/rain-city.ts";
import { makeData } from "../src/lib/pit/seed.ts";
import { applyLeague14, pitCreator } from "../src/lib/pit/store.ts";
import type { BotStyle, PitData, Session } from "../src/lib/pit/types.ts";

const BANNED = /seahawk|seattle|\bnfl\b|12th man|hawk[-\s]?head/i;

test("Rain City copy stays original and uses the bay palette", () => {
  assert.equal(RAIN_CITY.navy, "#002244");
  assert.equal(RAIN_CITY.green, "#69BE28");
  assert.equal(RAIN_CITY.gray, "#A5ACAF");
  assert.equal(RAIN_CITY.flair, "Loudest Bay in Texas");
  assert.equal(RAIN_CITY.scheme, "Rain City");
  const files = [
    "../src/lib/pit/rain-city.ts",
    "../src/components/pit/rain-city-banner.tsx",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(text, BANNED, file);
  }
  const joined = `${RAIN_CITY.scheme} ${RAIN_CITY.flair} ${RAIN_CITY.decalLabel}`;
  assert.doesNotMatch(joined, BANNED);
});

test("Rain City is free for Southlake and locked for every other store", () => {
  const data = makeData();
  for (const store of data.stores) {
    const home = store.id === RAIN_CITY.storeId;
    assert.equal(cosmeticUnlocked(data, store.id, "look", RAIN_CITY.look), home, store.id);
    assert.equal(cosmeticUnlocked(data, store.id, "decal", RAIN_CITY.decal), home, store.id);
    assert.equal(cosmeticUnlocked(data, store.id, "topper", RAIN_CITY.topper), home, store.id);
    assert.equal(cosmeticUnlocked(data, store.id, "decal", `${RAIN_CITY.decal}-foil`), false, store.id);
    assert.equal(garageThemeUnlocked(store.id, RAIN_CITY.garage), home, store.id);
    assert.equal(cosmeticOffered(store.id, "look", RAIN_CITY.look), home);
    assert.equal(cosmeticOffered(store.id, "decal", `${RAIN_CITY.decal}-foil`), home);
    assert.equal(cosmeticUnlocked(data, store.id, "look", "seahawks"), true);
    assert.equal(cosmeticOffered(store.id, "look", "plain"), true);
    assert.equal(garageThemeUnlocked(store.id, "bone"), true);
  }
});

function captain(storeId: string) {
  const league = createStore(pitCreator);
  const crew = league.getState().crew.find((row) => row.storeId === storeId && row.role === "captain")!;
  league.setState({
    session: { role: "captain", storeId, crewId: crew.id } satisfies Session,
  });
  return league;
}

test("Southlake can equip the set and other bays cannot", () => {
  const south = captain("southlake");
  const before = south.getState().bots.find((bot) => bot.storeId === "southlake")!;
  const equipped = structuredClone(before.equipped);
  const coins = structuredClone(before.coins);
  const repairSpent = before.repairSpent;
  const fightBefore = simulateDuel(south.getState(), "southlake", "plano", "rain-city");
  south.getState().setLook("southlake", RAIN_CITY.look);
  south.getState().setStyle("southlake", {
    topper: RAIN_CITY.topper,
    decal: RAIN_CITY.decal,
    stickers: { left: "none", right: "none", hood: RAIN_CITY.decal, rear: "none" },
  });
  south.getState().setGarage("southlake", RAIN_CITY.garage);
  const dressed = south.getState().bots.find((bot) => bot.storeId === "southlake")!;
  const bay = south.getState().stores.find((store) => store.id === "southlake")!;
  assert.equal(dressed.look, RAIN_CITY.look);
  assert.equal(dressed.style?.topper, RAIN_CITY.topper);
  assert.equal(dressed.style?.stickers?.hood, RAIN_CITY.decal);
  assert.equal(bay.garage, RAIN_CITY.garage);
  assert.deepEqual(dressed.equipped, equipped);
  assert.deepEqual(dressed.coins, coins);
  assert.equal(dressed.repairSpent, repairSpent);
  const fightAfter = simulateDuel(south.getState(), "southlake", "plano", "rain-city");
  assert.deepEqual(fightAfter.exchanges, fightBefore.exchanges);

  const plano = captain("plano");
  const plain = plano.getState().bots.find((bot) => bot.storeId === "plano")!;
  const floor = plano.getState().stores.find((store) => store.id === "plano")!.garage;
  plano.getState().setLook("plano", RAIN_CITY.look);
  assert.match(plano.getState().flash, /locked/i);
  assert.equal(plano.getState().bots.find((bot) => bot.storeId === "plano")!.look, plain.look);
  plano.getState().setStyle("plano", { topper: RAIN_CITY.topper, decal: RAIN_CITY.decal });
  assert.notEqual(plano.getState().bots.find((bot) => bot.storeId === "plano")!.style?.topper, RAIN_CITY.topper);
  plano.getState().setGarage("plano", RAIN_CITY.garage);
  assert.equal(plano.getState().stores.find((store) => store.id === "plano")!.garage, floor);
  assert.match(plano.getState().flash, /Southlake/);

  const proposed = checkedCosmeticLoadout(plano.getState(), "plano", {
    paint: "amber",
    look: RAIN_CITY.look,
    number: "1",
    style: styleOf(plain),
  });
  assert.equal(proposed, null);
  const allowed = checkedCosmeticLoadout(south.getState(), "southlake", {
    paint: bay.paint,
    look: RAIN_CITY.look,
    number: dressed.number,
    style: styleOf(dressed),
  });
  assert.ok(allowed);
  assert.equal(commandArgs.setLook.safeParse(["southlake", RAIN_CITY.look]).success, true);
  assert.equal(commandArgs.setGarage.safeParse(["southlake", RAIN_CITY.garage]).success, true);
  assert.equal(commandArgs.setLook.safeParse(["plano", "plain"]).success, true);
  assert.equal(commandArgs.setGarage.safeParse(["plano", "bone"]).success, true);
});

test("a season saved before Rain City still loads with bolts, repairs, and replays", () => {
  const seeded = makeData();
  const tape = simulateDuel(seeded, "southlake", "plano", "old-tape");
  const vintage = JSON.parse(JSON.stringify(seeded)) as PitData;
  vintage.version = 5;
  const bout = {
    id: "old-southlake",
    week: 1,
    slot: 1,
    kind: "bout" as const,
    title: "Saved card",
    storeIds: ["southlake", "plano"],
    teamA: ["southlake"],
    teamB: ["plano"],
    result: tape,
  };
  vintage.bouts = [bout];
  vintage.replays = [{ week: 1, bouts: [JSON.parse(JSON.stringify(bout))] }];
  const southStore = vintage.stores.find((store) => store.id === "southlake")!;
  southStore.boltsSpent = 4;
  southStore.boltCoins = { "2": 5 };
  southStore.garage = "bone";
  const southBot = vintage.bots.find((bot) => bot.storeId === "southlake")!;
  southBot.look = "plain";
  southBot.repairSpent = 2;
  southBot.services = 1;
  for (const bot of vintage.bots) {
    if (!bot.style) continue;
    const { finish, decal, trim, eye, flag } = bot.style;
    bot.style = { finish, decal, trim, eye, flag };
  }
  southBot.style = { finish: "factory", decal: "flames", trim: "steel", eye: "green", flag: false };
  const loaded = applyLeague14(JSON.parse(JSON.stringify(vintage)) as PitData);
  assert.equal(loaded.stores.length, seeded.stores.length);
  assert.equal(loaded.bots.length, seeded.bots.length);
  assert.deepEqual(loaded.bouts.map((row) => row.id), vintage.bouts.map((row) => row.id));
  assert.equal(loaded.replays?.some((row) => row.week === bout.week && row.bouts[0]?.id === bout.id), true);
  const loadedStore = loaded.stores.find((store) => store.id === "southlake")!;
  const loadedBot = loaded.bots.find((bot) => bot.storeId === "southlake")!;
  assert.equal(loadedStore.boltsSpent, 4);
  assert.deepEqual(loadedStore.boltCoins, { "2": 5 });
  assert.equal(loadedStore.garage, "bone");
  assert.equal(loadedBot.look, "plain");
  assert.equal(loadedBot.repairSpent, 2);
  assert.equal(loadedBot.services, 1);
  const styled = styleOf(loadedBot);
  assert.equal(styled.leds, "none");
  assert.equal(styled.smoke, "");
  assert.equal(styled.banner, "");
  assert.equal(styled.stickers?.hood, "flames");
  assert.equal(loadedBot.style?.stickers?.hood, "flames");
});

test("Rain City is drawn on the hull, the sticker, and the crowd topper", () => {
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(target, name: string) {
      if (name in target) return target[name];
      return () => {
        if (name.startsWith("create")) return { addColorStop() {} };
        if (name === "measureText") return { width: 8 };
        if (name === "getTransform") return { a: 1 };
      };
    },
  }) as unknown as CanvasRenderingContext2D;
  assert.doesNotThrow(() => drawPaintSkin(ctx, "rain-city", 0, 0, 120, 48, RAIN_CITY.navy, RAIN_CITY.gray));
  assert.doesNotThrow(() => stickerBadge(ctx, "rainfeather", 40, 24, 48, 32, RAIN_CITY.navy, "southlake", "4", true));

  const dimensions = { roofY: 0.95, width: 1.5, depth: 2.1 };
  const look: BotLookProps = {
    id: "southlake",
    storeName: "Southlake",
    paint: "bone",
    classId: "tank",
    weapon: "wedge",
    look: "rain-city",
    number: "4",
    hp: 100,
    style: {
      ...DEFAULT_STYLE,
      topper: "loudest",
      decal: "rainfeather",
      stickers: { left: "none", right: "none", hood: "rainfeather", rear: "none" },
    } satisfies BotStyle,
  };
  const model = createGarageCosmetics(look, dimensions);
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const positions = object.geometry.getAttribute("position");
    for (const value of positions.array) assert.ok(Number.isFinite(value), object.name);
  });
  assert.ok(model.getObjectByName("rain-city roof skin"));
  assert.ok(model.getObjectByName("Hood sticker rainfeather"));
  assert.ok(model.getObjectByName("Crowd megaphone"));
  assert.ok(model.getObjectByName("Crowd noise arc"));
});

test("the bay UI offers Rain City only as Southlake's scheme, feather, flair, and floor", () => {
  const garage = readFileSync(new URL("../src/components/pit/garage-page.tsx", import.meta.url), "utf8");
  const storePage = readFileSync(new URL("../src/components/pit/store-page.tsx", import.meta.url), "utf8");
  for (const id of ["rain-city-look", "rain-feather-decal", "loudest-bay-topper", "rain-city-bay"]) {
    assert.match(garage, new RegExp(id));
  }
  assert.match(garage, /cosmeticOffered/);
  assert.match(storePage, /RainCityBanner/);
  assert.match(storePage, /loudest-flair/);
  assert.match(garage, /Loudest Bay in Texas|RAIN_CITY\.flair/);
  assert.doesNotMatch(storePage, BANNED);
});
