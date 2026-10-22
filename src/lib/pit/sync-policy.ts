import type { Session } from "./types";
export function sameSession(a: Session, b: Session) {
  return a.role === b.role && a.storeId === b.storeId && a.crewId === b.crewId;
}
export function singleFlight(task: () => Promise<void>) {
  let active: Promise<void> | null = null;
  return () =>
    active ??
    (active = task().finally(() => {
      active = null;
    }));
}
