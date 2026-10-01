import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key() {
  const value = process.env.PIT_CODE_VAULT_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value))
    throw new Error("The Desk code panel needs its private server vault key configured.");
  return Buffer.from(value, "hex");
}
export function requireCodeVault() {
  key();
}
export function sealCode(id: string, code: string): string | null {
  if (!process.env.PIT_CODE_VAULT_KEY) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(id));
  const value = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), value].map((v) => v.toString("hex")).join(":");
}
export function openCode(id: string, sealed: string): string {
  const [iv, tag, value] = sealed.split(":");
  if (!iv || !tag || !value) throw new Error("Stored code could not be read. Set a new code.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "hex"));
  decipher.setAAD(Buffer.from(id));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(value, "hex")), decipher.final()]).toString(
    "utf8",
  );
}
