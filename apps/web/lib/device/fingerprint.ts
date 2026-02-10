/**
 * Device fingerprint: install_id + property salt hash.
 * Used for rate limiting and device_id in qr_scans/task_events (no named employee tracking).
 */

import { createHmac } from "crypto";

const STORAGE_KEY = "helphub_install_id";

function getPropertySalt(): string {
  const salt = process.env.PROPERTY_SALT_SECRET;
  if (!salt) return "default-salt-change-in-production";
  return salt;
}

/**
 * Generate or read a stable install_id for this browser (localStorage).
 * In MVP we use a simple UUID-like string; no PII.
 */
export function getOrCreateInstallId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

/**
 * Server: hash(property_salt + install_id) for storage as device_id / rate-limit key.
 */
export function hashInstallId(propertySalt: string, installId: string): string {
  return createHmac("sha256", propertySalt).update(installId).digest("hex");
}

/**
 * Server: get hash for device identification when property_id is known.
 * Only call from server (uses env PROPERTY_SALT_SECRET).
 */
export function hashInstallIdForProperty(installId: string): string {
  return hashInstallId(getPropertySalt(), installId);
}
