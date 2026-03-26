import { createHash, randomBytes } from "crypto";

/** SHA-256 hex of UTF-8 trimmed raw token (must match Postgres digest(trim(raw), 'sha256')). */
export function hashRoomToken(rawToken: string): string {
  return createHash("sha256").update(rawToken.trim(), "utf8").digest("hex");
}

/** Cryptographically strong opaque token for /t/[token] URLs (never persist plaintext). */
export function generateRawRoomToken(): string {
  return randomBytes(24).toString("hex");
}
