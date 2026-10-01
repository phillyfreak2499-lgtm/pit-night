import { useSyncExternalStore } from "react";
import { VERSION } from "./catalog";
import { mergeValue } from "./merge";
import { sharedDoc, usePit, type SharedDoc } from "./store";
import { pullSeason, pushSeason, type SyncMode } from "./sync-server";

/**
 * Keeps one season across every phone and laptop. The device keeps its own
 * copy (so it works offline); this pulls the league copy every few seconds
 * and pushes local changes, merging when two devices changed things at once.
 */

export type SyncStatus = {
  mode: SyncMode | "starting";
  state: "idle" | "saving" | "error" | "mismatch";
  lastSync: number | null;
  error: string;
};

const META_KEY = "pit-night-sync-v1";
const POLL_MS = 6000;
const PUSH_DELAY = 700;

let status: SyncStatus = { mode: "starting", state: "idle", lastSync: null, error: "" };
const listeners = new Set<() => void>();
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  for (const l of listeners) l();
}

let rev = 0;
let baseJson: string | null = null;
let started = false;
let busy = false;
let again = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return;
    const meta = JSON.parse(raw) as { rev: number; base: string };
    rev = Number(meta.rev) || 0;
    baseJson = typeof meta.base === "string" ? meta.base : null;
  } catch {
    /* fresh device */
  }
}
function saveMeta() {
  try {
    if (baseJson) localStorage.setItem(META_KEY, JSON.stringify({ rev, base: baseJson }));
  } catch {
    /* storage full or blocked; we'll re-merge next load */
  }
}

const localJson = () => JSON.stringify(sharedDoc(usePit.getState()));

function apply(doc: SharedDoc) {
  usePit.setState({
    ...doc,
    jobLog: doc.jobLog ?? [],
    sparkLog: doc.sparkLog ?? [],
    shouts: doc.shouts ?? [],
    picks: doc.picks ?? [],
    trainingOpenAll: doc.trainingOpenAll ?? false,
    kickoff: doc.kickoff ?? { grades: {}, paid: {}, appliedAt: null },
  });
}

function readable(json: string): SharedDoc | null {
  try {
    const doc = JSON.parse(json) as SharedDoc;
    if (doc.version !== VERSION) {
      setStatus({ state: "mismatch", error: "The league is on a different version of the site. Reload this page." });
      return null;
    }
    return doc;
  } catch {
    return null;
  }
}

/** Bring a league copy in, merging over anything this device changed since its base. */
function absorb(theirsJson: string, theirRev: number) {
  const theirs = readable(theirsJson);
  if (!theirs) return false;
  const mine = localJson();
  if (baseJson === null || mine === baseJson) {
    apply(theirs);
  } else if (mine !== theirsJson) {
    const base = JSON.parse(baseJson) as SharedDoc;
    apply(mergeValue(base, JSON.parse(mine), theirs) as SharedDoc);
  }
  baseJson = theirsJson;
  rev = theirRev;
  saveMeta();
  return true;
}

async function cycle() {
  if (busy) {
    again = true;
    return;
  }
  busy = true;
  try {
    const pulled = await pullSeason({ data: { rev } });
    setStatus({ mode: pulled.mode });
    if (pulled.mode === "off") return;
    if (pulled.rev === 0) rev = 0; // empty league: this device seeds it
    if (pulled.doc !== null && pulled.rev !== rev && !absorb(pulled.doc, pulled.rev)) return;
    if (status.state === "mismatch") return;
    for (let tries = 0; tries < 4; tries++) {
      const mine = localJson();
      if (pulled.rev !== 0 && mine === baseJson) break;
      setStatus({ state: "saving" });
      const res = await pushSeason({ data: { baseRev: rev, doc: mine } });
      if (res.ok) {
        rev = res.rev;
        baseJson = mine;
        saveMeta();
        break;
      }
      if (res.error) throw new Error(res.error);
      if (res.doc !== null && !absorb(res.doc, res.rev)) return;
    }
    setStatus({ state: "idle", lastSync: Date.now(), error: "" });
  } catch (err) {
    setStatus({ state: "error", error: err instanceof Error ? err.message : "Could not reach the league." });
  } finally {
    busy = false;
    if (again) {
      again = false;
      void cycle();
    }
  }
}

/** Start syncing. Call once, after the device copy has loaded. */
export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  loadMeta();
  void cycle();
  setInterval(() => {
    if (document.visibilityState === "visible") void cycle();
  }, POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void cycle();
  });
  usePit.subscribe(() => {
    if (status.mode === "off" || status.mode === "starting") return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      if (localJson() !== baseJson) void cycle();
    }, PUSH_DELAY);
  });
}

/** Commissioner override: make this device's season the league's season. */
export async function sendThisSeason() {
  const doc = localJson();
  const res = await pushSeason({ data: { baseRev: rev, doc, force: true } });
  if (!res.ok) throw new Error(res.error ?? "Push failed.");
  rev = res.rev;
  baseJson = doc;
  saveMeta();
  setStatus({ state: "idle", lastSync: Date.now(), error: "" });
}

/** Throw away this device's unsent changes and take the league copy. */
export async function takeLeagueSeason() {
  const pulled = await pullSeason({ data: { rev: -1 } });
  if (pulled.doc) {
    const theirs = readable(pulled.doc);
    if (!theirs) return;
    apply(theirs);
    baseJson = pulled.doc;
    rev = pulled.rev;
    saveMeta();
  }
  setStatus({ mode: pulled.mode, state: "idle", lastSync: Date.now(), error: "" });
}

export function useSyncStatus() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
    () => status,
  );
}
