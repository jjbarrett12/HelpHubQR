import type { SupabaseClient } from "@supabase/supabase-js";

/** Wizard slugs for the short self-serve / guided path (not the same as activation step_key). */
export type OnboardingWizardStepSlug =
  | "workspace"
  | "location"
  | "team"
  | "operating"
  | "templates"
  | "invite"
  | "activation";

export type OnboardingMode = "self_serve" | "admin_assisted" | "imported";

export type LaunchState = "created" | "in_progress" | "blocked" | "launched" | "churned";

export type OnboardingStepStatus = "pending" | "in_progress" | "completed" | "skipped" | "failed";

export type ProvisioningEventStatus = "started" | "succeeded" | "failed" | "skipped";

export type IndustryKey =
  | "janitorial"
  | "facilities"
  | "restaurant"
  | "hospitality"
  | "events"
  | "general";

export type OrganizationOnboardingRow = {
  id: string;
  organization_id: string;
  onboarding_mode: OnboardingMode;
  industry: string | null;
  plan_key: string | null;
  current_step: string | null;
  launch_state: LaunchState;
  assigned_csm_user_id: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  /** Platform-admin blocker metadata (migration 20260403120000) */
  blocker_reason?: string | null;
  blocker_category?: string | null;
  blocker_flagged_by?: string | null;
  blocker_flagged_at?: string | null;
  blocker_cleared_by?: string | null;
  blocker_cleared_at?: string | null;
  blocker_resolution_note?: string | null;
};

export type OrganizationOnboardingStepRow = {
  id: string;
  organization_id: string;
  step_key: string;
  status: OnboardingStepStatus;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type OrganizationProvisioningEventRow = {
  id: string;
  /** Null for pre-org bootstrap rows (constraint allows only with bootstrap event types). */
  organization_id: string | null;
  event_type: string;
  status: ProvisioningEventStatus;
  idempotency_key: string;
  payload: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
};

export type ServiceSupabase = SupabaseClient;

export type ProvisioningResult<T = unknown> =
  | { ok: true; skipped: true; reason: "idempotent_hit"; data?: T }
  | { ok: true; skipped: false; data: T }
  | { ok: false; error: string };
