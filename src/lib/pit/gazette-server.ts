/**
 * The Gazette writer, entirely on the server and for the Desk only: the league
 * brief is built from the saved season (never sent by a browser), Claude is
 * called through the shared Haiku helper, and the edition is saved with the
 * same revision check as every other league command. No key is a normal state:
 * the writer reports "no-key" and the Gazette keeps running on the template writer.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type WriteGazetteResult =
  | { ok: true; count: number }
  | { ok: false; reason: "no-key" | "api-error" | "bad-response" | "nothing-to-recap" | "busy" };

export const writeGazette = createServerFn({ method: "POST" })
  .validator(z.object({ mode: z.enum(["daily", "recap"]) }).strict())
  .handler(async ({ data: input }): Promise<WriteGazetteResult> => {
    const [{ loadSeason }, gazette, claude, { unsupportedNumbers }] = await Promise.all([
      import("./authoritative"),
      import("./gazette-ai"),
      import("./claude.server"),
      import("./claude-copy"),
    ]);
    const first = await loadSeason();
    first.auth.sameOrigin();
    if ((await first.auth.session(first.data)).role !== "commissioner")
      throw new Error("Only the Desk can write the Gazette.");
    const mode = input.mode;
    if (mode === "recap" && !first.data.bouts.some((b) => b.week === first.data.week && b.result))
      return { ok: false, reason: "nothing-to-recap" };

    // Write once from the facts as saved right now.
    const today = gazette.centralISODate(new Date());
    const brief = gazette.buildGazetteBrief(first.data, mode, today);
    const { system, prompt, maxTokens } = gazette.gazetteRequest(brief, mode);
    const prose = (drafts: { headline: string; body: string }[]) => drafts.map((d) => `${d.headline} ${d.body}`).join(" ");
    let drafts: ReturnType<typeof gazette.parseGazetteEntries> = [];
    try {
      drafts = gazette.parseGazetteEntries((await claude.askClaude({ feature: "gazette", system, prompt, maxTokens })).text, mode);
      // A number the brief does not contain means an invented stat: ask once more, then refuse.
      const invented = unsupportedNumbers(prose(drafts), brief);
      if (invented.length) {
        const retry = `${prompt}\n\nYour last edition used numbers that are not in the brief: ${invented.join(", ")}. Rewrite it using only numbers from the brief.`;
        drafts = gazette.parseGazetteEntries((await claude.askClaude({ feature: "gazette", system, prompt: retry, maxTokens })).text, mode);
        if (unsupportedNumbers(prose(drafts), brief).length) return { ok: false, reason: "bad-response" };
      }
    } catch (err) {
      const noKey = err instanceof claude.ClaudeUnavailable && /isn't reaching/.test(err.message);
      return { ok: false, reason: noKey ? "no-key" : "api-error" };
    }
    if (!drafts.length) return { ok: false, reason: "bad-response" };

    // Save through the Desk's own store actions, retrying only on a concurrent change.
    for (let attempt = 0; attempt < 8; attempt++) {
      const s = attempt === 0 ? first : await loadSeason();
      const state = s.vanilla.createStore(s.store.pitCreator);
      state.setState({ ...s.data, session: { role: "commissioner", storeId: null, crewId: null }, flash: "" });
      if (mode === "daily") state.getState().postDailyGazette(drafts, today);
      else state.getState().postRecapGazette(s.data.week, gazette.recapEntries(s.data, drafts));
      const doc = JSON.stringify(s.store.sharedDoc(state.getState()));
      const rows = await s.sql<{ rev: number }>`update pit_season set rev = rev + 1, doc = ${doc}, updated_at = now() where id = 'main' and rev = ${s.row.rev} returning rev`;
      if (rows[0]) return { ok: true, count: drafts.length };
    }
    return { ok: false, reason: "busy" };
  });
