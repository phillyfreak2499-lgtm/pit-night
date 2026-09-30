import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  CLASS_META,
  PAINT,
  SCRAP_CAP,
  VERSION,
  partById,
  stockPart,
  styleOf,
} from "./catalog";
import {
  SLOTS,
  RECLASS_FEE,
  bestBuildId,
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
  scrapMath,
  shopOpen,
  spyRead,
  titleField,
  WEAPON_FAMILIES,
  wonThisWeek,
  writeGazette,
} from "./engine";
import { makeData } from "./seed";
import type { Bot, BotLook, BotStyle, Condition, FightResult, GarageLook, Loadout, PitData, Slot, StoreCard } from "./types";

export type PitState = PitData & {
  flash: string;
  signPublic: () => void;
  signCrew: (storeId: string, crewId: string) => void;
  signCaptain: (storeId: string, passcode: string) => boolean;
  signCommissioner: (pin: string) => boolean;
  setDraftPart: (storeId: string, slot: Slot, partId: string | null) => void;
  setDraftLoadout: (storeId: string, loadout: Loadout) => void;
  lockStore: (storeId: string) => void;
  unlockStore: (storeId: string) => void;
  updateCard: (storeId: string, patch: Partial<StoreCard>) => void;
  propose: (storeId: string, partId: string, note: string) => void;
  acceptProposal: (id: string) => void;
  dismissProposal: (id: string) => void;
  buyPart: (storeId: string, partId: string) => void;
  repairSlot: (storeId: string, slot: Slot, mode: "full" | "weld" | "salvage" | "crown") => void;
  nameMvp: (storeId: string, crewId: string) => void;
  renameBot: (storeId: string, name: string) => void;
  renameCaptain: (storeId: string, name: string) => void;
  setGoal: (storeId: string, goal: number) => void;
  setProrate: (storeId: string, prorate: number) => void;
  setPasscode: (storeId: string, passcode: string) => void;
  setPaint: (storeId: string, paint: string) => void;
  setGarage: (storeId: string, garage: GarageLook) => void;
  setLook: (storeId: string, look: BotLook) => void;
  setStyle: (storeId: string, patch: Partial<BotStyle>) => void;
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

function payRepair(bot: Bot, cost: number): Bot | null {
  if (bot.voucher + bot.scrap < cost) return null;
  const fromVoucher = Math.min(bot.voucher, cost);
  const rest = cost - fromVoucher;
  return {
    ...bot,
    voucher: bot.voucher - fromVoucher,
    scrap: bot.scrap - rest,
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
    demoPct: clamp(prev.demoPct + j(1, 4), 42, 96),
    closePct: clamp(prev.closePct + j(2, 4), 38, 90),
    nsnuPct: clamp(prev.nsnuPct + j(3, 8), 60, 150),
    prorate: 1,
    reviews: clamp(prev.reviews + j(4, 1), 0, prev.crewOnClock * 2),
    crewOnClock: prev.crewOnClock,
    formerTicket: clamp(prev.formerTicket + j(5, 20), 180, 640),
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
    signCommissioner: () => false,
    setDraftPart: () => {},
    setDraftLoadout: () => {},
    lockStore: () => {},
    unlockStore: () => {},
    updateCard: () => {},
    propose: () => {},
    acceptProposal: () => {},
    dismissProposal: () => {},
    buyPart: () => {},
    repairSlot: () => {},
    nameMvp: () => {},
    renameBot: () => {},
    renameCaptain: () => {},
    setGoal: () => {},
    setProrate: () => {},
    setPasscode: () => {},
    setPaint: () => {},
    setGarage: () => {},
    setLook: () => {},
    setStyle: () => {},
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
          set({ flash: "Only the captain locks iron." });
          return;
        }
        if (data.phase !== "open" && !(isBoss(data) && data.phase === "locked")) {
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
          set({ flash: "Shakedown class is public. Reclass after the first fight." });
          return;
        }
        let next = bot;
        if (part.classLock && part.classLock !== bot.classId) {
          if (bot.scrap < RECLASS_FEE) {
            set({ flash: `Reclass costs ${RECLASS_FEE} scrap.` });
            return;
          }
          next = { ...bot, scrap: bot.scrap - RECLASS_FEE, classId: part.classLock };
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
          flash: part.classLock && part.classLock !== bot.classId ? `Reclassed to ${CLASS_META[part.classLock].label}. ${RECLASS_FEE} scrap.` : `${part.name} is on the ${slot}.`,
        });
      },
      setDraftLoadout: (storeId, loadout) => {
        const data = get();
        if (!isCaptainOf(data, storeId)) {
          set({ flash: "Only the captain locks iron." });
          return;
        }
        if (data.phase !== "open" && !(isBoss(data) && data.phase === "locked")) {
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
          set({ flash: "The weekly card belongs to the captain." });
          return;
        }
        if (data.phase !== "open" && !(isBoss(data) && data.phase === "locked")) {
          set({ flash: "The card is frozen." });
          return;
        }
        set({
          storeCards: data.storeCards.map((card) => {
            if (card.storeId !== storeId || card.week !== data.week) return card;
            const next = { ...card, ...patch, projected: false, week: data.week, storeId };
            next.reviews = Math.max(0, Math.min(next.reviews, Math.max(1, next.crewOnClock) * 2));
            return next;
          }),
          flash: "Card updated. Grades moved with it.",
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
        set({ proposals: get().proposals.filter((p) => p.id !== id) });
      },
      dismissProposal: (id) => set({ proposals: get().proposals.filter((p) => p.id !== id) }),
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
              scrap: bot.scrap - check.cost,
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
          return `${name} bought for ${cost} scrap.`;
        }
      },
      repairSlot: (storeId, slot, mode) => {
        const data = get();
        if (!isCaptainOf(data, storeId)) {
          set({ flash: "Repairs go through the captain." });
          return;
        }
        if (data.phase === "locked" || data.phase === "fought") {
          set({ flash: "No torches during the bell." });
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
          const paid = payRepair(current, 2);
          if (!paid) {
            set({ flash: "Weld is 2 scrap. The bank cannot cover it." });
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
                scrap: Math.min(SCRAP_CAP, bot.scrap + refund),
                owned: bot.owned.filter((id) => id !== partId),
                draft,
                equipped: { ...draft },
                partWear,
                weldForWeek: { ...bot.weldForWeek, [slot]: undefined },
              });
            }),
            flash: `${part.name} stripped. ${refund} scrap back. Slot dropped to stock.`,
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
        const cost = cond === "scratched" ? 1 : cond === "bent" ? 3 : 6;
        const paid = payRepair(current, cost);
        if (!paid) {
          set({ flash: `Quote is ${cost}. Wallet cannot cover it.` });
          return;
        }
        set({
          bots: patchBot(data.bots, storeId, () => {
            const weldForWeek = { ...paid.weldForWeek };
            delete weldForWeek[slot];
            return setPartWear({ ...paid, weldForWeek }, partId, "clean");
          }),
          flash: `${part.name} is clean. ${cost} scrap.`,
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
      setGoal: (storeId, goal) => {
        if (!isBoss(get())) return;
        set({
          stores: get().stores.map((s) => (s.id === storeId ? { ...s, nsnuGoal: Math.max(1, Math.round(goal)) } : s)),
          flash: "Weekly NSNU goal updated. The floor still only sees the percent.",
        });
      },
      setProrate: (storeId, prorate) => {
        const data = get();
        if (!isBoss(data)) return;
        set({
          storeCards: data.storeCards.map((c) =>
            c.storeId === storeId && c.week === data.week ? { ...c, prorate } : c,
          ),
          flash: prorate < 1 ? "Short week. Goal prorated. NSNU-to-goal moved. No traffic was invented." : "Full goal restored.",
        });
      },
      setPasscode: (storeId, passcode) => {
        if (!isBoss(get())) return;
        const clean = passcode.trim().toLowerCase();
        if (clean.length < 3) {
          set({ flash: "Passcode needs at least 3 characters." });
          return;
        }
        set({
          stores: get().stores.map((s) => (s.id === storeId ? { ...s, passcode: clean } : s)),
          flash: "Clipboard code changed.",
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
          storeCards: syncCrewCount(data, storeId, count),
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
          storeCards: syncCrewCount(data, storeId, specialists.length - 1),
          flash: `${member.name} is off the clock.`,
        });
      },
      dismissTutorial: () => set({ tutorialSeen: true }),
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
          bots: data.bots.map((b) => ({ ...b, locked: { ...(b.locked ?? b.draft) }, equipped: { ...(b.locked ?? b.draft) } })),
          flash: "Locked. Eleven loadouts frozen for Monday. Enter the official numbers, then run the card.",
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
        let bots = data.bots.map((bot) => {
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
        let bots = data.bots.map((bot) => {
          const card = cardFor(data, bot.storeId);
          if (!card) return bot;
          const grades = gradesOf(card);
          const earned = scrapMath(grades).total;
          const room = Math.max(0, SCRAP_CAP - bot.scrap);
          const banked = Math.min(room, earned);
          const keys = { ...bot.keys };
          const greens = { ...bot.greens };
          (Object.keys(grades) as (keyof typeof grades)[]).forEach((stat) => {
            if (grades[stat] === "green") {
              greens[stat] += 1;
              const key = keyForStat(stat);
              keys[key] += 1;
            }
          });
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
            scrap: bot.scrap + banked,
            voucher: bot.voucher + (bot.storeId === last ? 4 : 0),
            repairSpent: 0,
            keys,
            greens,
            partWear,
            weldForWeek,
            locked: null,
          });
        });
        const lines = [`Week ${data.week} paid out. Bank cap ${SCRAP_CAP}.`];
        if (last) {
          const store = data.stores.find((s) => s.id === last);
          lines.unshift(`${store?.name ?? last} takes the last-place stipend. Repair first.`);
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
          flash: `Week ${next} is open. ${data.week === 1 ? "The shop lights just came on." : "Cards are house projections until a captain overwrites them."}`,
          log: [...lines, ...data.log].slice(0, 24),
        });
      },
      resetSeason: () => {
        const session = { role: "public" as const, storeId: null, crewId: null };
        set({ ...makeData(), session, flash: "Period 12 reset. Eleven stock bots. Week 1." });
      },
    }),
    {
      name: "pit-night-storewars-v1",
      skipHydration: true,
      version: VERSION,
      partialize: (state) => ({
        version: state.version,
        seasonName: state.seasonName,
        tagline: state.tagline,
        pin: state.pin,
        week: state.week,
        phase: state.phase,
        stores: state.stores,
        crew: state.crew,
        bots: state.bots,
        weeks: state.weeks,
        storeCards: state.storeCards,
        bouts: state.bouts,
        gazette: state.gazette,
        quotes: state.quotes,
        proposals: state.proposals,
        mvps: state.mvps,
        honors: state.honors,
        craft: state.craft,
        session: state.session,
        log: state.log,
        tutorialSeen: state.tutorialSeen,
        intel: state.intel,
      }),
      migrate: () => makeData(),
      merge: (persisted, current) => {
        const saved = persisted as Partial<PitData> | undefined;
        if (!saved || saved.version !== VERSION) return current;
        const fixed = applyMondays(applyHulen(saved as PitData));
        return { ...current, ...fixed, intel: (Array.isArray(fixed.intel) ? fixed.intel : []).map((row) => ({ ...row, guess: row.guess ?? "" })), flash: "" };
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

function syncCrewCount(data: PitData, storeId: string, count: number) {
  return data.storeCards.map((card) => {
    if (card.storeId !== storeId || card.week !== data.week) return card;
    return { ...card, crewOnClock: count, reviews: Math.min(card.reviews, count * 2) };
  });
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

/** Moves an older save from Saturday fights to Monday fights without touching anything the stores set. */
export function applyMondays<T extends Partial<PitData>>(data: T): T {
  const fresh = makeData();
  return {
    ...data,
    weeks: data.weeks?.map((week) => {
      const next = fresh.weeks.find((row) => row.number === week.number);
      return next ? { ...week, name: next.name, blurb: next.blurb } : week;
    }),
    gazette: data.gazette?.map((entry) => (entry.id === "g-open" ? (fresh.gazette.find((row) => row.id === "g-open") ?? entry) : entry)),
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
