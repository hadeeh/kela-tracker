import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const hashBuf = Buffer.from(scryptSync(password, salt, 64));
  const keyBuf = Buffer.from(key, "hex");
  if (hashBuf.length !== keyBuf.length) return false;
  return timingSafeEqual(hashBuf, keyBuf);
}
