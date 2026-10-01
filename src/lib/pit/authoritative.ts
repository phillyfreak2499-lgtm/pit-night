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
async function load() {
  const s = await services();
  const seed = s.vanilla.createStore(s.store.pitCreator).getState();
  await s.sql`insert into pit_season (id, rev, doc) values ('main', 1, ${JSON.stringify(s.store.sharedDoc(seed))}) on conflict (id) do nothing`;
  const row = (
    await s.sql<{ rev: number; doc: string }>`select rev, doc from pit_season where id = 'main'`
  )[0]!;
  // Copy data only. Store actions close over their own instance and must never be copied.
  const merged = { ...s.store.sharedDoc(seed), ...JSON.parse(row.doc) };
  const data = { ...s.store.sharedDoc(merged), tutorialSeen: false, session: s.auth.publicSession };
  return { ...s, row, data };
}
export const pullSeason = createServerFn({ method: "POST" })
  .validator(z.object({ rev: z.number().int() }))
  .handler(async ({ data: input }): Promise<PullResult> => {
    const s = await load();
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
export const mutateSeason = createServerFn({ method: "POST" })
  .validator((input: { name: string; args: unknown[] }) => {
    if (!input || !Object.hasOwn(commandArgs, input.name))
      throw new Error("Unknown league command.");
    const name = input.name as Command;
    return { name, args: commandArgs[name].parse(input.args) as unknown[] };
  })
  .handler(async ({ data: input }) => {
    const { authorize } = await import("./commands");
    for (let attempt = 0; attempt < 8; attempt++) {
      const s = await load();
      s.auth.sameOrigin();
      const session = await s.auth.session(s.data);
      authorize(s.data, session, input.name, input.args);
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
