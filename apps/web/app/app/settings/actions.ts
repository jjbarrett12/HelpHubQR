"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .single();
  if (!profile?.tenant_id || profile.role !== "admin") {
    return { error: "Only tenant admins can update branding." };
  }

  const file = formData.get("logo") as File | null;
  if (file && file.size > 0) {

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${TENANT_LOGO_PREFIX}/${profile.tenant_id}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { upsert: true });
  if (uploadError) return { error: uploadError.message };

  const { data: urlData } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  const { error: updateError } = await supabase
    .from("tenants")
    .update({ logo_url: urlData.publicUrl })
    .eq("id", profile.tenant_id);
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
    .eq("id", profile.tenant_id);
  if (updateError) return { error: updateError.message };
  revalidatePath("/app", "layout");
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function updateTenantBranding(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .single();
  if (!profile?.tenant_id || profile.role !== "admin") {
    return { error: "Only tenant admins can update branding." };
  }

  const primaryColor = (formData.get("primary_color") as string | null)?.trim() || null;
  const { data: tenant } = await supabase
    .from("tenants")
    .select("branding")
    .eq("id", profile.tenant_id)
    .single();
  const branding = (tenant?.branding as Record<string, unknown>) ?? {};
  const newBranding = { ...branding, primary_color: primaryColor && /^#[0-9A-Fa-f]{6}$/.test(primaryColor) ? primaryColor : null };
  const { error } = await supabase
    .from("tenants")
    .update({ branding: newBranding })
    .eq("id", profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/app", "layout");
  revalidatePath("/app/settings");
  return { ok: true };
}
