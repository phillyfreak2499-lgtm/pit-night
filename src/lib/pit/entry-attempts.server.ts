import { createHash } from "node:crypto";
import { getSql } from "@/lib/db";
export async function countEntryAttempt(request: Request) {
  const address =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-pit-local-address") ??
    "unknown";
  const id = "entry:" + createHash("sha256").update(address.split(",")[0]!.trim()).digest("hex");
  const sql = await getSql();
  const rows = await sql<{
    attempts: number;
  }>`insert into pit_login_attempts (id, attempts) values (${id}, 1) on conflict (id) do update set attempts = case when pit_login_attempts.window_at < now() - interval '5 minutes' then 1 else pit_login_attempts.attempts + 1 end, window_at = case when pit_login_attempts.window_at < now() - interval '5 minutes' then now() else pit_login_attempts.window_at end returning attempts`;
  return Number(rows[0]!.attempts);
}
