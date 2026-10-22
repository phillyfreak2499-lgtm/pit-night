// @ts-nocheck -- shared runtime JS; behavior is covered by the gate tests.
import {
  seal,
  open,
  readCookie,
  entryAllowed,
  internalDestination,
  platformPath,
} from "./entry-crypto.mjs";
const nowSeconds = () => Math.floor(Date.now() / 1000);
function distance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}
export function answerMatches(n, answer) {
  if (typeof answer !== "string" || answer.length > 200 || !/^[1-5]$/.test(String(n))) return false;
  if (/\b(?:no|not|never|don't|dont|without|avoid|skip)\b/i.test(answer)) return false;
  let input = answer
    .toLowerCase()
    .replace(/\bthree\b/g, "3")
    .replace(/\bevery\s+one\b/g, "everyone")
    .replace(/\bevery\s+client\b/g, "eachclient")
    .replace(/\bgets\b/g, "get")
    .replace(/[^a-z0-9]/g, "");
  if (
    /dont|donot|never|without|noreferral|noreview|notseat|notfit|notclose|notfollow|notget/.test(
      input,
    )
  )
    return false;
  const phrases = {
    1: ["seateveryoneinstantly"],
    2: ["fiteveryone"],
    3: ["close3stepsystems"],
    4: ["followupwitheachclient", "followupeachclient"],
    5: ["getreferralsandreviews", "referralsandreviews"],
  };
  // Whole-phrase bounds prevent missing concepts or added negation from passing.
  return phrases[n].some(
    (expected) => distance(input, expected) <= (n === 5 ? 3 : n === 2 ? 1 : 2),
  );
}
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
function html(n, next, error = "") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Enter the Pit</title><style>*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 50% 0,#302314,#0e0d0b 65%);color:#f3efe6;font:16px/1.5 system-ui,sans-serif}main{width:min(100%,460px);border:1px solid #4b4233;background:#171510;padding:clamp(24px,6vw,40px);box-shadow:0 24px 90px #0008;border-top:4px solid #e8a33d}.eyebrow{color:#e8a33d;letter-spacing:.2em;font-size:11px;font-weight:800}h1{font:900 clamp(32px,8vw,46px)/1.05 Impact,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.02em;margin:16px 0 20px}label{display:block;font-weight:700;margin-bottom:10px}input,button{width:100%;min-height:48px;border:1px solid #70604b;font:inherit}input{background:#0e0d0b;color:#fff;padding:12px}button{background:#e8a33d;color:#15110b;font-weight:800;margin-top:16px;cursor:pointer}input:focus-visible,button:focus-visible{outline:3px solid #fff;outline-offset:4px}.note{font-size:13px;color:#bdb4a6}.error{color:#ffc49a}footer{border-top:1px solid #4b4233;margin-top:24px;padding-top:16px;color:#bdb4a6;font-size:12px}</style></head><body><main><p class="eyebrow">THE WATERMAN BATTLE BOT LEAGUE</p><h1>Know the fundamentals.<br>Enter the Pit.</h1><form method="post" action="/entry"><input type="hidden" name="next" value="${escape(next)}"><label for="answer">What is key fundamental #${n}?</label><input id="answer" name="answer" maxlength="200" autocomplete="off" required autofocus aria-describedby="hint${error ? " error" : ""}"><p id="hint" class="note">Write the fundamental in your own words. Small spelling or spacing mistakes are okay.</p>${error ? `<p id="error" role="alert" class="error">${escape(error)}</p>` : ""}<button type="submit">OPEN THE PIT &rarr;</button></form><footer>Once inside, use your store code to sign in.<br>Access lasts eight hours on this browser.</footer></main></body></html>`;
}
/** @param {Request} request
 * @param {{secret?:string,now?:number,countAttempt?:(request:Request)=>Promise<number>}} options */
/** @param {Request} request
 * @param {{secret?:string,now?:number,countAttempt?:(request:Request)=>Promise<number>}} options */
export async function handleFundamentalsRequest(
  request,
  { secret = process.env.PIT_CODE_VAULT_KEY, now = nowSeconds(), countAttempt } = {},
) {
  const url = new URL(request.url);
  if (platformPath(url.pathname)) return null;
  const headers = new Headers({
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow",
    vary: "Cookie",
    "x-content-type-options": "nosniff",
    "referrer-policy": "same-origin",
  });
  if (!/^[a-f\d]{64}$/i.test(secret ?? ""))
    return new Response("The entrance is temporarily unavailable.", { status: 503, headers });
  if (await entryAllowed(request, secret, now)) {
    if (url.pathname === "/entry" && request.method === "GET") {
      headers.set("location", internalDestination(url.searchParams.get("next")));
      return new Response(null, { status: 303, headers });
    }
    return null;
  }
  const isEntry = url.pathname === "/entry";
  if (!isEntry) {
    if (request.method === "GET" && request.headers.get("accept")?.includes("text/html")) {
      headers.set("location", "/entry?next=" + encodeURIComponent(url.pathname + url.search));
      return new Response(null, { status: 303, headers });
    }
    return new Response("Complete the fundamentals check at /entry.", { status: 401, headers });
  }
  const secure = url.protocol === "https:" ? "; Secure" : "";
  const cookie = (name, value, age) =>
    `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure}`;
  let challenge = await open(readCookie(request, "pit_challenge"), secret, "challenge", now);
  let error = "",
    status = 200;
  let next = internalDestination(url.searchParams.get("next"));
  if (request.method === "POST") {
    if (request.headers.get("origin") !== url.origin)
      return new Response("Use this site to enter.", { status: 403, headers });
    const size = Number(request.headers.get("content-length") ?? 0);
    if (size > 4096) return new Response("Answer too long.", { status: 413, headers });
    const body = await request.text();
    if (body.length > 4096) return new Response("Answer too long.", { status: 413, headers });
    const form = new URLSearchParams(body);
    next = internalDestination(form.get("next"));
    // The adapter persists attempts in PostgreSQL; resetting a browser cookie cannot reset the limit.
    if (!countAttempt)
      return new Response("The entrance is temporarily unavailable.", { status: 503, headers });
    const count = await countAttempt(request);
    if (count > 20) {
      status = 429;
      error = "Too many attempts. Try again in five minutes.";
      headers.set("retry-after", "300");
    } else if (!challenge) {
      status = 400;
      error = "That question expired. Try the new question below.";
    } else if (answerMatches(challenge.n, form.get("answer"))) {
      headers.append(
        "set-cookie",
        cookie("pit_entry", await seal({ version: 1, exp: now + 28800 }, secret, "entry"), 28800),
      );
      headers.append("set-cookie", cookie("pit_challenge", "", 0));
      headers.set("location", next);
      return new Response(null, { status: 303, headers });
    } else {
      status = 400;
      error =
        "That does not match this fundamental. Check the number and try again; minor typos are okay.";
    }
  } else if (request.method !== "GET" && request.method !== "HEAD")
    return new Response("Method not allowed", { status: 405, headers });
  if (!challenge) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    challenge = { n: (values[0] % 5) + 1, exp: now + 600 };
    headers.append(
      "set-cookie",
      cookie("pit_challenge", await seal(challenge, secret, "challenge"), 600),
    );
  }
  headers.set("content-type", "text/html; charset=utf-8");
  return new Response(request.method === "HEAD" ? null : html(challenge.n, next, error), {
    status,
    headers,
  });
}
