"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import {
  applyStarterPack,
  createLocationIfNeeded,
  ensureDefaultWorkforceSettings,
  ensureOnboardingRecord,
  listProvisioningEvents,
  markOnboardingCompleted,
  provisionOrganization,
  seedDefaultRoles,
  setLaunchState,
  syncDerivedActivationSteps,
} from "@/lib/onboarding/provisioning-service";
import type { ProvisionIndustry } from "@/lib/helphub/onboarding/types";
import type { LaunchState, OnboardingMode } from "@/lib/onboarding/types";
import { deriveOwnerInviteStatus } from "@/lib/admin-onboarding/invite-status";
import {
  adminBlockerClearSchema,
  adminBlockerFlagSchema,
  adminFirstLocationSchema,
  adminOnboardingMetaPatchSchema,
  adminSupportNoteBodySchema,
} from "@/lib/admin-onboarding/schemas";

async function gate() {
  const ctx = await requirePlatformAdmin();
  if (!ctx) return null;
  return createServiceRoleClient();
}

async function getActorUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function getActorEmail(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email?.trim() ?? null;
}

/** Keep legacy `/platform-admin/onboarding` and new `/admin/onboarding` in sync. */
function revalidateAdminOnboardingPaths(organizationId?: string) {
  revalidatePath("/platform-admin/onboarding");
  revalidatePath("/admin/onboarding");
  if (organizationId) {
    revalidatePath(`/platform-admin/onboarding/${organizationId}`);
    revalidatePath(`/admin/onboarding/${organizationId}`);
  }
}

export async function fetchOnboardingConsoleList() {
  const admin = await gate();
  if (!admin) return null;
  const { data: orgs, error } = await admin
    .from("organizations")
    .select("id, name, created_at, provisioning_idempotency_key")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) return { error: error.message };
  const ids = (orgs ?? []).map((o) => o.id as string);
  if (ids.length === 0) return { organizations: [] as const, onboardingByOrg: {} as Record<string, unknown> };

  const { data: onboardings, error: oErr } = await admin
    .from("organization_onboarding")
    .select("*")
    .in("organization_id", ids);
  if (oErr) return { error: oErr.message };

  const map: Record<string, (typeof onboardings)[0]> = {};
  for (const row of onboardings ?? []) {
    map[row.organization_id as string] = row;
  }
  return { organizations: orgs ?? [], onboardingByOrg: map };
}

export async function fetchOnboardingOrgDetail(organizationId: string) {
  const admin = await gate();
  if (!admin) return null;

  const [
    { data: org },
    { data: onboarding },
    { data: steps },
    ev,
    { data: locations },
    { data: ownerRow },
    { data: supportNotes },
    { data: inviteLogsRaw },
  ] = await Promise.all([
    admin
      .from("organizations")
      .select("id, name, created_at, provisioning_idempotency_key")
      .eq("id", organizationId)
      .maybeSingle(),
    admin.from("organization_onboarding").select("*").eq("organization_id", organizationId).maybeSingle(),
    admin.from("organization_onboarding_steps").select("*").eq("organization_id", organizationId),
    listProvisioningEvents(admin, organizationId),
    admin
      .from("locations")
      .select("id, name, address, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle(),
    admin
      .from("organization_support_notes")
      .select("id, body, created_by, created_by_email, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("organization_owner_invite_log")
      .select("id, action, status, created_at, error_message, actor_user_id")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (!org) return { error: "Organization not found" };

  const ownerUserId = (ownerRow?.user_id as string | undefined) ?? null;
  let ownerEmail: string | null = null;
  let emailConfirmedAt: string | null = null;
  let lastSignInAt: string | null = null;

  if (ownerUserId) {
    const { data: ures } = await admin.auth.admin.getUserById(ownerUserId);
    const u = ures?.user;
    if (u) {
      ownerEmail = u.email?.trim() ?? null;
      emailConfirmedAt = (u as { email_confirmed_at?: string }).email_confirmed_at ?? null;
      lastSignInAt = (u as { last_sign_in_at?: string }).last_sign_in_at ?? null;
    }
  }

  const inviteLogs = inviteLogsRaw ?? [];
  const lastLog =
    inviteLogs.length > 0
      ? {
          status: inviteLogs[0].status as string,
          action: inviteLogs[0].action as string,
          created_at: inviteLogs[0].created_at as string,
          error_message: (inviteLogs[0].error_message as string | null) ?? null,
        }
      : null;

  const derived = deriveOwnerInviteStatus(emailConfirmedAt, lastSignInAt, lastLog);

  const ownerInvite = {
    ownerEmail,
    status: derived.status,
    lastSentAt: derived.lastSentAt,
    acceptedAt: derived.acceptedAt,
    emailConfirmedAt,
    lastSignInAt,
  };

  const ownerInviteLog = inviteLogs.map((row) => ({
    id: row.id as string,
    action: row.action as string,
    status: row.status as string,
    created_at: row.created_at as string,
    error_message: (row.error_message as string | null) ?? null,
    actor_user_id: row.actor_user_id as string,
  }));

  const notes =
    supportNotes?.map((n) => ({
      id: n.id as string,
      body: n.body as string,
      created_by: (n.created_by as string | null) ?? null,
      created_by_email: (n.created_by_email as string | null) ?? null,
      created_at: n.created_at as string,
    })) ?? [];

  return {
    org,
    onboarding,
    steps: steps ?? [],
    events: ev,
    locations: locations ?? [],
    ownerUserId,
    ownerInvite,
    supportNotes: notes,
    ownerInviteLog,
  };
}

export async function adminCreateOrgWithOwner(formData: FormData) {
  const admin = await gate();
  if (!admin) return { error: "Forbidden" };

  const name = String(formData.get("name") ?? "").trim();
  const ownerUserId = String(formData.get("owner_user_id") ?? "").trim();
  const idempotencyKey = String(formData.get("idempotency_key") ?? "").trim() || `admin_bootstrap:${crypto.randomUUID()}`;
  const industryRaw = String(formData.get("industry") ?? "").trim();
  const planKey = String(formData.get("plan_key") ?? "").trim() || null;

  if (!name) return { error: "Organization name is required" };
  if (!ownerUserId) return { error: "Owner user id is required" };

  const { data: ownerAuth, error: ownerErr } = await admin.auth.admin.getUserById(ownerUserId);
  if (ownerErr || !ownerAuth?.user) {
    return { error: ownerErr?.message ?? "Owner auth user not found" };
  }
  const ownerEmail = ownerAuth.user.email?.trim() || `owner+${ownerUserId.replace(/-/g, "").slice(0, 12)}@unknown.invalid`;

  const industry = (industryRaw || "other") as ProvisionIndustry;

  const result = await provisionOrganization(admin, {
    mode: "admin_assisted",
    idempotencyKey,
    organization: {
      name,
      industry,
    },
    owner: {
      authUserId: ownerUserId,
      email: ownerEmail,
    },
    plan: { key: planKey },
    firstLocation: null,
    starterPack: { key: industry === "other" ? null : industry, enabled: true },
  });

  if (!result.success || !result.organizationId) {
    return { error: result.errors.join("; ") || "Provisioning failed" };
  }

  revalidateAdminOnboardingPaths(result.organizationId);
  return { ok: true as const, organizationId: result.organizationId, provision: result };
}

/** Validated industry + plan (admin console form). */
export async function adminUpdateOnboardingIndustryPlan(
  organizationId: string,
  raw: { industry: string; plan_key: string }
) {
  const admin = await gate();
  if (!admin) return { error: "Forbidden" };

  const parsed = adminOnboardingMetaPatchSchema.safeParse({
    industry: raw.industry,
    plan_key: raw.plan_key,
  });
  if (!parsed.success) {
    const msg = parsed.error.issues.map((e) => e.message).join("; ");
    return { error: msg };
  }

  const { error } = await admin
    .from("organization_onboarding")
    .update({
      industry: parsed.data.industry,
      plan_key: parsed.data.plan_key,
    })
    .eq("organization_id", organizationId);
  if (error) return { error: error.message };
  revalidateAdminOnboardingPaths(organizationId);
  return { ok: true as const };
}

export async function adminUpdateOnboardingMeta(
  organizationId: string,
  patch: {
    industry?: string | null;
    plan_key?: string | null;
    onboarding_mode?: OnboardingMode;
    assigned_csm_user_id?: string | null;
    current_step?: string | null;
  }
) {
  const admin = await gate();
  if (!admin) return { error: "Forbidden" };

  const updatePayload: Record<string, unknown> = {};

  if (patch.onboarding_mode !== undefined) updatePayload.onboarding_mode = patch.onboarding_mode;
  if (patch.assigned_csm_user_id !== undefined) {
    updatePayload.assigned_csm_user_id = patch.assigned_csm_user_id;
  }
  if (patch.current_step !== undefined) updatePayload.current_step = patch.current_step;

  if (patch.industry !== undefined || patch.plan_key !== undefined) {
    const { data: current } = await admin
      .from("organization_onboarding")
      .select("industry, plan_key")
      .eq("organization_id", organizationId)
      .maybeSingle();

    const industryInput =
      patch.industry !== undefined && patch.industry !== null
        ? String(patch.industry).trim()
        : String((current?.industry as string | null) ?? "general").trim();

    const planInput =
      patch.plan_key !== undefined
        ? patch.plan_key === null
          ? ""
          : String(patch.plan_key).trim()
        : String((current?.plan_key as string | null) ?? "").trim();

    const parsed = adminOnboardingMetaPatchSchema.safeParse({
      industry: industryInput,
      plan_key: planInput,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues.map((e) => e.message).join("; ") };
    }
    updatePayload.industry = parsed.data.industry;
    updatePayload.plan_key = parsed.data.plan_key;
  }

  if (Object.keys(updatePayload).length === 0) {
    return { error: "No fields to update" };
  }

  const { error } = await admin
    .from("organization_onboarding")
    .update(updatePayload)
    .eq("organization_id", organizationId);
  if (error) return { error: error.message };
  revalidateAdminOnboardingPaths(organizationId);
  return { ok: true as const };
}

export async function adminEnsureOnboardingRow(organizationId: string, mode: OnboardingMode = "admin_assisted") {
  const admin = await gate();
  if (!admin) return { error: "Forbidden" };
  await ensureOnboardingRecord(admin, organizationId, mode);
  await syncDerivedActivationSteps(admin, organizationId);
  revalidateAdminOnboardingPaths(organizationId);
  return { ok: true as const };
}

export async function adminApplyStarterPack(organizationId: string, forceNewKey?: boolean) {
  const admin = await gate();
  if (!admin) return { error: "Forbidden" };
  const { data: ob } = await admin
    .from("organization_onboarding")
    .select("industry")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const keyOverride = forceNewKey
    ? `starter_pack:${(ob?.industry as string) ?? "general"}:retry:${Date.now()}`
    : undefined;
  const res = await applyStarterPack(admin, organizationId, ob?.industry as string | null, {
    idempotencyKeyOverride: keyOverride,
  });
  if (!res.ok) return { error: res.error };
  await syncDerivedActivationSteps(admin, organizationId);
  revalidateAdminOnboardingPaths(organizationId);
  return { ok: true as const };
}

export async function adminSeedRoles(organizationId: string) {
  const admin = await gate();
  if (!admin) return { error: "Forbidden" };
  const { data: ob } = await admin
    .from("organization_onboarding")
    .select("industry")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const res = await seedDefaultRoles(admin, organizationId, ob?.industry as string | null);
  if (!res.ok) return { error: res.error };
  await syncDerivedActivationSteps(admin, organizationId);
  revalidateAdminOnboardingPaths(organizationId);
  return { ok: true as const };
}

export async function adminEnsureWorkforceSettings(organizationId: string) {
  const admin = await gate();
  if (!admin) return { error: "Forbidden" };
  await ensureDefaultWorkforceSettings(admin, organizationId);
  revalidateAdminOnboardingPaths(organizationId);
  return { ok: true as const };
}

export async function adminSyncActivation(organizationId: string) {
  const admin = await gate();
  if (!admin) return { error: "Forbidden" };
  await syncDerivedActivationSteps(admin, organizationId);
  revalidateAdminOnboardingPaths(organizationId);
  return { ok: true as const };
}

/**
 * Legacy launch_state toggle. Prefer `adminFlagBlocker` / `adminClearBlocker` for full metadata.
 */
export async function adminSetLaunchState(organizationId: string, state: LaunchState) {
  const admin = await gate();
  if (!admin) return { error: "Forbidden" };
  const actor = await getActorUserId();
  const now = new Date().toISOString();

  if (state === "blocked") {
    const { error } = await admin
      .from("organization_onboarding")
      .update({
        launch_state: "blocked",
        blocker_flagged_at: now,
        blocker_flagged_by: actor,
        blocker_category: "other",
        blocker_reason:
          "Legacy adminSetLaunchState(blocked). Use “Flag blocker” in /admin/onboarding for structured metadata.",
        blocker_cleared_by: null,
        blocker_cleared_at: null,
        blocker_resolution_note: null,
      })
      .eq("organization_id", organizationId);
    if (error) return { error: error.message };
  } else if (state === "in_progress") {
    const { error } = await admin
      .from("organization_onboarding")
      .update({
        launch_state: "in_progress",
        blocker_cleared_at: now,
        blocker_cleared_by: actor,
        blocker_resolution_note: "Legacy adminSetLaunchState(in_progress)",
      })
      .eq("organization_id", organizationId);
    if (error) return { error: error.message };
  } else {
    await setLaunchState(admin, organizationId, state);
  }

  revalidateAdminOnboardingPaths(organizationId);
  return { ok: true as const };
}

export async function adminFlagBlocker(
  organizationId: string,
  raw: { category: string; reason: string }
) {
  const admin = await gate();
  if (!admin) return { error: "Forbidden" };
  const parsed = adminBlockerFlagSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join("; ") };
  }
  const actor = await getActorUserId();
  if (!actor) return { error: "Could not resolve actor user" };
  const now = new Date().toISOString();

  const { error } = await admin
    .from("organization_onboarding")
    .update({
      launch_state: "blocked",
      blocker_category: parsed.data.category,
      blocker_reason: parsed.data.reason,
      blocker_flagged_by: actor,
      blocker_flagged_at: now,
      blocker_cleared_by: null,
      blocker_cleared_at: null,
      blocker_resolution_note: null,
    })
    .eq("organization_id", organizationId);
  if (error) return { error: error.message };
  revalidateAdminOnboardingPaths(organizationId);
  return { ok: true as const };
}

export async function adminClearBlocker(organizationId: string, raw?: { resolution_note?: string }) {
  const admin = await gate();
  if (!admin) return { error: "Forbidden" };
  const parsed = adminBlockerClearSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join("; ") };
  }
  const actor = await getActorUserId();
  if (!actor) return { error: "Could not resolve actor user" };
  const now = new Date().toISOString();

  const { error } = await admin
    .from("organization_onboarding")
    .update({
      launch_state: "in_progress",
      blocker_cleared_by: actor,
      blocker_cleared_at: now,
      blocker_resolution_note: parsed.data.resolution_note,
    })
    .eq("organization_id", organizationId);
  if (error) return { error: error.message };
  revalidateAdminOnboardingPaths(organizationId);
  return { ok: true as const };
}

export async function adminAddSupportNote(organizationId: string, bodyRaw: string) {
  const admin = await gate();
  if (!admin) return { error: "Forbidden" };
  const parsed = adminSupportNoteBodySchema.safeParse(bodyRaw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join("; ") };
  }
  const actor = await getActorUserId();
  const actorEmail = await getActorEmail();
  if (!actor) return { error: "Could not resolve actor user" };

  const { error } = await admin.from("organization_support_notes").insert({
    organization_id: organizationId,
    body: parsed.data,
    created_by: actor,
    created_by_email: actorEmail,
  });
  if (error) return { error: error.message };
  revalidateAdminOnboardingPaths(organizationId);
  return { ok: true as const };
}

export async function adminMarkLaunched(organizationId: string) {
  const admin = await gate();
  if (!admin) return { error: "Forbidden" };
  await markOnboardingCompleted(admin, organizationId);
  revalidateAdminOnboardingPaths(organizationId);
  return { ok: true as const };
}

export async function adminCreateFirstLocation(organizationId: string, name: string, address: string | null) {
  const admin = await gate();
  if (!admin) return { error: "Forbidden" };
  const parsed = adminFirstLocationSchema.safeParse({ name, address: address ?? undefined });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join("; ") };
  }
  const res = await createLocationIfNeeded(
    admin,
    organizationId,
    parsed.data.name,
    parsed.data.address ?? null
  );
  if (!res.ok) return { error: res.error };
  await syncDerivedActivationSteps(admin, organizationId);
  revalidateAdminOnboardingPaths(organizationId);
  return { ok: true as const, skipped: res.skipped };
}

export async function adminRetryProvisionWithStoredKey(organizationId: string) {
  const admin = await gate();
  if (!admin) return { error: "Forbidden" };

  const { data: org, error: oErr } = await admin
    .from("organizations")
    .select("id, name, provisioning_idempotency_key")
    .eq("id", organizationId)
    .maybeSingle();
  if (oErr || !org) return { error: oErr?.message ?? "Organization not found" };
  const key = org.provisioning_idempotency_key as string | null;
  if (!key?.trim()) {
    return {
      error:
        "No provisioning_idempotency_key on organization — cannot replay full pipeline. Use granular actions or backfill key (support-only).",
    };
  }

  const { data: owner } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  if (!owner?.user_id) return { error: "No owner membership for org" };

  const { data: auth, error: aErr } = await admin.auth.admin.getUserById(owner.user_id as string);
  if (aErr || !auth?.user) return { error: aErr?.message ?? "Could not load owner auth user" };
  const email =
    auth.user.email?.trim() ||
    `owner+${String(owner.user_id).replace(/-/g, "").slice(0, 12)}@unknown.invalid`;

  const { data: ob } = await admin
    .from("organization_onboarding")
    .select("industry, plan_key")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const industry = ((ob?.industry as string) || "other") as ProvisionIndustry;

  const result = await provisionOrganization(admin, {
    mode: "admin_assisted",
    idempotencyKey: key.trim(),
    organization: {
      name: org.name as string,
      industry,
    },
    owner: {
      authUserId: owner.user_id as string,
      email,
    },
    plan: { key: (ob?.plan_key as string | null) ?? null },
    firstLocation: null,
    starterPack: { key: industry === "other" ? null : industry, enabled: true },
  });

  if (!result.success) {
    return { error: result.errors.join("; ") || "Replay failed", provision: result };
  }
  revalidateAdminOnboardingPaths(organizationId);
  return { ok: true as const, provision: result };
}

type AdminAuthApi = {
  inviteUserByEmail: (
    email: string,
    options?: { redirectTo?: string; data?: Record<string, unknown> }
  ) => Promise<{ data: { user: { id: string } } | null; error: { message: string } | null }>;
  generateLink: (params: {
    type: "signup" | "recovery" | "invite" | "magiclink";
    email: string;
    options?: { redirectTo?: string };
  }) => Promise<{
    data: { properties?: { action_link?: string }; user?: unknown } | null;
    error: { message: string } | null;
  }>;
};

async function insertInviteLog(
  admin: Awaited<ReturnType<typeof gate>>,
  row: {
    organization_id: string;
    owner_user_id: string;
    actor_user_id: string;
    action: "invite_email" | "magiclink";
    status: "sent" | "failed" | "link_ready";
    provider_message?: string | null;
    error_message?: string | null;
  }
) {
  if (!admin) return;
  await admin.from("organization_owner_invite_log").insert({
    organization_id: row.organization_id,
    owner_user_id: row.owner_user_id,
    actor_user_id: row.actor_user_id,
    channel: "auth_admin",
    action: row.action,
    status: row.status,
    provider_message: row.provider_message ?? null,
    error_message: row.error_message ?? null,
  });
}

/**
 * Sends Supabase invite email when possible; if the user already exists, generates a magic link
 * (does not email automatically) — returned once for operator copy. All attempts audited.
 */
export async function adminResendOwnerInvite(organizationId: string) {
  const admin = await gate();
  if (!admin) return { error: "Forbidden" };

  const actor = await getActorUserId();
  if (!actor) return { error: "Could not resolve actor user" };

  const { data: owner } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  const ownerUserId = owner?.user_id as string | undefined;
  if (!ownerUserId) return { error: "No owner membership for org" };

  const { data: ures, error: uErr } = await admin.auth.admin.getUserById(ownerUserId);
  if (uErr || !ures?.user?.email) {
    return { error: uErr?.message ?? "Owner user or email missing" };
  }
  const email = ures.user.email.trim();
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const redirectTo = baseUrl ? `${baseUrl}/login` : undefined;
  if (!redirectTo) {
    return { error: "NEXT_PUBLIC_APP_URL is required for invite redirectTo" };
  }

  const authAdmin = admin.auth.admin as unknown as AdminAuthApi;

  const inviteResult = await authAdmin.inviteUserByEmail(email, {
    redirectTo,
    data: { helphub_organization_id: organizationId },
  });

  if (!inviteResult.error) {
    await insertInviteLog(admin, {
      organization_id: organizationId,
      owner_user_id: ownerUserId,
      actor_user_id: actor,
      action: "invite_email",
      status: "sent",
      provider_message: "inviteUserByEmail succeeded",
    });
    revalidateAdminOnboardingPaths(organizationId);
    return { ok: true as const, mode: "invite_email" as const };
  }

  const errMsg = inviteResult.error.message.toLowerCase();
  const duplicate =
    errMsg.includes("already") ||
    errMsg.includes("registered") ||
    errMsg.includes("exists") ||
    errMsg.includes("duplicate");

  if (!duplicate) {
    await insertInviteLog(admin, {
      organization_id: organizationId,
      owner_user_id: ownerUserId,
      actor_user_id: actor,
      action: "invite_email",
      status: "failed",
      error_message: inviteResult.error.message,
    });
    revalidateAdminOnboardingPaths(organizationId);
    return { error: inviteResult.error.message };
  }

  const linkResult = await authAdmin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (linkResult.error || !linkResult.data?.properties?.action_link) {
    await insertInviteLog(admin, {
      organization_id: organizationId,
      owner_user_id: ownerUserId,
      actor_user_id: actor,
      action: "magiclink",
      status: "failed",
      error_message: linkResult.error?.message ?? "generateLink returned no action_link",
    });
    revalidateAdminOnboardingPaths(organizationId);
    return { error: linkResult.error?.message ?? "Could not generate magic link" };
  }

  await insertInviteLog(admin, {
    organization_id: organizationId,
    owner_user_id: ownerUserId,
    actor_user_id: actor,
    action: "magiclink",
    status: "link_ready",
    provider_message: "Magic link generated; distribute securely — not emailed automatically.",
  });
  revalidateAdminOnboardingPaths(organizationId);
  return {
    ok: true as const,
    mode: "magiclink" as const,
    magicLink: linkResult.data.properties.action_link,
    warning:
      "User already exists — Supabase did not send email. Copy the link and send through your approved channel. Link is sensitive.",
  };
}
