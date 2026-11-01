/**
 * Matchup matrix for battery/stamina balance.
 * Combat is deterministic, so each build pair is one fight, not a Monte Carlo.
 * Run before and after the vitals change and diff the JSON.
 *
 *   node --experimental-strip-types --import ./scripts/register-pit-loader.mjs scripts/balance-vitals.ts
 */
import { writeFileSync } from "node:fs";
import { fightDuel } from "../src/lib/pit/combat.ts";
import { previewSaturday, simulateChampionshipDuel, simulateDuel } from "../src/lib/pit/engine.ts";
import { makeData } from "../src/lib/pit/seed.ts";
import type { ClassId, Loadout, PitData } from "../src/lib/pit/types.ts";

const A = "waco";
const B = "arlington";

function stock(classId: ClassId): Loadout {
  const chassis = classId === "striker" ? "shrike" : classId === "tank" ? "keystone" : "windlass";
  const drive = classId === "striker" ? "mag" : classId === "tank" ? "treads" : "omni";
  const weapon = classId === "striker" ? "saw" : classId === "tank" ? "wedge" : "claw";
  return {
    chassis: `chassis-${chassis}-stock`,
    drive: `drive-${drive}-stock`,
    weapon: `weapon-${weapon}-stock`,
    armor: "armor-plate-stock",
    utility: null,
    brain: "brain-logic-stock",
  };
}

function full(classId: ClassId): Loadout {
  const base = stock(classId);
  const chassis = classId === "striker" ? "shrike" : classId === "tank" ? "keystone" : "windlass";
  const drive = classId === "striker" ? "swerve" : classId === "tank" ? "anchor" : "air";
  const weapon = classId === "striker" ? "saw" : classId === "tank" ? "hammer" : "claw";
  return {
    ...base,
    chassis: `chassis-${chassis}-super`,
    drive: `drive-${drive}-super`,
    weapon: `weapon-${weapon}-super`,
    armor: "armor-plate-super",
    utility: "utility-burn-super",
    brain: "brain-logic-super",
  };
}

/** High printed power, thin armor. The endurance tax should land here. */
function glass(classId: ClassId): Loadout {
  const chassis = classId === "striker" ? "shrike" : classId === "tank" ? "keystone" : "windlass";
  const weapon = classId === "tank" ? "hammer" : classId === "specialist" ? "claw" : "disc";
  return {
    chassis: `chassis-${chassis}-super`,
    drive: classId === "tank" ? "drive-rocket-super" : "drive-mag-super",
    weapon: `weapon-${weapon}-super`,
    armor: "armor-plate-stock",
    utility: null,
    brain: "brain-berserker-sport",
  };
}

/** Low power, heavy armor, deep chassis. Should weather overtime. */
function brick(classId: ClassId): Loadout {
  return {
    chassis: classId === "striker" ? "chassis-shrike-stock" : classId === "specialist" ? "chassis-windlass-super" : "chassis-keystone-super",
    drive: "drive-anchor-super",
    weapon: classId === "striker" ? "weapon-wedge-stock" : "weapon-hammer-super",
    armor: "armor-plate-super",
    utility: "utility-weld-super",
    brain: "brain-turtle-pro",
  };
}

function equip(data: PitData, id: string, classId: ClassId, load: Loadout) {
  const bot = data.bots.find((row) => row.storeId === id)!;
  bot.classId = classId;
  bot.wear = { chassis: "clean", drive: "clean", weapon: "clean", armor: "clean", utility: "clean", brain: "clean" };
  bot.partWear = {};
  bot.draft = { ...load };
  bot.locked = { ...load };
  bot.equipped = { ...load };
  bot.owned = Object.values(load).filter((part): part is string => Boolean(part));
  const card = data.storeCards.find((row) => row.storeId === id && row.week === 1)!;
  card.nsnu = 950;
  card.conv = 70;
  card.demoRate = 90;
  card.demoClose = 80;
  card.arch = 4;
  card.demoTicket = 1800;
  card.projected = false;
  card.grades = undefined;
}

type Row = {
  id: string;
  mode: "regulation" | "overtime" | "championship" | "week1-preview";
  winner: string;
  loser: string;
  method: string;
  hpWinner: number;
  hpLoser: number;
  exchanges: number;
  margin: number;
};

const rows: Row[] = [];

function push(id: string, mode: Row["mode"], winner: string, loser: string, method: string, hp: Record<string, number>, exchanges: number) {
  rows.push({
    id,
    mode,
    winner,
    loser,
    method,
    hpWinner: hp[winner] ?? 0,
    hpLoser: hp[loser] ?? 0,
    exchanges,
    margin: (hp[winner] ?? 0) - (hp[loser] ?? 0),
  });
}

const classes: ClassId[] = ["striker", "tank", "specialist"];
const kits = { stock, full, glass, brick } as const;

for (const leftClass of classes) {
  for (const rightClass of classes) {
    for (const leftKit of Object.keys(kits) as (keyof typeof kits)[]) {
      for (const rightKit of Object.keys(kits) as (keyof typeof kits)[]) {
        if (leftClass === rightClass && leftKit === rightKit) continue;
        const data = makeData();
        equip(data, A, leftClass, kits[leftKit](leftClass));
        equip(data, B, rightClass, kits[rightKit](rightClass));
        const label = `${leftKit}-${leftClass}-vs-${rightKit}-${rightClass}`;
        const reg = simulateDuel(data, A, B, "balance");
        push(label, "regulation", reg.winnerIds[0]!, reg.loserIds[0]!, reg.method, reg.hp, reg.exchanges.length);
        const champ = simulateChampionshipDuel(data, A, B, "balance-ot");
        push(label, "championship", champ.winnerIds[0]!, champ.loserIds[0]!, champ.method, champ.hp, champ.exchanges.length);
      }
    }
  }
}

const preview = previewSaturday(makeData());
for (const bout of preview) {
  const result = bout.result!;
  const winner = result.winnerIds[0] ?? "none";
  const loser = result.loserIds[0] ?? result.fighters.find((f) => f.id !== winner)?.id ?? "none";
  push(
    `${bout.kind}:${bout.storeIds.join("-")}`,
    "week1-preview",
    winner,
    loser,
    result.method,
    result.hp,
    result.exchanges.length,
  );
}

const out = process.argv[2] ?? "/tmp/balance-vitals.json";
writeFileSync(out, JSON.stringify({ rows }, null, 2));
const flipsReady = rows.length;
const byMode: Record<string, number> = {};
for (const row of rows) byMode[row.mode] = (byMode[row.mode] ?? 0) + 1;
console.log(JSON.stringify({ wrote: out, fights: flipsReady, byMode }, null, 2));
