import type { SupabaseClient } from "@supabase/supabase-js";

/** Service-role Supabase client (bypasses RLS). Never expose to browser. */
export type ServiceSupabase = SupabaseClient;

export type ProvisionMode = "self_serve" | "admin_assisted";

/** Aligned with starter packs, admin onboarding schema, and DB `organization_onboarding.industry`. */
export type ProvisionIndustry =
  | "janitorial"
  | "facilities"
  | "restaurant"
  | "hospitality"
  | "events"
  | "general"
  | "other";

export type ProvisionOrganizationInput = {
  mode: ProvisionMode;
  /** Stable per logical provision attempt (client-generated UUID recommended). */
  idempotencyKey: string;

  organization: {
    name: string;
    industry?: ProvisionIndustry | null;
    timezone?: string | null;
    employeeCountRange?: string | null;
    locationCountEstimate?: string | null;
  };

  owner: {
    authUserId?: string | null;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };

  plan: {
    key?: string | null;
  };

  firstLocation?: {
    name: string;
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
    timezone?: string | null;
    locationType?: string | null;
  } | null;

  starterPack?: {
    key?: ProvisionIndustry | null;
    version?: string | null;
    enabled?: boolean;
  } | null;

  options?: {
    createDefaultRoles?: boolean;
    createDefaultSettings?: boolean;
    createOnboardingRecord?: boolean;
    createStepRows?: boolean;
    applyStarterPack?: boolean;
  };
};

export type ProvisionStepStatus = "completed" | "skipped" | "already_exists" | "failed";

export type ProvisionOrganizationStepResult = {
  stepKey: string;
  status: ProvisionStepStatus;
  detail?: string | null;
};

export type ProvisionDataSource = "created" | "retried" | "partial-recovery";

export type ProvisionOrganizationResult = {
  success: boolean;
  organizationId?: string;
  onboardingId?: string | null;
  launchState?: string | null;
  dataSource: ProvisionDataSource;
  idempotencyKey: string;
  steps: ProvisionOrganizationStepResult[];
  warnings: string[];
  errors: string[];
};

export const PROVISION_FINAL_EVENT = "provision_organization_complete" as const;
