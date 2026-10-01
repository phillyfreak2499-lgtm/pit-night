import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  CLASS_META,
  METRICS,
  PAINT,
  REPAIR_PRICE,
  VERSION,
  partById,
  stockPart,
  styleOf,
} from "./catalog";
import {
  SLOTS,
  RECLASS_FEE,
  bestBuildId,
  buildCard,
  kickoffRank,
  buyCheck,
  cardFor,
  craftScore,
  equippedScry,
  foesThisWeek,
  gradesOf,
  hashString,
  keyForStat,
  lastPlaceId,
  mergeWear,
  quotesForBot,
  runSaturday as playCard,
  coinMath,
  shopOpen,
  spyRead,
  titleField,
  WEAPON_FAMILIES,
  wonThisWeek,
  writeGazette,
} from "./engine";
import { makeData } from "./seed";
import { BOLTS, STREAK_BADGE, allJobs, crateFor, dayOpen, programWeek, type DayKey } from "./training";
import { boltsOf, lockerItem, sparkStreak } from "./week";
import type { Bot, BotLook, BotStyle, Condition, FightResult, GarageLook, Grade, Kickoff, Loadout, PitData, Slot, StatKey, StoreCard } from "./types";

const FIELD_OF: Record<StatKey, keyof StoreCard> = { nsnu: "nsnu", conv: "conv", demoRate: "demoRate", demoClose: "demoClose", arch: "arch", ticket: "demoTicket" };

export type PitState = PitData & {
  flash: string;
  signPublic: () => void;
  signCrew: (storeId: string, crewId: string) => void;
  signCaptain: (storeId: string, passcode: string) => boolean;
  signCommissioner: (pin: string) => boolean;
  setPin: (pin: string) => void;
  setDraftPart: (storeId: string, slot: Slot, partId: string | null) => void;
  setDraftLoadout: (storeId: string, loadout: Loadout) => void;
  lockStore: (storeId: string) => void;
  unlockStore: (storeId: string) => void;
  updateCard: (storeId: string, patch: Partial<StoreCard>) => void;
  setGrade: (storeId: string, stat: StatKey, grade: Grade | null) => void;
  setKickoffGrade: (storeId: string, stat: StatKey, grade: Grade | null) => void;
  applyKickoff: () => void;
  propose: (storeId: string, partId: string, note: string) => void;
  acceptProposal: (id: string) => void;
  dismissProposal: (id: string) => void;
  buyPart: (storeId: string, partId: string) => void;
  repairSlot: (storeId: string, slot: Slot, mode: "full" | "weld" | "salvage" | "crown") => void;
  nameMvp: (storeId: string, crewId: string) => void;
  renameBot: (storeId: string, name: string) => void;
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
  lockFriday: () => void;
  runSaturday: () => void;
  dropDamage: () => void;
  advanceWeek: () => void;
  resetSeason: () => void;
};

function isBoss(data: PitData) {
  return data.session.role === "commissioner";
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

function patchBot(bots: Bot[], storeId: string, fn: (bot: Bot) => Bot): Bot[] {
  return bots.map((bot) => (bot.storeId === storeId ? fn(bot) : bot));
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
  return Math.min(4, data.week + 1);
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
  };
}

function fresh(): PitState {
  return {
    ...makeData(),
    flash: "",
    signPublic: () => {},
    signCrew: () => {},
    signCaptain: () => false,
    setPin: () => {},
    signCommissioner: () => false,
    setDraftPart: () => {},
    setDraftLoadout: () => {},
    lockStore: () => {},
    unlockStore: () => {},
    updateCard: () => {},
    setGrade: () => {},
    setKickoffGrade: () => {},
    applyKickoff: () => {},
    propose: () => {},
    acceptProposal: () => {},
    dismissProposal: () => {},
    buyPart: () => {},
    repairSlot: () => {},
    nameMvp: () => {},
    renameBot: () => {},
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
    lockFriday: () => {},
    runSaturday: () => {},
    dropDamage: () => {},
    advanceWeek: () => {},
    resetSeason: () => {},
  };
}

/** Bump when the tutorial changes so every device sees the new one once. */
export const TUTORIAL_REV = 2;

/** Everything the league shares. Session and tutorial stay on the device. */
export const SHARED_KEYS = [
  "version", "seasonName", "tagline", "pin", "week", "phase", "stores", "crew", "bots", "weeks", "storeCards", "bouts",
  "gazette", "quotes", "proposals", "mvps", "honors", "craft", "log", "intel", "jobLog", "sparkLog", "shouts", "picks",
  "trainingOpenAll", "kickoff",
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
  return out as SharedDoc;
}

export const usePit = create<PitState>()(
  persist(
    (set, get) => ({
      ...fresh(),
      signPublic: () => set({ session: { role: "public", storeId: null, crewId: null }, flash: "Public side of the cage." }),
      signCrew: (storeId, crewId) => {
        const crew = get().crew.find((c) => c.id === crewId && c.storeId === storeId);
        if (!crew || crew.role !== "specialist") return;
        set({
          session: { role: "crew", storeId, crewId },
          flash: `${crew.name} is on the clipboard. Lock still belongs to the captain.`,
        });
      },
      signCaptain: (storeId, passcode) => {
        const store = get().stores.find((s) => s.id === storeId);
        if (!store) return false;
        if (store.passcode.toLowerCase() !== passcode.trim().toLowerCase()) {
          set({ flash: "That clipboard code does not open this bay." });
          return false;
        }
        const crew = get().crew.find((c) => c.storeId === storeId && c.role === "captain");
        set({
          session: { role: "captain", storeId, crewId: crew?.id ?? null },
          flash: `${store.captain} has ${store.name}'s clipboard.`,
        });
        return true;
      },
      setPin: (pin) => {
        if (!isBoss(get())) return;
        const clean = pin.trim();
        if (!/^\d{4,8}$/.test(clean)) {
          set({ flash: "House PIN is 4 to 8 digits." });
          return;
        }
        set({ pin: clean, flash: "House PIN changed. Write it down." });
      },
      signCommissioner: (pin) => {
        if (pin.trim() !== get().pin) {
          set({ flash: "House PIN refused." });
          return false;
        }
        set({
          session: { role: "commissioner", storeId: null, crewId: null },
          flash: "Desk is live. Eleven stores, one bell.",
        });
        return true;
      },
      setDraftPart: (storeId, slot, partId) => {
        const data = get();
        if (!isCaptainOf(data, storeId)) {
          set({ flash: "Only the captain can change parts." });
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
        let next = bot;
        if (part.classLock && part.classLock !== bot.classId) {
          if ((bot.coins.chassis ?? 0) < RECLASS_FEE) {
            set({ flash: `Reclass costs ${RECLASS_FEE} chassis coins.` });
            return;
          }
          next = { ...bot, coins: { ...bot.coins, chassis: bot.coins.chassis - RECLASS_FEE }, classId: part.classLock };
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
        if (!isCaptainOf(data, storeId)) {
          set({ flash: "Only the captain can change parts." });
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
          flash: "Draft is the best lock in the bay. It still has to be locked by Saturday close.",
        });
      },
      lockStore: (storeId) => {
        const data = get();
        if (!isCaptainOf(data, storeId)) {
          set({ flash: "Captain clipboard required." });
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
            return { ...card, ...patch, grades, projected: false, week: data.week, storeId };
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
        const seedOf = new Map(ranked.map((r) => [r.store.id, r.seed]));
        const paid: Kickoff["paid"] = {};
        const bots = data.bots.map((bot) => {
          const row = ranked.find((r) => r.store.id === bot.storeId);
          if (!row) return bot;
          const before = data.kickoff.paid[bot.storeId] ?? {};
          const coins = { ...bot.coins };
          for (const slot of SLOTS) coins[slot] = Math.max(0, (coins[slot] ?? 0) + row.bySlot[slot] - (before[slot] ?? 0));
          paid[bot.storeId] = { ...row.bySlot };
          return { ...bot, coins };
        });
        const stores = data.stores.map((s) => ({ ...s, seed: seedOf.get(s.id) ?? s.seed }));
        const card = buildCard({ ...data, stores, week: 1 });
        const name = (id: string | undefined) => stores.find((s) => s.id === id)?.name ?? "TBD";
        const bye = card.find((b) => b.kind === "bye");
        const main = card.filter((b) => b.kind === "bout").at(-1);
        const top = ranked[0]!;
        const gazette = data.gazette.map((g) =>
          g.id === "g-open"
            ? {
                ...g,
                body: `Period 12 opens October 25. Eleven stores, seeded on Period 11. The first card runs Monday morning, November 2: five fights and a bye. ${name(bye?.teamA[0])} earned the top seed and the first bye, and a bye counts as a win. The main event is ${name(main?.teamA[0])} against ${name(main?.teamB[0])}.`,
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
          flash: `Kickoff paid. ${top.store.name} is the 1 seed with ${top.coins} coins.`,
          log: [`Week 1 seeded on Period 11. ${top.store.name} is the 1 seed.`, ...data.log.slice(0, 23)],
        });
      },
      propose: (storeId, partId, note) => {
        const data = get();
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
        if (!isCaptainOf(data, storeId)) {
          set({ flash: "The wallet answers to the captain." });
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
            return syncWear({
              ...bot,
              coins: { ...bot.coins, [part.key]: (bot.coins[part.key] ?? 0) - check.cost },
              owned,
              classId: part.classLock ?? bot.classId,
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
      repairSlot: (storeId, slot, mode) => {
        const data = get();
        if (!isCaptainOf(data, storeId)) {
          set({ flash: "Repairs go through the captain." });
          return;
        }
        if (data.phase === "locked" || data.phase === "fought") {
          set({ flash: "Repairs are closed while the card is locked or running." });
          return;
        }
        const current = data.bots.find((b) => b.storeId === storeId);
        if (!current) return;
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
              setPartWear({ ...paid, weldForWeek: { ...paid.weldForWeek, [slot]: week } }, partId, "bent"),
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
                ...bot,
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
                ...bot,
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
            const weldForWeek = { ...paid.weldForWeek };
            delete weldForWeek[slot];
            return setPartWear({ ...paid, weldForWeek }, partId, "clean");
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
        const clean = name.trim().toUpperCase().slice(0, 22);
        if (!clean) return;
        const data = get();
        if (!isBoss(data) && !isCaptainOf(data, storeId)) return;
        set({ bots: patchBot(data.bots, storeId, (b) => ({ ...b, name: clean })), flash: `Bot is now ${clean}.` });
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
      setPasscode: (storeId, passcode) => {
        if (!isBoss(get())) return;
        const clean = passcode.trim();
        if (!/^\d{4}$/.test(clean)) {
          set({ flash: "Bay code must be 4 digits." });
          return;
        }
        const store = get().stores.find((s) => s.id === storeId);
        if (!store || store.passcode === clean) return;
        set({
          stores: get().stores.map((s) => (s.id === storeId ? { ...s, passcode: clean } : s)),
          flash: `${store.name} bay code changed.`,
        });
      },
      setPaint: (storeId, paint) => {
        const data = get();
        if (!isCaptainOf(data, storeId) || !PAINT[paint]) return;
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
        set({ bots: patchBot(data.bots, storeId, (b) => ({ ...b, look })), flash: "Bot dressed. Still the same iron." });
      },
      completeJob: (week, jobId, note) => {
        const data = get();
        const who = actor(data);
        if (!who) {
          set({ flash: "Sign in on the Clipboard with your bay code first." });
          return;
        }
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
        set({
          jobLog: [...data.jobLog.filter((e) => e.id !== id), entry],
          flash: status === "approved" ? `${job.title} is done.` : `${job.title} sent to the captain for a thumbs-up.`,
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
        set({
          jobLog: data.jobLog.map((e) => (e.id === entryId ? { ...e, status: "approved" } : e)),
          flash: `${entry.crewName} is approved. +${entry.jobId.endsWith("-crate") ? BOLTS.crate : BOLTS.job} bolts.`,
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
        set({
          sparkLog,
          flash: `Spark done. ${correct} of ${total}. +${correct * BOLTS.sparkCorrect} bolts.${streakNote}`,
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
        set({
          shouts: [
            ...data.shouts,
            { id: `${who.id}-${Date.now().toString(36)}`, week: data.week, storeId: who.storeId, fromCrewId: who.id, fromName: who.name, to: name, text: body, at: Date.now() },
          ],
          flash: "Shout-out posted.",
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
        const closed = trainingClosed(data, week);
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
          flash: off ? `${member.name} is off for week ${week}. They will not hold up the Tune-Up.` : `${member.name} is back on the week.`,
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
      setStyle: (storeId, patch) => {
        const data = get();
        if (!isCaptainOf(data, storeId)) return;
        set({ bots: patchBot(data.bots, storeId, (b) => ({ ...b, style: { ...styleOf(b), ...patch } })), flash: "Bot dressed. Still the same iron." });
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
        if (specialists.length >= 8) {
          set({ flash: "Eight specialists is the bay cap." });
          return;
        }
        const count = specialists.length + 1;
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
        set({
          intel,
          flash: same
            ? `${read.botName} has not moved.${called}`
            : read.locked
              ? `${read.botName} is locked. This is the locked iron.${called}`
              : `${read.botName} read. The captain can still move it before Saturday close.${called}`,
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
        set({
          phase: "locked",
          weeks: data.weeks.map((w) => (w.number === data.week ? { ...w, lockedAt: w.lockedAt ?? Date.now() } : w)),
          bots: data.bots.map((b) => ({ ...b, locked: { ...(b.locked ?? b.draft) }, equipped: { ...(b.locked ?? b.draft) } })),
          flash: "Locked. Eleven builds frozen for Monday. Click in Sunday's colors, then run the card.",
          log: [`Week ${data.week} locked.`, ...data.log.slice(0, 23)],
        });
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
        const lockedBots = data.bots.map((b) => ({
          ...b,
          locked: { ...(b.locked ?? b.draft) },
          equipped: { ...(b.locked ?? b.draft) },
        }));
        const staged: PitData = { ...data, phase: "locked", bots: lockedBots };
        const bouts = playCard(staged);
        const gazette = [...writeGazette(staged, bouts), ...data.gazette.filter((g) => g.week !== data.week || g.kicker === "House call")];
        const craft = [
          ...data.craft.filter((c) => c.week !== data.week),
          ...data.stores.map((s) => ({ week: data.week, storeId: s.id, score: craftScore({ ...staged, bouts }, s.id) })),
        ];
        let honors = data.honors;
        if (data.week === 4) {
          const field = titleField({ ...staged, bouts });
          const tie = bouts.find((b) => b.title === "Tiebreaker");
          const belt = tie?.result?.winnerIds[0] ?? field.leaders[0] ?? null;
          const plate =
            tie?.kind === "final"
              ? (tie.result?.loserIds[0] ?? null)
              : tie?.kind === "melee"
                ? (tie.result?.meleeOrder?.[1] ?? null)
                : (field.ranked.find((store) => store.id !== belt)?.id ?? null);
          const best = [...craft].sort((a, b) => b.score - a.score)[0];
          const why = best ? bestBuildId({ ...staged, bouts })?.why ?? "" : "";
          const bestStore = best?.storeId ?? null;
          honors = {
            pitBelt: belt,
            plate,
            bestBuild: bestStore,
            bestBuildWhy: best && bestStore ? craftWhy(staged, bestStore, why) : why,
            titleDrop: belt ? titlePart(lockedBots.find((b) => b.storeId === belt)?.classId ?? "striker") : null,
          };
        }
        const bots = lockedBots.map((bot) => {
          if (data.week !== 4 || honors.pitBelt !== bot.storeId || !honors.titleDrop) return bot;
          if (bot.owned.includes(honors.titleDrop)) return bot;
          return { ...bot, owned: [...bot.owned, honors.titleDrop] };
        });
        set({
          phase: "fought",
          bots,
          bouts: [...data.bouts.filter((b) => b.week !== data.week), ...bouts],
          gazette,
          craft,
          honors,
          flash: data.week === 4 ? "Title Monday is in the books." : "Monday card is live. Watch it before you drop damage.",
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
        const last = lastPlaceId(data);
        const bots = data.bots.map((bot) => {
          const card = cardFor(data, bot.storeId);
          if (!card) return bot;
          const grades = gradesOf(card);
          const paid = coinMath(grades).bySlot;
          const coins = { ...bot.coins };
          for (const slot of SLOTS) coins[slot] = (coins[slot] ?? 0) + paid[slot];
          const weldForWeek = { ...bot.weldForWeek };
          let partWear = { ...bot.partWear };
          for (const slot of SLOTS) {
            if (weldForWeek[slot] === data.week) {
              const id = bot.equipped[slot];
              if (id && (partWear[id] ?? "clean") === "bent") partWear = { ...partWear, [id]: "disabled" };
              delete weldForWeek[slot];
            }
          }
          return syncWear({
            ...bot,
            voucher: bot.voucher + (bot.storeId === last ? 3 : 0),
            repairSpent: 0,
            coins,
            partWear,
            weldForWeek,
            locked: null,
          });
        });
        const lines = [`Week ${data.week} paid out. Green 3, blue 2, orange 1, red 0 coins per part.`];
        if (last) {
          const store = data.stores.find((s) => s.id === last);
          lines.unshift(`${store?.name ?? last} takes the last-place repair voucher: 3 coins for any repair.`);
        }
        if (data.week >= 4) {
          set({
            phase: "complete",
            bots,
            flash: "Season closed. The trophy stays where it was hung.",
            log: [...lines, ...data.log].slice(0, 24),
          });
          return;
        }
        const next = data.week + 1;
        const existing = new Set(data.storeCards.filter((c) => c.week === next).map((c) => c.storeId));
        const storeCards = [
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
          flash: `Week ${next} is open. ${data.week === 1 ? "Coins are in the jars and the shop is open." : "Cards are house projections until the desk clicks in Sunday's colors."}`,
          log: [...lines, ...data.log].slice(0, 24),
        });
      },
      resetSeason: () => {
        const data = get();
        if (!isBoss(data)) return;
        const fresh = makeData();
        // Keep the people and the codes. Reset the game.
        const stores = fresh.stores.map((s) => {
          const was = data.stores.find((w) => w.id === s.id);
          return was ? { ...s, passcode: was.passcode, captain: was.captain } : s;
        });
        set({
          ...fresh,
          pin: data.pin,
          stores,
          crew: data.crew.map((c) => ({ ...c, offWeeks: [] })),
          session: data.session,
          tutorialSeen: data.tutorialSeen,
          flash: "Period 12 reset. Eleven stock bots. Week 1. Codes and crews kept.",
        });
      },
    }),
    {
      name: "pit-night-storewars-v1",
      skipHydration: true,
      version: VERSION,
      partialize: (state) => ({ ...sharedDoc(state), session: state.session, tutorialSeen: state.tutorialSeen }),
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
        const fixed = applyMondays(applyHulen(saved as PitData));
        return {
          ...current,
          ...fixed,
          version: VERSION,
          jobLog: fixed.jobLog ?? [],
          sparkLog: fixed.sparkLog ?? [],
          shouts: fixed.shouts ?? [],
          picks: fixed.picks ?? [],
          trainingOpenAll: fixed.trainingOpenAll ?? false,
          kickoff: fixed.kickoff ?? { grades: {}, paid: {}, appliedAt: null },
          intel: (Array.isArray(fixed.intel) ? fixed.intel : []).map((row) => ({ ...row, guess: row.guess ?? "" })), flash: "" };
      },
    },
  ),
);

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
    pin: old.pin || next.pin,
    tagline: old.tagline || next.tagline,
    tutorialSeen: old.tutorialSeen,
    stores: next.stores.map((store) => {
      const was = old.stores?.find((row) => row.id === store.id);
      return was
        ? { ...store, name: was.name, captain: was.captain, passcode: was.passcode, paint: was.paint, garage: was.garage }
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
            passcode: store.passcode === "bryant" ? "hulen" : store.passcode,
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

export function paintHex(id: string) {
  return PAINT[id] ?? PAINT.amber;
}
