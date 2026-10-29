import type { Sql } from "../db";
import type { SyncMode } from "./authoritative";
import type { PitData, Session } from "./types";
import { clientDoc, sharedDoc } from "./store";
import {
  runHalloweenArcade,
  type HalloweenArcadeContext,
  type HalloweenArcadeInput,
  type HalloweenArcadeResult,
} from "./halloween-arcade";

export type HalloweenArcadeSnapshot = {
  sql: Pick<Sql, "query">;
  data: PitData;
  session: Session;
  rev: number;
  mode: SyncMode;
};

/** Execute against a verified season snapshot, reloading after a concurrent writer wins. */
export async function executeHalloweenArcade(
  input: HalloweenArcadeInput,
  load: () => Promise<HalloweenArcadeSnapshot>,
  context: () => HalloweenArcadeContext,
): Promise<HalloweenArcadeResult> {
  for (let retry = 0; retry < 8; retry++) {
    const season = await load();
    const transition = runHalloweenArcade(season.data, season.session, input, context());
    let rev = season.rev;
    if (transition.changed) {
      const updated = await season.sql.query<{ rev: number }>(
        "update pit_season set rev = rev + 1, doc = $1, updated_at = now() where id = 'main' and rev = $2 returning rev",
        [JSON.stringify(sharedDoc(transition.data)), season.rev],
      );
      if (!updated[0]) continue;
      rev = Number(updated[0].rev);
    }
    return {
      ...transition.result,
      doc: JSON.stringify(clientDoc(transition.data, season.session)),
      rev,
      session: season.session,
      mode: season.mode,
    };
  }
  throw new Error("The league is busy. Please try your Halloween game again.");
}
