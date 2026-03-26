import { randomBytes } from "crypto";

/** Un guessable URL segment; base64url, ~24 chars. */
export function generateQrSlug(): string {
  return randomBytes(18).toString("base64url");
}

export function isValidPublicQrSlug(raw: string): boolean {
  const s = raw.trim();
  return /^[A-Za-z0-9_-]{12,64}$/.test(s);
}
