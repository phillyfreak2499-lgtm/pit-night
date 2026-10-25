import type { Exchange, FighterSnap, Method, Slot, Tier } from "./types";

/**
 * Both bots act every exchange. The card shows the heavier blow.
 * Damage comes from the printed build, then from chassis, battery, armor,
 * drive, weapon, utility, brain and the arena. Nothing is rolled.
 */

const PACE = 0.7;
const STOCK_BATTERY = 64;

type Kit = {
  chassis: string;
  drive: string;
  weapon: string;
  armor: string;
  utility: string | null;
  brain: string;
  brainTier: Tier;
  weaponTier: Tier;
  armorTier: Tier;
  driveTier: Tier;
  chassisTier: Tier;
  batteryMax: number;
  wear: Partial<Record<Slot, number>>;
  affinityHit?: boolean;
};

type Mem = {
  burn: Record<string, number>;
  stun: Record<string, number>;
  phoenix: Record<string, boolean>;
  spike: Record<string, number>;
  grapple: Record<string, boolean>;
  heat: Record<string, number>;
  battery: Record<string, number>;
  slow: Record<string, number>;
};

export type DuelOpts = { hot?: boolean; overtime?: boolean; pace?: number };

export type DuelCore = {
  exchanges: Exchange[];
  hp: Record<string, number>;
  finisher: { by: string; against: string; damage: number; call: string } | null;
  method: Method;
  koAt: number;
};

const TIER_Q: Record<Tier, number> = { stock: 0, sport: 1, pro: 2, super: 3, championship: 4 };

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function tierOf(snap: FighterSnap, slot: Slot): Tier {
  return snap.tiers?.[slot] ?? (slot === "brain" ? (snap.brainTier ?? "stock") : "stock");
}

export function kitOf(snap: FighterSnap): Kit {
  return {
    chassis: snap.chassisFamily ?? "shrike",
    drive: snap.driveFamily ?? "mag",
    weapon: snap.weaponFamily ?? "saw",
    armor: snap.armorFamily ?? "plate",
    utility: snap.utilityFamily === undefined ? null : snap.utilityFamily,
    brain: snap.brainFamily ?? "logic",
    brainTier: snap.brainTier ?? "stock",
    weaponTier: tierOf(snap, "weapon"),
    armorTier: tierOf(snap, "armor"),
    driveTier: tierOf(snap, "drive"),
    chassisTier: tierOf(snap, "chassis"),
    batteryMax: snap.batteryMax && snap.batteryMax > 0 ? snap.batteryMax : STOCK_BATTERY,
    wear: snap.wearMult ?? {},
  };
}

function q(tier: Tier) {
  return TIER_Q[tier] ?? 0;
}

function stamina(max: number, left: number) {
  const ratio = max <= 0 ? 0 : clamp(left, 0, max) / max;
  return 0.55 + 0.45 * ratio;
}

function lit(kit: Kit) {
  return kit.utility === "spotlight" || kit.utility === "uv";
}

const CAREFUL = new Set(["logic", "skynet", "sniper", "turtle"]);

function reckless(kit: Kit) {
  return !CAREFUL.has(kit.brain);
}

function lane(
  kit: Kit,
  index: number,
  hot: boolean,
): "safe" | "saw" | "pit" | "water" | "close" | "jet" {
  if (kit.drive === "anchor") return "safe";
  if (kit.chassis === "spring" && index === 0)
    return kit.brain === "berserker" || kit.brain === "hunter" || kit.brain === "brawler"
      ? "close"
      : "safe";
  // Jets before any "always close" return. Week 3, last exchange.
  if (hot && index === 2) {
    if (kit.brain === "berserker" || kit.brain === "hunter") return "jet";
    if (kit.drive === "rocket" && reckless(kit)) return "jet";
  }
  // Middle exchange. Reckless brains, chase drives, and anything that can
  // cross a pit on purpose. Hover and Air Cushion still pick the pit; the
  // hazard step is what ignores it.
  if (index === 1) {
    const crosses =
      kit.chassis === "hover" ||
      kit.drive === "air" ||
      kit.chassis === "skeleton" ||
      kit.brain === "berserker" ||
      kit.drive === "rocket" ||
      kit.drive === "ghostchaser" ||
      kit.drive === "chaser";
    if (crosses && (reckless(kit) || kit.chassis === "hover" || kit.drive === "air")) return "pit";
  }
  if (
    kit.drive === "chaser" ||
    kit.drive === "ghostchaser" ||
    kit.brain === "hunter" ||
    kit.brain === "berserker"
  )
    return index === 0 ? "saw" : "close";
  if (kit.brain === "brawler") return "close";
  if (kit.chassis === "skeleton" && reckless(kit) && index === 0) return "saw";
  if (kit.drive === "air" && kit.brain === "sniper") return "water";
  return "safe";
}

function brainHazard(kit: Kit) {
  const tier = q(kit.brainTier);
  if (kit.brain === "logic") return Math.max(0.08, 0.42 - tier * 0.1);
  if (kit.brain === "skynet") return Math.max(0.1, 0.38 - tier * 0.08);
  if (kit.brain === "sniper") return Math.max(0.12, 0.28 - tier * 0.04);
  if (kit.brain === "turtle") return 0.35;
  if (kit.brain === "hunter") return 0.42;
  if (kit.brain === "berserker") return 0.68;
  if (kit.brain === "brawler") return 0.7;
  return 0.7;
}

function hazardOf(kit: Kit, which: ReturnType<typeof lane>, foe: Kit, index: number) {
  let damage = 0;
  let slow = 1;
  const tags: string[] = [];
  const hover = kit.chassis === "hover";
  const air = kit.drive === "air";
  const spring = kit.chassis === "spring";
  if (which === "saw" || which === "close" || which === "jet") {
    const low = which !== "jet";
    const launched = spring && index === 0 && which !== "jet";
    if (!(hover && low) && !launched) {
      let bite = which === "jet" ? 7 : which === "close" ? 4 : 8;
      if (kit.drive === "swerve" && (which === "saw" || which === "close")) {
        const dodge = Math.max(0.08, 0.42 - q(kit.driveTier) * 0.1);
        bite *= hover ? 1 - (1 - dodge) * 0.45 : dodge;
        tags.push("swerve");
      }
      damage += bite;
      tags.push(which === "jet" ? "jet" : "saw");
    } else if (hover) tags.push("hover");
  }
  if (which === "pit") {
    if (hover || air) tags.push(air ? "air" : "hover");
    else {
      damage += 7;
      slow *= 0.9;
      tags.push("pit");
    }
  }
  if (which === "water") {
    if (air) {
      slow *= 1.06 + q(kit.driveTier) * 0.02;
      tags.push("air");
    } else {
      slow *= 0.84;
      tags.push("water");
    }
  }
  if (air && (which === "pit" || which === "water")) damage = which === "water" ? 0 : damage;
  if (foe.utility === "blackout" && !lit(kit)) {
    damage = which === "safe" ? damage : Math.max(damage, which === "saw" ? 8 : damage);
  }
  let mult = brainHazard(kit);
  if (
    (foe.brain === "jammer" || foe.utility === "siren" || foe.utility === "blackout") &&
    !lit(kit)
  )
    mult = Math.max(mult, 0.85);
  if (kit.utility === "uv") mult *= 0.7;
  if (kit.utility === "peace") mult *= 0.65;
  if (spring && index === 0 && which !== "jet") tags.push("spring");
  return { damage: Math.round(clamp(damage * mult, 0, 14)), slow, tags };
}

function aim(kit: Kit, foe: Kit, foeLane: ReturnType<typeof lane>) {
  const tier = q(kit.brainTier);
  const close = foeLane === "close" || foeLane === "saw";
  let n = 1;
  if (kit.brain === "logic") n = 1 + tier * 0.045;
  else if (kit.brain === "hunter") n = 1.3 + tier * 0.045;
  else if (kit.brain === "berserker") n = 1.36 + tier * 0.02;
  else if (kit.brain === "turtle") n = 0.62;
  else if (kit.brain === "sniper") n = (close ? 0.7 : 1.22) + tier * 0.03;
  else if (kit.brain === "brawler")
    n =
      close || foe.brain === "brawler" || foe.brain === "hunter" || foe.brain === "berserker"
        ? 1.34 + tier * 0.03
        : 0.88;
  else if (kit.brain === "jammer") n = 0.96 + tier * 0.015;
  else if (kit.brain === "phoenix") n = 1.08 + tier * 0.02;
  else if (kit.brain === "skynet") n = 1.07 + tier * 0.028;
  if (foe.brain === "turtle" && kit.brain === "hunter") n += 0.2;
  if (foe.brain === "turtle" && kit.brain === "berserker") n += 0.34;
  if (kit.brain === "berserker" && (foe.brain === "sniper" || foe.brain === "phoenix")) n += 0.18;
  if (foe.brain === "turtle" && kit.brain === "brawler") n += 0.08;
  if ((foe.brain === "jammer" || foe.utility === "siren") && !lit(kit)) {
    if (kit.brain === "logic" || kit.brain === "skynet" || kit.brain === "sniper" || kit.brain === "hunter")
      n *= 0.94;
  }
  return n * (kit.wear.brain ?? 1);
}

function guard(kit: Kit) {
  const tier = q(kit.brainTier);
  if (kit.brain === "logic") return Math.max(0.74, 0.98 - tier * 0.045);
  if (kit.brain === "skynet") return Math.max(0.76, 0.93 - tier * 0.035);
  if (kit.brain === "turtle") return 0.7;
  if (kit.brain === "sniper") return 1.12;
  if (kit.brain === "hunter" || kit.brain === "berserker") return 1.04;
  if (kit.brain === "brawler") return 0.94;
  return 1;
}

function focusOf(atk: Kit, foe: Kit, mem: Mem, id: string) {
  let f = mem.stun[id] ?? 1;
  const blinded = !lit(atk);
  if (blinded && (foe.brain === "jammer" || foe.utility === "jammer")) f *= 0.86;
  if (blinded && foe.utility === "siren") f *= 0.84;
  if (blinded && foe.utility === "blackout") f *= 0.84;
  if (blinded && foe.utility === "smoke") f *= 0.88;
  if (lit(atk)) f = Math.max(f, 0.98);
  return clamp(f, 0.62, 1.15);
}

function weaponMod(atk: Kit, foe: Kit, foeLane: ReturnType<typeof lane>, index: number) {
  const tier = 1 + q(atk.weaponTier) * 0.04;
  const fam = atk.weapon;
  let m = tier;
  const far = foeLane === "safe" || foeLane === "water";
  if (fam === "saw" || fam === "drum" || fam === "chainsaw") m *= far ? 0.94 : 1.06;
  if (fam === "chainsaw") m *= far ? 0.9 : 1.12;
  if (fam === "disc") m *= 1.04;
  if (fam === "hammer") m *= index === 0 ? 0.9 : index === 2 ? 1.12 : 1;
  if (fam === "wedge") m *= 1.02;
  if (fam === "claw") m *= 1.03;
  if (atk.weapon === "flail") {
    const moving = atk.drive === "anchor" ? 0.82 : 1.08 + q(atk.driveTier) * 0.02;
    m *= moving;
    if (atk.weaponTier === "super") m *= 1.08;
    if (foe.armor === "gel") m *= atk.weaponTier === "super" ? 0.72 : 0.8;
  }
  if (fam === "piston") {
    m *= far ? 1.1 + q(atk.weaponTier) * 0.03 : 1.02;
    if (atk.weaponTier === "super") m *= 1.08;
    if (foe.armor === "gel") m *= 0.84;
  }
  if (fam === "flame" && foe.armor === "gel") m *= 1.06;
  return m * (atk.wear.weapon ?? 1);
}

function armorMod(atk: Kit, foe: Kit, index: number) {
  const tier = 1 - q(foe.armorTier) * 0.03;
  let m = tier;
  const cut =
    atk.weapon === "saw" ||
    atk.weapon === "drum" ||
    atk.weapon === "disc" ||
    atk.weapon === "chainsaw";
  const metal =
    cut ||
    atk.weapon === "flail" ||
    atk.weapon === "tesla" ||
    atk.weapon === "piston" ||
    atk.weapon === "hammer";
  const impact =
    atk.weapon === "flail" ||
    atk.weapon === "hammer" ||
    atk.weapon === "piston" ||
    atk.weapon === "wedge";
  if (foe.armor === "plate") m *= 0.97;
  if (foe.armor === "skirt" && (atk.weapon === "wedge" || atk.drive === "flip")) m *= 0.75;
  if (foe.armor === "angle" && (cut || atk.weapon === "hammer")) m *= 0.86;
  if (foe.armor === "cage") m *= 1.04;
  if (foe.armor === "ablative") m *= index === 0 ? (foe.armorTier === "super" ? 0.5 : 0.62) : 1.06;
  if (foe.armor === "gel" && impact && atk.weapon !== "flame")
    m *= foe.armorTier === "super" ? 0.74 : 0.82;
  if (foe.armor === "chain" && cut) m *= foe.armorTier === "super" ? 0.68 : 0.78;
  if (foe.armor === "ceramic")
    m *= index === 0 ? (foe.armorTier === "super" ? 0.48 : 0.58) : index >= 2 ? 1.12 : 1;
  if (foe.armor === "magnet" && metal && atk.weapon !== "flame")
    m *= foe.armorTier === "super" ? 0.68 : 0.8;
  if (foe.armor === "magnet" && atk.weapon === "tesla")
    m *= foe.armorTier === "super" ? 0.5 : 0.82;
  if (foe.armor === "reactive") m *= 0.96;
  return m * (foe.wear.armor ?? 1);
}

function driveMod(atk: Kit, foe: Kit, index: number) {
  let m = 1 + q(atk.driveTier) * 0.025;
  if (atk.drive === "anchor") m *= 0.84 + q(atk.driveTier) * 0.02;
  if (atk.drive === "anchor" && foe.brain === "sniper") m *= 0.82;
  if (atk.drive === "rocket") m *= index === 0 ? 1.16 + q(atk.driveTier) * 0.03 : 0.9;
  if (atk.drive === "air") m *= 1.08 + q(atk.driveTier) * 0.02;
  if (atk.drive === "air" && (foe.drive === "swerve" || foe.drive === "omni")) m *= 0.76;
  if (atk.drive === "air" && foe.drive === "anchor") m *= 0.52;
  if (foe.drive === "air" && atk.drive === "anchor") m *= 1.24;
  if (foe.drive === "air" && (atk.brain === "sniper" || atk.weapon === "piston")) m *= 1.1;
  if (
    (atk.drive === "chaser" || atk.drive === "ghostchaser") &&
    (foe.brain === "sniper" || foe.drive === "air")
  )
    m *= 1.1;
  if (
    foe.drive === "anchor" &&
    (atk.weapon === "wedge" || atk.weapon === "hammer" || atk.drive === "flip")
  )
    m *= 0.72;
  if (foe.utility === "oil" && atk.drive === "air") m *= 0.7;
  else if (
    foe.utility === "oil" &&
    (atk.drive === "swerve" || atk.drive === "omni" || atk.drive === "mag")
  )
    m *= 0.88;
  if (index > 0 && atk.drive === "rocket") m *= 0.98;
  return m * (atk.wear.drive ?? 1);
}

function chassisMod(atk: Kit, foe: Kit, index: number) {
  let m = 1 + q(atk.chassisTier) * 0.02;
  if (atk.chassis === "shrike") m *= index === 0 ? 1.05 : index === 2 ? 0.96 : 1;
  if (atk.chassis === "keystone") m *= index === 2 ? 1.08 : index === 0 ? 0.96 : 1;
  if (
    atk.chassis === "windlass" &&
    (atk.weapon === "claw" || atk.weapon === "flame" || atk.weapon === "tesla")
  )
    m *= 1.05;
  if (atk.chassis === "spring") m *= index === 0 ? 1.12 + q(atk.chassisTier) * 0.02 : 0.98;
  if (atk.chassis === "hover") m *= 1.03;
  if (atk.chassis === "reactor") m *= 1.06;
  if (atk.affinityHit) m *= 1.04;
  return m * (atk.wear.chassis ?? 1);
}

/** Skeleton chassis slips a hit. The fraction is the build and the exchange, never a roll. */
function skeletonSlip(atk: Kit, foe: Kit, index: number) {
  if (foe.chassis !== "skeleton") return 1;
  const base = index === 1 ? 0.26 : index === 0 ? 0.58 : 0.44;
  let track = 0;
  if (atk.brain === "logic" || atk.brain === "skynet") track += 0.16 + q(atk.brainTier) * 0.06;
  if (atk.brain === "sniper") track += 0.1;
  if (atk.brain === "hunter") track += 0.08;
  if (lit(atk)) track += 0.22;
  if (atk.weapon === "claw" || atk.weapon === "bones") track += 0.14;
  if (foe.brain === "turtle") track += 0.16;
  if (foe.brain === "berserker" || foe.brain === "hunter") track -= 0.05;
  return clamp(base + track, 0.2, 0.92);
}

function utilityOut(atk: Kit, index: number) {
  let m = 1;
  if (atk.utility === "burn") m *= index === 0 ? 1.12 : index === 2 ? 0.94 : 1;
  if (atk.utility === "crowd") m *= 1.04;
  if (atk.utility === "leech") m *= 1.04;
  if (atk.utility === "grapple" && index === 0) m *= 1.06;
  return m * (atk.utility ? (atk.wear.utility ?? 1) : 1);
}

function utilityIn(atk: Kit, foe: Kit) {
  let m = 1;
  if (foe.utility === "veil" && !lit(atk)) m *= 0.84;
  if (foe.utility === "decoy" && !lit(atk)) m *= 0.9;
  if (foe.utility === "mirror") m *= 0.9;
  if (foe.utility === "peace") m *= 0.96;
  return m;
}

type Swing = {
  damage: number;
  reflect: number;
  tags: string[];
  call: string;
  burn: number;
  stun: number;
  drain: number;
  heat: number;
};

function oneWay(
  atk: FighterSnap,
  def: FighterSnap,
  index: number,
  mem: Mem,
  foeLane: ReturnType<typeof lane>,
  hot: boolean,
): Swing {
  const ak = kitOf(atk);
  const dk = kitOf(def);
  ak.affinityHit = affinityOn(atk, ak);
  const tags: string[] = [];
  const left = mem.battery[atk.id] ?? ak.batteryMax;
  const stam = stamina(ak.batteryMax, left) * (mem.slow[atk.id] ?? 1);
  if (stam < 0.82) tags.push("battery");
  const thin = dk.chassis === "skeleton" ? 0.5 : 1;
  let dmg =
    (atk.stats.power * 1.22 + atk.stats.speed * 0.2) * stam * (mem.spike[atk.id] ?? 1) -
    def.stats.armor * 0.38 * thin +
    (atk.weekQ - def.weekQ) * 6;

  if (index === 0 && atk.stats.speed > def.stats.speed + 4) {
    dmg += (atk.stats.speed - def.stats.speed) * 0.42 * stam;
    tags.push("first");
  }
  if (
    atk.classId === "striker" &&
    def.classId === "tank" &&
    atk.stats.speed > def.stats.speed + 6
  ) {
    dmg += index === 0 ? 16 : index === 1 ? 12 : 4;
    tags.push("pressure");
  }
  if (atk.classId === "tank" && index === 2) {
    dmg += 10 + atk.stats.heat * 0 + atk.stats.armor * 0.12;
    tags.push("late");
  }
  if (
    atk.classId === "tank" &&
    def.classId === "specialist" &&
    index > 0 &&
    def.stats.heat + (mem.heat[def.id] ?? 0) < 22
  ) {
    dmg += 9;
    tags.push("smother");
  }
  const atkHeat = atk.stats.heat + (mem.heat[atk.id] ?? 0);
  const defHeat = def.stats.heat + (mem.heat[def.id] ?? 0);
  if (atk.classId === "specialist" && def.classId === "striker" && atkHeat >= defHeat + 2) {
    dmg += 8 + Math.max(0, atkHeat - defHeat) * 0.35;
    tags.push("heat");
  }
  if (atk.classId === "striker" && def.classId === "specialist" && defHeat >= atkHeat + 4) {
    dmg *= 0.62;
    tags.push("shutdown");
  }
  if (ak.weapon === "disc" && atk.classId === "tank") {
    dmg *= 0.55;
    tags.push("ceiling-fan");
  }
  if (ak.weapon === "wedge" && atk.classId === "striker") {
    dmg *= 0.78;
    tags.push("wrong-iron");
  }

  dmg = halloweenStrikeAdjust(atk, def, index, dmg, tags);
  // A stock logic board does not read a hunter's line. Tuned logic still does.
  if (ak.brain === "hunter" && dk.brain === "logic" && q(dk.brainTier) === 0) dmg += 3;
  const slip = skeletonSlip(ak, dk, index);
  if (slip < 1) {
    dmg *= slip;
    tags.push(slip <= 0.4 ? "miss" : "evade");
  }

  let mod =
    weaponMod(ak, dk, foeLane, index) *
    armorMod(ak, dk, index) *
    driveMod(ak, dk, index) *
    chassisMod(ak, dk, index) *
    utilityOut(ak, index) *
    utilityIn(ak, dk) *
    aim(ak, dk, foeLane) *
    guard(dk) *
    focusOf(ak, dk, mem, atk.id);
  if (dk.utility === "grapple" && index === 0 && !mem.grapple[def.id]) {
    mod *= 0.55;
    tags.push("grapple");
  }
  if (dk.utility === "tremor" && ak.chassis !== "hover" && ak.drive !== "air") {
    mod *= 0.92;
    tags.push("tremor");
  }
  if (ak.utility === "scry" && atk.weekQ + 0.02 < def.weekQ) {
    mod *= 1.07;
    tags.push("scry");
  }
  dmg *= clamp(mod, 0.42, 1.72);
  if (ak.brain === "berserker" && dk.brain === "phoenix") dmg += 3;
  if (hot && index >= 2) dmg *= 1.04;
  dmg = clamp(dmg, 8, 58);

  let reflect = 0;
  const close =
    foeLane === "close" ||
    foeLane === "saw" ||
    ak.brain === "brawler" ||
    ak.brain === "hunter" ||
    ak.brain === "berserker";
  if (dk.armor === "spike" && close) {
    reflect += 4 + Math.round(dmg * (dk.armorTier === "super" ? 0.28 : 0.16));
    tags.push("spike");
  }
  const chip = ak.weapon === "flame";
  if (dk.armor === "reactive" && !chip && dmg >= 22) {
    reflect += dk.armorTier === "super" ? 12 : 8;
    dmg *= dk.armorTier === "super" ? 0.74 : 0.82;
    tags.push("reactive");
  }
  if (dk.armor === "reactive" && chip) tags.push("chip");
  if (dk.utility === "mirror") {
    reflect += Math.round(dmg * 0.22);
    tags.push("mirror");
  }
  if (ak.weapon === "flame") {
    tags.push("burn");
  }
  if (ak.weapon === "tesla") tags.push("stun");
  if (ak.utility === "leech") tags.push("leech");
  if ((mem.spike[atk.id] ?? 1) > 1) tags.push("phoenix-spike");

  const burn = ak.weapon === "flame" ? 4 + q(ak.weaponTier) * 2 : 0;
  let stun = ak.weapon === "tesla" ? Math.max(0.55, 0.8 - q(ak.weaponTier) * 0.05) : 1;
  let drain = ak.weapon === "tesla" ? 8 + q(ak.weaponTier) * 3 : 0;
  if (ak.weapon === "tesla" && dk.armor === "magnet") {
    if (dk.armorTier === "super") {
      stun = 1;
      drain = 0;
      reflect += 8;
      tags.push("lodestone");
    } else {
      stun = Math.max(stun, 0.92);
      drain = Math.round(drain * 0.45);
    }
  }
  const heat =
    (ak.weapon === "flame" ? 3 + q(ak.weaponTier) : 0) +
    (ak.utility === "leech" ? 4 : 0) +
    (ak.armor === "cage" ? 1 : 0);
  return {
    damage: Math.round(dmg),
    reflect,
    tags,
    call: callFor(atk, def, tags, index, stam),
    burn,
    stun,
    drain,
    heat,
  };
}

function affinityOn(snap: FighterSnap, kit: Kit) {
  const aff = snap.affinity;
  if (!aff) return false;
  if (aff.classId && aff.classId !== snap.classId) return false;
  if (!aff.families?.length) return Boolean(aff.classId);
  const fam =
    aff.slot === "drive"
      ? kit.drive
      : aff.slot === "weapon"
        ? kit.weapon
        : aff.slot === "armor"
          ? kit.armor
          : aff.slot === "utility"
            ? kit.utility
            : null;
  return Boolean(fam && aff.families.includes(fam));
}

function callFor(atk: FighterSnap, def: FighterSnap, tags: string[], index: number, stam: number) {
  if (tags.includes("bog"))
    return `${atk.botName} revs the Texas Chainsaw. The plate is thick, and the saw keeps singing.`;
  if (tags.includes("chainsaw"))
    return `${atk.botName} opens with the Texas Chainsaw. The first bite is the parade.`;
  if (tags.includes("lunge"))
    return `${atk.botName} lunges with the Slasher Blade and finds a clean line.`;
  if (tags.includes("late-slash"))
    return `${atk.botName} brings the Slasher Blade around late. A faster week would love this one.`;
  if (tags.includes("fade"))
    return `The Ghost Blade thins out. More Heat and ${atk.botName} would light the lane.`;
  if (tags.includes("phase"))
    return `${atk.botName} lets the Ghost Blade slip through the plate, trail and all.`;
  if (tags.includes("lob"))
    return `${atk.botName} lofts a pumpkin into the middle of the cage. Festive, and it counts.`;
  if (tags.includes("rattle"))
    return `Skeleton Claws chatter. ${atk.botName} keeps the grab cheerful.`;
  if (tags.includes("staff"))
    return `${atk.botName} plants the Witch's Broom like a staff and conducts the exchange.`;
  if (tags.includes("broom"))
    return `${atk.botName} is still sweeping. The broom becomes a staff when the Heat catches up.`;
  if (tags.includes("chase"))
    return `Ghost Chaser closes the gap. ${atk.botName} arrives with the lamps on.`;
  if (tags.includes("miss"))
    return `${def.botName} is bones and air. ${atk.botName} swings through the gap.`;
  if (tags.includes("lodestone"))
    return `Lodestone drinks the arc. ${atk.botName}'s coil comes back.`;
  if (tags.includes("ceiling-fan"))
    return `${atk.botName} spins the disc. On that chassis it is a ceiling fan. ${def.botName} walks through it.`;
  if (tags.includes("phoenix-spike"))
    return `${atk.botName} comes back hot. The next hit is the spike.`;
  if (tags.includes("pressure") && index === 0)
    return `${atk.botName} is in the pocket before ${def.storeName} finishes the handshake.`;
  if (tags.includes("shutdown"))
    return `${def.botName} cooks the exchange. ${atk.botName} swings at air that is already hot.`;
  if (tags.includes("heat"))
    return `Heat is real. ${atk.botName} holds ${def.botName} and does not give the saw back.`;
  if (tags.includes("smother"))
    return `${atk.botName} lays on the grapple and waits. The claw never finds a second bite.`;
  if (tags.includes("late"))
    return `Late fight. ${atk.botName} finally spends the armor it drove in with.`;
  if (tags.includes("wrong-iron"))
    return `${atk.botName} brought the wrong iron. ${def.botName} treats it like a suggestion.`;
  if (tags.includes("burn"))
    return `${atk.botName} leaves fire on ${def.botName}. The heat stays after the hit.`;
  if (tags.includes("stun"))
    return `${atk.botName} arcs the coil. ${def.botName} stutters and the battery sags.`;
  if (tags.includes("grapple"))
    return `${def.botName} clamps on. ${atk.botName} spends the exchange held.`;
  if (tags.includes("saw")) return `${atk.botName} takes the saw lane to reach ${def.botName}.`;
  if (tags.includes("battery") && stam < 0.78)
    return `${atk.botName}'s battery is down. The weapon and the wheels both sag.`;
  if (tags.includes("first")) return `First steel belongs to ${atk.storeName}.`;
  return `${atk.botName} and ${def.botName} trade the middle of the cage.`;
}

/**
 * Halloween parts share the normal damage number. Each one adds a single
 * trade. Fog Machine and Blacklight Mode are lights, and they are not read here.
 */
export function halloweenStrikeAdjust(
  attacker: FighterSnap,
  defender: FighterSnap,
  index: number,
  dmg: number,
  tags: string[],
) {
  const w = attacker.weaponFamily;
  if (w === "chainsaw") {
    if (index === 0) {
      dmg += 4;
      tags.push("chainsaw");
    }
    if (attacker.stats.armor < defender.stats.armor) {
      dmg *= 0.85;
      tags.push("bog");
    }
  } else if (w === "slasher") {
    if (attacker.stats.speed > defender.stats.speed) {
      if (index === 0) {
        dmg += 6;
        tags.push("lunge");
      }
    } else {
      dmg *= 0.8;
      tags.push("late-slash");
    }
  } else if (w === "ghost") {
    dmg += defender.stats.armor * 0.38 * 0.3;
    tags.push("phase");
    if (attacker.stats.heat < 10) {
      dmg *= 0.72;
      tags.push("fade");
    }
  } else if (w === "launcher") {
    if (index === 0) dmg *= 0.72;
    if (index === 1) {
      dmg += 8;
      tags.push("lob");
    }
  } else if (w === "bones") {
    if (defender.classId === "tank") dmg *= 0.85;
    else if (defender.classId === "striker") {
      dmg += 2;
      tags.push("rattle");
    }
  } else if (w === "broom") {
    if (attacker.stats.heat >= defender.stats.heat) {
      dmg += 3;
      tags.push("staff");
    } else {
      dmg -= 4;
      tags.push("broom");
    }
  }
  if (attacker.chassisFamily === "pumpkin") dmg *= 0.93;
  if (defender.chassisFamily === "pumpkin" && index === 0) dmg *= 0.94;
  if (
    attacker.driveFamily === "ghostchaser" &&
    index === 0 &&
    attacker.stats.speed > defender.stats.speed
  ) {
    dmg += 3;
    tags.push("chase");
  }
  if (defender.driveFamily === "ghostchaser") dmg *= 1.06;
  return dmg;
}

export function buildScore(snap: FighterSnap): number {
  const slots: Slot[] = ["chassis", "drive", "weapon", "armor", "utility", "brain"];
  const tiers = slots.reduce((sum, slot) => sum + (TIER_Q[tierOf(snap, slot)] ?? 0), 0);
  return tiers * 10 + (snap.fit ?? 0) * 100 + snap.rating * 0.001;
}

/** Higher health, then the fuller build, then rating. A true mirror keeps the first name. */
export function preferFighter(a: FighterSnap, b: FighterSnap, hpA: number, hpB: number): FighterSnap {
  if (hpA !== hpB) return hpA > hpB ? a : b;
  const qa = buildScore(a);
  const qb = buildScore(b);
  if (qa !== qb) return qa > qb ? a : b;
  if (a.rating !== b.rating) return a.rating > b.rating ? a : b;
  return a;
}

function emptyMem(a: FighterSnap, b: FighterSnap): Mem {
  const ka = kitOf(a);
  const kb = kitOf(b);
  return {
    burn: {},
    stun: {},
    phoenix: {},
    spike: {},
    grapple: {},
    heat: {},
    battery: { [a.id]: ka.batteryMax, [b.id]: kb.batteryMax },
    slow: {},
  };
}

function revive(snap: FighterSnap, hp: number, mem: Mem) {
  const kit = kitOf(snap);
  if (hp > 0 || kit.brain !== "phoenix" || mem.phoenix[snap.id]) return hp;
  mem.phoenix[snap.id] = true;
  mem.spike[snap.id] = 1.32;
  return 22;
}

function drainAmt(kit: Kit) {
  let d = 20;
  if (kit.weapon === "flame" || kit.weapon === "tesla" || kit.weapon === "chainsaw") d += 4;
  if (kit.drive === "rocket") d += 4;
  if (kit.drive === "anchor") d -= 5;
  if (kit.chassis === "sprinter" || kit.chassis === "hornet") d += 4;
  if (kit.chassis === "reactor" || kit.chassis === "capacitor") d -= 4;
  return d;
}

function healAmt(kit: Kit) {
  let h = 0;
  if (kit.utility === "medbay") h += 6;
  if (kit.utility === "weld") h += 3;
  return Math.round(h * (kit.wear.utility ?? 1));
}

export function fightDuel(a: FighterSnap, b: FighterSnap, opts: DuelOpts = {}): DuelCore {
  const pace = opts.pace ?? PACE;
  const hot = Boolean(opts.hot);
  const hp: Record<string, number> = { [a.id]: 100, [b.id]: 100 };
  const mem = emptyMem(a, b);
  const exchanges: Exchange[] = [];
  let koAt = -1;
  const limit = opts.overtime ? 12 : 3;
  const bots = [a, b];

  for (let i = 0; i < limit && hp[a.id]! > 0 && hp[b.id]! > 0; i++) {
    for (const bot of bots) {
      const pending = mem.burn[bot.id] ?? 0;
      if (pending > 0) {
        hp[bot.id] = Math.max(0, hp[bot.id]! - pending);
        mem.burn[bot.id] = Math.max(0, pending - 2);
      }
    }
    for (const bot of bots) hp[bot.id] = revive(bot, hp[bot.id]!, mem);
    if (hp[a.id]! <= 0 || hp[b.id]! <= 0) {
      koAt = i;
      break;
    }

    const ka = kitOf(a);
    const kb = kitOf(b);
    const laneA = lane(ka, i, hot);
    const laneB = lane(kb, i, hot);
    const hazA = hazardOf(ka, laneA, kb, i);
    const hazB = hazardOf(kb, laneB, ka, i);
    if (kb.utility === "tremor" && ka.chassis !== "hover" && ka.drive !== "air")
      hp[a.id] = Math.max(0, hp[a.id]! - 4);
    if (ka.utility === "tremor" && kb.chassis !== "hover" && kb.drive !== "air")
      hp[b.id] = Math.max(0, hp[b.id]! - 4);
    hp[a.id] = Math.max(0, hp[a.id]! - hazA.damage);
    hp[b.id] = Math.max(0, hp[b.id]! - hazB.damage);
    mem.slow[a.id] = hazA.slow;
    mem.slow[b.id] = hazB.slow;
    for (const bot of bots) hp[bot.id] = revive(bot, hp[bot.id]!, mem);
    if (hp[a.id]! <= 0 || hp[b.id]! <= 0) {
      koAt = i;
      const dead = hp[a.id]! <= 0 ? a : b;
      const live = dead.id === a.id ? b : a;
      exchanges.push({
        index: i + 1,
        attackerId: live.id,
        defenderId: dead.id,
        damage: dead.id === a.id ? hazA.damage : hazB.damage,
        attackerHp: hp[live.id]!,
        defenderHp: 0,
        call: `${dead.botName} takes the arena. ${hazA.tags.concat(hazB.tags).includes("saw") ? "The saw" : "The hazard"} ends the exchange.`,
        tags: ["hazard", ...hazA.tags, ...hazB.tags, `hazard:${a.id}`, `hazard:${b.id}`],
      });
      break;
    }

    const blowA = oneWay(a, b, i, mem, laneB, hot);
    const blowB = oneWay(b, a, i, mem, laneA, hot);
    const ot = !opts.overtime || i < 3 ? 1 : i === 3 ? 1.1 : i === 4 ? 1.2 : 1.35;
    const dmgA = Math.max(1, Math.round((blowA.damage + blowB.reflect) * pace * ot));
    const dmgB = Math.max(1, Math.round((blowB.damage + blowA.reflect) * pace * ot));
    hp[b.id] = Math.max(0, hp[b.id]! - dmgA);
    hp[a.id] = Math.max(0, hp[a.id]! - dmgB);
    for (const bot of bots) {
      const before = hp[bot.id]!;
      hp[bot.id] = revive(bot, before, mem);
    }
    for (const bot of bots) {
      if (hp[bot.id]! > 0) hp[bot.id] = Math.min(100, hp[bot.id]! + healAmt(kitOf(bot)));
    }

    mem.burn[b.id] = (mem.burn[b.id] ?? 0) + blowA.burn;
    mem.burn[a.id] = (mem.burn[a.id] ?? 0) + blowB.burn;
    if (blowA.stun < 1) mem.stun[b.id] = blowA.stun;
    else delete mem.stun[b.id];
    if (blowB.stun < 1) mem.stun[a.id] = blowB.stun;
    else delete mem.stun[a.id];
    mem.heat[a.id] = (mem.heat[a.id] ?? 0) + blowA.heat - (blowB.tags.includes("leech") ? 4 : 0);
    mem.heat[b.id] = (mem.heat[b.id] ?? 0) + blowB.heat - (blowA.tags.includes("leech") ? 4 : 0);
    mem.battery[b.id] = Math.max(0, (mem.battery[b.id] ?? 0) - blowA.drain);
    mem.battery[a.id] = Math.max(0, (mem.battery[a.id] ?? 0) - blowB.drain);
    for (const [bot, kit] of [
      [a, ka],
      [b, kb],
    ] as const) {
      mem.battery[bot.id] = Math.max(0, (mem.battery[bot.id] ?? 0) - drainAmt(kit));
    }
    if (blowA.tags.includes("grapple") || blowB.tags.includes("grapple")) {
      mem.grapple[a.id] = true;
      mem.grapple[b.id] = true;
    }
    if ((mem.spike[a.id] ?? 1) > 1 && blowA.tags.includes("phoenix-spike")) mem.spike[a.id] = 1;
    if ((mem.spike[b.id] ?? 1) > 1 && blowB.tags.includes("phoenix-spike")) mem.spike[b.id] = 1;

    const featureA = dmgA >= dmgB;
    const attacker = featureA ? a : b;
    const defender = featureA ? b : a;
    const blow = featureA ? blowA : blowB;
    const hazTags = [...hazA.tags, ...hazB.tags];
    const tags = [...blow.tags, ...hazTags, ...(opts.overtime && i >= 3 ? ["overtime"] : [])];
    if (hazA.damage || hazB.damage) tags.push("hazard");
    exchanges.push({
      index: i + 1,
      attackerId: attacker.id,
      defenderId: defender.id,
      damage: featureA ? dmgA : dmgB,
      attackerHp: hp[attacker.id]!,
      defenderHp: hp[defender.id]!,
      call: opts.overtime && i >= 3 ? `Overtime, round ${i + 1}. ${blow.call}` : blow.call,
      tags,
    });
    if (hp[a.id] === 0 || hp[b.id] === 0) {
      koAt = i;
      break;
    }
  }

  let method: Method = "decision";
  let finisher: DuelCore["finisher"] = null;
  if (hp[a.id] === 0 || hp[b.id] === 0) method = "ko";
  else if (!opts.overtime) {
    const ahead = preferFighter(a, b, hp[a.id]!, hp[b.id]!);
    const behind = ahead.id === a.id ? b : a;
    const winnerHeat = ahead.stats.heat + (mem.heat[ahead.id] ?? 0);
    const loserHeat = behind.stats.heat + (mem.heat[behind.id] ?? 0);
    const gap = winnerHeat - loserHeat;
    if (gap >= 6 && hp[behind.id]! < 48) {
      const burn = Math.round(12 + gap * 0.8);
      hp[behind.id] = revive(behind, Math.max(0, hp[behind.id]! - burn), mem);
      finisher = {
        by: ahead.id,
        against: behind.id,
        damage: burn,
        call: `${ahead.botName} spends the Heat. ${behind.botName} does not get a fourth exchange.`,
      };
      if (hp[behind.id] === 0) method = "ko";
    }
    if (method === "decision") {
      const control =
        kitOf(ahead).weapon === "wedge" ||
        kitOf(ahead).weapon === "claw" ||
        kitOf(ahead).weapon === "bones";
      const planted = kitOf(behind).drive === "anchor";
      if (
        control &&
        !planted &&
        hp[behind.id]! < 36 &&
        ahead.stats.power > behind.stats.armor * 0.7
      ) {
        method = "dump";
        hp[behind.id] = revive(behind, Math.max(0, hp[behind.id]! - 8), mem);
        if (hp[behind.id] === 0) method = "ko";
      }
    }
  }

  if (opts.overtime && hp[a.id]! > 0 && hp[b.id]! > 0) {
    const defender = hp[a.id]! <= hp[b.id]! ? a : b;
    const attacker = defender.id === a.id ? b : a;
    const damage = hp[defender.id]!;
    hp[defender.id] = 0;
    method = "ko";
    const call = `The championship cannot go to the judges. ${attacker.botName} lands the last shot.`;
    exchanges.push({
      index: exchanges.length + 1,
      attackerId: attacker.id,
      defenderId: defender.id,
      damage,
      attackerHp: hp[attacker.id]!,
      defenderHp: 0,
      call,
      tags: ["sudden-death"],
    });
    finisher = { by: attacker.id, against: defender.id, damage, call };
    koAt = exchanges.length - 1;
  }

  return { exchanges, hp, finisher, method, koAt };
}

export function duelWear(winnerId: string, loserId: string, method: Method, blowout: boolean) {
  const clean = (): Record<Slot, "clean" | "scratched" | "bent" | "disabled"> => ({
    chassis: "clean",
    drive: "clean",
    weapon: "clean",
    armor: "clean",
    utility: "clean",
    brain: "clean",
  });
  const w = clean();
  const l = clean();
  w.armor = "scratched";
  if (blowout) w.drive = "scratched";
  if (blowout || method === "ko") {
    l.weapon = "disabled";
    l.drive = "disabled";
    l.armor = "bent";
    l.chassis = "scratched";
  } else if (method === "dump") {
    l.weapon = "bent";
    l.drive = "disabled";
    l.armor = "bent";
    l.chassis = "scratched";
  } else {
    l.weapon = "bent";
    l.armor = "scratched";
    l.drive = "scratched";
    l.chassis = "clean";
  }
  return { [winnerId]: w, [loserId]: l };
}
