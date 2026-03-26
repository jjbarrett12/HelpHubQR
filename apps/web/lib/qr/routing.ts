/**
 * QR routing decision helpers.
 * Resolve qrId -> property/location; decide guest vs staff entry.
 */

export type QrResolveResult = {
  property: { id: string; name: string; branding: Record<string, unknown> };
  location: { id: string; type: string; identifier: string };
  mode_default: "auto" | "guest" | "staff";
};

/**
 * Returns true if the app should show staff UI for this QR (e.g. valid staff session or mode_default staff).
 */
export function shouldShowStaff(
  modeDefault: "auto" | "guest" | "staff",
  hasValidStaffSession: boolean
): boolean {
  if (modeDefault === "staff") return true;
  if (modeDefault === "guest") return false;
  return hasValidStaffSession;
}

/**
 * Guest entry URL for a qrId.
 */
export function guestUrl(qrId: string): string {
  return `/guest/${encodeURIComponent(qrId)}`;
}

/**
 * Staff entry URL for a qrId.
 */
export function staffUrl(qrId: string): string {
  return `/staff/${encodeURIComponent(qrId)}`;
}
