/**
 * Onboarding / provisioning — compatibility layer.
 * Core implementation: `@/lib/helphub/onboarding/*` (single engine for self-serve + admin).
 */

import type { ProvisioningResult, ServiceSupabase } from "./types";
import { provisionOrganization } from "@/lib/helphub/onboarding/provision-organization";
import type { ProvisionOrganizationInput } from "@/lib/helphub/onboarding/types";
export { provisionOrganization } from "@/lib/helphub/onboarding/provision-organization";
export type { ProvisionOrganizationInput, ProvisionOrganizationResult } from "@/lib/helphub/onboarding/types";

export {
  hasSucceededProvisioning,
  runWithIdempotency,
} from "@/lib/helphub/onboarding/idempotency";
export type { IdempotentRunResult } from "@/lib/helphub/onboarding/idempotency";

export {
  findCompletedProvisionOrganizationId,
  findOrganizationIdByProvisioningKey,
  findBootstrapOrganizationId,
  insertProvisioningEvent,
} from "@/lib/helphub/onboarding/audit";

export {
  ensureActivationStepRows,
  ensureOnboardingRecord,
  upsertStepStatus,
  setProvisioningWizardStep,
  setLaunchState,
  markOnboardingCompleted,
} from "@/lib/helphub/onboarding/onboarding-state";

/** @deprecated Use `setProvisioningWizardStep` */
export { setProvisioningWizardStep as setWizardStep } from "@/lib/helphub/onboarding/onboarding-state";

export { syncDerivedActivationSteps } from "@/lib/helphub/onboarding/activation-sync";

export {
  seedDefaultRolesForOrg as seedDefaultRoles,
  ensureDefaultWorkforceSettingsForOrg as ensureDefaultWorkforceSettings,
  applyStarterPackForOrg as applyStarterPack,
  createFirstLocationIfNeeded as createLocationIfNeeded,
} from "@/lib/helphub/onboarding/starter-pack-engine";

/**
 * @deprecated Prefer `provisionOrganization` with a full `ProvisionOrganizationInput`.
 * Thin wrapper for legacy callers: org + owner only, no onboarding rows.
 */
export async function createOrganizationWithOwner(
  admin: ServiceSupabase,
  name: string,
  ownerUserId: string,
  idempotencyKey: string
): Promise<ProvisioningResult<{ organizationId: string }>> {
  const input: ProvisionOrganizationInput = {
    mode: "admin_assisted",
    idempotencyKey,
    organization: { name },
    owner: {
      authUserId: ownerUserId,
      email: `owner+${ownerUserId.replace(/-/g, "").slice(0, 12)}@provisioned.invalid`,
    },
    plan: {},
    starterPack: { enabled: false },
    options: {
      createDefaultRoles: false,
      createDefaultSettings: false,
      createOnboardingRecord: false,
      createStepRows: false,
      applyStarterPack: false,
    },
  };
  const result = await provisionOrganization(admin, input);
  if (!result.success || !result.organizationId) {
    return { ok: false, error: result.errors[0] ?? "Provision failed" };
  }
  if (result.dataSource === "retried") {
    return {
      ok: true,
      skipped: true,
      reason: "idempotent_hit",
      data: { organizationId: result.organizationId },
    };
  }
  return { ok: true, skipped: false, data: { organizationId: result.organizationId } };
}

export async function listProvisioningEvents(admin: ServiceSupabase, organizationId: string, limit = 100) {
  const { data, error } = await admin
    .from("organization_provisioning_events")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}
