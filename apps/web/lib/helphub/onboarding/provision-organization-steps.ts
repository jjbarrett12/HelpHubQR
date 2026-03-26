import type { ProvisionIndustry, ProvisionOrganizationInput } from "./types";
import { PROVISION_FINAL_EVENT } from "./types";
import {
  findBootstrapOrganizationId,
  findOrganizationIdByProvisioningKey,
  insertProvisioningEvent,
} from "./audit";
import type { ProvisionOrganizationStepResult } from "./types";
import {
  ensureDefaultWorkforceSettingsForOrg,
  seedDefaultRolesForOrg,
  applyStarterPackForOrg,
  createFirstLocationIfNeeded,
} from "./starter-pack-engine";
import { ensureOnboardingRecord, setProvisioningWizardStep } from "./onboarding-state";

const PG_UNIQUE = "23505";

export function formatFirstLocationAddress(
  loc: NonNullable<ProvisionOrganizationInput["firstLocation"]>
): string | null {
  const parts = [
    loc.address1,
    loc.address2,
    loc.city,
    loc.state,
    loc.postalCode,
    loc.country,
  ].filter((p) => p && String(p).trim());
  return parts.length ? parts.map((p) => String(p).trim()).join(", ") : null;
}

export function industryStoredValue(industry: ProvisionIndustry | null | undefined): string | null {
  if (!industry || industry === "other") return "other";
  return industry;
}

export async function stepResolveOrganization(
  admin: Parameters<typeof findOrganizationIdByProvisioningKey>[0],
  input: ProvisionOrganizationInput,
  steps: ProvisionOrganizationStepResult[]
): Promise<
  | { ok: true; organizationId: string; dataSource: "created" | "partial-recovery" }
  | { ok: false; error: string }
> {
  const key = input.idempotencyKey.trim();
  const name = input.organization.name.trim();

  let organizationId = await findOrganizationIdByProvisioningKey(admin, key);
  let dataSource: "created" | "partial-recovery" = "partial-recovery";

  if (organizationId) {
    steps.push({ stepKey: "resolve_organization", status: "already_exists", detail: "provisioning_idempotency_key" });
    return { ok: true, organizationId, dataSource };
  }

  organizationId = await findBootstrapOrganizationId(admin, key);
  if (organizationId) {
    await admin
      .from("organizations")
      .update({ provisioning_idempotency_key: key })
      .eq("id", organizationId)
      .is("provisioning_idempotency_key", null);
    steps.push({
      stepKey: "resolve_organization",
      status: "already_exists",
      detail: "legacy_bootstrap_event_stamped_key",
    });
    return { ok: true, organizationId, dataSource };
  }

  const { data: created, error } = await admin
    .from("organizations")
    .insert({
      name,
      provisioning_idempotency_key: key,
    })
    .select("id")
    .single();

  if (error?.code === PG_UNIQUE) {
    organizationId = await findOrganizationIdByProvisioningKey(admin, key);
    if (!organizationId) {
      return { ok: false, error: "Unique conflict on provisioning key but org row not found" };
    }
    steps.push({ stepKey: "resolve_organization", status: "already_exists", detail: "race_unique_key" });
    return { ok: true, organizationId, dataSource: "partial-recovery" };
  }

  if (error) {
    return { ok: false, error: error.message };
  }

  dataSource = "created";
  steps.push({ stepKey: "resolve_organization", status: "completed", detail: null });
  return { ok: true, organizationId: created!.id as string, dataSource };
}

export async function stepResolveOwnerMembership(
  admin: Parameters<typeof findOrganizationIdByProvisioningKey>[0],
  organizationId: string,
  input: ProvisionOrganizationInput,
  steps: ProvisionOrganizationStepResult[]
): Promise<{ ok: true; status: "completed" | "already_exists" } | { ok: false; error: string }> {
  const ownerUserId = input.owner.authUserId?.trim();
  if (!ownerUserId) {
    return { ok: false, error: "owner.authUserId is required to create membership" };
  }

  const { data: existing } = await admin
    .from("organization_members")
    .select("id, role")
    .eq("organization_id", organizationId)
    .eq("user_id", ownerUserId)
    .maybeSingle();

  if (existing) {
    if (existing.role !== "owner") {
      return {
        ok: false,
        error: `User ${ownerUserId} is already a member with role ${existing.role}; refusing to change role via provision`,
      };
    }
    steps.push({ stepKey: "resolve_owner_membership", status: "already_exists", detail: null });
    return { ok: true, status: "already_exists" };
  }

  const { error } = await admin.from("organization_members").insert({
    organization_id: organizationId,
    user_id: ownerUserId,
    role: "owner",
    is_active: true,
  });

  if (error) {
    if (error.code === PG_UNIQUE) {
      steps.push({ stepKey: "resolve_owner_membership", status: "already_exists", detail: "race" });
      return { ok: true, status: "already_exists" };
    }
    return { ok: false, error: error.message };
  }

  steps.push({ stepKey: "resolve_owner_membership", status: "completed", detail: null });
  return { ok: true, status: "completed" };
}

export async function stepOrgSettings(
  admin: Parameters<typeof ensureDefaultWorkforceSettingsForOrg>[0],
  organizationId: string,
  enabled: boolean,
  steps: ProvisionOrganizationStepResult[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!enabled) {
    steps.push({ stepKey: "org_workforce_settings", status: "skipped", detail: "options.createDefaultSettings" });
    return { ok: true };
  }
  const res = await ensureDefaultWorkforceSettingsForOrg(admin, organizationId);
  if (!res.ok) {
    steps.push({ stepKey: "org_workforce_settings", status: "failed", detail: res.error });
    return { ok: false, error: res.error };
  }
  steps.push({
    stepKey: "org_workforce_settings",
    status: res.skipped ? "already_exists" : "completed",
    detail: null,
  });
  return { ok: true };
}

export async function stepOnboardingRecord(
  admin: Parameters<typeof ensureOnboardingRecord>[0],
  organizationId: string,
  input: ProvisionOrganizationInput,
  enabled: boolean,
  steps: ProvisionOrganizationStepResult[]
): Promise<{ ok: true; onboardingId: string | null } | { ok: false; error: string }> {
  if (!enabled) {
    steps.push({ stepKey: "onboarding_record", status: "skipped", detail: "options.createOnboardingRecord" });
    return { ok: true, onboardingId: null };
  }

  const industry = industryStoredValue(input.organization.industry ?? null);

  try {
    const row = await ensureOnboardingRecord(admin, organizationId, input.mode, {
      industry,
      planKey: input.plan.key ?? null,
      currentStep: "location",
      timezone: input.organization.timezone ?? null,
      employeeCountRange: input.organization.employeeCountRange ?? null,
      locationCountEstimate: input.organization.locationCountEstimate ?? null,
    });
    steps.push({ stepKey: "onboarding_record", status: "completed", detail: null });
    return { ok: true, onboardingId: row.id as string };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({ stepKey: "onboarding_record", status: "failed", detail: msg });
    return { ok: false, error: msg };
  }
}

export async function stepFirstLocation(
  admin: Parameters<typeof createFirstLocationIfNeeded>[0],
  organizationId: string,
  input: ProvisionOrganizationInput,
  steps: ProvisionOrganizationStepResult[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.firstLocation?.name?.trim()) {
    steps.push({ stepKey: "first_location", status: "skipped", detail: "firstLocation omitted" });
    return { ok: true };
  }
  const addr = formatFirstLocationAddress(input.firstLocation);
  const res = await createFirstLocationIfNeeded(
    admin,
    organizationId,
    input.firstLocation.name.trim(),
    addr
  );
  if (!res.ok) {
    steps.push({ stepKey: "first_location", status: "failed", detail: res.error });
    return { ok: false, error: res.error };
  }
  steps.push({
    stepKey: "first_location",
    status: res.skipped ? "already_exists" : "completed",
    detail: null,
  });
  return { ok: true };
}

export async function stepDefaultRoles(
  admin: Parameters<typeof seedDefaultRolesForOrg>[0],
  organizationId: string,
  industry: string | null,
  enabled: boolean,
  steps: ProvisionOrganizationStepResult[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!enabled) {
    steps.push({ stepKey: "default_roles", status: "skipped", detail: "options.createDefaultRoles" });
    return { ok: true };
  }
  const res = await seedDefaultRolesForOrg(admin, organizationId, industry);
  if (!res.ok) {
    steps.push({ stepKey: "default_roles", status: "failed", detail: res.error });
    return { ok: false, error: res.error };
  }
  steps.push({
    stepKey: "default_roles",
    status: res.skipped ? "already_exists" : "completed",
    detail: null,
  });
  return { ok: true };
}

export async function stepStarterPack(
  admin: Parameters<typeof applyStarterPackForOrg>[0],
  organizationId: string,
  packIndustry: string | null,
  input: ProvisionOrganizationInput,
  enabled: boolean,
  steps: ProvisionOrganizationStepResult[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!enabled) {
    steps.push({ stepKey: "starter_pack", status: "skipped", detail: "options.applyStarterPack" });
    return { ok: true };
  }
  const sp = input.starterPack;
  if (sp?.enabled === false) {
    steps.push({ stepKey: "starter_pack", status: "skipped", detail: "starterPack.enabled false" });
    return { ok: true };
  }
  const res = await applyStarterPackForOrg(admin, organizationId, packIndustry, {
    idempotencyKeyOverride: sp?.version
      ? `starter_pack:${packIndustry ?? "general"}:${sp.version}`
      : undefined,
  });
  if (!res.ok) {
    steps.push({ stepKey: "starter_pack", status: "failed", detail: res.error });
    return { ok: false, error: res.error };
  }
  steps.push({
    stepKey: "starter_pack",
    status: res.skipped ? "already_exists" : "completed",
    detail: null,
  });
  return { ok: true };
}

export async function stepFinalizeLaunchState(
  admin: Parameters<typeof setProvisioningWizardStep>[0],
  organizationId: string,
  steps: ProvisionOrganizationStepResult[]
): Promise<void> {
  await setProvisioningWizardStep(admin, organizationId, "location");
  steps.push({ stepKey: "finalize_wizard_state", status: "completed", detail: "current_step=location" });
}

export async function stepProvisioningStartedEvent(
  admin: Parameters<typeof insertProvisioningEvent>[0],
  organizationId: string,
  baseIdempotencyKey: string,
  input: ProvisionOrganizationInput
): Promise<void> {
  await insertProvisioningEvent(admin, {
    organization_id: organizationId,
    event_type: "provision_organization_started",
    status: "started",
    idempotency_key: `${baseIdempotencyKey}:provision_started`,
    payload: {
      mode: input.mode,
      organization_name: input.organization.name,
      owner_email: input.owner.email,
    },
  });
}

export async function stepProvisioningCompleteEvent(
  admin: Parameters<typeof insertProvisioningEvent>[0],
  organizationId: string,
  idempotencyKey: string,
  stepSummary: ProvisionOrganizationStepResult[],
  warnings: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  return insertProvisioningEvent(admin, {
    organization_id: organizationId,
    event_type: PROVISION_FINAL_EVENT,
    status: "succeeded",
    idempotency_key: idempotencyKey,
    payload: {
      organization_id: organizationId,
      steps: stepSummary,
      warnings,
    },
  });
}

export async function stepProvisioningFailedEvent(
  admin: Parameters<typeof insertProvisioningEvent>[0],
  organizationId: string | null,
  idempotencyKey: string,
  message: string,
  partialSteps: ProvisionOrganizationStepResult[]
): Promise<void> {
  await insertProvisioningEvent(admin, {
    organization_id: organizationId,
    event_type: "provision_organization_failed",
    status: "failed",
    idempotency_key: `${idempotencyKey}:failed:${crypto.randomUUID()}`,
    error_message: message,
    payload: { steps: partialSteps },
  });
}
