"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const LOGO_BUCKET = "site-logos";

export const createSite = async (formData: FormData) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();
  if (!profile?.tenant_id) return { error: "No tenant" };

  const name = (formData.get("name") as string)?.trim();
  const address = (formData.get("address") as string)?.trim() || null;
  const timezone = (formData.get("timezone") as string)?.trim() || "UTC";
  const roomCountRaw = formData.get("room_count");
  const room_count = roomCountRaw ? parseInt(String(roomCountRaw), 10) : null;
  if (!name) return { error: "Name is required" };

  const { data: site, error: insertError } = await supabase
    .from("sites")
    .insert({
      tenant_id: profile.tenant_id,
      name,
      address,
      timezone,
      room_count: Number.isFinite(room_count) ? room_count : null,
    })
    .select("id")
    .single();
  if (insertError) return { error: insertError.message };

  const file = formData.get("logo") as File | null;
  if (file && file.size > 0) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${profile.tenant_id}/${site.id}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(LOGO_BUCKET)
      .upload(path, file, { upsert: true });
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
      await supabase.from("sites").update({ logo_url: urlData.publicUrl }).eq("id", site.id);
    }
  }
  revalidatePath("/app/admin/sites");
  revalidatePath("/app");
  return { ok: true };
};

export type DeleteSiteResult = { ok: true } | { ok: false; error: string };

export const deleteSite = async (siteId: string): Promise<DeleteSiteResult> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: site } = await supabase
    .from("sites")
    .select("id, tenant_id, name")
    .eq("id", siteId)
    .single();
  if (!site) return { ok: false, error: "Customer not found or access denied" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();
  if (!profile || profile.tenant_id !== site.tenant_id) {
    return { ok: false, error: "Customer not found or access denied" };
  }

  const { error } = await supabase.from("sites").delete().eq("id", siteId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/admin/sites");
  revalidatePath("/app");
  return { ok: true };
};
