/**
 * Three-way merge for the shared season. `base` is what this device last saw
 * from the league, `mine` is this device now, `theirs` is the league now.
 * Arrays of records merge item by item, so two bays checking off jobs at the
 * same time both land.
 */
type Json = unknown;

const same = (a: Json, b: Json) => a === b || JSON.stringify(a) === JSON.stringify(b);
const isObj = (v: Json): v is Record<string, Json> => typeof v === "object" && v !== null && !Array.isArray(v);

function keyOf(item: Json): string {
  if (typeof item === "string" || typeof item === "number") return `v:${item}`;
  if (isObj(item)) {
    if (typeof item.id === "string") return `id:${item.id}`;
    const parts = ["week", "number", "storeId", "crewId", "from", "target", "slot"].map((k) => String(item[k] ?? ""));
    if (parts.some(Boolean)) return `k:${parts.join("|")}`;
  }
  return `j:${JSON.stringify(item)}`;
}

/** Numbers that are running balances: both sides' changes add up instead of one winning. */
const COUNTERS = new Set(["voucher", "repairSpent", "boltsSpent"]);
const isCounter = (path: string[]) => COUNTERS.has(path.at(-1) ?? "") || path.at(-2) === "coins";

function mergeArray(base: Json[] | undefined, mine: Json[], theirs: Json[], path: string[]): Json[] {
  const b = new Map((base ?? []).map((x) => [keyOf(x), x]));
  const m = new Map(mine.map((x) => [keyOf(x), x]));
  const t = new Map(theirs.map((x) => [keyOf(x), x]));
  // Keys must be unique for item merging to make sense.
  if (m.size !== mine.length || t.size !== theirs.length) return same(mine, base) ? theirs : mine;
  const out: Json[] = [];
  const order = [...t.keys(), ...[...m.keys()].filter((k) => !t.has(k))];
  for (const k of order) {
    const bi = b.get(k);
    const mi = m.get(k);
    const ti = t.get(k);
    if (mi !== undefined && ti !== undefined) out.push(mergeValue(bi, mi, ti, [...path, k]));
    else if (mi !== undefined) {
      if (bi !== undefined && same(bi, mi)) continue; // they deleted it
      out.push(mi);
    } else if (ti !== undefined) {
      if (bi !== undefined && same(bi, ti)) continue; // I deleted it
      out.push(ti);
    }
  }
  return out;
}

export function mergeValue(base: Json, mine: Json, theirs: Json, path: string[] = []): Json {
  if (same(mine, theirs)) return mine;
  if (base !== undefined && same(mine, base)) return theirs;
  if (base !== undefined && same(theirs, base)) return mine;
  if (typeof base === "number" && typeof mine === "number" && typeof theirs === "number" && isCounter(path)) return theirs + (mine - base);
  if (Array.isArray(mine) && Array.isArray(theirs)) return mergeArray(Array.isArray(base) ? base : undefined, mine, theirs, path);
  if (isObj(mine) && isObj(theirs)) {
    const b = isObj(base) ? base : {};
    const out: Record<string, Json> = {};
    for (const k of new Set([...Object.keys(theirs), ...Object.keys(mine)])) {
      if (!(k in mine)) {
        if (k in b && same(b[k], theirs[k])) continue;
        out[k] = theirs[k];
      } else if (!(k in theirs)) {
        if (k in b && same(b[k], mine[k])) continue;
        out[k] = mine[k];
      } else out[k] = mergeValue(b[k], mine[k], theirs[k], [...path, k]);
    }
    return out;
  }
  return mine;
}
