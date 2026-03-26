"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getDefaultTenantIdForUser, isTenantDashboardAdmin } from "@/lib/tenant-auth/context";

const LOGO_BUCKET = "site-logos";
const TENANT_LOGO_PREFIX = "tenant-logos";

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export async function updateTenantLogo(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const defaultTenantId = await getDefaultTenantIdForUser(supabase, user.id);
  const canBrand = defaultTenantId ? await isTenantDashboardAdmin(supabase, user.id, defaultTenantId) : false;
  if (!defaultTenantId || !canBrand) {
    return { error: "Only tenant admins can update branding." };
  }

  const file = formData.get("logo") as File | null;
  if (file && file.size > 0) {

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${TENANT_LOGO_PREFIX}/${defaultTenantId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { upsert: true });
  if (uploadError) return { error: uploadError.message };

  const { data: urlData } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  const { error: updateError } = await supabase
    .from("tenants")
    .update({ logo_url: urlData.publicUrl })
    .eq("id", defaultTenantId);
  if (updateError) return { error: updateError.message };

  revalidatePath("/app", "layout");
  revalidatePath("/app/settings");
  return { ok: true };
  }

  const logoUrlInput = (formData.get("logo_url") as string | null)?.trim() ?? "";
  const urlToSet = logoUrlInput === "" ? null : (isValidUrl(logoUrlInput) ? logoUrlInput : null);
  if (logoUrlInput !== "" && !urlToSet) return { error: "Please enter a valid logo URL." };
  const { error: updateError } = await supabase
    .from("tenants")
    .update({ logo_url: urlToSet })
    .eq("id", defaultTenantId);
  if (updateError) return { error: updateError.message };
  revalidatePath("/app", "layout");
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function updateTenantBranding(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const defaultTenantId = await getDefaultTenantIdForUser(supabase, user.id);
  const canBrand = defaultTenantId ? await isTenantDashboardAdmin(supabase, user.id, defaultTenantId) : false;
  if (!defaultTenantId || !canBrand) {
    return { error: "Only tenant admins can update branding." };
  }

  const primaryColor = (formData.get("primary_color") as string | null)?.trim() || null;
  const { data: tenant } = await supabase
    .from("tenants")
    .select("branding")
    .eq("id", defaultTenantId)
    .single();
  const branding = (tenant?.branding as Record<string, unknown>) ?? {};
  const newBranding = { ...branding, primary_color: primaryColor && /^#[0-9A-Fa-f]{6}$/.test(primaryColor) ? primaryColor : null };
  const { error } = await supabase
    .from("tenants")
    .update({ branding: newBranding })
    .eq("id", defaultTenantId);
  if (error) return { error: error.message };
  revalidatePath("/app", "layout");
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function markTenantOnboardingComplete() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const defaultTenantId = await getDefaultTenantIdForUser(supabase, user.id);
  const can = defaultTenantId ? await isTenantDashboardAdmin(supabase, user.id, defaultTenantId) : false;
  if (!defaultTenantId || !can) {
    return { error: "Only tenant admins can update onboarding status." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("tenant_onboarding")
    .update({ status: "completed", completed_at: now, updated_at: now })
    .eq("tenant_id", defaultTenantId);
  if (error) return { error: error.message };
  revalidatePath("/app");
  revalidatePath("/app/settings");
  revalidatePath("/app/dashboard");
  return { ok: true as const };
}
