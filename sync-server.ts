import { createServerFn } from "@tanstack/react-start";

export type SyncMode = "live" | "preview" | "off";
export type PullResult = { mode: SyncMode; rev: number; doc: string | null };
export type PushResult =
  | { mode: SyncMode; ok: true; rev: number }
  | { mode: SyncMode; ok: false; rev: number; doc: string | null; error?: string };

const ROW = "main";
const MAX = 4_000_000;

async function mode(): Promise<SyncMode> {
  const { dbSource } = await import("@/lib/db");
  if (dbSource === "neon") return "live";
  // An in-memory preview database on a deployed site would forget and split
  // the season between servers. Stay device-only until Neon is connected.
  return process.env.NODE_ENV === "production" ? "off" : "preview";
}

export const pullSeason = createServerFn({ method: "POST" })
  .validator((input: { rev: number }) => ({ rev: Number(input?.rev) || 0 }))
  .handler(async ({ data }): Promise<PullResult> => {
    const m = await mode();
    if (m === "off") return { mode: m, rev: 0, doc: null };
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ rev: number; doc: string }>`select rev, doc from pit_season where id = ${ROW}`;
    const row = rows[0];
    if (!row) return { mode: m, rev: 0, doc: null };
    return { mode: m, rev: Number(row.rev), doc: Number(row.rev) === data.rev ? null : row.doc };
  });

export const pushSeason = createServerFn({ method: "POST" })
  .validator((input: { baseRev: number; doc: string; force?: boolean }) => {
    if (typeof input?.doc !== "string" || input.doc.length > MAX) throw new Error("Season is missing or too large.");
    JSON.parse(input.doc);
    return { baseRev: Number(input.baseRev) || 0, doc: input.doc, force: Boolean(input.force) };
  })
  .handler(async ({ data }): Promise<PushResult> => {
    const m = await mode();
    if (m === "off") return { mode: m, ok: false, rev: 0, doc: null, error: "No shared database." };
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    if (data.force) {
      const rows = await sql<{ rev: number }>`
        insert into pit_season (id, rev, doc) values (${ROW}, 1, ${data.doc})
        on conflict (id) do update set rev = pit_season.rev + 1, doc = excluded.doc, updated_at = now()
        returning rev`;
      return { mode: m, ok: true, rev: Number(rows[0].rev) };
    }
    if (data.baseRev === 0) {
      const rows = await sql<{ rev: number }>`
        insert into pit_season (id, rev, doc) values (${ROW}, 1, ${data.doc})
        on conflict (id) do nothing returning rev`;
      if (rows[0]) return { mode: m, ok: true, rev: Number(rows[0].rev) };
    } else {
      const rows = await sql<{ rev: number }>`
        update pit_season set rev = rev + 1, doc = ${data.doc}, updated_at = now()
        where id = ${ROW} and rev = ${data.baseRev} returning rev`;
      if (rows[0]) return { mode: m, ok: true, rev: Number(rows[0].rev) };
    }
    const cur = await sql<{ rev: number; doc: string }>`select rev, doc from pit_season where id = ${ROW}`;
    return { mode: m, ok: false, rev: Number(cur[0]?.rev ?? 0), doc: cur[0]?.doc ?? null };
  });
