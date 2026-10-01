import { useSyncExternalStore } from "react";
import { commandArgs, type Command } from "./commands";
import { usePit, type PitState } from "./store";
import {
  mutateSeason,
  pullSeason,
  setAccessCode,
  signIn,
  signOut,
  type SyncMode,
} from "./sync-server";
import type { Session } from "./types";
export type SyncStatus = {
  mode: SyncMode | "starting";
  state: "idle" | "saving" | "error" | "mismatch";
  lastSync: number | null;
  error: string;
};
let status: SyncStatus = { mode: "starting", state: "idle", lastSync: null, error: "" };
const listeners = new Set<() => void>();
let rev = 0;
let started = false;
let queue = Promise.resolve();
let pending = 0;
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}
function apply(doc: string | null, next: number, session: Session) {
  // An older poll response cannot overwrite a just-completed command.
  if (next < rev) return;
  rev = next;
  usePit.setState({ ...(doc ? JSON.parse(doc) : {}), session });
}
function enqueue(task: () => Promise<void>) {
  pending++;
  setStatus({ state: "saving", error: "" });
  queue = queue
    .then(task)
    .then(() =>
      setStatus({ state: pending > 1 ? "saving" : "idle", lastSync: Date.now(), error: "" }),
    )
    .catch((err: unknown) => {
      const error = err instanceof Error ? err.message : "Could not reach the league. Try again.";
      usePit.setState({ flash: error });
      setStatus({ state: "error", error });
    })
    .finally(() => {
      pending--;
    });
  return queue;
}
function command(name: Command, args: unknown[]) {
  return enqueue(async () => {
    const res = await mutateSeason({ data: { name, args } });
    apply(res.doc, res.rev, res.session);
    usePit.setState({ flash: res.flash });
    setStatus({ mode: res.mode });
  });
}
export function submitDailySpark(week: number, day: string, answers: number[]) {
  return command("submitSpark", [week, day, answers]);
}
async function login(
  role: "crew" | "captain" | "commissioner",
  storeId: string | null,
  crewId: string | null,
  code: string,
) {
  let ok = false;
  await enqueue(async () => {
    const session = await signIn({ data: { role, storeId, crewId, code } });
    const res = await pullSeason({ data: { rev: 0 } });
    apply(res.doc, res.rev, session);
    usePit.setState({ session, flash: "Signed in. Your role is verified by the league." });
    ok = true;
  });
  return ok;
}
async function poll() {
  if (pending) return;
  try {
    let res = await pullSeason({ data: { rev } });
    if (pending) return;
    if (!res.doc && JSON.stringify(res.session) !== JSON.stringify(usePit.getState().session))
      res = await pullSeason({ data: { rev: 0 } });
    if (pending) return;
    apply(res.doc, res.rev, res.session);
    setStatus({ mode: res.mode, state: "idle", error: "", lastSync: Date.now() });
  } catch (err) {
    setStatus({
      state: "error",
      error: err instanceof Error ? err.message : "Could not reach the league.",
    });
  }
}
/** Only verified server responses update the league. No local document upload or merge. */
export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  // Clear legacy credential-bearing browser caches before reading the server.
  try {
    localStorage.removeItem("pit-night-sync-v1");
  } catch {
    /* Storage may be disabled. Server sync still works. */
  }
  const overrides: Partial<PitState> = { session: { role: "public", storeId: null, crewId: null } };
  for (const name of Object.keys(commandArgs) as Command[]) {
    (overrides as Record<string, unknown>)[name] = (...args: unknown[]) => {
      void command(name, args);
    };
  }
  overrides.signCaptain = (storeId, code) => login("captain", storeId, null, code);
  overrides.signCrew = (storeId, crewId, code = "") => login("crew", storeId, crewId, code);
  overrides.signCommissioner = (code) => login("commissioner", null, null, code);
  overrides.signPublic = () => {
    void enqueue(async () => {
      await signOut();
      const res = await pullSeason({ data: { rev: 0 } });
      apply(res.doc, res.rev, res.session);
    });
  };
  overrides.setPin = (code) => {
    void enqueue(async () => {
      await setAccessCode({ data: { id: "desk", code } });
      const res = await pullSeason({ data: { rev: 0 } });
      apply(res.doc, res.rev, res.session);
      usePit.setState({
        flash: "Desk PIN changed. Sign in again.",
      });
    });
  };
  overrides.setPasscode = (storeId, code) => {
    void enqueue(async () => {
      await setAccessCode({ data: { id: `captain:${storeId}`, code } });
      usePit.setState({ flash: "Captain code changed. Existing captain sessions are revoked." });
    });
  };
  usePit.setState(overrides);
  void poll();
  setInterval(() => {
    if (document.visibilityState === "visible") void poll();
  }, 4000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void poll();
  });
}
export async function sendThisSeason() {
  throw new Error("Whole-season uploads are disabled. League changes must use verified actions.");
}
export async function takeLeagueSeason() {
  await queue;
  rev = 0;
  await poll();
}
export function useSyncStatus() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => status,
    () => status,
  );
}
