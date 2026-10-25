/**
 * Original-name and banner checks for pit cosmetics.
 * Sponsor art must not use real trademarks. Player banners get the same
 * trademark list plus a profanity filter. No Node APIs, so the client can import it.
 */

/** @type {readonly string[]} */
export const TRADEMARK_NEEDLES = [
  "snap-on",
  "snapon",
  "dewalt",
  "milwaukee",
  "makita",
  "craftsman",
  "honda",
  "yamaha",
  "kawasaki",
  "monster",
  "red bull",
  "redbull",
  "mobil",
  "castrol",
  "pennzoil",
  "valvoline",
  "nike",
  "adidas",
  "gatorade",
  "coca-cola",
  "cocacola",
  "pepsi",
  "disney",
  "marvel",
  "pokemon",
  "nintendo",
  "ferrari",
  "porsche",
  "lamborghini",
  "nascar",
  "stihl",
  "husqvarna",
  "caterpillar",
  "john deere",
  "deere",
  "goodyear",
  "michelin",
  "bridgestone",
  "bosch",
  "black decker",
  "black+decker",
  "ryobi",
  "hilti",
  "starbucks",
  "mcdonald",
  "formula 1",
  "ghostbusters",
  "ecto",
];

/** @type {readonly string[]} */
const STEMS = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "dick",
  "cock",
  "pussy",
  "slut",
  "whore",
  "faggot",
  "nigger",
  "nigga",
  "retard",
  "porn",
  "rape",
  "wank",
  "piss",
  "tits",
  "boob",
  "damn",
];

/** Whole banners that contain a stem by accident. */
const SAFE_FOLDED = new Set(["peacock", "grape", "drape", "scrape"]);

/**
 * @param {string} word
 */
function foldWord(word) {
  return word
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/@/g, "a")
    .replace(/\$/g, "s");
}

/**
 * @param {string} text
 */
function foldAll(text) {
  return foldWord(text).replace(/[^a-z]/g, "");
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function findTrademarkHits(text) {
  const raw = String(text ?? "").toLowerCase();
  const words = raw.split(/[^a-z0-9]+/).filter(Boolean);
  const singles = new Set(words);
  const pairs = new Set(words.slice(0, -1).map((word, i) => word + words[i + 1]));
  /** @type {string[]} */
  const hits = [];
  for (const needle of TRADEMARK_NEEDLES) {
    const squashed = needle.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!squashed) continue;
    if (singles.has(squashed) || pairs.has(squashed)) hits.push(needle);
  }
  return hits;
}

/**
 * @param {string} text
 */
export function abusiveBanner(text) {
  const folded = foldAll(text);
  if (!folded || SAFE_FOLDED.has(folded)) return false;
  if (STEMS.some((stem) => folded.includes(stem))) return true;
  const tokens = String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(foldWord);
  return tokens.includes("kys");
}

/**
 * Bot and team names use the banner trademark and profanity policy.
 * The caller keeps its own length limit (22 for a bot, 40 for a team).
 * @param {string} text
 * @returns {string | null}
 */
export function blockedName(text) {
  const collapsed = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!collapsed) return null;
  if (abusiveBanner(collapsed) || findTrademarkHits(collapsed).length > 0) return "That name isn't allowed.";
  return null;
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, text: string } | { ok: false, reason: string }}
 */
export function bannerVerdict(raw) {
  const collapsed = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!collapsed) return { ok: true, text: "" };
  if (collapsed.length > 12) return { ok: false, reason: "Banner is 12 characters max." };
  if (!/^[A-Za-z0-9 &'!?.,-]+$/.test(collapsed))
    return { ok: false, reason: "Use letters, numbers, and simple marks." };
  if (abusiveBanner(collapsed) || findTrademarkHits(collapsed).length > 0)
    return { ok: false, reason: "That banner isn't allowed." };
  return { ok: true, text: collapsed };
}
