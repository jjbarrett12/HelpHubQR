"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/helphub/require-org";

export async function upsertLocation(formData: FormData) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  if (!name) return { error: "Name is required" };

  if (id) {
    const u = await supabase.from("locations").update({ name, address }).eq("id", id).eq("organization_id", orgId);
    if (u.error) return { error: u.error.message };
  } else {
    const i = await supabase.from("locations").insert({ organization_id: orgId, name, address });
    if (i.error) return { error: i.error.message };
  }
  revalidatePath("/app/locations");
  revalidatePath("/app/employees");
  revalidatePath("/app/checklists");
  return { ok: true };
}

export async function deleteLocation(id: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const d = await supabase.from("locations").delete().eq("id", id).eq("organization_id", orgId);
  if (d.error) return { error: d.error.message };
  revalidatePath("/app/locations");
  return { ok: true };
}

export async function deleteLocationForm(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing id" };
  return deleteLocation(id);
}

export async function upsertLocationFormAction(formData: FormData): Promise<void> {
  await upsertLocation(formData);
}

export async function deleteLocationFormAction(formData: FormData): Promise<void> {
  await deleteLocationForm(formData);
}
