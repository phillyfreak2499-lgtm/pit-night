// @ts-nocheck -- shared runtime JS; behavior is covered by the gate tests.
// Web Crypto only: shared by the server and Vercel's asset-routing middleware.
const encoder = new TextEncoder();
const encode = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
const decode = (text) =>
  Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));
async function key(secret, purpose) {
  if (!/^[a-f\d]{64}$/i.test(secret ?? "")) throw new Error("Entry unavailable");
  const material = await crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode("pit-fundamentals-v1"),
      info: encoder.encode(purpose),
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function seal(value, secret, purpose) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await key(secret, purpose),
    encoder.encode(JSON.stringify(value)),
  );
  return encode(new Uint8Array([...iv, ...new Uint8Array(bytes)]));
}
export async function open(token, secret, purpose, now = Math.floor(Date.now() / 1000)) {
  try {
    if (!token || token.length > 2048) return null;
    const bytes = decode(token);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.slice(0, 12) },
      await key(secret, purpose),
      bytes.slice(12),
    );
    const data = JSON.parse(new TextDecoder().decode(plain));
    return Number.isFinite(data.exp) && data.exp > now ? data : null;
  } catch {
    return null;
  }
}
export function readCookie(request, name) {
  return (
    (request.headers.get("cookie") ?? "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(name + "="))
      ?.slice(name.length + 1) ?? ""
  );
}
export async function entryAllowed(request, secret, now) {
  const value = await open(readCookie(request, "pit_entry"), secret, "entry", now);
  return value?.version === 1;
}
export function platformPath(path) {
  return path.startsWith("/__grok/") || path === "/__app-env";
}
export function internalDestination(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020\u007f]/.test(value) ||
    value.startsWith("/entry") ||
    value.length > 2000
  )
    return "/";
  try {
    const url = new URL(value, "https://pit.invalid");
    return url.origin === "https://pit.invalid" && !url.pathname.startsWith("//")
      ? url.pathname + url.search + url.hash
      : "/";
  } catch {
    return "/";
  }
}
