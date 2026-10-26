import type { Session } from "./types";
export function sameSession(a: Session, b: Session) {
  return a.role === b.role && a.storeId === b.storeId && a.crewId === b.crewId;
}
/**
 * League command arguments without a click event. A button wired as
 * onClick={action} hands React its click event as the first argument; that
 * event cannot be sent to the server, so the command would never arrive.
 */
export function leagueArgs(args: unknown[]): unknown[] {
  return args.filter(
    (arg) =>
      !(
        arg &&
        typeof arg === "object" &&
        ("nativeEvent" in arg || (typeof Event !== "undefined" && arg instanceof Event))
      ),
  );
}
export function singleFlight(task: () => Promise<void>) {
  let active: Promise<void> | null = null;
  return () =>
    active ??
    (active = task().finally(() => {
      active = null;
    }));
}
