import type { ServiceSupabase } from "./types";
import type { ProvisionOrganizationInput, ProvisionOrganizationResult } from "./types";
import { PROVISION_FINAL_EVENT } from "./types";
import { findCompletedProvisionOrganizationId } from "./audit";
import {
  stepResolveOrganization,
  stepResolveOwnerMembership,
  stepOrgSettings,
  stepOnboardingRecord,
  stepFirstLocation,
  stepDefaultRoles,
  stepStarterPack,
  stepFinalizeLaunchState,
  stepProvisioningStartedEvent,
  stepProvisioningCompleteEvent,
  stepProvisioningFailedEvent,
  industryStoredValue,
} from "./provision-organization-steps";
import { syncDerivedActivationSteps } from "./activation-sync";

function defaultOptions(input: ProvisionOrganizationInput) {
  const o = input.options ?? {};
  return {
    createDefaultRoles: o.createDefaultRoles !== false,
    createDefaultSettings: o.createDefaultSettings !== false,
    createOnboardingRecord: o.createOnboardingRecord !== false,
    createStepRows: o.createStepRows !== false,
    applyStarterPack: o.applyStarterPack !== false,
  };
}

function validateProvisionInput(input: ProvisionOrganizationInput): string | null {
  if (!input.idempotencyKey?.trim()) return "idempotencyKey is required";
  if (!input.organization?.name?.trim()) return "organization.name is required";
  if (input.mode === "self_serve") {
    if (!input.owner?.email?.trim()) return "owner.email is required for self_serve";
    if (!input.owner.authUserId?.trim()) return "self_serve requires owner.authUserId";
  }
  if (input.mode === "admin_assisted" && !input.owner.authUserId?.trim()) {
    return "admin_assisted requires owner.authUserId";
  }
  if (input.firstLocation && !input.firstLocation.name?.trim()) {
    return "firstLocation.name is required when firstLocation is set";
  }
  return null;
}

function packIndustry(input: ProvisionOrganizationInput): string | null {
  const fromPack = input.starterPack?.key;
  const fromOrg = input.organization.industry;
  const raw = fromPack && fromPack !== "other" ? fromPack : fromOrg;
  if (!raw || raw === "other") return null;
  return raw;
}

/**
 * Single entry point for org workspace provisioning (self-serve + admin-assisted).
 * Must run with Supabase service role after auth/permission checks at the edge.
 */
export async function provisionOrganization(
  admin: ServiceSupabase,
  input: ProvisionOrganizationInput
): Promise<ProvisionOrganizationResult> {
  const steps: ProvisionOrganizationResult["steps"] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const key = input.idempotencyKey.trim();

  const v = validateProvisionInput(input);
  if (v) {
    errors.push(v);
    steps.push({ stepKey: "validate_input", status: "failed", detail: v });
    return {
      success: false,
      dataSource: "created",
      idempotencyKey: key,
      steps,
      warnings,
      errors,
    };
  }
  steps.push({ stepKey: "validate_input", status: "completed", detail: null });

  const existingOrgId = await findCompletedProvisionOrganizationId(admin, key);
  if (existingOrgId) {
    const { data: ob } = await admin
      .from("organization_onboarding")
      .select("id, launch_state")
      .eq("organization_id", existingOrgId)
      .maybeSingle();
    return {
      success: true,
      organizationId: existingOrgId,
      onboardingId: (ob?.id as string | undefined) ?? null,
      launchState: (ob?.launch_state as string | undefined) ?? null,
      dataSource: "retried",
      idempotencyKey: key,
      steps: [
        ...steps,
        {
          stepKey: "idempotent_short_circuit",
          status: "already_exists",
          detail: PROVISION_FINAL_EVENT,
        },
      ],
      warnings,
      errors,
    };
  }

  let organizationId: string | undefined;
  let dataSource: ProvisionOrganizationResult["dataSource"] = "created";
  let onboardingId: string | null = null;
  let launchState: string | null = null;

  const opts = defaultOptions(input);

  try {
    const orgRes = await stepResolveOrganization(admin, input, steps);
    if (!orgRes.ok) {
      errors.push(orgRes.error);
      await stepProvisioningFailedEvent(admin, null, key, orgRes.error, steps);
      return {
        success: false,
        dataSource,
        idempotencyKey: key,
        steps,
        warnings,
        errors,
      };
    }
    organizationId = orgRes.organizationId;
    dataSource = orgRes.dataSource === "partial-recovery" ? "partial-recovery" : dataSource;

    const ownRes = await stepResolveOwnerMembership(admin, organizationId, input, steps);
    if (!ownRes.ok) {
      errors.push(ownRes.error);
      await stepProvisioningFailedEvent(admin, organizationId, key, ownRes.error, steps);
      return {
        success: false,
        organizationId,
        dataSource,
        idempotencyKey: key,
        steps,
        warnings,
        errors,
      };
    }

    await stepProvisioningStartedEvent(admin, organizationId, key, input).catch(() => {
      warnings.push("Could not write provision_organization_started audit (non-fatal)");
    });

    const settingsRes = await stepOrgSettings(admin, organizationId, opts.createDefaultSettings, steps);
    if (!settingsRes.ok) {
      errors.push(settingsRes.error);
      await stepProvisioningFailedEvent(admin, organizationId, key, settingsRes.error, steps);
      return {
        success: false,
        organizationId,
        dataSource,
        idempotencyKey: key,
        steps,
        warnings,
        errors,
      };
    }

    if (!opts.createStepRows && opts.createOnboardingRecord) {
      warnings.push("createStepRows=false still ensures rows via ensureOnboardingRecord when createOnboardingRecord=true");
    }

    const obRes = await stepOnboardingRecord(admin, organizationId, input, opts.createOnboardingRecord, steps);
    if (!obRes.ok) {
      errors.push(obRes.error);
      await stepProvisioningFailedEvent(admin, organizationId, key, obRes.error, steps);
      return {
        success: false,
        organizationId,
        dataSource,
        idempotencyKey: key,
        steps,
        warnings,
        errors,
      };
    }
    onboardingId = obRes.onboardingId;

    const locRes = await stepFirstLocation(admin, organizationId, input, steps);
    if (!locRes.ok) {
      errors.push(locRes.error);
      await stepProvisioningFailedEvent(admin, organizationId, key, locRes.error, steps);
      return {
        success: false,
        organizationId,
        onboardingId,
        dataSource,
        idempotencyKey: key,
        steps,
        warnings,
        errors,
      };
    }

    const industryForRoles = industryStoredValue(input.organization.industry ?? null);
    const rolesRes = await stepDefaultRoles(
      admin,
      organizationId,
      industryForRoles,
      opts.createDefaultRoles,
      steps
    );
    if (!rolesRes.ok) {
      errors.push(rolesRes.error);
      await stepProvisioningFailedEvent(admin, organizationId, key, rolesRes.error, steps);
      return {
        success: false,
        organizationId,
        onboardingId,
        dataSource,
        idempotencyKey: key,
        steps,
        warnings,
        errors,
      };
    }

    const packInd = packIndustry(input);
    const spRes = await stepStarterPack(
      admin,
      organizationId,
      packInd,
      input,
      opts.applyStarterPack,
      steps
    );
    if (!spRes.ok) {
      errors.push(spRes.error);
      await stepProvisioningFailedEvent(admin, organizationId, key, spRes.error, steps);
      return {
        success: false,
        organizationId,
        onboardingId,
        dataSource,
        idempotencyKey: key,
        steps,
        warnings,
        errors,
      };
    }

    await stepFinalizeLaunchState(admin, organizationId, steps);

    const ev = await stepProvisioningCompleteEvent(admin, organizationId, key, steps, warnings);
    if (!ev.ok) {
      errors.push(ev.error);
      warnings.push(
        "Provision steps finished but final audit insert failed — safe to retry with same idempotency key"
      );
      await stepProvisioningFailedEvent(admin, organizationId, key, ev.error, steps);
      return {
        success: false,
        organizationId,
        onboardingId,
        dataSource,
        idempotencyKey: key,
        steps,
        warnings,
        errors,
      };
    }

    await syncDerivedActivationSteps(admin, organizationId);

    const { data: obFinal } = await admin
      .from("organization_onboarding")
      .select("launch_state")
      .eq("organization_id", organizationId)
      .maybeSingle();
    launchState = (obFinal?.launch_state as string | undefined) ?? "in_progress";

    return {
      success: true,
      organizationId,
      onboardingId,
      launchState,
      dataSource,
      idempotencyKey: key,
      steps,
      warnings,
      errors,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(msg);
    await stepProvisioningFailedEvent(admin, organizationId ?? null, key, msg, steps);
    return {
      success: false,
      organizationId,
      onboardingId,
      dataSource,
      idempotencyKey: key,
      steps,
      warnings,
      errors,
    };
  }
}
