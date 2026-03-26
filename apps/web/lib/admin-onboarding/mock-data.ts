import type { OrganizationOnboardingRow, OrganizationProvisioningEventRow } from "@/lib/onboarding/types";
import type { AdminOnboardingConsoleListResult, AdminOnboardingDetailResult } from "./types";

const now = new Date().toISOString();

const mockOnboarding1: OrganizationOnboardingRow = {
  id: "00000000-0000-4000-8000-000000000010",
  organization_id: "00000000-0000-4000-8000-000000000001",
  onboarding_mode: "admin_assisted",
  industry: "janitorial",
  plan_key: "pilot",
  current_step: "location",
  launch_state: "in_progress",
  assigned_csm_user_id: null,
  started_at: now,
  completed_at: null,
  created_at: now,
  updated_at: now,
  blocker_reason: null,
  blocker_category: null,
  blocker_flagged_by: null,
  blocker_flagged_at: null,
  blocker_cleared_by: null,
  blocker_cleared_at: null,
  blocker_resolution_note: null,
};

const mockEvents1: OrganizationProvisioningEventRow[] = [
  {
    id: "00000000-0000-4000-8000-00000000e001",
    organization_id: "00000000-0000-4000-8000-000000000001",
    event_type: "provision_organization_started",
    status: "succeeded",
    idempotency_key: "mock-key-1",
    payload: { phase: "start" },
    error_message: null,
    created_at: now,
  },
  {
    id: "00000000-0000-4000-8000-00000000e002",
    organization_id: "00000000-0000-4000-8000-000000000001",
    event_type: "starter_pack_apply",
    status: "failed",
    idempotency_key: "mock-key-1:starter",
    payload: { retry: false },
    error_message: "Simulated failure for UI drill-down",
    created_at: now,
  },
];

/** `ADMIN_ONBOARDING_MOCK=1` — static rows for UI development without Supabase. */
export function getMockOnboardingConsoleList(): AdminOnboardingConsoleListResult {
  return {
    source: "mock",
    rows: [
      {
        org: {
          id: "00000000-0000-4000-8000-000000000001",
          name: "[MOCK] ClearPath Facility Services",
          created_at: now,
          provisioning_idempotency_key: "mock-key-1",
        },
        onboarding: mockOnboarding1,
        lastActivityAt: now,
        isBlocker: false,
      },
      {
        org: {
          id: "00000000-0000-4000-8000-000000000002",
          name: "[MOCK] Blocked rollout",
          created_at: now,
          provisioning_idempotency_key: null,
        },
        onboarding: mockOnboardingBlocked,
        lastActivityAt: now,
        isBlocker: true,
      },
    ],
  };
}

function mockDetailFor001(): AdminOnboardingDetailResult {
  return {
    source: "mock",
    org: {
      id: "00000000-0000-4000-8000-000000000001",
      name: "[MOCK] ClearPath Facility Services",
      created_at: now,
      provisioning_idempotency_key: "mock-key-1",
    },
    onboarding: mockOnboarding1,
    steps: [],
    events: mockEvents1,
    locations: [
      {
        id: "00000000-0000-4000-8000-0000000000aa",
        name: "Building B",
        address: "1800 Harbor Way",
        created_at: now,
      },
    ],
    ownerUserId: "00000000-0000-4000-8000-0000000000f0",
    ownerInvite: {
      ownerEmail: "owner@example.com",
      status: "pending",
      lastSentAt: now,
      acceptedAt: null,
      emailConfirmedAt: null,
      lastSignInAt: null,
    },
    supportNotes: [
      {
        id: "00000000-0000-4000-8000-00000000n001",
        body: "CSM called — waiting on IT to allowlist email.",
        created_by: "00000000-0000-4000-8000-0000000000f1",
        created_by_email: "support@example.com",
        created_at: now,
      },
    ],
    ownerInviteLog: [
      {
        id: "00000000-0000-4000-8000-00000000i001",
        action: "invite_email",
        status: "sent",
        created_at: now,
        error_message: null,
        actor_user_id: "00000000-0000-4000-8000-0000000000f1",
      },
    ],
  };
}

const mockOnboardingBlocked: OrganizationOnboardingRow = {
  ...mockOnboarding1,
  id: "00000000-0000-4000-8000-000000000020",
  organization_id: "00000000-0000-4000-8000-000000000002",
  onboarding_mode: "self_serve",
  industry: "restaurant",
  plan_key: "growth",
  current_step: "templates",
  launch_state: "blocked",
  blocker_category: "billing",
  blocker_reason: "Awaiting signed order form",
  blocker_flagged_by: "00000000-0000-4000-8000-0000000000f1",
  blocker_flagged_at: now,
  blocker_cleared_by: null,
  blocker_cleared_at: null,
  blocker_resolution_note: null,
};

function mockDetailFor002(): AdminOnboardingDetailResult {
  return {
    source: "mock",
    org: {
      id: "00000000-0000-4000-8000-000000000002",
      name: "[MOCK] Blocked rollout",
      created_at: now,
      provisioning_idempotency_key: null,
    },
    onboarding: mockOnboardingBlocked,
    steps: [],
    events: [],
    locations: [],
    ownerUserId: "00000000-0000-4000-8000-0000000000f2",
    ownerInvite: {
      ownerEmail: "blocked-owner@example.com",
      status: "not_sent",
      lastSentAt: null,
      acceptedAt: null,
      emailConfirmedAt: null,
      lastSignInAt: null,
    },
    supportNotes: [],
    ownerInviteLog: [],
  };
}

export function getMockOnboardingDetail(organizationId: string): AdminOnboardingDetailResult {
  if (organizationId === "00000000-0000-4000-8000-000000000001") return mockDetailFor001();
  if (organizationId === "00000000-0000-4000-8000-000000000002") return mockDetailFor002();
  return {
    error: `Mock only supports org 00000000-0000-4000-8000-000000000001 or …000002`,
  };
}
