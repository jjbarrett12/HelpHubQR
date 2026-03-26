import "server-only";

import { fetchOnboardingConsoleList, fetchOnboardingOrgDetail } from "@/app/platform-admin/onboarding/actions";
import type {
  OrganizationOnboardingRow,
  OrganizationOnboardingStepRow,
  OrganizationProvisioningEventRow,
} from "@/lib/onboarding/types";
import { ADMIN_ONBOARDING_BASE_PATH } from "./constants";
import { getMockOnboardingConsoleList, getMockOnboardingDetail } from "./mock-data";
import type {
  AdminOnboardingConsoleListResult,
  AdminOnboardingDetailResult,
  AdminOnboardingListRow,
  OwnerInviteLogRow,
  OwnerInviteSnapshot,
  SupportNoteRow,
} from "./types";

function mapListRow(
  org: { id: string; name: string; created_at: string; provisioning_idempotency_key?: string | null },
  onboarding: OrganizationOnboardingRow | null | undefined
): AdminOnboardingListRow {
  const ob = onboarding ?? null;
  const lastActivityAt = ob?.updated_at ?? org.created_at ?? null;
  const isBlocker = ob?.launch_state === "blocked";
  return {
    org: {
      id: org.id,
      name: org.name,
      created_at: org.created_at,
      provisioning_idempotency_key: org.provisioning_idempotency_key ?? null,
    },
    onboarding: ob,
    lastActivityAt,
    isBlocker,
  };
}

/**
 * Typed list loader for the internal onboarding console.
 * Set `ADMIN_ONBOARDING_MOCK=1` for static UI (no Supabase).
 */
export async function loadAdminOnboardingConsoleList(): Promise<AdminOnboardingConsoleListResult> {
  if (process.env.ADMIN_ONBOARDING_MOCK === "1") {
    return getMockOnboardingConsoleList();
  }

  const data = await fetchOnboardingConsoleList();
  if (data === null) return { error: "Unauthorized" };
  if ("error" in data && data.error) return { error: data.error };
  if (!("organizations" in data)) return { error: "Invalid response" };

  const onboardingByOrg = data.onboardingByOrg as Record<string, OrganizationOnboardingRow>;
  const rows = (data.organizations as { id: string; name: string; created_at: string; provisioning_idempotency_key?: string | null }[]).map(
    (org) => mapListRow(org, onboardingByOrg[org.id])
  );

  return { source: "live", rows };
}

export async function loadAdminOnboardingOrgDetail(organizationId: string): Promise<AdminOnboardingDetailResult> {
  if (process.env.ADMIN_ONBOARDING_MOCK === "1") {
    return getMockOnboardingDetail(organizationId);
  }

  const data = await fetchOnboardingOrgDetail(organizationId);
  if (data === null) return { error: "Unauthorized" };
  if ("error" in data && data.error) return { error: data.error };
  if (!("org" in data) || !data.org) return { error: "Invalid response" };

  const orgRow = data.org as {
    id: string;
    name: string;
    created_at: string;
    provisioning_idempotency_key?: string | null;
  };

  const ownerInvite = data.ownerInvite as OwnerInviteSnapshot | undefined;
  const supportNotes = (data.supportNotes as SupportNoteRow[] | undefined) ?? [];
  const ownerInviteLog = (data.ownerInviteLog as OwnerInviteLogRow[] | undefined) ?? [];

  const result: AdminOnboardingDetailResult = {
    source: "live",
    org: {
      id: orgRow.id,
      name: orgRow.name,
      created_at: orgRow.created_at,
      provisioning_idempotency_key: orgRow.provisioning_idempotency_key ?? null,
    },
    onboarding: (data.onboarding as OrganizationOnboardingRow | null) ?? null,
    steps: (data.steps as OrganizationOnboardingStepRow[] | undefined) ?? [],
    events: (data.events as OrganizationProvisioningEventRow[] | undefined) ?? [],
    locations: (data.locations as { id: string; name: string; address: string | null; created_at: string }[]) ?? [],
    ownerUserId: data.ownerUserId ?? null,
    ownerInvite: ownerInvite ?? {
      ownerEmail: null,
      status: "not_sent",
      lastSentAt: null,
      acceptedAt: null,
      emailConfirmedAt: null,
      lastSignInAt: null,
    },
    supportNotes,
    ownerInviteLog,
  };
  return result;
}

export function adminOnboardingDetailPath(organizationId: string) {
  return `${ADMIN_ONBOARDING_BASE_PATH}/${organizationId}`;
}
