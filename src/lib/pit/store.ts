import { create, type StateCreator } from "zustand";
import { persist } from "zustand/middleware";
import { memoSnapshot, snapshotStorage } from "./snapshot-storage";
import {
  CLASS_META,
  METRICS,
  PAINT,
  LOCKER_PAINTS,
  REPAIR_PRICE,
  VERSION,
  partById,
  stockPart,
  styleOf,
  starterBodies,
} from "./catalog";
import {
  SLOTS,
  RECLASS_FEE,
  bestBuildId,
  buildCard,
  kickoffRank,
  buyCheck,
  SELL_BACK,
  sellCheck,
  showCheck,
  cardFor,
  championshipFinalists,
  craftScore,
  equippedScry,
  foesThisWeek,
  gradesOf,
  hashString,
  lastPlaceId,
  mergeWear,
  quotesForBot,
  runSaturday as playCard,
  coinsByJar,
  spyRead,
  WEAPON_FAMILIES,
  wonThisWeek,
  writeGazette,
} from "./engine";
import { makeData } from "./seed";
import { BOLTS, STREAK_BADGE, allJobs, crateFor, dayOpen, programWeek, type DayKey } from "./training";
import { eligibilityClosed } from "./eligibility";
import { blockedName } from "../../../scripts/copy-guard.mjs";
import { bannerVerdict, cosmeticUnlocked, earnedRewardIds, HALLOWEEN_REWARD_IDS, THANKSGIVING_REWARD_IDS, validBodyForClass } from "./cosmetics";
import { boltsOf, lockerItem, sparkStreak } from "./week";
import { checkedCosmeticLoadout } from "./cosmetic-loadout";
import { authorize } from "./commands";
import { showEffect } from "./halloween";
import { thanksgivingShowEffect } from "./thanksgiving";
import { buildLockMessage, deadlineDue, weekDeadline } from "./time";
import type { BotDecal, CosmeticLoadout, StickerSlot } from "./types";
import type { Bot, BotLook, BotStyle, Condition, FightResult, GarageLook, GazetteEntry, Grade, Kickoff, Loadout, PitData, Session, ShowEffectId, Slot, StatKey, StoreCard } from "./types";
import { dailyGazetteId, type GazetteDraft } from "./gazette-ai";

const FIELD_OF: Record<StatKey, keyof StoreCard> = { nsnu: "nsnu", conv: "conv", demoRate: "demoRate", demoClose: "demoClose", arch: "arch", ticket: "demoTicket" };

export type PitState = PitData & {
  flash: string;
  /** Bumps when a Halloween look unlocks, so the floor can throw green ooze. Not saved. */
  ooze: number;
  setSticker: (storeId: string, slot: StickerSlot, decal: BotDecal) => void;
  proposeCosmetic: (storeId: string, loadout: CosmeticLoadout) => void;
  voteCosmetic: (id: string) => void;
  acceptCosmetic: (id: string) => void;
  signPublic: () => void;
  chooseStarterBody: (storeId: string, classId: Bot["classId"], body: NonNullable<BotStyle["body"]>) => void;
  signCrew: (storeId: string, crewId: string, code?: string) => Promise<boolean>;
  signCaptain: (storeId: string, passcode: string) => Promise<boolean>;
  signCommissioner: (pin: string) => Promise<boolean>;
  setPin: (pin: string) => void;
  setDraftPart: (storeId: string, slot: Slot, partId: string | null) => void;
  setDraftLoadout: (storeId: string, loadout: Loadout) => void;
  lockStore: (storeId: string) => void;
  unlockStore: (storeId: string) => void;
  updateCard: (storeId: string, patch: Partial<StoreCard>) => void;
  setOfficialNsnu: (storeId: string, dollars: number) => void;
  setGrade: (storeId: string, stat: StatKey, grade: Grade | null) => void;
  setKickoffGrade: (storeId: string, stat: StatKey, grade: Grade | null) => void;
  applyKickoff: () => void;
  propose: (storeId: string, partId: string, note: string) => void;
  acceptProposal: (id: string) => void;
  dismissProposal: (id: string) => void;
  buyPart: (storeId: string, partId: string) => void;
  sellPart: (storeId: string, partId: string) => void;
  buyShow: (storeId: string, effectId: ShowEffectId) => void;
  repairSlot: (storeId: string, slot: Slot, mode: "full" | "weld" | "salvage" | "crown") => void;
  nameMvp: (storeId: string, crewId: string) => void;
  renameBot: (storeId: string, name: string) => void;
  renameIdentity: (storeId: string, botName: string, teamName: string) => void;
  renameCaptain: (storeId: string, name: string) => void;
  setPasscode: (storeId: string, passcode: string) => void;
  setPaint: (storeId: string, paint: string) => void;
  setGarage: (storeId: string, garage: GarageLook) => void;
  setLook: (storeId: string, look: BotLook) => void;
  setStyle: (storeId: string, patch: Partial<BotStyle>) => void;
  completeJob: (week: number, jobId: string, note: string) => void;
  approveJob: (entryId: string) => void;
  rejectJob: (entryId: string) => void;
  submitSpark: (week: number, day: string, correct: number, total: number) => void;
  postShout: (to: string, text: string) => void;
  removeShout: (id: string) => void;
  setCrewOff: (crewId: string, week: number, off: boolean) => void;
  setTrainingOpenAll: (on: boolean) => void;
  buyLocker: (storeId: string, itemId: string) => void;
  makePick: (boutId: string, pick: string) => void;
  setRally: (targetId: string) => void;
  setNumber: (storeId: string, number: string) => void;
  renameCrew: (crewId: string, name: string) => void;
  addCrew: (storeId: string, name: string) => void;
  removeCrew: (storeId: string, crewId: string) => void;
  dismissTutorial: () => void;
  showTutorial: () => void;
  pullSpy: (storeId: string, targetId: string) => void;
  callSpy: (storeId: string, targetId: string, family: string) => void;
  setTags: (week: number, on: boolean) => void;
  setTagline: (tagline: string) => void;
  houseCall: (text: string) => void;
  giftCoins: (storeId: string, slot: Slot, amount: number) => void;
  postDailyGazette: (entries: GazetteDraft[], todayISO: string) => void;
  postRecapGazette: (week: number, entries: GazetteEntry[]) => void;
  lockFriday: () => void;
  runSaturday: () => void;
  dropDamage: () => void;
  advanceWeek: () => void;
  resetSeason: () => void;
};

function isBoss(data: PitData) {
  return data.session.role === "commissioner";
}

const HALLOWEEN_LABEL: Record<(typeof HALLOWEEN_REWARD_IDS)[number], string> = {
  "reward-pumpkin": "Pumpkin Sticker",
  "reward-lantern-mask": "Lantern Mask",
  "reward-hockey-mask": "Hockey Mask",
  "reward-hockey-machete": "Hockey Mask Machete",
};

function newlyEarnedHalloween(data: PitData, storeId: string, before: Set<string>) {
  const after = earnedRewardIds(data, storeId);
  const hit = HALLOWEEN_REWARD_IDS.find((id) => after.has(id) && !before.has(id));
  return hit ? HALLOWEEN_LABEL[hit] : null;
}

const THANKSGIVING_LABEL: Record<(typeof THANKSGIVING_REWARD_IDS)[number], string> = {
  "reward-turkey": "Turkey Sticker",
  "reward-pilgrim-hat": "Pilgrim Hat",
  "reward-wishbone": "Wishbone Decal",
  "reward-harvest-wreath": "Harvest Wreath",
};

function newlyEarnedThanksgiving(data: PitData, storeId: string, before: Set<string>) {
  const after = earnedRewardIds(data, storeId);
  const hit = THANKSGIVING_REWARD_IDS.find((id) => after.has(id) && !before.has(id));
  return hit ? THANKSGIVING_LABEL[hit] : null;
}

/** The signed-in crew member, if any. The desk acts as nobody. */
function actor(data: PitData) {
  const { role, crewId } = data.session;
  if ((role !== "crew" && role !== "captain") || !crewId) return undefined;
  return data.crew.find((c) => c.id === crewId);
}

/** Why a Pit Week action is closed right now, or null when it is open. */
function trainingClosed(data: PitData, week: number, day?: DayKey): string | null {
  if (week < data.week) return `Week ${week} training is closed.`;
  if (week > data.week) return `Week ${week} opens after the desk advances the league.`;
  if (data.phase !== "open") return "Saturday lock passed. This week's training is closed.";
  const plan = programWeek(week);
  if (day && plan && !dayOpen(plan, day, new Date(), data.trainingOpenAll)) return "That day is not open yet.";
  return null;
}

function isCaptainOf(data: PitData, storeId: string) {
  return isBoss(data) || (data.session.role === "captain" && data.session.storeId === storeId);
}

function championshipPrepAllowed(data: PitData, storeId: string) {
  return data.week !== 5 || championshipFinalists(data).includes(storeId);
}

function championshipPrepGuard(data: PitData, storeId: string): string | null {
  return championshipPrepAllowed(data, storeId)
    ? null
    : "Championship Week bot work belongs to the two conference champions. Rally behind a finalist instead.";
}

function starterBodyGuard(data: PitData, storeId: string): string | null {
  const bot = data.bots.find((row) => row.storeId === storeId);
  return data.week === 1 && !bot?.style?.body
    ? "Choose and lock your Week 1 body first."
    : null;
}

/** Captains and crew cannot move iron once this week's automatic deadline has passed. The Desk still can. */
function captainBuildBlock(data: PitData): string | null {
  if (isBoss(data) || !deadlineDue(data.week, new Date())) return null;
  return buildLockMessage(data.week);
}

function buildsFrozen(data: PitData): boolean {
  const finalists = data.week === 5 ? championshipFinalists(data) : null;
  return data.bots.every((bot) => {
    if (finalists && !finalists.includes(bot.storeId)) return true;
    return bot.locked != null;
  });
}

function lockPatch(data: PitData, at: number) {
  const championship = data.week === 5;
  const finalists = championshipFinalists(data);
  return {
    phase: "locked" as const,
    weeks: data.weeks.map((w) => (w.number === data.week ? { ...w, lockedAt: w.lockedAt ?? at } : w)),
    bots: data.bots.map((b) =>
      championship && !finalists.includes(b.storeId)
        ? { ...b, locked: null }
        : { ...b, locked: { ...(b.locked ?? b.draft) }, equipped: { ...(b.locked ?? b.draft) } },
    ),
    flash: championship
      ? "Championship builds frozen. Saturday ends only with a knockout."
      : `Locked. ${data.stores.length} builds frozen for Monday. Click in Sunday's colors, then run the card.`,
    log: [`Week ${data.week} locked.`, ...data.log.slice(0, 23)],
  };
}

/**
 * Freeze the current week once its automatic deadline has passed.
 * Returns null before the deadline, once the phase has already moved on, and for weeks with no deadline (2–4).
 */
export function applyDueLock<T extends PitData>(data: T, now: Date): T | null {
  const deadline = weekDeadline(data.week);
  if (!deadline || now.getTime() < deadline.at.getTime() || data.phase !== "open") return null;
  return { ...data, ...lockPatch(data, deadline.at.getTime()) };
}

function patchBot(bots: Bot[], storeId: string, fn: (bot: Bot) => Bot): Bot[] {
  return bots.map((bot) => (bot.storeId === storeId ? fn(partWelds(bot)) : bot));
}

/** Bind old slot-based welds before any equipment change can move them. */
function partWelds(bot: Bot): Bot {
  if (!Object.values(bot.weldForWeek ?? {}).some((week) => week != null)) return bot;
  const weldedParts = { ...bot.weldedParts };
  for (const slot of SLOTS) {
    const week = bot.weldForWeek[slot];
    const id = bot.equipped[slot];
    if (week != null && id && weldedParts[id] == null) weldedParts[id] = week;
  }
  return { ...bot, weldedParts, weldForWeek: {}, services: Math.max(bot.services ?? 0, 1) };
}

function clearPartWeld(bot: Bot, partId: string): Bot {
  const normalized = partWelds(bot);
  const weldedParts = { ...normalized.weldedParts };
  delete weldedParts[partId];
  return { ...normalized, weldedParts };
}

function syncWear(bot: Bot): Bot {
  const wear = { ...bot.wear };
  const equipped = bot.equipped;
  for (const slot of SLOTS) {
    const id = equipped[slot];
    wear[slot] = id ? (bot.partWear[id] ?? "clean") : "clean";
  }
  return { ...bot, wear };
}

function setPartWear(bot: Bot, partId: string, condition: Condition): Bot {
  const partWear = { ...bot.partWear, [partId]: condition };
  return syncWear({ ...bot, partWear });
}

/** Repairs come out of the voucher first, then that part's own coin jar. */
function payRepair(bot: Bot, slot: Slot, cost: number): Bot | null {
  const jar = bot.coins[slot] ?? 0;
  if (bot.voucher + jar < cost) return null;
  const fromVoucher = Math.min(bot.voucher, cost);
  const rest = cost - fromVoucher;
  return {
    ...bot,
    voucher: bot.voucher - fromVoucher,
    coins: { ...bot.coins, [slot]: jar - rest },
    repairSpent: bot.repairSpent + rest,
  };
}

function nextFightWeek(data: PitData): number {
  if (data.phase === "open" || data.phase === "locked") return data.week;
  return Math.min(5, data.week + 1);
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function projectCard(prev: StoreCard, week: number): StoreCard {
  const h = hashString(`${prev.storeId}:${week}:project`);
  const j = (i: number, span: number) => ((h >> (i * 4)) % (span * 2 + 1)) - span;
  return {
    id: `${prev.storeId}-w${week}`,
    storeId: prev.storeId,
    week,
    nsnu: clamp(prev.nsnu + j(1, 6) * 10, 600, 1500),
    conv: clamp(prev.conv + j(2, 3), 35, 85),
    demoRate: clamp(prev.demoRate + j(3, 3), 60, 98),
    demoClose: clamp(prev.demoClose + j(4, 2), 55, 85),
    arch: clamp(Math.round((prev.arch + j(5, 3) / 10) * 10) / 10, 1.8, 5),
    demoTicket: clamp(prev.demoTicket + j(6, 6) * 10, 1100, 2400),
    projected: true,
    nsnuOfficial: false,
  };
}

function fresh(): PitState {
  return {
    ...makeData(),
    flash: "",
    ooze: 0,
    setSticker: () => {},
    proposeCosmetic: () => {},
    voteCosmetic: () => {},
    acceptCosmetic: () => {},
    signPublic: () => {},
    chooseStarterBody: () => {},
    signCrew: async () => false,
    signCaptain: async () => false,
    setPin: () => {},
    signCommissioner: async () => false,
    setDraftPart: () => {},
    setDraftLoadout: () => {},
    lockStore: () => {},
    unlockStore: () => {},
    updateCard: () => {},
    setOfficialNsnu: () => {},
    setGrade: () => {},
    setKickoffGrade: () => {},
    applyKickoff: () => {},
    propose: () => {},
    acceptProposal: () => {},
    dismissProposal: () => {},
    buyPart: () => {},
    sellPart: () => {},
    buyShow: () => {},
    repairSlot: () => {},
    nameMvp: () => {},
    renameBot: () => {},
    renameIdentity: () => {},
    renameCaptain: () => {},
    setPasscode: () => {},
    setPaint: () => {},
    setGarage: () => {},
    setLook: () => {},
    setStyle: () => {},
    completeJob: () => {},
    approveJob: () => {},
    rejectJob: () => {},
    submitSpark: () => {},
    postShout: () => {},
    removeShout: () => {},
    setCrewOff: () => {},
    setTrainingOpenAll: () => {},
    buyLocker: () => {},
    makePick: () => {},
    setRally: () => {},
    setNumber: () => {},
    renameCrew: () => {},
    addCrew: () => {},
    removeCrew: () => {},
    dismissTutorial: () => {},
    showTutorial: () => {},
    pullSpy: () => {},
    callSpy: () => {},
    setTags: () => {},
    setTagline: () => {},
    houseCall: () => {},
    giftCoins: () => {},
    postDailyGazette: () => {},
    postRecapGazette: () => {},
    lockFriday: () => {},
    runSaturday: () => {},
    dropDamage: () => {},
    advanceWeek: () => {},
    resetSeason: () => {},
  };
}

/** Bump when the tutorial changes so every device sees the new one once. */
export const TUTORIAL_REV = 3;

/** Everything the league shares. Session and tutorial stay on the device. */
export const SHARED_KEYS = [
  "version", "seasonName", "tagline", "week", "phase", "stores", "crew", "bots", "weeks", "storeCards", "bouts",
  "gazette", "quotes", "proposals", "mvps", "honors", "craft", "log", "intel", "jobLog", "rallies", "sparkLog", "shouts", "picks",
  "trainingOpenAll", "kickoff", "cosmeticProposals",
] as const satisfies readonly (keyof PitData)[];

export type SharedDoc = Pick<PitData, (typeof SHARED_KEYS)[number]>;

/** A device that starts over must take the league copy before it pushes anything. */
function forgetSyncBase() {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem("pit-night-sync-v1");
  } catch {
    /* storage blocked */
  }
}

export function sharedDoc(state: PitData): SharedDoc {
  const out = {} as Record<string, unknown>;
  for (const k of SHARED_KEYS) out[k] = state[k];
  out.stores = state.stores.map(s => ({ id: s.id, name: s.name, teamName: s.teamName, region: s.region, conference: s.conference, captain: s.captain, paint: s.paint, garage: s.garage, seed: s.seed, unlocks: s.unlocks, boltsSpent: s.boltsSpent }));
  return out as SharedDoc;
}

/** Private drafts and scouting notes are projected for the verified viewer only. */
export function clientDoc(state: PitData, session: Session): SharedDoc {
  const out = sharedDoc(state);
  const desk = session.role === "commissioner";
  out.intel = desk ? out.intel : out.intel.filter(i => i.from === session.storeId);
  out.proposals = desk ? out.proposals : out.proposals.filter(p => p.storeId === session.storeId);
  out.cosmeticProposals = (out.cosmeticProposals ?? []).filter(p => desk || (session.role !== "public" && p.storeId === session.storeId));
  if (desk || ["fought", "inspected", "complete"].includes(state.phase)) return out;
  out.bots = out.bots.map(bot => {
    if (session.role !== "public" && session.storeId === bot.storeId) return bot;
    const stock = { chassis: stockPart("chassis", bot.classId).id, armor: stockPart("armor", bot.classId).id, drive: stockPart("drive", bot.classId).id, weapon: stockPart("weapon", bot.classId).id, utility: null, brain: stockPart("brain", bot.classId).id };
    return { ...bot, draft: stock, equipped: stock, locked: bot.locked ? stock : null, owned: [], partWear: {}, weldForWeek: {}, weldedParts: {}, coins: { chassis: 0, armor: 0, drive: 0, weapon: 0, utility: 0, brain: 0 }, voucher: 0, repairSpent: 0, shows: [] };
  });
  return out;
}

export const pitCreator: StateCreator<PitState> = (set, get) => ({
      ...fresh(),
      setSticker: (storeId, slot, decal) => {
        const data = get();
        if (!isCaptainOf(data, storeId)) return;
        const bot = data.bots.find(b => b.storeId === storeId);
        if (!bot) return;
        // Merge only this slot against the latest authoritative bot, not the caller's snapshot.
        data.setStyle(storeId, { stickers: { ...styleOf(bot).stickers!, [slot]: decal } });
      },
      proposeCosmetic: (storeId, input) => {
        const data = get();
        try { authorize(data, data.session, "proposeCosmetic", [storeId, input]); } catch { return; }
        const who = actor(data);
        if (!who || who.storeId !== storeId) return;
        const loadout = checkedCosmeticLoadout(data, storeId, input);
        if (!loadout) { set({ flash: "Use only your store's unlocked cosmetics. Starter bodies stay frozen through Week 1." }); return; }
        const proposals = data.cosmeticProposals ?? [];
        if (proposals.some(p => p.status === "open" && p.crewId === who.id && JSON.stringify(p.loadout) === JSON.stringify(loadout))) {
          set({ flash: "Your crew can already vote for this look." }); return;
        }
        // One current proposal per person keeps the shared board bounded; edits start a fresh vote.
        const id = `look:${who.id}:${crypto.randomUUID()}`;
        set({ cosmeticProposals: [...proposals.filter(p => p.crewId !== who.id || p.status !== "open"),
          { id, storeId, crewId: who.id, crewName: who.name, loadout, voters: [], at: Date.now(), status: "open" }],
          flash: "Look proposed. One vote per person per proposal; the captain makes the final call." });
      },
      voteCosmetic: (id) => {
        const data = get();
        try { authorize(data, data.session, "voteCosmetic", [id]); } catch { return; }
        const who = actor(data);
        const p = data.cosmeticProposals?.find(p => p.id === id && p.status === "open");
        if (!who || !p || p.storeId !== who.storeId || p.voters.includes(who.id)) return;
        set({ cosmeticProposals: data.cosmeticProposals.map(row => row.id === id ? { ...row, voters: [...row.voters, who.id] } : row), flash: "Vote counted." });
      },
      acceptCosmetic: (id) => {
        const data = get();
        try { authorize(data, data.session, "acceptCosmetic", [id]); } catch { return; }
        const p = data.cosmeticProposals?.find(p => p.id === id && p.status === "open");
        if (!p || !isCaptainOf(data, p.storeId)) return;
        const loadout = checkedCosmeticLoadout(data, p.storeId, p.loadout);
        if (!loadout) { set({ flash: "This proposal no longer qualifies. Ask the crew to submit a current unlocked look." }); return; }
        set({ stores: data.stores.map(s => s.id === p.storeId ? { ...s, paint: loadout.paint } : s),
          bots: patchBot(data.bots, p.storeId, b => ({ ...b, style: loadout.style, look: loadout.look, number: loadout.number })),
          cosmeticProposals: data.cosmeticProposals.map(row => row.id === id ? { ...row, status: "accepted" } : row),
          flash: `${p.crewName}'s look accepted. Battle history and combat stats stay unchanged.` });
      },
      signPublic: () => {},
      chooseStarterBody: (storeId, classId, body) => {
        const data = get();
        const ownCrew = data.session.role === "crew" && data.session.storeId === storeId;
        if (!isCaptainOf(data, storeId) && !ownCrew) {
          set({ flash: "Sign in to choose this store's starter body." });
          return;
        }
        const buildBlock = captainBuildBlock(data);
        if (buildBlock) {
          set({ flash: buildBlock });
          return;
        }
        const bot = data.bots.find((row) => row.storeId === storeId);
        if (!bot) return;
        if (data.week !== 1 || data.bouts.some((bout) => bout.week === 1 && bout.result) || bot.style?.body) {
          set({ flash: "The Week 1 body choice is already locked." });
          return;
        }
        const option = starterBodies(classId).find((row) => row.id === body);
        if (!option) {
          set({ flash: "That body does not belong to that fighting style." });
          return;
        }
        const draft: Loadout = {
          chassis: stockPart("chassis", classId).id,
          drive: stockPart("drive", classId).id,
          weapon: stockPart("weapon", classId).id,
          armor: stockPart("armor", classId).id,
          utility: null,
          brain: stockPart("brain", classId).id,
        };
        set({
          bots: patchBot(data.bots, storeId, (current) =>
            syncWear({
              ...current,
              classId,
              draft,
              equipped: { ...draft },
              locked: null,
              style: { ...styleOf(current, classId), body },
            }),
          ),
          flash: `${option.label} selected. ${CLASS_META[classId].label} body is locked through Week 1.`,
          log: [
            `${data.stores.find((row) => row.id === storeId)?.name ?? storeId} chose ${option.label} (${CLASS_META[classId].label}) for Week 1.`,
            ...data.log.slice(0, 23),
          ],
        });
      },
      signCrew: async () => false,
      signCaptain: async () => false,
      signCommissioner: async () => false,
      setPin: () => {},
      setDraftPart: (storeId, slot, partId) => {
        const data = get();
        const championshipBlock = championshipPrepGuard(data, storeId);
        if (championshipBlock && !isBoss(data)) { set({ flash: championshipBlock }); return; }
        const starterBlock = starterBodyGuard(data, storeId);
        if (starterBlock && !isBoss(data)) { set({ flash: starterBlock }); return; }
        if (!isCaptainOf(data, storeId)) {
          set({ flash: "Only the captain can change parts." });
          return;
        }
        const buildBlock = captainBuildBlock(data);
        if (buildBlock) {
          set({ flash: buildBlock });
          return;
        }
        const reopened = data.phase === "locked" && !data.bots.find((b) => b.storeId === storeId)?.locked;
        if (data.phase !== "open" && !(data.phase === "locked" && (isBoss(data) || reopened))) {
          set({ flash: "The bay is frozen." });
          return;
        }
        const bot = data.bots.find((b) => b.storeId === storeId);
        if (!bot || (bot.locked && !isBoss(data))) {
          set({ flash: "Already locked. The commissioner can override." });
          return;
        }
        if (slot === "utility" && !partId) {
          const draft: Loadout = { ...bot.draft, utility: null };
          set({
            bots: patchBot(data.bots, storeId, (b) => syncWear({ ...b, draft, equipped: { ...draft }, locked: b.locked && isBoss(data) ? { ...draft } : b.locked })),
            flash: "Utility slot cleared.",
          });
          return;
        }
        const part = partById(partId);
        if (!part || part.slot !== slot) return;
        if (part.tier !== "stock" && !bot.owned.includes(part.id)) {
          set({ flash: "That part is not in this cage." });
          return;
        }
        if (part.classLock && part.classLock !== bot.classId && data.week === 1) {
          set({ flash: "Week 1 class is locked. You can change class after the first fight (3 chassis coins)." });
          return;
        }
        let next = partWelds(bot);
        if (part.classLock && part.classLock !== bot.classId) {
          if ((bot.coins.chassis ?? 0) < RECLASS_FEE) {
            set({ flash: `Reclass costs ${RECLASS_FEE} chassis coins.` });
            return;
          }
          next = { ...next, coins: { ...bot.coins, chassis: bot.coins.chassis - RECLASS_FEE }, classId: part.classLock, style: { ...styleOf(bot, part.classLock), body: starterBodies(part.classLock)[0]!.id } };
        }
        const draft: Loadout = { ...next.draft, [slot]: part.id };
        set({
          bots: patchBot(data.bots, storeId, () =>
            syncWear({
              ...next,
              draft,
              equipped: { ...draft },
              locked: next.locked && isBoss(data) ? { ...draft } : next.locked,
            }),
          ),
          flash: part.classLock && part.classLock !== bot.classId ? `Reclassed to ${CLASS_META[part.classLock].label}. ${RECLASS_FEE} chassis coins.` : `${part.name} is on the ${slot}.`,
        });
      },
      setDraftLoadout: (storeId, loadout) => {
        const data = get();
        const championshipBlock = championshipPrepGuard(data, storeId);
        if (championshipBlock && !isBoss(data)) { set({ flash: championshipBlock }); return; }
        const starterBlock = starterBodyGuard(data, storeId);
        if (starterBlock && !isBoss(data)) { set({ flash: starterBlock }); return; }
        if (!isCaptainOf(data, storeId)) {
          set({ flash: "Only the captain can change parts." });
          return;
        }
        const buildBlock = captainBuildBlock(data);
        if (buildBlock) {
          set({ flash: buildBlock });
          return;
        }
        const reopened = data.phase === "locked" && !data.bots.find((b) => b.storeId === storeId)?.locked;
        if (data.phase !== "open" && !(data.phase === "locked" && (isBoss(data) || reopened))) {
          set({ flash: "The bay is frozen." });
          return;
        }
        const bot = data.bots.find((b) => b.storeId === storeId);
        if (!bot || (bot.locked && !isBoss(data))) {
          set({ flash: "Already locked. The commissioner can override." });
          return;
        }
        for (const slot of SLOTS) {
          const id = loadout[slot];
          if (!id) continue;
          const part = partById(id);
          if (!part || part.slot !== slot) {
            set({ flash: "That lock is not legal iron." });
            return;
          }
          if (part.tier !== "stock" && !bot.owned.includes(part.id)) {
            set({ flash: `${part.name} is not in this cage.` });
            return;
          }
          if (part.classLock && part.classLock !== bot.classId) {
            set({ flash: "Best lock stays in class." });
            return;
          }
        }
        const draft: Loadout = { ...loadout };
        set({
          bots: patchBot(data.bots, storeId, (current) =>
            syncWear({
              ...current,
              draft,
              equipped: { ...draft },
              locked: current.locked && isBoss(data) ? { ...draft } : current.locked,
            }),
          ),
          flash: weekDeadline(data.week)
            ? `Draft is the best lock in the bay. It still has to be locked by ${weekDeadline(data.week)!.label}.`
            : "Draft is the best lock in the bay. It still has to be locked by Saturday close.",
        });
      },
      lockStore: (storeId) => {
        const data = get();
        const championshipBlock = championshipPrepGuard(data, storeId);
        if (championshipBlock && !isBoss(data)) { set({ flash: championshipBlock }); return; }
        const starterBlock = starterBodyGuard(data, storeId);
        if (starterBlock && !isBoss(data)) { set({ flash: starterBlock }); return; }
        if (!isCaptainOf(data, storeId)) {
          set({ flash: "Captain clipboard required." });
          return;
        }
        const buildBlock = captainBuildBlock(data);
        if (buildBlock) {
          set({ flash: buildBlock });
          return;
        }
        if (data.phase !== "open" && data.phase !== "locked") {
          set({ flash: "Too late to lock. The card already ran." });
          return;
        }
        const store = data.stores.find((s) => s.id === storeId);
        set({
          bots: patchBot(data.bots, storeId, (b) => ({ ...b, locked: { ...b.draft }, equipped: { ...b.draft } })),
          flash: `${store?.name ?? "Store"} is locked.`,
          log: [`${store?.name ?? storeId} locked a loadout.`, ...data.log.slice(0, 23)],
        });
      },
      unlockStore: (storeId) => {
        const data = get();
        if (!isBoss(data)) return;
        if (data.phase === "fought" || data.phase === "inspected" || data.phase === "complete") {
          set({ flash: "Damage is already on the clock." });
          return;
        }
        set({
          phase: data.phase === "locked" ? "locked" : "open",
          bots: patchBot(data.bots, storeId, (b) => ({ ...b, locked: null })),
          flash: "Lock overridden. That bay can still move iron.",
        });
      },
      setOfficialNsnu: (storeId, dollars) => {
        const data = get();
        if (!isBoss(data) || !["open", "locked"].includes(data.phase)) return;
        if (!Number.isFinite(dollars) || dollars < 0 || dollars > 1000000) return;
        set({ storeCards: data.storeCards.map(c => c.storeId === storeId && c.week === data.week ? { ...c, nsnu: dollars, nsnuOfficial: true } : c), flash: "Official NSNU recorded. Colors are unchanged." });
      },
      updateCard: (storeId, patch) => {
        const data = get();
        if (!isCaptainOf(data, storeId)) {
          set({ flash: "Only the desk enters the official numbers." });
          return;
        }
        if (data.phase !== "open" && !(isBoss(data) && data.phase === "locked")) {
          set({ flash: "The card is frozen." });
          return;
        }
        set({
          storeCards: data.storeCards.map((card) => {
            if (card.storeId !== storeId || card.week !== data.week) return card;
            // A typed number takes back that metric from a clicked color.
            const grades = { ...(card.grades ?? {}) };
            for (const m of METRICS) if (FIELD_OF[m.stat] in patch) delete grades[m.stat];
            return { ...card, ...patch, nsnuOfficial: patch.nsnu !== undefined ? true : card.nsnuOfficial, grades, projected: false, week: data.week, storeId };
          }),
          flash: "Card updated. Grades moved with it.",
        });
      },
      setGrade: (storeId, stat, grade) => {
        const data = get();
        if (!isBoss(data)) return;
        if (data.phase !== "open" && data.phase !== "locked") {
          set({ flash: "This week's card already ran. Grades are frozen." });
          return;
        }
        set({
          storeCards: data.storeCards.map((card) => {
            if (card.storeId !== storeId || card.week !== data.week) return card;
            const grades = { ...(card.grades ?? {}) };
            if (grade) grades[stat] = grade;
            else delete grades[stat];
            return { ...card, grades, projected: false };
          }),
        });
      },
      setKickoffGrade: (storeId, stat, grade) => {
        const data = get();
        if (!isBoss(data)) return;
        const mine = { ...(data.kickoff.grades[storeId] ?? {}) };
        if (grade) mine[stat] = grade;
        else delete mine[stat];
        set({ kickoff: { ...data.kickoff, grades: { ...data.kickoff.grades, [storeId]: mine } } });
      },
      applyKickoff: () => {
        const data = get();
        if (!isBoss(data)) return;
        if (data.week !== 1 || data.bouts.some((b) => b.week === 1 && b.result)) {
          set({ flash: "Kickoff only changes week 1, before the first card runs." });
          return;
        }
        const ranked = kickoffRank(data);
        const missing = ranked.filter((r) => r.filled < METRICS.length);
        if (missing.length) {
          set({ flash: `Finish the colors first: ${missing.map((r) => r.store.name).join(", ")}.` });
          return;
        }
        const seedOf = new Map<string, number>();
        for (const conference of ["metro","frontier"] as const) {
          ranked
            .filter((row) => row.store.conference === conference)
            .forEach((row, index) => seedOf.set(row.store.id, index + 1));
        }
        const paid: Kickoff["paid"] = {};
        const bots = data.bots.map((bot) => {
          const row = ranked.find((r) => r.store.id === bot.storeId);
          if (!row) return bot;
          const before = data.kickoff.paid[bot.storeId] ?? {};
          const coins = { ...bot.coins };
          // row.bySlot is coinsByJar: grade coins plus the pair bonus on later greens.
          // A re-run pays only the difference from the last snapshot, including that bonus.
          for (const slot of SLOTS) coins[slot] = Math.max(0, (coins[slot] ?? 0) + row.bySlot[slot] - (before[slot] ?? 0));
          paid[bot.storeId] = { ...row.bySlot };
          return { ...bot, coins };
        });
        const stores = data.stores.map((s) => ({ ...s, seed: seedOf.get(s.id) ?? s.seed }));
        const card = buildCard({ ...data, stores, week: 1 });
        const name = (id: string | undefined) => stores.find((s) => s.id === id)?.name ?? "TBD";
        const main = card.filter((b) => b.kind === "bout").at(-1);
        const metroTop = ranked.filter((row) => row.store.conference === "metro").sort((a,b) => (seedOf.get(a.store.id) ?? 99) - (seedOf.get(b.store.id) ?? 99))[0]!;
        const frontierTop = ranked.filter((row) => row.store.conference === "frontier").sort((a,b) => (seedOf.get(a.store.id) ?? 99) - (seedOf.get(b.store.id) ?? 99))[0]!;
        const gazette = data.gazette.map((g) =>
          g.id === "g-open"
            ? {
                ...g,
                body: `Period 12 opens October 25. Fourteen stores, two conferences, seven fights every Monday and no byes. Metro #1 is ${metroTop.store.name}; Frontier #1 is ${frontierTop.store.name}. The first main event is ${name(main?.teamA[0])} against ${name(main?.teamB[0])}.`,
              }
            : g,
        );
        const stillOn = new Set(card.map((b) => b.id));
        set({
          bots,
          stores,
          gazette,
          picks: data.picks.filter((p) => p.week !== 1 || stillOn.has(p.boutId)),
          kickoff: { ...data.kickoff, paid, appliedAt: Date.now() },
          flash: `Kickoff paid. Metro and Frontier seeds are set from Period 11 colors.`,
          log: [`Week 1 seeded inside both conferences from Period 11.`, ...data.log.slice(0, 23)],
        });
      },
      propose: (storeId, partId, note) => {
        const data = get();
        const championshipBlock = championshipPrepGuard(data, storeId);
        if (championshipBlock && !isBoss(data)) { set({ flash: championshipBlock }); return; }
        const starterBlock = starterBodyGuard(data, storeId);
        if (starterBlock && !isBoss(data)) { set({ flash: starterBlock }); return; }
        const crewOk =
          data.session.role === "crew" && data.session.storeId === storeId && data.session.crewId;
        if (!crewOk && !isCaptainOf(data, storeId)) {
          set({ flash: "Pit crew propose. Captains bolt." });
          return;
        }
        const crew = data.crew.find((c) => c.id === data.session.crewId) ?? data.crew.find((c) => c.storeId === storeId && c.role === "captain");
        const part = partById(partId);
        if (!part || !crew) return;
        set({
          proposals: [
            {
              id: `p-${Date.now()}`,
              storeId,
              crewId: crew.id,
              crewName: crew.name,
              partId,
              note: note || part.job,
            },
            ...data.proposals,
          ].slice(0, 40),
          flash: `${crew.name} proposed ${part.name}.`,
        });
      },
      acceptProposal: (id) => {
        const data = get();
        const proposal = data.proposals.find((p) => p.id === id);
        if (!proposal || !isCaptainOf(data, proposal.storeId)) return;
        const part = partById(proposal.partId);
        if (!part) return;
        get().setDraftPart(proposal.storeId, part.slot, part.id);
        // Keep the idea on the board if the part could not go on.
        if (get().bots.find((b) => b.storeId === proposal.storeId)?.draft[part.slot] === part.id) {
          set({ proposals: get().proposals.filter((p) => p.id !== id) });
        }
      },
      dismissProposal: (id) => {
        const data = get();
        const proposal = data.proposals.find((p) => p.id === id);
        if (!proposal || !isCaptainOf(data, proposal.storeId)) return;
        set({ proposals: data.proposals.filter((p) => p.id !== id) });
      },
      buyPart: (storeId, partId) => {
        const data = get();
        const championshipBlock = championshipPrepGuard(data, storeId);
        if (championshipBlock && !isBoss(data)) { set({ flash: championshipBlock }); return; }
        const starterBlock = starterBodyGuard(data, storeId);
        if (starterBlock && !isBoss(data)) { set({ flash: starterBlock }); return; }
        if (!isCaptainOf(data, storeId)) {
          set({ flash: "The wallet answers to the captain." });
          return;
        }
        const buildBlock = captainBuildBlock(data);
        if (buildBlock) {
          set({ flash: buildBlock });
          return;
        }
        const part = partById(partId);
        if (!part) return;
        const check = buyCheck(data, storeId, part);
        if (!check.ok) {
          set({ flash: check.reason });
          return;
        }
        set({
          bots: patchBot(data.bots, storeId, (bot) => {
            const classChange = Boolean(part.classLock && part.classLock !== bot.classId);
            const draft = { ...bot.draft, [part.slot]: part.id };
            const owned = bot.owned.includes(part.id) ? bot.owned : [...bot.owned, part.id];
            const nextClass = part.classLock ?? bot.classId;
            return syncWear({
              ...bot,
              coins: { ...bot.coins, [part.key]: (bot.coins[part.key] ?? 0) - check.cost },
              owned,
              classId: nextClass,
              style: classChange
                ? { ...styleOf(bot, nextClass), body: starterBodies(nextClass)[0]!.id }
                : bot.style,
              draft,
              equipped: { ...draft },
              locked: null,
            });
          }),
          flash: classChangeNote(part.name, check.cost),
        });
        function classChangeNote(name: string, cost: number) {
          return `${name} bought for ${cost} coins.`;
        }
      },
      sellPart: (storeId, partId) => {
        const data = get();
        const championshipBlock = championshipPrepGuard(data, storeId);
        if (championshipBlock && !isBoss(data)) { set({ flash: championshipBlock }); return; }
        const starterBlock = starterBodyGuard(data, storeId);
        if (starterBlock && !isBoss(data)) { set({ flash: starterBlock }); return; }
        if (!isCaptainOf(data, storeId)) {
          set({ flash: "The wallet answers to the captain." });
          return;
        }
        const buildBlock = captainBuildBlock(data);
        if (buildBlock) {
          set({ flash: buildBlock });
          return;
        }
        const part = partById(partId);
        if (!part) return;
        const check = sellCheck(data, storeId, part);
        if (!check.ok) {
          set({ flash: check.reason });
          return;
        }
        set({
          bots: patchBot(data.bots, storeId, (bot) => {
            // A sold part that was on the bot leaves the slot on the stock loaner (utility goes empty).
            const loaner = part.slot === "utility" ? null : stockPart(part.slot, bot.classId).id;
            const onBot = bot.draft[part.slot] === part.id || bot.equipped[part.slot] === part.id;
            const draft = bot.draft[part.slot] === part.id ? { ...bot.draft, [part.slot]: loaner } : bot.draft;
            const equipped = bot.equipped[part.slot] === part.id ? { ...bot.equipped, [part.slot]: loaner } : bot.equipped;
            const partWear = { ...bot.partWear };
            delete partWear[part.id];
            return syncWear({
              ...clearPartWeld(bot, part.id),
              coins: { ...bot.coins, [part.key]: (bot.coins[part.key] ?? 0) + SELL_BACK },
              owned: bot.owned.filter((id) => id !== part.id),
              draft,
              equipped,
              partWear,
              weldForWeek: onBot ? { ...bot.weldForWeek, [part.slot]: undefined } : bot.weldForWeek,
            });
          }),
          flash: `${part.name} sold. ${SELL_BACK} ${part.key} coins back in the jar.`,
        });
      },
      buyShow: (storeId, effectId) => {
        const data = get();
        // Falling Leaves is exempt from championshipPrepGuard on purpose:
        // a show effect is arena atmosphere, not bot work — it never enters
        // the loadout — and Falling Leaves is sold league-wide in Week 5,
        // finalist or not. Fog and Blacklight keep the guard, exactly as
        // before. starterBodyGuard and captainBuildBlock still apply to
        // every show purchase.
        if (!thanksgivingShowEffect(effectId)) {
          const championshipBlock = championshipPrepGuard(data, storeId);
          if (championshipBlock && !isBoss(data)) { set({ flash: championshipBlock }); return; }
        }
        const starterBlock = starterBodyGuard(data, storeId);
        if (starterBlock && !isBoss(data)) { set({ flash: starterBlock }); return; }
        if (!isCaptainOf(data, storeId)) {
          set({ flash: "The wallet answers to the captain." });
          return;
        }
        const buildBlock = captainBuildBlock(data);
        if (buildBlock) {
          set({ flash: buildBlock });
          return;
        }
        const check = showCheck(data, storeId, effectId);
        if (!check.ok) {
          set({ flash: check.reason });
          return;
        }
        const effect = effectId;
        const effectName = showEffect(effectId)?.name ?? thanksgivingShowEffect(effectId)?.name ?? effectId;
        set({
          bots: patchBot(data.bots, storeId, (bot) => ({
            ...bot,
            coins: { ...bot.coins, utility: (bot.coins.utility ?? 0) - check.cost },
            shows: [...(bot.shows ?? []), effect],
          })),
          flash: `${effectName} is in the rafters. Light only. The fight does not change.`,
        });
      },
      repairSlot: (storeId, slot, mode) => {
        const data = get();
        const championshipBlock = championshipPrepGuard(data, storeId);
        if (championshipBlock && !isBoss(data)) { set({ flash: championshipBlock }); return; }
        const starterBlock = starterBodyGuard(data, storeId);
        if (starterBlock && !isBoss(data)) { set({ flash: starterBlock }); return; }
        if (!isCaptainOf(data, storeId)) {
          set({ flash: "Repairs go through the captain." });
          return;
        }
        const buildBlock = captainBuildBlock(data);
        if (buildBlock) {
          set({ flash: buildBlock });
          return;
        }
        if (data.phase === "locked" || data.phase === "fought") {
          set({ flash: "Repairs are closed while the card is locked or running." });
          return;
        }
        const found = data.bots.find((b) => b.storeId === storeId);
        if (!found) return;
        const current = partWelds(found);
        if (data.phase === "open" && current.locked) {
          set({ flash: "This build is locked. Ask the Desk for a lock override." });
          return;
        }
        const partId = current.equipped[slot];
        if (!partId) return;
        const part = partById(partId);
        if (!part) return;
        const cond = current.partWear[partId] ?? "clean";
        if (cond === "clean") {
          set({ flash: "That part is already clean." });
          return;
        }
        if (mode === "weld") {
          if (cond !== "disabled") {
            set({ flash: "Emergency weld is only for a dead part." });
            return;
          }
          const paid = payRepair(current, slot, REPAIR_PRICE.weld);
          if (!paid) {
            set({ flash: `Weld is ${REPAIR_PRICE.weld} ${slot} coin. The jar cannot cover it.` });
            return;
          }
          const week = nextFightWeek(data);
          set({
            bots: patchBot(data.bots, storeId, () =>
              setPartWear(
                { ...paid, services: (paid.services ?? 0) + 1, weldedParts: { ...paid.weldedParts, [partId]: week } },
                partId,
                "bent",
              ),
            ),
            flash: `${part.name} is welded to Bent for week ${week}. Then it dies again if you do not finish the job.`,
          });
          return;
        }
        if (mode === "salvage") {
          const refund = part.tier === "pro" ? 2 : part.tier === "super" ? 4 : part.tier === "championship" ? 3 : 0;
          if (!refund) {
            set({ flash: "Stock does not salvage. Repair it or live with the loaner." });
            return;
          }
          const loaner = part.slot === "utility" ? null : stockPart(part.slot, current.classId).id;
          set({
            bots: patchBot(data.bots, storeId, (bot) => {
              const draft = { ...bot.draft, [slot]: loaner };
              const partWear = { ...bot.partWear };
              delete partWear[partId];
              return syncWear({
                ...clearPartWeld(bot, partId),
                coins: { ...bot.coins, [slot]: (bot.coins[slot] ?? 0) + refund },
                owned: bot.owned.filter((id) => id !== partId),
                draft,
                equipped: { ...draft },
                partWear,
                weldForWeek: { ...bot.weldForWeek, [slot]: undefined },
              });
            }),
            flash: `${part.name} stripped. ${refund} ${slot} coins back. Slot dropped to stock.`,
          });
          return;
        }
        if (mode === "crown") {
          if (!(part.tier === "super" && cond === "disabled" && wonThisWeek(data, storeId))) {
            set({ flash: "Championship salvage needs a wrecked Super and a win." });
            return;
          }
          const champ = partById(`${part.slot}-${part.family}-championship`);
          if (!champ) {
            set({ flash: "That family has no title piece." });
            return;
          }
          set({
            bots: patchBot(data.bots, storeId, (bot) => {
              const draft = { ...bot.draft, [slot]: champ.id };
              const partWear = { ...bot.partWear };
              delete partWear[partId];
              partWear[champ.id] = "clean";
              return syncWear({
                ...clearPartWeld(clearPartWeld(bot, partId), champ.id),
                owned: [...bot.owned.filter((id) => id !== partId), champ.id],
                draft,
                equipped: { ...draft },
                partWear,
              });
            }),
            flash: `${part.name} comes back as ${champ.name}. Never sold. Salvaged.`,
          });
          return;
        }
        const cost = REPAIR_PRICE[cond];
        const paid = payRepair(current, slot, cost);
        if (!paid) {
          set({ flash: `Quote is ${cost} ${slot} coins. The jar cannot cover it.` });
          return;
        }
        set({
          bots: patchBot(data.bots, storeId, () => {
            return setPartWear({ ...clearPartWeld(paid, partId), services: (paid.services ?? 0) + 1 }, partId, "clean");
          }),
          flash: `${part.name} is clean. ${cost} ${slot} coins.`,
        });
      },
      nameMvp: (storeId, crewId) => {
        const data = get();
        if (!isCaptainOf(data, storeId)) {
          set({ flash: "MVP is the captain's call, or the desk's." });
          return;
        }
        const crew = data.crew.find((c) => c.id === crewId && c.storeId === storeId);
        if (!crew) return;
        set({
          mvps: [
            ...data.mvps.filter((m) => !(m.week === data.week && m.storeId === storeId)),
            { week: data.week, storeId, crewId, name: crew.name },
          ],
          flash: `${crew.name} is the pit-crew MVP. No personal record. Just the name.`,
        });
      },
      renameBot: (storeId, name) => {
        const data = get();
        if (!isBoss(data) && !isCaptainOf(data, storeId)) return;
        const clean = name.trim().toUpperCase().replace(/\s+/g, " ").slice(0, 22);
        if (!clean) return;
        const blocked = blockedName(clean);
        if (blocked) {
          set({ flash: blocked });
          return;
        }
        set({ bots: patchBot(data.bots, storeId, (b) => ({ ...b, name: clean })), flash: `Bot is now ${clean}.` });
      },
      renameIdentity: (storeId, botName, teamName) => {
        const data = get();
        if (!isBoss(data) && !isCaptainOf(data, storeId)) return;
        const cleanBot = botName.trim().replace(/\s+/g, " ").toUpperCase();
        const cleanTeam = teamName.trim().replace(/\s+/g, " ");
        // eslint-disable-next-line no-control-regex -- names may not contain C0 controls or DEL
        if (!cleanBot || cleanBot.length > 22 || !cleanTeam || cleanTeam.length > 40 || /[\u0000-\u001f\u007f]/.test(botName + teamName)) return;
        const blocked = blockedName(cleanBot) ?? blockedName(cleanTeam);
        if (blocked) {
          set({ flash: blocked });
          return;
        }
        if (!data.stores.some(s => s.id === storeId)) return;
        set({
          bots: patchBot(data.bots, storeId, bot => ({ ...bot, name: cleanBot })),
          stores: data.stores.map(store => store.id === storeId ? { ...store, teamName: cleanTeam } : store),
          flash: `Team ${cleanTeam} · bot ${cleanBot}. Names saved.`,
        });
      },
      renameCaptain: (storeId, name) => {
        const data = get();
        if (!isCaptainOf(data, storeId)) return;
        const clean = name.trim().slice(0, 40);
        if (!clean) return;
        set({
          stores: data.stores.map((s) => (s.id === storeId ? { ...s, captain: clean } : s)),
          crew: data.crew.map((c) => (c.storeId === storeId && c.role === "captain" ? { ...c, name: clean } : c)),
          mvps: data.mvps.map((m) => (m.storeId === storeId && data.crew.find((c) => c.id === m.crewId)?.role === "captain" ? { ...m, name: clean } : m)),
          flash: `Captain of record is ${clean}.`,
        });
      },
      setPasscode: () => {},
      setPaint: (storeId, paint) => {
        const data = get();
        if (!isCaptainOf(data, storeId) || !PAINT[paint]) return;
        const unlock = LOCKER_PAINTS[paint];
        if (unlock && !data.stores.find(s => s.id === storeId)?.unlocks?.includes(unlock)) {
          set({ flash: "Buy that paint in the Bolt Locker first." });
          return;
        }
        const store = data.stores.find((row) => row.id === storeId);
        if (paint !== store?.paint && !cosmeticUnlocked(data, storeId, "paint", paint)) {
          set({ flash: "That paint is still locked." });
          return;
        }
        set({
          stores: data.stores.map((s) => (s.id === storeId ? { ...s, paint } : s)),
          flash: "Paint is on the bay. It does not change the fight.",
        });
      },
      setGarage: (storeId, garage) => {
        const data = get();
        if (!isCaptainOf(data, storeId)) return;
        set({
          stores: data.stores.map((s) => (s.id === storeId ? { ...s, garage } : s)),
          flash: "Garage floor changed. Decoration only.",
        });
      },
      setLook: (storeId, look) => {
        const data = get();
        if (!isCaptainOf(data, storeId)) return;
        if (!cosmeticUnlocked(data, storeId, "look", look)) {
          set({ flash: "That stripe kit is still locked." });
          return;
        }
        set({ bots: patchBot(data.bots, storeId, (b) => ({ ...b, look })), flash: "Bot dressed. Still the same iron." });
      },
      completeJob: (week, jobId, note) => {
        const data = get();
        const who = actor(data);
        if (!who) {
          set({ flash: "Sign in on the Clipboard with your bay code first." });
          return;
        }
        const championshipBlock = championshipPrepGuard(data, who.storeId);
        if (championshipBlock) { set({ flash: championshipBlock }); return; }
        const starterBlock = starterBodyGuard(data, who.storeId);
        if (starterBlock) { set({ flash: starterBlock }); return; }
        const plan = programWeek(week);
        const job = plan ? [...allJobs(plan), plan.care, crateFor(week)].find((j) => j.id === jobId) : undefined;
        if (!plan || !job) return;
        const dayOf = job.kind === "crate" ? "wed" : plan.days.find((d) => d.jobs.some((j) => j.id === jobId))?.day;
        const closed = trainingClosed(data, week, dayOf);
        if (closed) {
          set({ flash: closed });
          return;
        }
        if (data.jobLog.some((e) => e.id === `${week}:${jobId}:${who.id}` && e.status === "approved")) return;
        if (job.kind === "care" && who.role !== "captain") {
          set({ flash: "CARE jobs belong to the captain." });
          return;
        }
        const clean = note.trim().slice(0, 400);
        if (clean.length < 3) {
          set({ flash: "Write a line about what happened. That is the proof." });
          return;
        }
        const id = `${week}:${jobId}:${who.id}`;
        const status = who.role === "captain" || data.session.role === "commissioner" ? "approved" : "pending";
        const entry = { id, week, jobId, storeId: who.storeId, crewId: who.id, crewName: who.name, note: clean, status, at: Date.now() } as const;
        const before = status === "approved" ? earnedRewardIds(data, who.storeId) : null;
        const jobLog = [...data.jobLog.filter((e) => e.id !== id), entry];
        const unlocked = before ? newlyEarnedHalloween({ ...data, jobLog }, who.storeId, before) : null;
        set({
          jobLog,
          ooze: unlocked ? Date.now() : data.ooze,
          flash: unlocked
            ? `${job.title} is done. ${unlocked} unlocked. It stays on the bot after Halloween week, and it does not change the fight.`
            : status === "approved"
              ? `${job.title} is done.`
              : `${job.title} sent to the captain for a thumbs-up.`,
        });
      },
      approveJob: (entryId) => {
        const data = get();
        const entry = data.jobLog.find((e) => e.id === entryId);
        if (!entry || !isCaptainOf(data, entry.storeId) || entry.status !== "pending") return;
        const lockedAt = data.weeks.find((w) => w.number === entry.week)?.lockedAt;
        if (entry.week !== data.week || (data.phase !== "open" && !(data.phase === "locked" && lockedAt && entry.at <= lockedAt))) {
          set({ flash: "That week is closed. Approvals had to land before the card ran." });
          return;
        }
        const before = earnedRewardIds(data, entry.storeId);
        const jobLog = data.jobLog.map((e) => (e.id === entryId ? { ...e, status: "approved" as const } : e));
        const unlocked = newlyEarnedHalloween({ ...data, jobLog }, entry.storeId, before);
        set({
          jobLog,
          ooze: unlocked ? Date.now() : data.ooze,
          flash: unlocked
            ? `${entry.crewName} is approved. ${unlocked} unlocked. It stays on the bot after Halloween week, and it does not change the fight.`
            : `${entry.crewName} is approved. +${entry.jobId.endsWith("-crate") ? BOLTS.crate : BOLTS.job} bolts.`,
        });
      },
      rejectJob: (entryId) => {
        const data = get();
        const entry = data.jobLog.find((e) => e.id === entryId);
        if (!entry || !isCaptainOf(data, entry.storeId) || entry.status !== "pending") return;
        set({ jobLog: data.jobLog.filter((e) => e.id !== entryId), flash: `Sent back to ${entry.crewName}. They can try it again.` });
      },
      submitSpark: (week, day, correct, total) => {
        const data = get();
        const who = actor(data);
        if (!who) return;
        const championshipBlock = championshipPrepGuard(data, who.storeId);
        if (championshipBlock) { set({ flash: championshipBlock }); return; }
        const starterBlock = starterBodyGuard(data, who.storeId);
        if (starterBlock) { set({ flash: starterBlock }); return; }
        const closed = trainingClosed(data, week, day as DayKey);
        if (closed) {
          set({ flash: closed });
          return;
        }
        const id = `${week}:${day}:${who.id}`;
        if (data.sparkLog.some((e) => e.id === id)) return;
        const sparkLog = [...data.sparkLog, { id, week, day, storeId: who.storeId, crewId: who.id, correct, total, at: Date.now() }];
        const before = sparkStreak(data, who.id);
        const after = sparkStreak({ sparkLog }, who.id);
        const streakNote =
          after.badge && !before.badge
            ? ` ${STREAK_BADGE} perfect in a row. Streak badge earned.`
            : after.current > 1
              ? ` ${after.current} perfect in a row.`
              : "";
        const unlocked = newlyEarnedThanksgiving({ ...data, sparkLog }, who.storeId, earnedRewardIds(data, who.storeId));
        set({
          sparkLog,
          flash: `Spark done. ${correct} of ${total}. +${correct * BOLTS.sparkCorrect} bolts.${streakNote}${unlocked ? ` ${unlocked} unlocked. It stays on the bot after Championship Week, and it does not change the fight.` : ""}`,
        });
      },
      postShout: (to, text) => {
        const data = get();
        const who = actor(data);
        if (!who) {
          set({ flash: "Sign in on the Clipboard to post a shout-out." });
          return;
        }
        const body = text.trim().slice(0, 240);
        const name = to.trim().slice(0, 60);
        if (!body || !name) return;
        const before = earnedRewardIds(data, who.storeId);
        const shouts = [
          ...data.shouts,
          { id: `${who.id}-${Date.now().toString(36)}`, week: data.week, storeId: who.storeId, fromCrewId: who.id, fromName: who.name, to: name, text: body, at: Date.now() },
        ];
        const unlocked = newlyEarnedThanksgiving({ ...data, shouts }, who.storeId, before);
        set({
          shouts,
          flash: unlocked
            ? `Shout-out posted. ${unlocked} unlocked. It stays on the bot after Championship Week, and it does not change the fight.`
            : "Shout-out posted.",
        });
      },
      removeShout: (id) => {
        const data = get();
        const shout = data.shouts.find((s) => s.id === id);
        if (!shout || !isCaptainOf(data, shout.storeId)) return;
        set({ shouts: data.shouts.filter((s) => s.id !== id) });
      },
      setCrewOff: (crewId, week, off) => {
        const data = get();
        const member = data.crew.find((c) => c.id === crewId);
        if (!member || !isCaptainOf(data, member.storeId)) return;
        const closed = eligibilityClosed(data, week);
        if (closed && !isBoss(data)) {
          set({ flash: closed });
          return;
        }
        set({
          crew: data.crew.map((c) => {
            if (c.id !== crewId) return c;
            const weeks = new Set(c.offWeeks ?? []);
            if (off) weeks.add(week);
            else weeks.delete(week);
            return { ...c, offWeeks: [...weeks] };
          }),
          log: [...data.log, `${data.session.role}: ${member.name} ${off ? "Off" : "eligible"} week ${week} at ${new Date().toISOString()}`],
          flash: off ? `${member.name} is unavailable for week ${week}.` : `${member.name} is back on the week.`,
        });
      },
      setTrainingOpenAll: (on) => {
        const data = get();
        if (!isBoss(data)) return;
        set({ trainingOpenAll: on, flash: on ? "Every training day is open now." : "Training days open on their dates." });
      },
      buyLocker: (storeId, itemId) => {
        const data = get();
        if (!isCaptainOf(data, storeId)) {
          set({ flash: "The captain spends the bolts." });
          return;
        }
        const item = lockerItem(itemId);
        const store = data.stores.find((s) => s.id === storeId);
        if (!item || !store) return;
        if ((store.unlocks ?? []).includes(itemId)) return;
        const bolts = boltsOf(data, storeId);
        if (bolts.balance < item.price) {
          set({ flash: `${item.name} is ${item.price} bolts. The bay has ${bolts.balance}.` });
          return;
        }
        set({
          stores: data.stores.map((s) =>
            s.id === storeId ? { ...s, unlocks: [...(s.unlocks ?? []), itemId], boltsSpent: (s.boltsSpent ?? 0) + item.price } : s,
          ),
          flash: `${item.name} unlocked.`,
        });
      },
      makePick: (boutId, pick) => {
        const data = get();
        const who = actor(data);
        if (!who) {
          set({ flash: "Sign in on the Clipboard to make picks." });
          return;
        }
        if (data.phase !== "open") {
          set({ flash: "Picks close when the bots lock Saturday." });
          return;
        }
        const bout = buildCard(data).find((b) => b.id === boutId);
        if (!bout || !bout.storeIds.includes(pick) || data.bouts.some((b) => b.id === boutId && b.result)) return;
        const id = `${boutId}:${who.id}`;
        set({
          picks: [...data.picks.filter((p) => p.id !== id), { id, week: data.week, boutId, storeId: who.storeId, crewId: who.id, pick, at: Date.now() }],
        });
      },
      setRally: (targetId) => {
        const data = get();
        const who = actor(data);
        if (!who) {
          set({ flash: "Sign in on the Clipboard to rally behind a finalist." });
          return;
        }
        if (data.week !== 5 || !["open","locked"].includes(data.phase)) {
          set({ flash: "Rally opens after the Week 4 conference champions are set." });
          return;
        }
        const finalists = championshipFinalists(data);
        if (finalists.includes(who.storeId)) {
          set({ flash: "Finalist stores prepare their own bot. The rest of the league handles Rally." });
          return;
        }
        if (!finalists.includes(targetId)) return;
        const id = `rally:${who.id}`;
        set({
          rallies: [...(data.rallies ?? []).filter((r) => r.id !== id), { id, week: 5, storeId: who.storeId, crewId: who.id, fromName: who.name, targetId, at: Date.now() }],
          flash: `${who.name} is rallying behind ${data.stores.find((row) => row.id === targetId)?.name ?? targetId}. Crowd only — no fight bonus.`,
        });
      },
      setStyle: (storeId, patch) => {
        const data = get();
        if (!isCaptainOf(data, storeId)) return;
        const bot = data.bots.find((row) => row.storeId === storeId);
        if (!bot) return;
        let nextPatch = patch;
        if (typeof patch.banner === "string") {
          const verdict = bannerVerdict(patch.banner);
          if (!verdict.ok) {
            set({ flash: verdict.reason });
            return;
          }
          nextPatch = { ...patch, banner: verdict.text };
        }
        const current = styleOf(bot, bot.classId);
        const next = styleOf({ classId: bot.classId, style: { ...current, ...nextPatch, stickers: nextPatch.stickers ?? (nextPatch.decal !== undefined ? { ...current.stickers!, hood: nextPatch.decal } : current.stickers) } });
        const store = data.stores.find(s => s.id === storeId);
        if (!store || !checkedCosmeticLoadout(data, storeId, { paint: store.paint, look: bot.look, number: bot.number, style: next })) {
          set({ flash: "Earn or purchase that cosmetic before equipping it." }); return;
        }
        if (nextPatch.body) {
          if (data.week === 1 && bot.style?.body && nextPatch.body !== bot.style.body) {
            set({ flash: "Starter body is frozen through the first fight." });
            return;
          }
          if (!validBodyForClass(nextPatch.body, bot.classId) || !cosmeticUnlocked(data, storeId, "body", nextPatch.body)) {
            set({ flash: "That body shell is still locked." });
            return;
          }
        }
        for (const [kind, value] of Object.entries(nextPatch)) {
          if (value === undefined || value === null || typeof value === "object") continue;
          if (["flag", "walkout", "victory", "body"].includes(kind)) continue;
          if (
            ["finish", "decal", "trim", "eye", "topper", "mask", "weaponSkin", "leds", "smoke", "banner"].includes(kind) &&
            !cosmeticUnlocked(data, storeId, kind as "finish" | "decal" | "trim" | "eye" | "topper" | "mask" | "weaponSkin" | "leds" | "smoke" | "banner", String(value))
          ) {
            set({ flash: "Earn that cosmetic in Pit Week first." });
            return;
          }
        }
        set({
          bots: patchBot(data.bots, storeId, (b) => ({ ...b, style: next })),
          flash: "Bot dressed. Still the same iron.",
        });
      },
      setNumber: (storeId, number) => {
        const data = get();
        if (!isCaptainOf(data, storeId)) return;
        const clean = number.trim().slice(0, 3).toUpperCase();
        set({ bots: patchBot(data.bots, storeId, (b) => ({ ...b, number: clean })) });
      },
      renameCrew: (crewId, name) => {
        const data = get();
        const member = data.crew.find((c) => c.id === crewId);
        if (!member || !isCaptainOf(data, member.storeId)) {
          set({ flash: "Staff names belong to the captain or the desk." });
          return;
        }
        const clean = name.trim().slice(0, 40);
        if (!clean || clean === member.name) return;
        set({
          crew: data.crew.map((c) => (c.id === crewId ? { ...c, name: clean } : c)),
          stores:
            member.role === "captain"
              ? data.stores.map((s) => (s.id === member.storeId ? { ...s, captain: clean } : s))
              : data.stores,
          mvps: data.mvps.map((m) => (m.crewId === crewId ? { ...m, name: clean } : m)),
          flash: `${clean} is on the sheet.`,
        });
      },
      addCrew: (storeId, name) => {
        const data = get();
        if (!isCaptainOf(data, storeId)) {
          set({ flash: "The captain adds staff." });
          return;
        }
        const clean = name.trim().slice(0, 40);
        if (!clean) return;
        const specialists = data.crew.filter((c) => c.storeId === storeId && c.role === "specialist");
        if (eligibilityClosed(data, data.week)) { set({ flash: "Add staff before Tuesday Pit Week begins." }); return; }
        if (specialists.length >= 8) {
          set({ flash: "Eight specialists is the bay cap." });
          return;
        }
        set({
          crew: [...data.crew, { id: `${storeId}-crew-${Date.now().toString(36)}`, storeId, name: clean, role: "specialist" }],
          flash: `${clean} is on the clock.`,
        });
      },
      removeCrew: (storeId, crewId) => {
        const data = get();
        if (!isCaptainOf(data, storeId)) return;
        const member = data.crew.find((c) => c.id === crewId && c.storeId === storeId && c.role === "specialist");
        if (!member) return;
        if (eligibilityClosed(data, data.week)) { set({ flash: "Weekly roster is frozen. The Desk can mark a legitimate absence Off." }); return; }
        const specialists = data.crew.filter((c) => c.storeId === storeId && c.role === "specialist");
        if (specialists.length <= 1) {
          set({ flash: "A bay keeps at least one specialist." });
          return;
        }
        set({
          crew: data.crew.filter((c) => c.id !== crewId),
          mvps: data.mvps.filter((m) => m.crewId !== crewId),
          proposals: data.proposals.filter((p) => p.crewId !== crewId),
          flash: `${member.name} is off the clock.`,
        });
      },
      dismissTutorial: () => set({ tutorialSeen: TUTORIAL_REV }),
      showTutorial: () => set({ tutorialSeen: false }),
      callSpy: (storeId, targetId, family) => {
        const data = get();
        const ready = spyReady(data, storeId, targetId);
        if (!ready.ok) {
          set({ flash: ready.flash });
          return;
        }
        if (!WEAPON_FAMILIES.includes(family as (typeof WEAPON_FAMILIES)[number])) return;
        const prior = data.intel.find((row) => row.week === data.week && row.from === storeId && row.target === targetId);
        if (prior?.lines.length) {
          set({ flash: "The call is already in. You don't get a second guess." });
          return;
        }
        const intel = [
          ...data.intel.filter((row) => !(row.week === data.week && row.from === storeId && row.target === targetId)),
          {
            week: data.week,
            from: storeId,
            target: targetId,
            signature: "",
            tier: ready.scry.tier,
            lines: [],
            guess: family,
          },
        ];
        set({ intel, flash: `Called ${family}. Hit Read when the room is ready.` });
      },
      pullSpy: (storeId, targetId) => {
        const data = get();
        const ready = spyReady(data, storeId, targetId);
        if (!ready.ok) {
          set({ flash: ready.flash });
          return;
        }
        const prior = data.intel.find((row) => row.week === data.week && row.from === storeId && row.target === targetId);
        const earned = Boolean(prior?.guess) || Boolean(prior?.lines.length);
        if (!earned) {
          set({ flash: "Call the weapon first. That is how you earn the spy." });
          return;
        }
        const read = spyRead(data, targetId, ready.scry.tier);
        if (!read) return;
        const intel = [
          ...data.intel.filter((row) => !(row.week === data.week && row.from === storeId && row.target === targetId)),
          {
            week: data.week,
            from: storeId,
            target: targetId,
            signature: read.signature,
            tier: ready.scry.tier,
            lines: read.lines,
            guess: prior?.guess ?? "",
          },
        ];
        const same = prior?.signature === read.signature && Boolean(prior?.lines.length);
        const called = prior?.guess ? ` You called ${prior.guess}.` : "";
        const until = weekDeadline(data.week)?.label ?? "Saturday close";
        set({
          intel,
          flash: same
            ? `${read.botName} has not moved.${called}`
            : read.locked
              ? `${read.botName} is locked. This is the locked iron.${called}`
              : `${read.botName} read. The captain can still move it before ${until}.${called}`,
        });
      },
      setTags: (week, on) => {
        if (!isBoss(get())) return;
        set({
          weeks: get().weeks.map((w) => (w.number === week ? { ...w, tagsEnabled: on } : w)),
          flash: on ? "Allied tag is on the grudge card." : "Tag bout pulled.",
        });
      },
      setTagline: (tagline) => {
        if (!isBoss(get())) return;
        set({ tagline: tagline.slice(0, 180), flash: "Theme updated." });
      },
      giftCoins: (storeId, slot, amount) => {
        const data = get();
        if (!isBoss(data)) {
          set({ flash: "Only the Desk can give coins." });
          return;
        }
        const store = data.stores.find((s) => s.id === storeId);
        if (!store || !SLOTS.includes(slot) || !Number.isInteger(amount) || amount < 1 || amount > 20) return;
        set({
          bots: patchBot(data.bots, storeId, (bot) => ({
            ...bot,
            coins: { ...bot.coins, [slot]: (bot.coins[slot] ?? 0) + amount },
          })),
          flash: `${store.name} got ${amount} ${slot} coin${amount === 1 ? "" : "s"} from the Desk.`,
          log: [`Desk gave ${store.name} ${amount} ${slot} coin${amount === 1 ? "" : "s"}.`, ...data.log.slice(0, 23)],
        });
      },
      houseCall: (text) => {
        const data = get();
        if (!isBoss(data)) return;
        const body = text.trim();
        if (!body) return;
        set({
          gazette: [
            {
              id: `house-${Date.now()}`,
              week: data.week,
              boutId: null,
              kicker: "House call",
              headline: body.slice(0, 90),
              body,
            },
            ...data.gazette,
          ],
          flash: "House call posted to the gazette.",
        });
      },
      postDailyGazette: (drafts, todayISO) => {
        const data = get();
        if (!isBoss(data)) return;
        const clean = drafts.filter((d) => d.headline?.trim() && d.body?.trim());
        if (!clean.length) return;
        const base = dailyGazetteId(data.week, todayISO);
        const entries: GazetteEntry[] = clean.map((d, i) => ({
          id: i === 0 ? base : `${base}-${i + 1}`,
          week: data.week,
          boutId: null,
          kicker: d.kicker?.trim() || "Daily Gazette",
          headline: d.headline.trim(),
          body: d.body.trim(),
        }));
        // The Gazette page features the first entry as the front page, so the
        // daily edition goes on top; a rewrite replaces that day's entries.
        const isOld = (g: GazetteEntry) => g.id === base || g.id.startsWith(`${base}-`);
        set({
          gazette: [...entries, ...data.gazette.filter((g) => !isOld(g))],
          flash: "Daily Gazette posted.",
        });
      },
      postRecapGazette: (week, entries) => {
        const data = get();
        if (!isBoss(data)) return;
        const clean = entries.filter((e) => e.headline?.trim() && e.body?.trim());
        if (!clean.length) return;
        // Same replacement semantics as runSaturday: the week's own entries are
        // replaced, House calls for the week are kept.
        set({
          gazette: [...clean, ...data.gazette.filter((g) => g.week !== week || g.kicker === "House call")],
          flash: "Saturday recap posted.",
        });
      },
      lockFriday: () => {
        const data = get();
        if (!isBoss(data)) {
          set({ flash: "The bell is a desk button." });
          return;
        }
        if (data.phase !== "open" && data.phase !== "locked") {
          set({ flash: "The bots are already locked this week." });
          return;
        }
        const deadline = weekDeadline(data.week);
        if (data.phase === "locked" && buildsFrozen(data)) {
          set({
            flash: !deadline
              ? "Already locked. Run the card, drop damage, and advance when you are ready."
              : data.week === 5
                ? `Already locked at ${deadline.label}. Saturday, Nov 28 still runs from this desk.`
                : `Already locked at ${deadline.label}. Run the card, drop damage, and advance when you are ready.`,
          });
          return;
        }
        const at = deadline && Date.now() >= deadline.at.getTime() ? deadline.at.getTime() : Date.now();
        set(lockPatch(data, at));
      },
      runSaturday: () => {
        const data = get();
        if (!isBoss(data)) {
          set({ flash: "Run the card from the desk." });
          return;
        }
        if (data.phase === "fought" || data.phase === "inspected" || data.phase === "complete") {
          set({ flash: "This card already ran." });
          return;
        }
        const unrecorded = data.week === 5 ? [] : data.stores.filter(s => !data.storeCards.find(c => c.storeId === s.id && c.week === data.week)?.nsnuOfficial);
        if (unrecorded.length) {
          set({ flash: `Record official Sunday NSNU for the tiebreak first: ${unrecorded.map(s => s.name).join(", ")}.` });
          return;
        }
        const finalists = championshipFinalists(data);
        const lockedBots = data.bots.map((b) =>
          data.week === 5 && !finalists.includes(b.storeId)
            ? { ...b, locked: null }
            : { ...b, locked: { ...(b.locked ?? b.draft) }, equipped: { ...(b.locked ?? b.draft) } },
        );
        const staged: PitData = { ...data, phase: "locked", bots: lockedBots };
        const bouts = playCard(staged);
        const gazette = [...writeGazette(staged, bouts), ...data.gazette.filter((g) => g.week !== data.week || g.kicker === "House call")];
        const craft = [
          ...data.craft.filter((c) => c.week !== data.week),
          ...data.stores.map((s) => ({ week: data.week, storeId: s.id, score: craftScore({ ...staged, bouts }, s.id) })),
        ];
        let honors = data.honors;
        if (data.week === 5) {
          const final = bouts.find((bout) => bout.title === "Waterman Championship" && bout.result);
          const belt = final?.result?.winnerIds[0] ?? null;
          const plate = final?.result?.loserIds[0] ?? null;
          const best = [...craft].filter((row) => row.week <= 4).sort((a,b) => b.score-a.score)[0];
          const bestStore = best?.storeId ?? data.honors.bestBuild;
          honors = {
            pitBelt: belt,
            plate,
            bestBuild: bestStore ?? null,
            bestBuildWhy: bestStore ? (data.honors.bestBuildWhy || craftWhy(staged,bestStore,"")) : "",
            titleDrop: belt ? titlePart(lockedBots.find((bot) => bot.storeId === belt)?.classId ?? "striker") : null,
          };
        } else if (data.week === 4) {
          const best = [...craft].filter((row) => row.week <= 4).sort((a,b) => b.score-a.score)[0];
          const bestStore = best?.storeId ?? null;
          honors = {
            ...data.honors,
            bestBuild: bestStore,
            bestBuildWhy: bestStore ? craftWhy(staged,bestStore,bestBuildId(staged)?.why ?? "") : "",
          };
        }
        const bots = lockedBots.map((bot) => {
          if (data.week !== 5 || honors.pitBelt !== bot.storeId || !honors.titleDrop) return bot;
          return bot.owned.includes(honors.titleDrop) ? bot : { ...bot, owned: [...bot.owned, honors.titleDrop] };
        });
        set({
          phase: "fought",
          bots,
          bouts: [...data.bouts.filter((b) => b.week !== data.week), ...bouts],
          gazette,
          craft,
          honors,
          flash: data.week === 5 ? "Championship Saturday is in the books." : data.week === 4 ? "Regular season complete. Conference champions are set for Saturday." : "Monday card is live. Watch it before you drop damage.",
          log: [`Week ${data.week} fought.`, ...data.log.slice(0, 23)],
        });
      },
      dropDamage: () => {
        const data = get();
        if (!isBoss(data)) return;
        if (data.phase !== "fought") {
          set({ flash: data.phase === "inspected" ? "Damage is already on the wall." : "Run the card first." });
          return;
        }
        const weekBouts = data.bouts.filter((b) => b.week === data.week);
        const bots = data.bots.map((bot) => {
          let next = bot;
          const wearIn: Partial<Record<Slot, Condition>> = {};
          for (const bout of weekBouts) {
            const planned = bout.result?.wear[bot.storeId];
            if (!planned) continue;
            for (const slot of SLOTS) {
              const incoming = planned[slot];
              if (!incoming || incoming === "clean") continue;
              const prev = wearIn[slot];
              wearIn[slot] = prev ? mergeWear(prev, incoming) : incoming;
            }
          }
          for (const slot of SLOTS) {
            const incoming = wearIn[slot];
            if (!incoming || incoming === "clean") continue;
            const partId = next.equipped[slot];
            if (!partId) continue;
            const current = next.partWear[partId] ?? "clean";
            next = setPartWear(next, partId, mergeWear(current, incoming));
          }
          return next;
        });
        const quotes: PitData["quotes"] = {};
        const staged = { ...data, bots };
        for (const bot of bots) {
          quotes[bot.storeId] = quotesForBot(bot, wonThisWeek(staged, bot.storeId));
        }
        set({
          phase: "inspected",
          bots,
          quotes,
          flash: "Damage report is up. Quotes stick until somebody pays them.",
          log: [`Week ${data.week} damage posted.`, ...data.log.slice(0, 23)],
        });
      },
      advanceWeek: () => {
        const data = get();
        if (!isBoss(data)) return;
        if (data.phase !== "inspected") {
          set({ flash: "Drop the damage report before you advance." });
          return;
        }
        if (data.week === 5) {
          set({
            phase: "complete",
            flash: "Season closed. The Waterman Champion is on the wall.",
            log: ["Championship Saturday complete.", ...data.log].slice(0, 24),
          });
          return;
        }
        const last = lastPlaceId(data);
        const bots = data.bots.map((raw) => {
          const bot = partWelds(raw);
          const card = cardFor(data, bot.storeId);
          if (!card) return bot;
          const grades = gradesOf(card);
          const paid = coinsByJar(grades);
          const coins = { ...bot.coins };
          for (const slot of SLOTS) coins[slot] = (coins[slot] ?? 0) + paid[slot];
          const weldedParts = { ...bot.weldedParts };
          let partWear = { ...bot.partWear };
          for (const [id, week] of Object.entries(weldedParts)) {
            if (week <= data.week) {
              if (partWear[id] === "bent") partWear = { ...partWear, [id]: "disabled" };
              delete weldedParts[id];
            }
          }
          return syncWear({
            ...bot,
            voucher: bot.voucher + (bot.storeId === last ? 3 : 0),
            repairSpent: 0,
            coins,
            partWear,
            weldedParts,
            locked: null,
          });
        });
        const lines = [`Week ${data.week} paid out. Green 3, blue 2, orange 1, red 0 coins per part.`];
        if (last) {
          const store = data.stores.find((s) => s.id === last);
          lines.unshift(`${store?.name ?? last} takes the last-place repair voucher: 3 coins for any repair.`);
        }
        const next = data.week + 1;
        const existing = new Set(data.storeCards.filter((c) => c.week === next).map((c) => c.storeId));
        const storeCards = next === 5
          ? data.storeCards
          : [
              ...data.storeCards,
              ...data.storeCards
                .filter((c) => c.week === data.week && !existing.has(c.storeId))
                .map((c) => projectCard(c, next)),
            ];
        set({
          week: next,
          phase: "open",
          bots,
          storeCards,
          flash: next === 5 ? "Championship Week is open. Only the two conference champions can work on their bots; everyone else can Rally." : `Week ${next} is open. ${data.week === 1 ? "Coins are in the jars and the shop is open." : "Cards are house projections until the desk clicks in Sunday's colors."}`,
          log: [...lines, ...data.log].slice(0, 24),
        });
      },
      resetSeason: () => {
        const data = get();
        if (!isBoss(data)) return;
        const fresh = makeData();
        // Keep the roster. Server credentials are independent of game resets.
        const stores = fresh.stores.map((s) => {
          const was = data.stores.find((w) => w.id === s.id);
          return was ? { ...s, captain: was.captain } : s;
        });
        set({
          ...fresh,
          stores,
          crew: data.crew.map((c) => ({ ...c, offWeeks: [] })),
          session: data.session,
          tutorialSeen: data.tutorialSeen,
          flash: "Period 12 reset. Fourteen stock bots. Week 1. Codes and crews kept.",
        });
      },
    });


function spyReady(
  data: PitData,
  storeId: string,
  targetId: string,
): { ok: true; scry: { tier: PitData["intel"][number]["tier"]; name: string } } | { ok: false; flash: string } {
  if (!isCaptainOf(data, storeId)) return { ok: false, flash: "Only the captain sends a spy." };
  if (data.phase !== "open" && data.phase !== "locked") return { ok: false, flash: "The bell already rang. Watch the tape." };
  const bot = data.bots.find((row) => row.storeId === storeId);
  const scry = bot ? equippedScry(bot) : null;
  if (!bot || !scry) return { ok: false, flash: "Bolt a Scry on the utility slot. That is the spy." };
  if (!foesThisWeek(data, storeId).includes(targetId)) return { ok: false, flash: "That store is not on your card." };
  return { ok: true, scry };
}


function titlePart(classId: Bot["classId"]) {
  if (classId === "tank") return "chassis-keystone-championship";
  if (classId === "specialist") return "chassis-windlass-championship";
  return "chassis-shrike-championship";
}

function craftWhy(data: PitData, storeId: string, fallback: string) {
  const hit = bestBuildId(data);
  if (hit && hit.id === storeId) return hit.why;
  return fallback;
}

function mapStoreId(id: string) {
  return id === "bryant" ? "hulen" : id;
}

function mapCrewId(id: string) {
  return id.replace(/^bryant-/, "hulen-");
}

function renameRecordKey<T>(record: Record<string, T>): Record<string, T> {
  if (!("bryant" in record)) return record;
  const next: Record<string, T> = {};
  for (const key of Object.keys(record)) next[key === "bryant" ? "hulen" : key] = record[key]!;
  return next;
}

function mapFight(result: FightResult): FightResult {
  return {
    ...result,
    winnerIds: result.winnerIds.map(mapStoreId),
    loserIds: result.loserIds.map(mapStoreId),
    hp: renameRecordKey(result.hp),
    wear: renameRecordKey(result.wear),
    meleeOrder: result.meleeOrder?.map(mapStoreId),
    fighters: result.fighters.map((fighter) =>
      fighter.id === "bryant"
        ? {
            ...fighter,
            id: "hulen",
            name: "Fort Worth — Hulen",
            storeName: "Fort Worth — Hulen",
            botName: fighter.botName === "IRVIN" ? "HULEN" : fighter.botName,
          }
        : fighter,
    ),
    exchanges: result.exchanges.map((exchange) => ({
      ...exchange,
      attackerId: mapStoreId(exchange.attackerId),
      defenderId: mapStoreId(exchange.defenderId),
      call: exchange.call.replaceAll("Bryant Irvin", "Hulen").replaceAll("IRVIN", "HULEN"),
    })),
    finisher: result.finisher
      ? {
          ...result.finisher,
          by: mapStoreId(result.finisher.by),
          against: mapStoreId(result.finisher.against),
          call: result.finisher.call.replaceAll("Bryant Irvin", "Hulen").replaceAll("IRVIN", "HULEN"),
        }
      : null,
  };
}

/**
 * Version 4 saves predate the six-number scorecard, the brain slot, and coins.
 * Nothing had been fought yet, so start a fresh season but keep everything people set by hand.
 */
function carryCosmetics(old: PitData): PitData {
  const next = makeData();
  return {
    ...next,
    tagline: old.tagline || next.tagline,
    tutorialSeen: old.tutorialSeen,
    stores: next.stores.map((store) => {
      const was = old.stores?.find((row) => row.id === store.id);
      return was
        ? { ...store, name: was.name, captain: was.captain, paint: was.paint, garage: was.garage }
        : store;
    }),
    crew: Array.isArray(old.crew) && old.crew.length ? old.crew : next.crew,
    bots: next.bots.map((bot) => {
      const was = old.bots?.find((row) => row.storeId === bot.storeId);
      return was ? { ...bot, name: was.name, look: was.look, number: was.number, style: was.style } : bot;
    }),
  };
}

/** Moves an older save from Saturday fights to Monday fights without touching anything the stores set. */
export function applyMondays<T extends Partial<PitData>>(data: T): T {
  const fresh = makeData();
  return {
    ...data,
    weeks: data.weeks?.map((week) => {
      const next = fresh.weeks.find((row) => row.number === week.number);
      return next ? { ...week, name: next.name, blurb: next.blurb } : week;
    }),
    gazette: data.kickoff?.appliedAt
      ? data.gazette
      : data.gazette?.map((entry) => (entry.id === "g-open" ? (fresh.gazette.find((row) => row.id === "g-open") ?? entry) : entry)),
  };
}

/** Keeps a live Period 12 save when Bryant Irvin is corrected to Hulen. */
export function applyHulen<T extends Partial<PitData>>(data: T): T {
  if (!data.stores?.some((store) => store.id === "bryant")) return data;
  return {
    ...data,
    stores: data.stores.map((store) =>
      store.id === "bryant"
        ? {
            ...store,
            id: "hulen",
            name: "Fort Worth — Hulen",
          }
        : store,
    ),
    crew: data.crew?.map((member) =>
      member.storeId === "bryant" ? { ...member, id: mapCrewId(member.id), storeId: "hulen" } : member,
    ),
    bots: data.bots?.map((bot) =>
      bot.storeId === "bryant"
        ? {
            ...bot,
            id: bot.id === "bot-bryant" ? "bot-hulen" : bot.id,
            storeId: "hulen",
            name: bot.name === "IRVIN" ? "HULEN" : bot.name,
          }
        : bot,
    ),
    storeCards: data.storeCards?.map((card) =>
      card.storeId === "bryant" ? { ...card, id: card.id.replace(/^bryant-/, "hulen-"), storeId: "hulen" } : card,
    ),
    bouts: data.bouts?.map((bout) => ({
      ...bout,
      id: bout.id.replaceAll("bryant", "hulen"),
      storeIds: bout.storeIds.map(mapStoreId),
      teamA: bout.teamA.map(mapStoreId),
      teamB: bout.teamB.map(mapStoreId),
      result: bout.result ? mapFight(bout.result) : bout.result,
    })),
    quotes: data.quotes ? renameRecordKey(data.quotes) : data.quotes,
    proposals: data.proposals?.map((proposal) =>
      proposal.storeId === "bryant" ? { ...proposal, storeId: "hulen", crewId: mapCrewId(proposal.crewId) } : proposal,
    ),
    mvps: data.mvps?.map((mvp) =>
      mvp.storeId === "bryant" ? { ...mvp, storeId: "hulen", crewId: mapCrewId(mvp.crewId) } : mvp,
    ),
    honors: data.honors
      ? {
          ...data.honors,
          pitBelt: data.honors.pitBelt ? mapStoreId(data.honors.pitBelt) : null,
          plate: data.honors.plate ? mapStoreId(data.honors.plate) : null,
          bestBuild: data.honors.bestBuild ? mapStoreId(data.honors.bestBuild) : null,
        }
      : data.honors,
    craft: data.craft?.map((row) => (row.storeId === "bryant" ? { ...row, storeId: "hulen" } : row)),
    session: data.session
      ? {
          ...data.session,
          storeId: data.session.storeId ? mapStoreId(data.session.storeId) : null,
          crewId: data.session.crewId ? mapCrewId(data.session.crewId) : null,
        }
      : data.session,
    gazette: data.gazette?.map((entry) => ({
      ...entry,
      headline: entry.headline.replaceAll("Bryant Irvin", "Hulen").replaceAll("IRVIN", "HULEN"),
      body: entry.body.replaceAll("Bryant Irvin", "Hulen").replaceAll("IRVIN", "HULEN"),
    })),
    log: data.log?.map((line) => line.replaceAll("Bryant Irvin", "Hulen").replaceAll("IRVIN", "HULEN")),
  };
}

/** Adds the 14-store conference format to an existing live Period 12 row without wiping work already entered. */
export function applyLeague14<T extends Partial<PitData>>(data: T): T {
  const fresh = makeData();
  const oldStores = data.stores ?? [];
  const stores = fresh.stores.map((store) => {
    const old = oldStores.find((row) => row.id === store.id);
    return old ? { ...store, ...old, conference: store.conference,
      captain: store.id === "abilene" && old.captain === "Abilene Captain" ? store.captain : old.captain,
    } : store;
  });
  const oldCrew = data.crew ?? [];
  // Correct only the pre-launch placeholders; retain real roster edits and surviving identity IDs.
  const abileneNames: Record<string, string> = { "Abilene Captain": "Taylor VanSickle", "Abilene Specialist 1": "Nathan Burney", "Abilene Specialist 2": "Philip Rodriguez" };
  const crew = oldCrew.filter(c => c.storeId !== "abilene" || !["Abilene Specialist 3", "Abilene Specialist 4"].includes(c.name))
    .map(c => c.storeId === "abilene" && abileneNames[c.name] ? { ...c, name: abileneNames[c.name]! } : c);
  for (const store of fresh.stores) {
    if (crew.some((member) => member.storeId === store.id)) continue;
    crew.push(...fresh.crew.filter((member) => member.storeId === store.id));
  }
  const oldBots = data.bots ?? [];
  const bots = fresh.bots.map((bot) => {
    const old = partWelds(oldBots.find((row) => row.storeId === bot.storeId) ?? bot);
    // Preserve the one-time starter choice: migration must not invent a body for an unchosen bot.
    return old.style ? { ...old, style: { ...old.style, stickers: styleOf(old).stickers } } : old;
  });
  const oldCards = data.storeCards ?? [];
  const storeCards = [
    ...oldCards,
    ...fresh.storeCards.filter((card) => !oldCards.some((row) => row.storeId === card.storeId && row.week === card.week)),
  ];
  const weeks = fresh.weeks.map((week) => {
    const old = data.weeks?.find((row) => row.number === week.number);
    return old ? { ...week, lockedAt: old.lockedAt } : week;
  });
  const oldTagline = data.tagline ?? "";
  const tagline = !oldTagline || oldTagline.includes("Eleven stores")
    ? fresh.tagline
    : oldTagline;
  return {
    ...data,
    version: VERSION,
    tagline,
    stores,
    crew,
    bots,
    storeCards,
    weeks,
    rallies: data.rallies ?? [],
    cosmeticProposals: data.cosmeticProposals ?? [],
  } as T;
}

export function paintHex(id: string) {
  return PAINT[id] ?? PAINT.amber;
};

const persistedSnapshot = memoSnapshot((state: PitState) => ({ ...sharedDoc(state), tutorialSeen: state.tutorialSeen }), [...SHARED_KEYS, "tutorialSeen"]);
const browserStorage = snapshotStorage<ReturnType<typeof persistedSnapshot>>(() => localStorage);
export const usePit = create<PitState>()(persist(pitCreator, {
      storage: browserStorage,
      name: "pit-night-storewars-v1",
      skipHydration: true,
      version: VERSION,
      partialize: persistedSnapshot,
      migrate: (persisted, version) => {
        if (persisted && version === 4) return carryCosmetics(applyHulen(persisted as PitData));
        // Version 5 and later saves carry forward; new fields get defaults in merge.
        if (persisted && version >= 5) return { ...(persisted as PitData), version: VERSION };
        forgetSyncBase();
        return makeData();
      },
      merge: (persisted, current) => {
        const saved = persisted as Partial<PitData> | undefined;
        if (!saved) return current;
        if (typeof saved.version !== "number" || saved.version < 5) return current;
        const fixed = applyLeague14(applyMondays(applyHulen(saved as PitData)));
        return {
          ...current,
          ...sharedDoc(fixed),
          tutorialSeen: fixed.tutorialSeen ?? false,
          stores: sharedDoc(fixed).stores,
          session: { role: "public", storeId: null, crewId: null },
          version: VERSION,
          jobLog: fixed.jobLog ?? [],
          sparkLog: fixed.sparkLog ?? [],
          rallies: fixed.rallies ?? [],
          shouts: fixed.shouts ?? [],
          picks: fixed.picks ?? [],
          trainingOpenAll: fixed.trainingOpenAll ?? false,
          kickoff: fixed.kickoff ?? { grades: {}, paid: {}, appliedAt: null },
          intel: (Array.isArray(fixed.intel) ? fixed.intel : []).map((row) => ({ ...row, guess: row.guess ?? "" })), flash: "" };
      },
    }));
