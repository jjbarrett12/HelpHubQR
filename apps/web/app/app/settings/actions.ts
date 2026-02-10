"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const LOGO_BUCKET = "site-logos";
const TENANT_LOGO_PREFIX = "tenant-logos";

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
  if (!file || file.size === 0) return { error: "Please select a logo file." };

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

  revalidatePath("/app");
  revalidatePath("/app/settings");
  return { ok: true };
}
