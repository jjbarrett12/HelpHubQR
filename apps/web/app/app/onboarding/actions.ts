"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { getHelpHubContext } from "@/app/app/helphub/actions/org";
import { setActiveOrganizationIdCookie } from "@/lib/helphub/org-context";
import {
  applyStarterPack,
  createLocationIfNeeded,
  ensureDefaultWorkforceSettings,
  ensureOnboardingRecord,
  markOnboardingCompleted,
  seedDefaultRoles,
  setWizardStep,
  syncDerivedActivationSteps,
} from "@/lib/onboarding/provisioning-service";
import type { OnboardingWizardStepSlug } from "@/lib/onboarding/types";
import { nextWizardStep, isWizardStep } from "@/lib/onboarding/wizard-steps";

async function requireOwnerManagerAdmin(organizationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: uErr,
  } = await supabase.auth.getUser();
  if (uErr || !user) return { error: "Not signed in" as const };
  const { data: row } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle();
  if (!row || !["owner", "manager", "admin"].includes(row.role as string)) {
    return { error: "You need manager access to continue setup." as const };
  }
  return { user, supabase };
}

function adminClient() {
  return createServiceRoleClient();
}

export async function onboardingCreateWorkspace(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const industry = String(formData.get("industry") ?? "general").trim();
  if (!name) return { error: "Workspace name is required" };

  const supabase = await createClient();
  const {
    data: { user },
    error: uErr,
  } = await supabase.auth.getUser();
  if (uErr || !user) return { error: "Not signed in" };

  const { data: orgId, error: rpcErr } = await supabase.rpc("hh_create_organization", { p_name: name });
  if (rpcErr) return { error: rpcErr.message };
  if (!orgId || typeof orgId !== "string") return { error: "Failed to create workspace" };

  const admin = adminClient();
  await ensureOnboardingRecord(admin, orgId, "self_serve", {
    industry: industry || "general",
    currentStep: "location",
  });
  await seedDefaultRoles(admin, orgId, industry);
  await setActiveOrganizationIdCookie(orgId);

  revalidatePath("/app", "layout");
  revalidatePath("/app/onboarding");
  return { ok: true as const, organizationId: orgId };
}

export async function onboardingAttachExistingOrg() {
  const ctx = await getHelpHubContext();
  if (!ctx.organizationId) return { error: "No workspace selected" };
  const gate = await requireOwnerManagerAdmin(ctx.organizationId);
  if ("error" in gate) return { error: gate.error };

  const admin = adminClient();
  await ensureOnboardingRecord(admin, ctx.organizationId, "self_serve", { currentStep: "location" });
  await seedDefaultRoles(admin, ctx.organizationId, null);
  await syncDerivedActivationSteps(admin, ctx.organizationId);

  revalidatePath("/app/onboarding");
  return { ok: true as const };
}

export async function onboardingSaveLocation(formData: FormData) {
  const ctx = await getHelpHubContext();
  if (!ctx.organizationId) return { error: "No workspace" };
  const gate = await requireOwnerManagerAdmin(ctx.organizationId);
  if ("error" in gate) return { error: gate.error };

  const locName = String(formData.get("location_name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  if (!locName) return { error: "Location name is required" };

  const admin = adminClient();
  const res = await createLocationIfNeeded(admin, ctx.organizationId, locName, address);
  if (!res.ok) return { error: res.error };

  await setWizardStep(admin, ctx.organizationId, "team");
  await syncDerivedActivationSteps(admin, ctx.organizationId);
  revalidatePath("/app/onboarding");
  return { ok: true as const };
}

export async function onboardingSkipLocation() {
  const ctx = await getHelpHubContext();
  if (!ctx.organizationId) return { error: "No workspace" };
  const gate = await requireOwnerManagerAdmin(ctx.organizationId);
  if ("error" in gate) return { error: gate.error };

  const admin = adminClient();
  await setWizardStep(admin, ctx.organizationId, "team");
  revalidatePath("/app/onboarding");
  return { ok: true as const };
}

export async function onboardingTeamContinue(formData: FormData) {
  const ctx = await getHelpHubContext();
  if (!ctx.organizationId) return { error: "No workspace" };
  const gate = await requireOwnerManagerAdmin(ctx.organizationId);
  if ("error" in gate) return { error: gate.error };

  const industry = String(formData.get("industry") ?? "").trim() || null;
  const admin = adminClient();
  if (industry) {
    await admin
      .from("organization_onboarding")
      .update({ industry })
      .eq("organization_id", ctx.organizationId);
  }
  await seedDefaultRoles(admin, ctx.organizationId, industry ?? undefined);
  await setWizardStep(admin, ctx.organizationId, "operating");
  await syncDerivedActivationSteps(admin, ctx.organizationId);
  revalidatePath("/app/onboarding");
  return { ok: true as const };
}

export async function onboardingOperatingContinue() {
  const ctx = await getHelpHubContext();
  if (!ctx.organizationId) return { error: "No workspace" };
  const gate = await requireOwnerManagerAdmin(ctx.organizationId);
  if ("error" in gate) return { error: gate.error };

  const admin = adminClient();
  await ensureDefaultWorkforceSettings(admin, ctx.organizationId);
  await setWizardStep(admin, ctx.organizationId, "templates");
  revalidatePath("/app/onboarding");
  return { ok: true as const };
}

export async function onboardingApplyStarterPack() {
  const ctx = await getHelpHubContext();
  if (!ctx.organizationId) return { error: "No workspace" };
  const gate = await requireOwnerManagerAdmin(ctx.organizationId);
  if ("error" in gate) return { error: gate.error };

  const admin = adminClient();
  const { data: ob } = await admin
    .from("organization_onboarding")
    .select("industry")
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  const res = await applyStarterPack(admin, ctx.organizationId, ob?.industry as string | null);
  if (!res.ok) return { error: res.error };

  await setWizardStep(admin, ctx.organizationId, "invite");
  await syncDerivedActivationSteps(admin, ctx.organizationId);
  revalidatePath("/app/onboarding");
  return { ok: true as const };
}

export async function onboardingSkipStarterPack() {
  const ctx = await getHelpHubContext();
  if (!ctx.organizationId) return { error: "No workspace" };
  const gate = await requireOwnerManagerAdmin(ctx.organizationId);
  if ("error" in gate) return { error: gate.error };

  const admin = adminClient();
  await setWizardStep(admin, ctx.organizationId, "invite");
  revalidatePath("/app/onboarding");
  return { ok: true as const };
}

export async function onboardingInviteContinue() {
  const ctx = await getHelpHubContext();
  if (!ctx.organizationId) return { error: "No workspace" };
  const gate = await requireOwnerManagerAdmin(ctx.organizationId);
  if ("error" in gate) return { error: gate.error };

  const admin = adminClient();
  await setWizardStep(admin, ctx.organizationId, "activation");
  revalidatePath("/app/onboarding");
  return { ok: true as const };
}

export async function onboardingFinish() {
  const ctx = await getHelpHubContext();
  if (!ctx.organizationId) return { error: "No workspace" };
  const gate = await requireOwnerManagerAdmin(ctx.organizationId);
  if ("error" in gate) return { error: gate.error };

  const admin = adminClient();
  await syncDerivedActivationSteps(admin, ctx.organizationId);
  await markOnboardingCompleted(admin, ctx.organizationId);
  revalidatePath("/app", "layout");
  revalidatePath("/app/onboarding");
  return { ok: true as const };
}

export async function onboardingGoToStep(step: string) {
  if (!isWizardStep(step)) return { error: "Invalid step" };
  const ctx = await getHelpHubContext();
  if (!ctx.organizationId) return { error: "No workspace" };
  const gate = await requireOwnerManagerAdmin(ctx.organizationId);
  if ("error" in gate) return { error: gate.error };

  const admin = adminClient();
  await setWizardStep(admin, ctx.organizationId, step as OnboardingWizardStepSlug);
  revalidatePath("/app/onboarding");
  return { ok: true as const };
}

export async function onboardingAdvanceFromStep(current: OnboardingWizardStepSlug) {
  const next = nextWizardStep(current);
  if (!next) return { error: "No next step" };
  return onboardingGoToStep(next);
}
