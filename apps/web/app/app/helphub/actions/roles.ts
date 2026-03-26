"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/helphub/require-org";

export async function upsertStaffRole(formData: FormData) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required" };

  if (id) {
    const u = await supabase.from("staff_roles").update({ name }).eq("id", id).eq("organization_id", orgId);
    if (u.error) return { error: u.error.message };
  } else {
    const i = await supabase.from("staff_roles").insert({ organization_id: orgId, name });
    if (i.error) return { error: i.error.message };
  }
  revalidatePath("/app/roles");
  revalidatePath("/app/checklists");
  revalidatePath("/app/schedule");
  return { ok: true };
}

export async function deleteStaffRole(id: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const d = await supabase.from("staff_roles").delete().eq("id", id).eq("organization_id", orgId);
  if (d.error) return { error: d.error.message };
  revalidatePath("/app/roles");
  return { ok: true };
}

export async function deleteStaffRoleForm(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing id" };
  return deleteStaffRole(id);
}

export async function upsertStaffRoleFormAction(formData: FormData): Promise<void> {
  await upsertStaffRole(formData);
}

export async function deleteStaffRoleFormAction(formData: FormData): Promise<void> {
  await deleteStaffRoleForm(formData);
}
