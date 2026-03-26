"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getDefaultTenantIdForUser, getTenantMembership } from "@/lib/tenant-auth/context";

const LOGO_BUCKET = "site-logos";

export const createSite = async (formData: FormData) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const defaultTenantId = await getDefaultTenantIdForUser(supabase, user.id);
  if (!defaultTenantId) return { error: "No tenant" };
  const m = await getTenantMembership(supabase, user.id, defaultTenantId);
  if (!m) return { error: "No tenant" };

  const name = (formData.get("name") as string)?.trim();
  const address = (formData.get("address") as string)?.trim() || null;
  const timezone = (formData.get("timezone") as string)?.trim() || "UTC";
  if (!name) return { error: "Name is required" };

  const { data: site, error: insertError } = await supabase
    .from("sites")
    .insert({
      tenant_id: defaultTenantId,
      name,
      address,
      timezone,
    })
    .select("id")
    .single();
  if (insertError) return { error: insertError.message };

  const file = formData.get("logo") as File | null;
  if (file && file.size > 0) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${defaultTenantId}/${site.id}.${ext}`;
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

export type ArchiveSiteResult = { ok: true } | { ok: false; error: string };

/** Soft-archive site + its rooms; revoke active QR tokens. Ticket history is preserved. */
export const archiveSite = async (siteId: string): Promise<ArchiveSiteResult> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: site } = await supabase
    .from("sites")
    .select("id, tenant_id, name, archived_at")
    .eq("id", siteId)
    .single();
  if (!site) return { ok: false, error: "Customer not found or access denied" };
  if (site.archived_at) return { ok: false, error: "This customer is already archived." };

  const siteTenantId = site.tenant_id as string;
  const m = await getTenantMembership(supabase, user.id, siteTenantId);
  if (!m) {
    return { ok: false, error: "Customer not found or access denied" };
  }

  const now = new Date().toISOString();
  const { data: roomRows } = await supabase.from("rooms").select("id").eq("site_id", siteId).is("archived_at", null);
  const roomIds = (roomRows ?? []).map((r) => r.id);
  if (roomIds.length > 0) {
    await supabase
      .from("room_tokens")
      .update({ revoked_at: now, revoked_reason: "site_archived" })
      .in("room_id", roomIds)
      .is("revoked_at", null);
    const { error: roomsErr } = await supabase.from("rooms").update({ archived_at: now }).in("id", roomIds);
    if (roomsErr) return { ok: false, error: roomsErr.message };
  }

  const { error } = await supabase.from("sites").update({ archived_at: now }).eq("id", siteId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/admin/sites");
  revalidatePath("/app");
  revalidatePath(`/app/sites/${siteId}`);
  return { ok: true };
};

/** @deprecated Use archiveSite — hard deletes are no longer used for sites with ticket history. */
export const deleteSite = archiveSite;
export type DeleteSiteResult = ArchiveSiteResult;
