import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function deskOnly() {
  const [{ loadSeason }, auth, { getSql }] = await Promise.all([
    import("./authoritative"),
    import("./session.server"),
    import("@/lib/db"),
  ]);
  const season = await loadSeason();
  if ((await auth.session(season.data)).role !== "commissioner") throw new Error("Only the Desk can manage reminders.");
  return { auth, data: season.data, sql: await getSql() };
}

/** Desk only: store addresses, setup status, pause switch and the last week of sends. */
export const reminderStatus = createServerFn({ method: "POST" }).handler(async () => {
  const { sql } = await deskOnly();
  const nudges = await import("./nudge.server");
  const contacts = await nudges.contacts(sql);
  const log = await sql<{ day: string; store_id: string; status: string; detail: string | null }>`
    select day, store_id, status, detail from pit_nudge_log order by sent_at desc limit 40`;
  return {
    email: nudges.emailConfigured(),
    cronSecret: Boolean(process.env.CRON_SECRET?.trim()),
    paused: await nudges.paused(sql),
    contacts: Object.fromEntries(contacts.map((c) => [c.store_id, c.email])),
    log,
  };
});

export const saveStoreEmail = createServerFn({ method: "POST" })
  .validator(z.object({ storeId: z.string().min(1).max(120), email: z.string().max(200) }).strict())
  .handler(async ({ data: input }) => {
    const { auth, data, sql } = await deskOnly();
    auth.sameOrigin();
    if (!data.stores.some((s) => s.id === input.storeId)) throw new Error("Unknown store.");
    const email = input.email.trim();
    if (!email) {
      await sql`delete from pit_store_contacts where store_id = ${input.storeId}`;
      return { ok: true };
    }
    const { validEmail } = await import("./nudge.server");
    if (!validEmail(email)) throw new Error("That doesn't look like an email address.");
    await sql`
      insert into pit_store_contacts (store_id, email) values (${input.storeId}, ${email})
      on conflict (store_id) do update set email = excluded.email, updated_at = now()`;
    return { ok: true };
  });

export const setRemindersPaused = createServerFn({ method: "POST" })
  .validator(z.object({ paused: z.boolean() }).strict())
  .handler(async ({ data: input }) => {
    const { auth, sql } = await deskOnly();
    auth.sameOrigin();
    await sql`
      insert into pit_nudge_settings (id, paused) values ('main', ${input.paused})
      on conflict (id) do update set paused = excluded.paused`;
    return { paused: input.paused };
  });

/** Send one store its reminder now, or a sample when today has nothing to remind about. Not logged as the daily send. */
export const sendTestReminder = createServerFn({ method: "POST" })
  .validator(z.object({ storeId: z.string().min(1).max(120) }).strict())
  .handler(async ({ data: input }) => {
    const { auth, data, sql } = await deskOnly();
    auth.sameOrigin();
    const [{ nudgeFor, SITE }, nudges] = await Promise.all([import("./nudge"), import("./nudge.server")]);
    const to = (await nudges.contacts(sql)).find((c) => c.store_id === input.storeId)?.email;
    if (!to) throw new Error("Save an email for that store first.");
    const store = data.stores.find((s) => s.id === input.storeId);
    const real = nudgeFor(data, input.storeId, new Date());
    const subject = `[Test] ${real?.subject ?? `${store?.name ?? "Your store"}: Battle Bot League reminders are on`}`;
    const text =
      real?.text ??
      `This is a test from the Waterman Battle Bot League Desk.\n\nOn Pit Week days at 8 a.m. Central, this address will get a short list of what the store still has to do: jobs, the Daily Spark, coins waiting in the Shop, and lock day.\n\n${SITE}`;
    const html = real?.html ?? `<p>${text.replace(/\n/g, "<br>")}</p>`;
    await nudges.sendEmail(to, subject, text, html);
    return { ok: true, to };
  });
