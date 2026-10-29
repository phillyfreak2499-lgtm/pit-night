import { randomInt, randomUUID } from "node:crypto";
import { loadSeason } from "./authoritative";
import type { HalloweenArcadeInput, HalloweenArcadeResult } from "./halloween-arcade";
import { executeHalloweenArcade } from "./halloween-arcade-transaction";

/** A season revision commits the attempt, retry payment and reward together. */
export async function handleHalloweenArcade(
  input: HalloweenArcadeInput,
): Promise<HalloweenArcadeResult> {
  return executeHalloweenArcade(
    input,
    async () => {
      const season = await loadSeason();
      season.auth.sameOrigin();
      const session = await season.auth.session(season.data);
      return {
        sql: season.sql,
        data: season.data,
        session,
        rev: Number(season.row.rev),
        mode: season.mode,
      };
    },
    () => ({ now: Date.now(), randomInt: (max) => randomInt(max), newId: randomUUID }),
  );
}
