import { createStore } from "zustand/vanilla";
import { pitCreator, sharedDoc } from "./store";
import { approvedCards } from "./period12-approved-card";
import {
  approvedFinaleTape,
  pendingApprovedFinale,
  FINALE_EVENT,
  FINALE_POST_AFTER,
} from "./period12-tape";
import { championshipFinalists, regularSeasonRecordOf, craftScore, bestBuildId } from "./engine";
import { sealReplay } from "./replay";
import type { PitData } from "./types";
export { FINALE_EVENT, FINALE_POST_AFTER } from "./period12-tape";

/** Server-only owner settlement; production, backup and CAS are enforced by the caller. */
export function reconcilePeriod12Finale<T extends PitData>(data: T, now: Date): T {
  if (
    now.getTime() <= FINALE_POST_AFTER ||
    now.getTime() >= Date.parse("2026-11-28T15:30:00.000Z") ||
    !pendingApprovedFinale(data)
  )
    return data;
  const card = approvedFinaleTape();
  const staged: PitData = {
    ...structuredClone(sharedDoc(data)),
    tutorialSeen: false,
    session: { role: "commissioner", storeId: null, crewId: null },
    week: 4,
    phase: "fought" as const,
    bouts: [...structuredClone(data.bouts), ...card],
    storeCards: [
      ...structuredClone(data.storeCards.filter((c) => c.week !== 4)),
      ...structuredClone(approvedCards),
    ],
    bots: data.bots.map((b) => ({
      ...structuredClone(b),
      locked: { ...b.draft },
      equipped: { ...b.draft },
    })),
  };
  if (JSON.stringify(championshipFinalists(staged)) !== JSON.stringify(["rockwall", "abilene"]))
    throw new Error("Approved championship field failed verification.");
  if (
    !staged.stores.every((s) => {
      const r = regularSeasonRecordOf(staged, s.id);
      return r.w + r.l === 4;
    })
  )
    throw new Error("Week 4 is incomplete.");
  staged.craft = [
    ...data.craft.filter((c) => c.week !== 4),
    ...data.stores.map((s) => ({ week: 4, storeId: s.id, score: craftScore(staged, s.id) })),
  ];
  const best = [...staged.craft].filter((c) => c.week <= 4).sort((a, b) => b.score - a.score)[0];
  const bestBuild = bestBuildId(staged);
  staged.honors = {
    ...data.honors,
    bestBuild: best?.storeId ?? null,
    bestBuildWhy:
      best?.storeId === bestBuild?.id ? (bestBuild?.why ?? "") : data.honors.bestBuildWhy,
  };
  staged.replays = sealReplay(staged, 4);
  const store = createStore(pitCreator);
  store.setState({ ...staged, session: { role: "commissioner", storeId: null, crewId: null } });
  store.getState().dropDamage();
  store.getState().advanceWeek();
  const settled = sharedDoc(store.getState());
  if (settled.week !== 5 || settled.phase !== "open")
    throw new Error("Championship preparation could not open.");
  return {
    ...data,
    ...settled,
    ownerEvents: [...(settled.ownerEvents ?? []), FINALE_EVENT],
    log: [
      "Week 4 approved Nov 16; standings posted after Tuesday 10 AM Central. Rockwall and Abilene advance. All fourteen stores prepare Nov 17–27 for Nov 28.",
      ...settled.log,
    ].slice(0, 24),
    gazette: [
      {
        id: "owner-finale-2026-11-17",
        week: 5,
        kicker: "Conference Finale · official",
        headline: "Rockwall and Abilene advance to November 28",
        body: "All four regular rounds now count. Rockwall wins Metro at 4–0. Abilene and College Station finish 4–0; Abilene wins the Frontier berth tiebreaker. Every store prepares November 17–27: twelve bots for the Third Place Royal Rumble, then Rockwall versus Abilene for the title. All builds lock Friday, November 27 at 6 PM Central. The Desk PIN starts the November 28 show at or after 9:30 AM Central.",
      },
      ...settled.gazette,
    ],
  } as T;
}
