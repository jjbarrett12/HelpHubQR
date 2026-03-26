"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { revalidatePath } from "next/cache";

const LOGO_BUCKET = "site-logos";
const TENANT_LOGO_PREFIX = "tenant-logos";

async function ensurePlatformAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: up } = await supabase
    .from("user_profiles")
    .select("is_platform_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!up?.is_platform_admin) throw new Error("Forbidden");
  return { user, supabase };
}

export async function createTenant(formData: FormData) {
  const { supabase } = await ensurePlatformAdmin();
  const name = (formData.get("name") as string)?.trim();
  const billing_email = (formData.get("billing_email") as string)?.trim() || null;
  const billing_name = (formData.get("billing_name") as string)?.trim() || null;
  const billing_address = (formData.get("billing_address") as string)?.trim() || null;
  if (!name) return { error: "Name is required" };

  const { data: tenant, error } = await supabase
    .from("tenants")
    .insert({ name, billing_email, billing_name, billing_address })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const file = formData.get("logo") as File | null;
  if (file && file.size > 0) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${TENANT_LOGO_PREFIX}/${tenant.id}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, { upsert: true });
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
      await supabase.from("tenants").update({ logo_url: urlData.publicUrl }).eq("id", tenant.id);
    }
  }
  revalidatePath("/platform-admin");
  revalidatePath("/platform-admin/tenants/new");
  return { ok: true, tenantId: tenant.id };
}

export async function updateTenant(
  tenantId: string,
  formData: FormData
) {
  const { supabase } = await ensurePlatformAdmin();
  const name = (formData.get("name") as string)?.trim();
  const billing_email = (formData.get("billing_email") as string)?.trim() || null;
  const billing_name = (formData.get("billing_name") as string)?.trim() || null;
  const billing_address = (formData.get("billing_address") as string)?.trim() || null;
  if (!name) return { error: "Name is required" };

  const { error } = await supabase
    .from("tenants")
    .update({ name, billing_email, billing_name, billing_address })
    .eq("id", tenantId);
  if (error) return { error: error.message };

  const file = formData.get("logo") as File | null;
  if (file && file.size > 0) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${TENANT_LOGO_PREFIX}/${tenantId}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, { upsert: true });
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
      await supabase.from("tenants").update({ logo_url: urlData.publicUrl }).eq("id", tenantId);
    }
  }
  revalidatePath("/platform-admin");
  revalidatePath(`/platform-admin/tenants/${tenantId}`);
  return { ok: true };
}

export async function updateUserEmail(userId: string, email: string) {
  await ensurePlatformAdmin();
  const admin = createServiceRoleClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { email: email.trim() });
  if (error) return { error: error.message };
  revalidatePath("/platform-admin");
  return { ok: true };
}

export async function updateUserPassword(userId: string, password: string) {
  await ensurePlatformAdmin();
  if (password.length < 6) return { error: "Password must be at least 6 characters" };
  const admin = createServiceRoleClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password: password.trim() });
  if (error) return { error: error.message };
  revalidatePath("/platform-admin");
  return { ok: true };
}

export async function setUserRole(userId: string, tenantId: string, role: "admin" | "manager" | "staff") {
  const { supabase, user } = await ensurePlatformAdmin();
  const { error } = await supabase.from("tenant_memberships").upsert(
    {
      tenant_id: tenantId,
      user_id: userId,
      role,
      status: "active",
      created_by: user.id,
      disabled_at: null,
    },
    { onConflict: "tenant_id,user_id" }
  );
  if (error) return { error: error.message };

  if (role === "admin") {
    await supabase
      .from("tenant_onboarding")
      .update({ primary_admin_user_id: userId, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .is("primary_admin_user_id", null);
  }

  revalidatePath("/platform-admin");
  return { ok: true };
}

/** Platform admin: create invite; returns one-time token in JSON (show operator once). */
export async function createTenantInviteForCustomer(
  tenantId: string,
  email: string,
  role: "admin" | "manager" | "staff"
) {
  await ensurePlatformAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("hh_tenant_create_invite", {
    p_tenant_id: tenantId,
    p_email: email.trim(),
    p_role: role,
  });
  if (error) return { error: error.message };
  const row = data as { ok?: boolean; error?: string; token?: string } | null;
  if (!row?.ok) return { error: row?.error ?? "Invite failed" };
  revalidatePath(`/platform-admin/tenants/${tenantId}`);
  return { ok: true as const, token: row.token };
}

/** Returns map of user_id -> email for the given user ids (platform admin only). */
export async function getUserEmails(userIds: string[]): Promise<Record<string, string>> {
  await ensurePlatformAdmin();
  if (userIds.length === 0) return {};
  const admin = createServiceRoleClient();
  const result: Record<string, string> = {};
  await Promise.all(
    userIds.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      if (data?.user?.email) result[id] = data.user.email;
    })
  );
  return result;
}
