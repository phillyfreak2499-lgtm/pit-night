import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { commandArgs, type Command } from "./commands";
export type SyncMode = "live" | "preview" | "off";
export type PullResult = {
  mode: SyncMode;
  rev: number;
  doc: string | null;
  session: import("./types").Session;
};
const SCHEMA_TAG = "14-store-abilene-proposals-v1";
async function services() {
  const [db, store, auth, vanilla] = await Promise.all([
    import("@/lib/db"),
    import("./store"),
    import("./session.server"),
    import("zustand/vanilla"),
  ]);
  if (
    process.env.NODE_ENV === "production" &&
    db.dbSource !== "neon" &&
    process.env.PIT_ALLOW_PREVIEW_DB !== "1"
  )
    throw new Error(
      "The shared league database is not configured. League actions are unavailable.",
    );
  const sql = await db.getSql();
  const mode: SyncMode = db.dbSource === "neon" ? "live" : "preview";
  return { sql, store, auth, vanilla, mode };
}
async function load(options?: { deadlines?: boolean }) {
  const deadlines = options?.deadlines !== false;
  const s = await services();
  const seed = s.vanilla.createStore(s.store.pitCreator).getState();
  await s.sql`insert into pit_season (id, rev, doc) values ('main', 1, ${JSON.stringify(s.store.sharedDoc(seed))}) on conflict (id) do nothing`;
  for (let attempt = 0; attempt < 8; attempt++) {
    const row = (
      await s.sql<{ rev: number; doc: string; schema_tag: string }>`select rev, doc, schema_tag from pit_season where id = 'main'`
    )[0];
    if (!row) continue;
    // Normalize the persisted season before it can override the new 14-store seed.
    // This is intentionally additive: existing stores, work logs, builds, and results survive.
    const parsed = JSON.parse(row.doc) as import("./types").PitData;
    const normalized = s.store.applyLeague14(s.store.applyMondays(s.store.applyHulen(parsed)));
    const merged = { ...seed, ...s.store.sharedDoc(normalized) };
    const due = deadlines ? s.store.applyDueLock(merged, new Date()) : null;
    const effective = due ?? merged;
    const normalizedDoc = JSON.stringify(s.store.sharedDoc(effective));
    let rev = Number(row.rev);
    let doc = row.doc;
    if (normalizedDoc !== row.doc || row.schema_tag !== SCHEMA_TAG) {
      const changed = await s.sql<{ rev: number }>`
        update pit_season
        set rev = rev + 1, doc = ${normalizedDoc}, schema_tag = ${SCHEMA_TAG}, updated_at = now()
        where id = 'main' and rev = ${row.rev}
        returning rev
      `;
      if (!changed[0]) continue; // A concurrent command won. Read again, up to 8 tries.
      rev = Number(changed[0].rev);
      doc = normalizedDoc;
    }
    const data = { ...s.store.sharedDoc(effective), tutorialSeen: false, session: s.auth.publicSession };
    return { ...s, row: { rev, doc, schema_tag: SCHEMA_TAG }, data };
  }
  throw new Error("The league is busy. Please try again.");
}
/** Server-only: the normalized season for other server functions (Claude copy, the Monday job). */
export async function loadSeason() {
  return load();
}
export const pullSeason = createServerFn({ method: "POST" })
  .validator(z.object({ rev: z.number().int() }))
  .handler(async ({ data: input }): Promise<PullResult> => {
    const quick = await services();
    const meta = (
      await quick.sql<{ rev: number; schema_tag: string; phase: string | null }>`
        select rev, schema_tag, doc::json->>'phase' as phase from pit_season where id = 'main'
      `
    )[0];
    const { anyDeadlineDue } = await import("./time");
    const closed = meta?.phase != null && meta.phase !== "open";
    const unchanged = meta?.schema_tag === SCHEMA_TAG && Number(meta.rev) === input.rev;
    // A closed week does not re-run the deadline normalizer on every poll.
    // An open week still loads once a scheduled lock can be due, so it freezes without a Desk button.
    if (unchanged && (closed || !anyDeadlineDue(new Date()))) {
      // Verify expiry and credential generation on every pull, even unchanged ones.
      return { mode: quick.mode, rev: Number(meta.rev), doc: null, session: await quick.auth.session() };
    }
    const s = await load({ deadlines: !closed });
    const session = await s.auth.session(s.data);
    return {
      mode: s.mode,
      rev: Number(s.row.rev),
      doc:
        input.rev === Number(s.row.rev) ? null : JSON.stringify(s.store.clientDoc(s.data, session)),
      session,
    };
  });
export const signIn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        role: z.enum(["crew", "captain", "commissioner"]),
        storeId: z.string().max(120).nullable(),
        crewId: z.string().max(120).nullable(),
        code: z.string().max(100),
      })
      .strict(),
  )
  .handler(async ({ data }) => {
    const s = await load();
    return s.auth.login(s.data, data.role, data.storeId, data.crewId, data.code);
  });
export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const { logout } = await import("./session.server");
  await logout();
});
export const setAccessCode = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().max(120), code: z.string().regex(/^\d{4,8}$/) }).strict())
  .handler(async ({ data }) => {
    const s = await load();
    if ((await s.auth.session(s.data)).role !== "commissioner")
      throw new Error("Only the Desk changes access codes.");
    if (
      data.id !== "desk" &&
      !s.data.stores.some(
        (store: import("./types").Store) =>
          data.id === `bay:${store.id}` || data.id === `captain:${store.id}`,
      )
    )
      throw new Error("Unknown credential.");
    await s.auth.changeCredential(data.id, data.code);
  });
export const getStoreCodes = createServerFn({ method: "POST" }).handler(async () => {
  const s = await load();
  if ((await s.auth.session(s.data)).role !== "commissioner")
    throw new Error("Only the Desk can view store codes.");
  return s.auth.readStoreCodes(s.data);
});
export const rotateAllStoreCodes = createServerFn({ method: "POST" }).handler(async () => {
  const s = await load();
  s.auth.sameOrigin();
  if ((await s.auth.session(s.data)).role !== "commissioner")
    throw new Error("Only the Desk can rotate store codes.");
  return s.auth.rotateStoreCodes(s.data);
});
export const mutateSeason = createServerFn({ method: "POST" })
  .validator((input: { name: string; args: unknown[] }) => {
    if (!input || !Object.hasOwn(commandArgs, input.name))
      throw new Error("Unknown league command.");
    const name = input.name as Command;
    return { name, args: commandArgs[name].parse(input.args) as unknown[] };
  })
  .handler(async ({ data: input }) => {
    const { authorize, captainBuildRejection } = await import("./commands");
    for (let attempt = 0; attempt < 8; attempt++) {
      const s = await load();
      s.auth.sameOrigin();
      const session = await s.auth.session(s.data);
      authorize(s.data, session, input.name, input.args);
      const buildRejection = captainBuildRejection(input.name, session.role, s.data.week, new Date(), {
        data: s.data,
        args: input.args,
      });
      if (buildRejection) throw new Error(buildRejection);
      const state = s.vanilla.createStore(s.store.pitCreator);
      state.setState({ ...s.data, session, flash: "" });
      if (input.name === "submitSpark") {
        const { programWeek } = await import("./training");
        const [week, day, answers] = input.args as [number, string, number[]];
        const questions = programWeek(week)?.days.find((d) => d.day === day)?.spark;
        if (!questions || answers.some((a, i) => a >= questions[i]!.choices.length))
          throw new Error("Invalid Spark answers.");
        state
          .getState()
          .submitSpark(
            week,
            day,
            answers.filter((a, i) => a === questions[i]!.answer).length,
            questions.length,
          );
      } else {
        (state.getState()[input.name] as (...args: unknown[]) => unknown)(...input.args);
      }
      const result = state.getState();
      const doc = JSON.stringify(s.store.sharedDoc(result));
      const rows = await s.sql<{
        rev: number;
      }>`update pit_season set rev = rev + 1, doc = ${doc}, updated_at = now() where id = 'main' and rev = ${s.row.rev} returning rev`;
      if (rows[0])
        return {
          rev: Number(rows[0].rev),
          doc: JSON.stringify(s.store.clientDoc(result, session)),
          flash: result.flash,
          mode: s.mode,
          session,
        };
    }
    throw new Error("The league is busy. Please try again.");
  });
