import type { PersistStorage } from "zustand/middleware";
/** Project only when persisted fields change, not when flash/session/functions change. */
export function memoSnapshot<T extends object, U>(
  project: (state: T) => U,
  keys: readonly (keyof T)[],
) {
  let previous: T | undefined, snapshot: U;
  return (state: T): U => {
    if (!previous || keys.some((key) => previous![key] !== state[key])) snapshot = project(state);
    previous = state;
    return snapshot;
  };
}
export function snapshotStorage<T>(
  getStorage: () => Pick<Storage, "getItem" | "setItem" | "removeItem">,
): PersistStorage<T> {
  const previous = new Map<string, { state: T; version?: number }>();
  return {
    getItem(name) {
      try {
        const raw = getStorage().getItem(name);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    setItem(name, value) {
      const old = previous.get(name);
      if (old?.state === value.state && old?.version === value.version) return;
      try {
        getStorage().setItem(name, JSON.stringify(value));
        previous.set(name, value);
      } catch {
        /* Server sync remains usable with browser storage disabled. */
      }
    },
    removeItem(name) {
      previous.delete(name);
      try {
        getStorage().removeItem(name);
      } catch {
        /* Storage may be disabled. */
      }
    },
  };
}
