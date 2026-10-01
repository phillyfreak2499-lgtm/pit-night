import type { ClassId, Exchange, FightResult, FighterSnap } from "@/lib/pit/types";

/**
 * Where every bot is, per frame, in arena space: x 0..1 left to right,
 * y 0..1 back wall to front glass. Pure function of the beat and its local time,
 * so scrubbing, pausing and 4× all land on the same picture.
 */

export type Beat =
  | { t: number; dur: number; kind: "bumper" }
  | { t: number; dur: number; kind: "intro"; side: 0 | 1 }
  | { t: number; dur: number; kind: "stats" }
  | { t: number; dur: number; kind: "exchange"; index: number }
  | { t: number; dur: number; kind: "finisher" }
  | { t: number; dur: number; kind: "decision" };

export type Spot = { x: number; y: number };

export type BotState = {
  bot: FighterSnap;
  spot: Spot;
  /** Top-down heading, radians. 0 points right, PI/2 points at the camera. */
  heading: number;
  /** Height off the floor, in bot lengths. */
  lift: number;
  /** Pitch in the side view, radians. Positive is nose up. */
  pitch: number;
  /** Upside down on the floor. */
  flipped: boolean;
  /** 0..1 weapon stroke: flipper fired, hammer down, saw arm down, jaws shut. */
  stroke: number;
  /** 0..1 spinner speed. */
  rev: number;
  /** 0..1 dropped into the pit. */
  gone: number;
  /** Knocked out and not moving. */
  dead: boolean;
  /** Distance driven, for wheel spin. */
  roll: number;
  hp: number;
  /** Charging this frame. Dust and a lean. */
  charging: boolean;
  spotlight: boolean;
  /** 0..1 flame from the utility bay. */
  flame: number;
  /** Winner on the decision beat. Fires the Bolt Locker victory effect. */
  celebrate?: boolean;
};

export type Drive = {
  bots: BotState[];
  /** Contact point while the hit lands. */
  impact: Spot | null;
  /** 0..1 how hard. */
  power: number;
  /** Unique per hit so particles fire once. */
  hitKey: string | null;
  /** Hit fires once local passes this. */
  hitAt: number;
  weapon: string;
  /** Who got hit. */
  victim: string | null;
  /** Where the camera wants to look, arena space. */
  focus: Spot;
  /** How tight the camera wants to be. */
  tight: number;
};

export const PIT = { x: 0.5, y: 0.1, w: 0.2, h: 0.09 };
const REACH = 0.2;
const HIT_AT = 0.42;

export function buildBeats(result: FightResult): Beat[] {
  const beats: Beat[] = [];
  let t = 0;
  const push = (dur: number, beat: DistributiveOmit<Beat, "t" | "dur">) => {
    beats.push({ t, dur, ...beat } as Beat);
    t += dur;
  };
  push(5, { kind: "bumper" });
  push(6.5, { kind: "intro", side: 0 });
  if (result.fighters[1]) push(6.5, { kind: "intro", side: 1 });
  push(5.5, { kind: "stats" });
  result.exchanges.forEach((_, index) => push(12, { kind: "exchange", index }));
  if (result.finisher) push(7, { kind: "finisher" });
  push(8, { kind: "decision" });
  return beats;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export function beatAt(beats: Beat[], time: number) {
  return beats.find((b) => time >= b.t && time < b.t + b.dur) ?? beats[beats.length - 1]!;
}

export function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rand(seed: string) {
  return (hash(seed) % 10000) / 10000;
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export function ease(t: number) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function easeOut(t: number) {
  const x = clamp(t, 0, 1);
  return 1 - (1 - x) * (1 - x) * (1 - x);
}

function easeIn(t: number) {
  const x = clamp(t, 0, 1);
  return x * x;
}

function mix(a: Spot, b: Spot, t: number): Spot {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

function keepIn(s: Spot): Spot {
  return { x: clamp(s.x, 0.09, 0.91), y: clamp(s.y, 0.2, 0.9) };
}

function angle(from: Spot, to: Spot) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function dist(a: Spot, b: Spot) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function unit(from: Spot, to: Spot): Spot {
  const d = dist(from, to) || 1;
  return { x: (to.x - from.x) / d, y: (to.y - from.y) / d };
}

/** Squared-up start positions for each exchange. Seeded so a tape replays the same. */
export function mark(result: FightResult, side: 0 | 1, step: number): Spot {
  const r1 = rand(`${result.seed}|${side}|${step}|x`);
  const r2 = rand(`${result.seed}|${side}|${step}|y`);
  const swap = step > 0 && rand(`${result.seed}|swap|${step}`) > 0.72;
  const left = side === 0 ? !swap : swap;
  const x = left ? 0.16 + r1 * 0.2 : 0.64 + r1 * 0.2;
  return { x, y: 0.34 + r2 * 0.46 };
}

function blank(bot: FighterSnap, spot: Spot, heading: number, hp: number): BotState {
  return {
    bot,
    spot,
    heading,
    lift: 0,
    pitch: 0,
    flipped: false,
    stroke: 0,
    rev: 0.35,
    gone: 0,
    dead: false,
    roll: spot.x * 34 + spot.y * 21,
    hp,
    charging: false,
    spotlight: false,
    flame: 0,
  };
}

function face(self: BotState, other: BotState, twist = 0) {
  self.heading = angle(self.spot, other.spot) + twist;
}

function juke(seed: string, time: number, amp: number): Spot {
  const a = rand(seed) * 6.28;
  return {
    x: Math.sin(time * 2.3 + a) * amp + Math.sin(time * 5.1 + a * 2) * amp * 0.3,
    y: Math.cos(time * 1.7 + a) * amp * 0.8,
  };
}

function isSpinner(family: string) {
  return family === "saw" || family === "disc" || family === "drum";
}

function knockFor(family: string, damage: number) {
  const base = 0.07 + (clamp(damage, 0, 40) / 40) * 0.2;
  if (family === "flip") return base * 1.15;
  if (isSpinner(family)) return base * 1.3;
  if (family === "hammer") return base * 0.35;
  if (family === "wedge" || family === "claw") return base * 1.1;
  return base;
}

type StrikeOut = {
  atk: BotState;
  def: BotState;
  impact: Spot | null;
  power: number;
  focus: Spot;
  tight: number;
};

/**
 * One exchange. Wind up, charge, land, throw the defender, regroup.
 * `P0`/`Q0` start, `P1`/`Q1` where the next exchange starts.
 */
function strike(
  atkBot: FighterSnap,
  defBot: FighterSnap,
  P0: Spot,
  Q0: Spot,
  P1: Spot,
  Q1: Spot,
  local: number,
  time: number,
  damage: number,
  hpAtk: number,
  hpDefBefore: number,
  hpDefAfter: number,
  flameHit: boolean,
): StrikeOut {
  const family = atkBot.weaponFamily;
  const dir = unit(P0, Q0);
  const back = { x: P0.x - dir.x * 0.04, y: P0.y - dir.y * 0.04 };
  const qBrace = keepIn({ x: Q0.x - dir.x * 0.025, y: Q0.y - dir.y * 0.025 });
  const contactP = { x: qBrace.x - dir.x * REACH, y: qBrace.y - dir.y * REACH };
  const kb = flameHit ? 0.03 : knockFor(family, damage);
  const qEnd = keepIn({ x: qBrace.x + dir.x * kb, y: qBrace.y + dir.y * kb });
  const recoil = isSpinner(family) ? 0.07 : family === "hammer" ? 0.015 : 0.03;
  const pEnd = keepIn({ x: contactP.x - dir.x * recoil, y: contactP.y - dir.y * recoil });
  const ko = hpDefAfter <= 0;

  const atk = blank(atkBot, P0, 0, hpAtk);
  const def = blank(defBot, Q0, 0, hpDefBefore);
  atk.rev = 0.6;
  def.rev = 0.45;
  let impact: Spot | null = null;
  let power = 0;
  let spinDef = 0;
  let tight = 0.35;

  if (local < 0.1) {
    const t = ease(local / 0.1);
    atk.spot = mix(P0, back, t);
    def.spot = mix(Q0, qBrace, t * 0.5);
    atk.rev = lerp(0.6, 1, t);
  } else if (local < HIT_AT) {
    const t = (local - 0.1) / (HIT_AT - 0.1);
    atk.spot = mix(back, contactP, easeIn(t));
    def.spot = mix(Q0, qBrace, 0.5 + ease(t) * 0.5);
    atk.charging = t > 0.15;
    atk.rev = 1;
    atk.pitch = atk.charging ? 0.05 : 0;
    tight = lerp(0.35, 0.8, t);
  } else if (local < HIT_AT + 0.04) {
    atk.spot = contactP;
    def.spot = qBrace;
    atk.rev = 1;
    atk.stroke = ease((local - HIT_AT) / 0.03);
    impact = mix(contactP, qBrace, 0.62);
    power = clamp(damage / 30, 0.35, 1);
    tight = 0.9;
  } else if (local < 0.72) {
    const k = easeOut((local - HIT_AT - 0.04) / (0.72 - HIT_AT - 0.04));
    const arc = Math.sin(Math.min(1, k * 1.15) * Math.PI);
    atk.spot = mix(contactP, pEnd, k);
    def.spot = mix(qBrace, qEnd, k);
    atk.stroke = 1 - ease((local - HIT_AT - 0.04) / 0.2);
    atk.rev = 1;
    if (!flameHit) {
      if (family === "flip") {
        def.lift = arc * (0.7 + damage / 80);
        def.pitch = k * Math.PI * 2 * (ko ? 0.5 : 1);
      } else if (isSpinner(family)) {
        def.lift = arc * (0.1 + damage / 220);
        def.pitch = Math.sin(k * Math.PI * 3) * 0.35 * (1 - k);
        spinDef = k * (1.4 + damage / 20);
      } else if (family === "hammer") {
        def.lift = -Math.sin(k * Math.PI * 4) * 0.015 * (1 - k);
        def.pitch = Math.sin(k * Math.PI * 5) * 0.12 * (1 - k);
      } else if (family === "wedge" || family === "claw") {
        def.lift = arc * 0.18;
        def.pitch = arc * 0.55;
        spinDef = k * 0.5;
      } else {
        def.lift = arc * 0.12;
        spinDef = k * 0.8;
      }
    }
    if (ko && k > 0.55 && !flameHit) {
      def.flipped =
        family === "flip" || family === "wedge" || family === "claw" || isSpinner(family);
      if (def.flipped) def.pitch = 0;
    }
    def.hp = lerp(hpDefBefore, hpDefAfter, clamp(k * 3, 0, 1));
    tight = lerp(0.9, 0.5, k);
  } else {
    const t = ease((local - 0.72) / 0.28);
    atk.spot = mix(pEnd, P1, t);
    def.spot = ko ? qEnd : mix(qEnd, Q1, t);
    def.hp = hpDefAfter;
    spinDef = isSpinner(family)
      ? (1.4 + damage / 20) * (1 - t)
      : family === "flip"
        ? 0
        : 0.5 * (1 - t);
    atk.rev = lerp(1, 0.6, t);
    if (ko && !flameHit)
      def.flipped =
        family === "flip" || family === "wedge" || family === "claw" || isSpinner(family);
    tight = lerp(0.5, 0.3, t);
  }

  if (flameHit && local >= HIT_AT) {
    atk.flame =
      local < 0.8
        ? clamp((local - HIT_AT) / 0.05, 0, 1) * (1 - clamp((local - 0.7) / 0.1, 0, 1))
        : 0;
    impact = local < 0.72 ? mix(contactP, qBrace, 0.7) : null;
    power = impact ? 0.6 : 0;
  }

  if (ko && local >= HIT_AT + 0.04) {
    def.dead = true;
    def.rev = 0;
    def.hp = local < 0.72 ? def.hp : 0;
  }
  face(atk, def);
  face(def, atk, spinDef);
  atk.roll = atk.spot.x * 34 + atk.spot.y * 21;
  def.roll = def.spot.x * 34 + def.spot.y * 21;
  return { atk, def, impact, power, focus: mix(atk.spot, def.spot, 0.5), tight };
}

function beforeHp(result: FightResult, ex: Exchange) {
  const prior = [...result.exchanges]
    .reverse()
    .find((item) => item.index < ex.index && item.defenderId === ex.defenderId);
  if (prior) return prior.defenderHp;
  const asAttacker = [...result.exchanges]
    .reverse()
    .find((item) => item.index < ex.index && item.attackerId === ex.defenderId);
  return asAttacker ? asAttacker.attackerHp : 100;
}

function hpBefore(result: FightResult, id: string, index: number) {
  let hp = 100;
  for (const ex of result.exchanges) {
    if (ex.index >= index) break;
    if (ex.defenderId === id) hp = ex.defenderHp;
    if (ex.attackerId === id) hp = ex.attackerHp;
  }
  return hp;
}

/** Position of everyone at the end of the last exchange (or finisher). */
function duelEnd(result: FightResult, time: number): { a: BotState; b: BotState } {
  const a = result.fighters[0]!;
  const b = result.fighters[1]!;
  const n = result.exchanges.length;
  if (result.finisher) {
    return finisherState(result, 1, time);
  }
  const last = result.exchanges[n - 1];
  if (last && last.defenderHp <= 0) {
    const s = exchangeState(result, n - 1, 1, time);
    return s;
  }
  const A = blank(a, mark(result, 0, n), 0, hpBefore(result, a.id, n));
  const B = blank(b, mark(result, 1, n), 0, hpBefore(result, b.id, n));
  face(A, B);
  face(B, A);
  return { a: A, b: B };
}

function exchangeState(result: FightResult, index: number, local: number, time: number) {
  const a = result.fighters[0]!;
  const b = result.fighters[1]!;
  const ex = result.exchanges[index]!;
  const aAttacks = ex.attackerId === a.id;
  const P0 = mark(result, aAttacks ? 0 : 1, index);
  const Q0 = mark(result, aAttacks ? 1 : 0, index);
  const P1 = mark(result, aAttacks ? 0 : 1, index + 1);
  const Q1 = mark(result, aAttacks ? 1 : 0, index + 1);
  const atkBot = aAttacks ? a : b;
  const defBot = aAttacks ? b : a;
  const out = strike(
    atkBot,
    defBot,
    P0,
    Q0,
    P1,
    Q1,
    local,
    time,
    ex.damage,
    ex.attackerHp,
    beforeHp(result, ex),
    ex.defenderHp,
    false,
  );
  return aAttacks ? { a: out.atk, b: out.def, out } : { a: out.def, b: out.atk, out };
}

function finisherState(result: FightResult, local: number, time: number) {
  const a = result.fighters[0]!;
  const b = result.fighters[1]!;
  const fin = result.finisher!;
  const n = result.exchanges.length;
  const aAttacks = fin.by === a.id;
  const P0 = mark(result, aAttacks ? 0 : 1, n);
  const Q0 = mark(result, aAttacks ? 1 : 0, n);
  const atkBot = aAttacks ? a : b;
  const defBot = aAttacks ? b : a;
  const hpDef = hpBefore(result, defBot.id, n);
  const hpAfter = result.hp[defBot.id] ?? Math.max(0, hpDef - fin.damage);
  const P1 = { x: lerp(P0.x, 0.5, 0.3), y: lerp(P0.y, 0.6, 0.3) };
  const out = strike(
    atkBot,
    defBot,
    P0,
    Q0,
    P1,
    Q0,
    local,
    time,
    fin.damage,
    hpBefore(result, atkBot.id, n),
    hpDef,
    hpAfter,
    true,
  );
  if (local > HIT_AT) {
    out.def.hp = lerp(hpDef, hpAfter, clamp((local - HIT_AT) / 0.3, 0, 1));
  }
  return aAttacks ? { a: out.atk, b: out.def, out } : { a: out.def, b: out.atk, out };
}

export function fightDrive(result: FightResult, beat: Beat, local: number, time: number): Drive {
  if (result.method === "melee" || result.fighters.length > 2)
    return meleeDrive(result, beat, local, time);
  const a = result.fighters[0]!;
  const b = result.fighters[1];
  const noHit = {
    impact: null,
    power: 0,
    hitKey: null,
    hitAt: HIT_AT,
    weapon: a.weaponFamily,
    victim: null,
  };

  if (!b) {
    const A = blank(a, { x: 0.5, y: 0.6 }, Math.PI / 2, 100);
    A.heading = time * 0.8;
    return { bots: [A], ...noHit, focus: A.spot, tight: 0.3 };
  }

  const startA = mark(result, 0, 0);
  const startB = mark(result, 1, 0);

  if (beat.kind === "bumper") {
    const t = ease(clamp((local - 0.15) / 0.75, 0, 1));
    const A = blank(a, mix({ x: -0.15, y: 0.62 }, startA, t), 0, 100);
    const B = blank(b, mix({ x: 1.15, y: 0.62 }, startB, t), Math.PI, 100);
    A.charging = t > 0 && t < 0.9;
    B.charging = A.charging;
    if (t > 0.7) {
      face(A, B);
      face(B, A);
    }
    A.rev = 0.2;
    B.rev = 0.2;
    return { bots: [A, B], ...noHit, focus: { x: 0.5, y: 0.55 }, tight: 0 };
  }

  if (beat.kind === "intro") {
    const me = beat.side;
    const home = me === 0 ? startA : startB;
    const stage = { x: me === 0 ? 0.42 : 0.58, y: 0.72 };
    const out = local < 0.25 ? ease(local / 0.25) : local > 0.8 ? 1 - ease((local - 0.8) / 0.2) : 1;
    const hero = blank(me === 0 ? a : b, mix(home, stage, out), 0, 100);
    const other = blank(me === 0 ? b : a, me === 0 ? startB : startA, 0, 100);
    const j = juke(`${other.bot.id}intro`, time, 0.012);
    other.spot = { x: other.spot.x + j.x, y: other.spot.y + j.y };
    hero.spotlight = true;
    // Show off: a slow turn toward the camera, then a rev.
    const show = local > 0.25 && local < 0.8 ? (local - 0.25) / 0.55 : local <= 0.25 ? 0 : 1;
    face(other, hero);
    hero.heading = angle(hero.spot, other.spot) + Math.sin(show * Math.PI) * 1.9;
    hero.rev = local > 0.45 && local < 0.8 ? 1 : 0.35;
    hero.stroke = local > 0.55 && local < 0.62 ? 1 : 0;
    hero.charging = local < 0.25 || local > 0.8;
    const A = me === 0 ? hero : other;
    const B = me === 0 ? other : hero;
    return { bots: [A, B], ...noHit, focus: hero.spot, tight: 0.55 };
  }

  if (beat.kind === "stats") {
    const fade = Math.sin(clamp(local, 0, 1) * Math.PI);
    const ja = juke(`${a.id}stats`, time, 0.03 * fade);
    const jb = juke(`${b.id}stats`, time + 1.3, 0.03 * fade);
    const A = blank(a, { x: startA.x + ja.x, y: startA.y + ja.y }, 0, 100);
    const B = blank(b, { x: startB.x + jb.x, y: startB.y + jb.y }, 0, 100);
    face(A, B);
    face(B, A);
    A.rev = 0.5 + fade * 0.5;
    B.rev = 0.5 + fade * 0.5;
    return { bots: [A, B], ...noHit, focus: mix(A.spot, B.spot, 0.5), tight: 0.2 };
  }

  if (beat.kind === "exchange") {
    const s = exchangeState(result, beat.index, local, time);
    const ex = result.exchanges[beat.index]!;
    // Tiny idle weave on whoever is not moving, so nobody freezes.
    return {
      bots: [s.a, s.b],
      impact: s.out.impact,
      power: s.out.power,
      hitKey: `ex-${beat.index}`,
      hitAt: HIT_AT,
      weapon: (ex.attackerId === a.id ? a : b).weaponFamily,
      victim: ex.defenderId,
      focus: s.out.focus,
      tight: s.out.tight,
    };
  }

  if (beat.kind === "finisher" && result.finisher) {
    const s = finisherState(result, local, time);
    return {
      bots: [s.a, s.b],
      impact: s.out.impact,
      power: s.out.power,
      hitKey: "fin",
      hitAt: HIT_AT,
      weapon: "burn",
      victim: result.finisher.against,
      focus: s.out.focus,
      tight: s.out.tight,
    };
  }

  // Decision.
  const end = duelEnd(result, time);
  const A = end.a;
  const B = end.b;
  const winnerA = result.winnerIds.includes(a.id);
  const win = winnerA ? A : B;
  const lose = winnerA ? B : A;
  lose.hp = result.hp[lose.bot.id] ?? lose.hp;
  win.hp = result.hp[win.bot.id] ?? win.hp;
  lose.flame = 0;
  win.flame = 0;
  win.stroke = 0;
  lose.stroke = 0;
  lose.lift = 0;
  win.lift = 0;
  lose.pitch = 0;
  win.pitch = 0;
  let focus = win.spot;
  let impact: Spot | null = null;
  let power = 0;

  if (result.method === "dump") {
    // Shove the loser across the floor and into the pit.
    const pit = { x: PIT.x, y: PIT.y + 0.02 };
    const start = lose.spot;
    const dir = unit(start, pit);
    const behind = keepIn({ x: start.x - dir.x * REACH, y: start.y - dir.y * REACH });
    if (local < 0.18) {
      const t = easeIn(local / 0.18);
      win.spot = mix(win.spot, behind, t);
      win.charging = true;
      face(win, lose);
    } else if (local < 0.62) {
      const t = ease((local - 0.18) / 0.44);
      lose.spot = mix(start, pit, t);
      win.spot = { x: lose.spot.x - dir.x * REACH, y: lose.spot.y - dir.y * REACH };
      win.charging = true;
      win.stroke = 1;
      face(win, lose);
      lose.heading = angle(lose.spot, win.spot) + Math.sin(t * 7) * 0.2;
      lose.gone = clamp((t - 0.82) / 0.18, 0, 1);
      if (local < 0.25) {
        impact = mix(win.spot, lose.spot, 0.6);
        power = 0.5;
      }
    } else {
      const t = ease((local - 0.62) / 0.38);
      const pushEnd = { x: pit.x - dir.x * REACH, y: pit.y - dir.y * REACH };
      lose.spot = pit;
      lose.gone = 1;
      win.spot = mix(pushEnd, { x: 0.5, y: 0.55 }, t);
      win.heading = angle(pushEnd, { x: 0.5, y: 0.55 }) + t * Math.PI * 3;
      win.rev = 1;
    }
    focus = mix(win.spot, lose.spot, 0.5);
    lose.dead = true;
    lose.rev = 0;
  } else if (result.method !== "scrimmage") {
    win.celebrate = local > 0.2;
    // Victory lap: a spin in place and a rev.
    const t = clamp((local - 0.15) / 0.6, 0, 1);
    win.heading = win.heading + ease(t) * Math.PI * 4;
    win.rev = 1;
    win.stroke = local > 0.8 && local < 0.86 ? 1 : 0;
    if (result.method === "ko") {
      lose.dead = true;
      lose.rev = 0;
      lose.hp = 0;
    } else {
      lose.rev = 0.15;
    }
  } else {
    win.rev = 0.4;
    lose.rev = 0.4;
  }
  win.roll = win.spot.x * 34 + win.spot.y * 21 + (result.method !== "dump" ? local * 6 : 0);
  lose.roll = lose.spot.x * 34 + lose.spot.y * 21;
  return {
    bots: [A, B],
    impact,
    power,
    hitKey: impact ? "dump" : null,
    hitAt: 0.18,
    weapon: win.bot.weaponFamily,
    victim: lose.bot.id,
    focus,
    tight: 0.45,
  };
}

function meleeDrive(result: FightResult, beat: Beat, local: number, time: number): Drive {
  const bots = result.fighters.filter((f) => f.id !== "house");
  const count = Math.max(1, bots.length);
  const hpNow = meleeHp(result, beat, local);
  const slot = (i: number): Spot => {
    const orbit = time * 0.06 + (Math.PI * 2 * i) / count;
    return { x: 0.5 + Math.cos(orbit) * 0.32, y: 0.56 + Math.sin(orbit) * 0.26 };
  };
  const center = { x: 0.5, y: 0.56 };
  const states = bots.map((bot, i) => {
    const j = juke(`${bot.id}melee`, time, 0.025);
    const base = slot(i);
    const s = blank(
      bot,
      { x: base.x + j.x, y: base.y + j.y },
      angle(base, center),
      hpNow[bot.id] ?? 100,
    );
    s.rev = 0.8;
    s.heading = angle(s.spot, center) + Math.sin(time * 1.3 + i) * 0.5;
    if ((hpNow[bot.id] ?? 100) <= 0) {
      s.dead = true;
      s.rev = 0;
      s.flipped = rand(`${bot.id}flip`) > 0.4;
      s.spot = base;
    }
    return s;
  });

  let impact: Spot | null = null;
  let power = 0;
  let hitKey: string | null = null;
  let weapon = "ram";
  let victim: string | null = null;
  let focus = center;
  let tight = 0.1;

  if (beat.kind === "bumper") {
    states.forEach((s, i) => {
      const from = { x: i % 2 === 0 ? -0.15 : 1.15, y: 0.3 + (i / count) * 0.6 };
      const t = ease(clamp((local - 0.1) / 0.8, 0, 1));
      s.spot = mix(from, s.spot, t);
      s.charging = t < 0.9;
      s.heading = angle(from, s.spot);
    });
  }

  if (beat.kind === "exchange") {
    const ex = result.exchanges[beat.index];
    const ai = bots.findIndex((bot) => bot.id === ex?.attackerId);
    const di = bots.findIndex((bot) => bot.id === ex?.defenderId);
    if (ex && ai >= 0 && di >= 0) {
      const atkBot = bots[ai]!;
      const defBot = bots[di]!;
      const P0 = slot(ai);
      const Q0 = slot(di);
      const out = strike(
        atkBot,
        defBot,
        P0,
        Q0,
        P0,
        Q0,
        local,
        time,
        ex.damage,
        ex.attackerHp,
        meleeBefore(result, ex),
        ex.defenderHp,
        false,
      );
      states[ai] = out.atk;
      states[di] = out.def;
      impact = out.impact;
      power = out.power;
      hitKey = `ex-${beat.index}`;
      weapon = atkBot.weaponFamily;
      victim = defBot.id;
      focus = out.focus;
      tight = out.tight * 0.6;
    }
  }

  if (beat.kind === "decision") {
    const winner = result.winnerIds[0];
    states.forEach((s) => {
      if (s.bot.id === winner) {
        s.celebrate = local > 0.25;
        s.spot = mix(s.spot, center, ease(local * 2));
        s.heading += ease(clamp((local - 0.3) / 0.6, 0, 1)) * Math.PI * 4;
        s.rev = 1;
        focus = s.spot;
        tight = 0.4;
      }
    });
  }

  states.forEach((s) => (s.roll = s.spot.x * 34 + s.spot.y * 21));
  return { bots: states, impact, power, hitKey, hitAt: HIT_AT, weapon, victim, focus, tight };
}

function meleeBefore(result: FightResult, ex: Exchange) {
  return hpBefore(result, ex.defenderId, ex.index);
}

function meleeHp(result: FightResult, beat: Beat, local: number) {
  const hp: Record<string, number> = {};
  result.fighters.forEach((f) => (hp[f.id] = 100));
  const upto =
    beat.kind === "exchange"
      ? beat.index + (local > HIT_AT + 0.1 ? 1 : 0)
      : beat.kind === "decision" || beat.kind === "finisher"
        ? result.exchanges.length
        : 0;
  result.exchanges.slice(0, upto).forEach((ex) => {
    hp[ex.defenderId] = ex.defenderHp;
    hp[ex.attackerId] = ex.attackerHp;
  });
  return hp;
}

export function classSize(classId: ClassId) {
  if (classId === "tank") return 1.08;
  if (classId === "specialist") return 0.92;
  return 1;
}
