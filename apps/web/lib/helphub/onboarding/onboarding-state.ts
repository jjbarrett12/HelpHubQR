import { ACTIVATION_STEP_KEYS } from "@/lib/onboarding/step-keys";
import type { LaunchState, OnboardingMode, OnboardingWizardStepSlug } from "@/lib/onboarding/types";
import type { ServiceSupabase } from "./types";

export async function ensureActivationStepRows(admin: ServiceSupabase, organizationId: string) {
  const rows = ACTIVATION_STEP_KEYS.map((step_key) => ({
    organization_id: organizationId,
    step_key,
    status: "pending" as const,
    metadata: {},
  }));
  const { error } = await admin.from("organization_onboarding_steps").upsert(rows, {
    onConflict: "organization_id,step_key",
    ignoreDuplicates: true,
  });
  if (error) throw new Error(error.message);
}

export type EnsureOnboardingOptions = {
  industry?: string | null;
  planKey?: string | null;
  currentStep?: OnboardingWizardStepSlug | null;
  timezone?: string | null;
  employeeCountRange?: string | null;
  locationCountEstimate?: string | null;
};

export async function ensureOnboardingRecord(
  admin: ServiceSupabase,
  organizationId: string,
  mode: OnboardingMode,
  opts?: EnsureOnboardingOptions
) {
  const { data: existing } = await admin
    .from("organization_onboarding")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (opts?.industry !== undefined) patch.industry = opts.industry;
    if (opts?.planKey !== undefined) patch.plan_key = opts.planKey;
    if (opts?.currentStep !== undefined) patch.current_step = opts.currentStep;
    if (opts?.timezone !== undefined) patch.timezone = opts.timezone;
    if (opts?.employeeCountRange !== undefined) patch.employee_count_range = opts.employeeCountRange;
    if (opts?.locationCountEstimate !== undefined) patch.location_count_estimate = opts.locationCountEstimate;
    if (Object.keys(patch).length > 0) {
      await admin.from("organization_onboarding").update(patch).eq("id", existing.id);
    }
    await ensureActivationStepRows(admin, organizationId);
    const { data: refreshed } = await admin
      .from("organization_onboarding")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();
    return refreshed ?? existing;
  }

  const { data, error } = await admin
    .from("organization_onboarding")
    .insert({
      organization_id: organizationId,
      onboarding_mode: mode,
      industry: opts?.industry ?? null,
      plan_key: opts?.planKey ?? null,
      current_step: opts?.currentStep ?? "workspace",
      launch_state: "in_progress",
      timezone: opts?.timezone ?? null,
      employee_count_range: opts?.employeeCountRange ?? null,
      location_count_estimate: opts?.locationCountEstimate ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  await ensureActivationStepRows(admin, organizationId);
  await upsertStepStatus(admin, organizationId, "organization_created", "completed");
  return data;
}

export async function upsertStepStatus(
  admin: ServiceSupabase,
  organizationId: string,
  stepKey: string,
  status: "pending" | "in_progress" | "completed" | "skipped" | "failed",
  metadata?: Record<string, unknown>
) {
  const completed_at =
    status === "completed" || status === "skipped" ? new Date().toISOString() : null;
  const { error } = await admin.from("organization_onboarding_steps").upsert(
    {
      organization_id: organizationId,
      step_key: stepKey,
      status,
      completed_at,
      metadata: metadata ?? {},
    },
    { onConflict: "organization_id,step_key" }
  );
  if (error) throw new Error(error.message);
}

export async function setProvisioningWizardStep(
  admin: ServiceSupabase,
  organizationId: string,
  step: OnboardingWizardStepSlug | null
) {
  await admin
    .from("organization_onboarding")
    .update({ current_step: step, launch_state: "in_progress" })
    .eq("organization_id", organizationId);
}

export async function setLaunchState(
  admin: ServiceSupabase,
  organizationId: string,
  state: LaunchState
) {
  await admin.from("organization_onboarding").update({ launch_state: state }).eq("organization_id", organizationId);
}

export async function markOnboardingCompleted(admin: ServiceSupabase, organizationId: string) {
  const now = new Date().toISOString();
  await admin
    .from("organization_onboarding")
    .update({ completed_at: now, launch_state: "launched", current_step: "activation" })
    .eq("organization_id", organizationId);
  await upsertStepStatus(admin, organizationId, "launch_complete", "completed");
}
