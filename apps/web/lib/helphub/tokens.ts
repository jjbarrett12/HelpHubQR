import { randomBytes } from "crypto";

/** Unguessable token for public checklist links (URL-safe). */
export function generateChecklistAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

const TOKEN_MIN_LEN = 32;

export function isLikelyChecklistToken(raw: string | undefined | null): raw is string {
  if (!raw || typeof raw !== "string") return false;
  const t = raw.trim();
  return t.length >= TOKEN_MIN_LEN && /^[A-Za-z0-9_-]+$/.test(t);
}
