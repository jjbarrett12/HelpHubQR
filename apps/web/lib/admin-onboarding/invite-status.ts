import type { OwnerInviteUiStatus } from "./types";

export type { OwnerInviteUiStatus };

export type OwnerInviteLogSummary = {
  status: string;
  action: string;
  created_at: string;
  error_message: string | null;
} | null;

/**
 * Derive UI status from Auth user + last invite audit row.
 * Priority: accepted → failed (last attempt) → pending (sent awaiting confirm) → not_sent
 */
export function deriveOwnerInviteStatus(
  emailConfirmedAt: string | null | undefined,
  lastSignInAt: string | null | undefined,
  lastLog: OwnerInviteLogSummary
): {
  status: OwnerInviteUiStatus;
  lastSentAt: string | null;
  acceptedAt: string | null;
} {
  const acceptedAt = emailConfirmedAt ?? lastSignInAt ?? null;
  if (acceptedAt) {
    return {
      status: "accepted",
      lastSentAt: lastLog?.created_at ?? null,
      acceptedAt,
    };
  }

  if (lastLog?.status === "failed") {
    return {
      status: "failed",
      lastSentAt: lastLog.created_at,
      acceptedAt: null,
    };
  }

  if (lastLog && (lastLog.status === "sent" || lastLog.status === "link_ready")) {
    return {
      status: "pending",
      lastSentAt: lastLog.created_at,
      acceptedAt: null,
    };
  }

  return {
    status: "not_sent",
    lastSentAt: null,
    acceptedAt: null,
  };
}
