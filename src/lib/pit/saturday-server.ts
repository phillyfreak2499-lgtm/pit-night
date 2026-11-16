/**
 * Desk-only doors for Championship Saturday.
 * The season document stays sealed. These functions never return the tape
 * to a public or store session, and they never echo the Desk PIN.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Bout, SaturdayFightName } from "./types";
import {
  markSaturdayRevealed,
  markSaturdayStarted,
  saturdayBout,
  saturdayPlayDecision,
} from "./saturday-seal";

const fight = z.enum(["rumble", "championship"]);

async function deskSeason() {
  const s = await (await import("./authoritative")).loadSeason();
  s.auth.sameOrigin();
  const session = await s.auth.session(s.data);
  if (session.role !== "commissioner") throw new Error("The Desk PIN starts this fight.");
  return { ...s, session };
}

export const openSaturdayTape = createServerFn({ method: "POST" })
  .validator(z.object({ fight }).strict())
  .handler(async ({ data: input }): Promise<{ bout: Bout }> => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const s = await deskSeason();
      const gate = saturdayPlayDecision({
        role: s.session.role,
        fight: input.fight as SaturdayFightName,
        now: new Date(),
        data: s.data,
      });
      if (!gate.ok) throw new Error(gate.error);
      const name = input.fight as SaturdayFightName;
      const bout = saturdayBout(s.data, name);
      if (!bout?.result) throw new Error("Run Championship Saturday from the Desk first. The result stays sealed.");
      const watch = markSaturdayStarted(s.data.saturdayWatch, name, Date.now());
      const prior = name === "rumble" ? s.data.saturdayWatch?.rumbleStartedAt : s.data.saturdayWatch?.championshipStartedAt;
      const next = name === "rumble" ? watch.rumbleStartedAt : watch.championshipStartedAt;
      if (prior === next) return { bout };
      const doc = JSON.stringify(s.store.sharedDoc({ ...s.data, saturdayWatch: watch }));
      const rows = await s.sql<{ rev: number }>`
        update pit_season set rev = rev + 1, doc = ${doc}, updated_at = now()
        where id = 'main' and rev = ${s.row.rev} returning rev
      `;
      if (rows[0]) return { bout };
    }
    throw new Error("The league is busy. Please try again.");
  });

export const publishSaturday = createServerFn({ method: "POST" })
  .validator(z.object({ fight }).strict())
  .handler(async ({ data: input }): Promise<{ ok: true }> => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const s = await deskSeason();
      const name = input.fight as SaturdayFightName;
      const gate = saturdayPlayDecision({ role: s.session.role, fight: name, now: new Date(), data: s.data });
      if (!gate.ok) throw new Error(gate.error);
      const already = name === "rumble" ? s.data.saturdayWatch?.rumbleRevealedAt : s.data.saturdayWatch?.championshipRevealedAt;
      if (already) return { ok: true };
      const watch = markSaturdayRevealed(s.data.saturdayWatch, name, Date.now());
      const doc = JSON.stringify(s.store.sharedDoc({ ...s.data, saturdayWatch: watch }));
      const rows = await s.sql<{ rev: number }>`
        update pit_season set rev = rev + 1, doc = ${doc}, updated_at = now()
        where id = 'main' and rev = ${s.row.rev} returning rev
      `;
      if (rows[0]) return { ok: true };
    }
    throw new Error("The league is busy. Please try again.");
  });

export type SaturdayPeek = {
  rumble: { winner: string } | null;
  championship: { winner: string; runnerUp: string } | null;
};

/** Commissioner eyes only. Not written to the season and not returned by league sync. */
export const peekSaturday = createServerFn({ method: "POST" })
  .validator(z.object({}).strict())
  .handler(async (): Promise<SaturdayPeek> => {
    const s = await deskSeason();
    const name = (id: string | undefined) => s.data.stores.find((store) => store.id === id)?.name ?? "Still sealed";
    const rumble = saturdayBout(s.data, "rumble");
    const title = saturdayBout(s.data, "championship");
    return {
      rumble: rumble?.result?.winnerIds[0] ? { winner: name(rumble.result.winnerIds[0]) } : null,
      championship: title?.result?.winnerIds[0]
        ? { winner: name(title.result.winnerIds[0]), runnerUp: name(title.result.loserIds[0]) }
        : null,
    };
  });
