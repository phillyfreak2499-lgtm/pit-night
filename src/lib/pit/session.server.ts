import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  getCookie,
  setCookie,
  getRequestHeader,
  getRequestUrl,
} from "@tanstack/react-start/server";
import { getSql } from "@/lib/db";
import type { PitData, Session } from "./types";
const COOKIE = "pit_role";
const TTL = 8 * 60 * 60;
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
export function sameOrigin() {
  const origin = getRequestHeader("origin");
  if (origin && new URL(origin).origin !== getRequestUrl().origin)
    throw new Error("League actions must come from this site.");
}
export function passwordHash(secret: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(secret, salt, 32).toString("hex")}`;
}
function matches(secret: string, stored: string) {
  const [salt, value] = stored.split(":");
  if (!salt || !value) return false;
  const expected = Buffer.from(value, "hex");
  const actual = scryptSync(secret, salt, 32);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export const publicSession: Session = { role: "public", storeId: null, crewId: null };
function cookie(value: string, maxAge = TTL) {
  setCookie(COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
  });
}
export async function logout() {
  sameOrigin();
  const token = getCookie(COOKIE);
  const sql = await getSql();
  if (token) await sql`delete from pit_sessions where token_hash = ${digest(token)}`;
  cookie("", 0);
}
export async function session(data?: PitData): Promise<Session> {
  const token = getCookie(COOKIE);
  if (!token) return publicSession;
  const sql = await getSql();
  const rows = await sql<{
    identity: string;
  }>`select s.identity from pit_sessions s join pit_credentials c on c.id = s.credential_id and c.generation = s.generation where s.token_hash = ${digest(token)} and s.expires_at > now()`;
  if (!rows[0]) return publicSession;
  const identity = JSON.parse(rows[0].identity) as Session;
  if (
    data &&
    identity.role !== "commissioner" &&
    !data.crew.some(
      (c) =>
        c.id === identity.crewId &&
        c.storeId === identity.storeId &&
        c.role === (identity.role === "captain" ? "captain" : "specialist"),
    )
  )
    return publicSession;
  return identity;
}
async function credential(id: string) {
  const sql = await getSql();
  const rows = await sql<{
    hash: string;
    generation: number;
  }>`select hash, generation from pit_credentials where id = ${id}`;
  if (rows[0]) return rows[0];
  const [role, store] = id.split(":");
  let secret: string | undefined;
  if (role === "desk") secret = process.env.PIT_DESK_PIN;
  else {
    const raw = role === "captain" ? process.env.PIT_CAPTAIN_CODES : process.env.PIT_BAY_CODES;
    secret = raw ? (JSON.parse(raw) as Record<string, string>)[store!] : undefined;
  }
  if (!secret)
    throw new Error("The Desk must configure new server-side access codes before sign-in.");
  if (!/^\d{4,8}$/.test(secret)) throw new Error("Server access codes must contain 4 to 8 digits.");
  if (role === "captain" || role === "bay") {
    const otherId = `${role === "captain" ? "bay" : "captain"}:${store}`;
    const other = await sql<{
      hash: string;
    }>`select hash from pit_credentials where id = ${otherId}`;
    const raw = process.env[role === "captain" ? "PIT_BAY_CODES" : "PIT_CAPTAIN_CODES"];
    const otherSecret = raw ? (JSON.parse(raw) as Record<string, string>)[store!] : undefined;
    if ((other[0] && matches(secret, other[0].hash)) || otherSecret === secret)
      throw new Error("Crew and captain codes must be different.");
  }
  await sql`insert into pit_credentials (id, hash) values (${id}, ${passwordHash(secret)}) on conflict (id) do nothing`;
  return (
    await sql<{
      hash: string;
      generation: number;
    }>`select hash, generation from pit_credentials where id = ${id}`
  )[0]!;
}
export async function login(
  data: PitData,
  role: "crew" | "captain" | "commissioner",
  storeId: string | null,
  crewId: string | null,
  code: string,
): Promise<Session> {
  sameOrigin();
  if (role !== "commissioner" && !data.stores.some((s) => s.id === storeId))
    throw new Error("Unknown store.");
  const sql = await getSql();
  const key =
    role === "commissioner" ? "desk" : `${role === "captain" ? "captain" : "bay"}:${storeId}`;
  const attempts = await sql<{
    attempts: number;
  }>`insert into pit_login_attempts (id, attempts) values (${key}, 1) on conflict (id) do update set attempts = case when pit_login_attempts.window_at < now() - interval '5 minutes' then 1 else pit_login_attempts.attempts + 1 end, window_at = case when pit_login_attempts.window_at < now() - interval '5 minutes' then now() else pit_login_attempts.window_at end returning attempts`;
  if (attempts[0]!.attempts > 20)
    throw new Error("Too many sign-in attempts. Try again in five minutes.");
  const c = await credential(key);
  if (!matches(code.trim(), c.hash)) throw new Error("That code does not open this role.");
  let identity: Session = { role, storeId: null, crewId: null };
  if (role !== "commissioner") {
    if (!data.stores.some((s) => s.id === storeId)) throw new Error("Unknown store.");
    const member = data.crew.find(
      (c) =>
        c.storeId === storeId &&
        (role === "captain" ? c.role === "captain" : c.id === crewId && c.role === "specialist"),
    );
    if (!member) throw new Error("Choose a member of this store's crew.");
    identity = { role, storeId, crewId: member.id };
  }
  await logout();
  await sql`delete from pit_sessions where expires_at <= now()`;
  const token = randomBytes(32).toString("hex");
  await sql`insert into pit_sessions (token_hash, credential_id, generation, identity, expires_at) values (${digest(token)}, ${key}, ${c.generation}, ${JSON.stringify(identity)}, now() + interval '8 hours')`;
  cookie(token);
  await sql`delete from pit_login_attempts where id = ${key}`;
  return identity;
}
export async function changeCredential(id: string, code: string) {
  sameOrigin();
  if (!/^\d{4,8}$/.test(code)) throw new Error("Use 4 to 8 digits.");
  const sql = await getSql();
  if (id.startsWith("captain:") || id.startsWith("bay:")) {
    const otherId = id.startsWith("captain:")
      ? id.replace("captain:", "bay:")
      : id.replace("bay:", "captain:");
    const other = await sql<{
      hash: string;
    }>`select hash from pit_credentials where id = ${otherId}`;
    const raw = process.env[id.startsWith("captain:") ? "PIT_BAY_CODES" : "PIT_CAPTAIN_CODES"];
    const otherSecret = raw
      ? (JSON.parse(raw) as Record<string, string>)[id.split(":")[1]!]
      : undefined;
    if ((other[0] && matches(code, other[0].hash)) || otherSecret === code)
      throw new Error("Crew and captain codes must be different.");
  }
  await sql`insert into pit_credentials (id, hash) values (${id}, ${passwordHash(code)}) on conflict (id) do update set hash = excluded.hash, generation = pit_credentials.generation + 1`;
}
