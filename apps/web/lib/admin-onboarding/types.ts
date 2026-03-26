import type { OrganizationOnboardingRow, OrganizationOnboardingStepRow } from "@/lib/onboarding/types";
import type { OrganizationProvisioningEventRow } from "@/lib/onboarding/types";

/** Row shape from `organizations` for console list/detail. */
export type AdminOrgRow = {
  id: string;
  name: string;
  created_at: string;
  provisioning_idempotency_key?: string | null;
};

export type AdminLocationRow = {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
};

export type AdminOnboardingListRow = {
  org: AdminOrgRow;
  onboarding: OrganizationOnboardingRow | null;
  /** Max(updated_at) from onboarding or steps — computed client/server from available fields */
  lastActivityAt: string | null;
  /** Derived: launch_state === "blocked" */
  isBlocker: boolean;
};

export type AdminOnboardingConsoleListResult =
  | { source: "live"; rows: AdminOnboardingListRow[] }
  | { source: "mock"; rows: AdminOnboardingListRow[] }
  | { error: string };

export type OwnerInviteUiStatus = "not_sent" | "pending" | "accepted" | "failed";

export type OwnerInviteSnapshot = {
  ownerEmail: string | null;
  status: OwnerInviteUiStatus;
  lastSentAt: string | null;
  acceptedAt: string | null;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
};

export type SupportNoteRow = {
  id: string;
  body: string;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
};

export type OwnerInviteLogRow = {
  id: string;
  action: string;
  status: string;
  created_at: string;
  error_message: string | null;
  actor_user_id: string;
};

export type AdminOnboardingDetailPayload = {
  org: AdminOrgRow;
  onboarding: OrganizationOnboardingRow | null;
  steps: OrganizationOnboardingStepRow[];
  events: OrganizationProvisioningEventRow[];
  locations: AdminLocationRow[];
  ownerUserId: string | null;
  ownerInvite: OwnerInviteSnapshot;
  supportNotes: SupportNoteRow[];
  ownerInviteLog: OwnerInviteLogRow[];
};

export type AdminOnboardingDetailResult =
  | ({ source: "live" } & AdminOnboardingDetailPayload)
  | ({ source: "mock" } & AdminOnboardingDetailPayload)
  | { error: string };

export type StarterPackStatus = "not_loaded" | "partial" | "loaded" | "unknown";
