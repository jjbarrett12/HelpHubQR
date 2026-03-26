"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/helphub/require-org";

export async function upsertEmployee(formData: FormData) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const id = String(formData.get("id") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const locationIdRaw = String(formData.get("location_id") ?? "").trim();
  const locationId = locationIdRaw ? locationIdRaw : null;
  const isActive = String(formData.get("is_active") ?? "true") !== "false";
  const staffRoleId = String(formData.get("staff_role_id") ?? "").trim();
  const authUserRaw = String(formData.get("auth_user_id") ?? "").trim();
  const authUserId = authUserRaw ? authUserRaw : null;

  if (!fullName) return { error: "Name is required" };

  if (id) {
    const upd = await supabase
      .from("employees")
      .update({
        full_name: fullName,
        phone,
        email,
        location_id: locationId,
        is_active: isActive,
        auth_user_id: authUserId,
      })
      .eq("id", id)
      .eq("organization_id", orgId);
    if (upd.error) return { error: upd.error.message };
  } else {
    const ins = await supabase
      .from("employees")
      .insert({
        organization_id: orgId,
        full_name: fullName,
        phone,
        email,
        location_id: locationId,
        is_active: isActive,
      })
      .select("id")
      .single();
    if (ins.error) return { error: ins.error.message };
    const newId = ins.data.id as string;
    if (staffRoleId) {
      const a = await supabase.from("employee_role_assignments").insert({
        organization_id: orgId,
        employee_id: newId,
        staff_role_id: staffRoleId,
        is_primary: true,
      });
      if (a.error) return { error: a.error.message };
    }
    revalidatePath("/app/employees");
    return { ok: true };
  }

  if (staffRoleId) {
    const existing = await supabase
      .from("employee_role_assignments")
      .select("id")
      .eq("employee_id", id)
      .eq("staff_role_id", staffRoleId)
      .maybeSingle();
    if (!existing.data?.id) {
      const a = await supabase.from("employee_role_assignments").insert({
        organization_id: orgId,
        employee_id: id,
        staff_role_id: staffRoleId,
        is_primary: true,
      });
      if (a.error) return { error: a.error.message };
    }
  }

  revalidatePath("/app/employees");
  return { ok: true };
}

export async function setEmployeeRolePrimary(employeeId: string, staffRoleId: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  await supabase
    .from("employee_role_assignments")
    .update({ is_primary: false })
    .eq("employee_id", employeeId)
    .eq("organization_id", orgId);

  const existing = await supabase
    .from("employee_role_assignments")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("staff_role_id", staffRoleId)
    .maybeSingle();

  if (existing.data?.id) {
    await supabase.from("employee_role_assignments").update({ is_primary: true }).eq("id", existing.data.id);
  } else {
    const a = await supabase.from("employee_role_assignments").insert({
      organization_id: orgId,
      employee_id: employeeId,
      staff_role_id: staffRoleId,
      is_primary: true,
    });
    if (a.error) return { error: a.error.message };
  }

  revalidatePath("/app/employees");
  return { ok: true };
}

export async function removeEmployeeRole(employeeId: string, staffRoleId: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const del = await supabase
    .from("employee_role_assignments")
    .delete()
    .eq("organization_id", orgId)
    .eq("employee_id", employeeId)
    .eq("staff_role_id", staffRoleId);
  if (del.error) return { error: del.error.message };
  revalidatePath("/app/employees");
  return { ok: true };
}

export async function ensureEmployeeRoleAssignment(employeeId: string, staffRoleId: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const existing = await supabase
    .from("employee_role_assignments")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("staff_role_id", staffRoleId)
    .maybeSingle();
  if (existing.data?.id) {
    revalidatePath("/app/employees");
    return { ok: true };
  }

  const count = await supabase
    .from("employee_role_assignments")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", employeeId)
    .eq("organization_id", orgId);

  const isPrimary = (count.count ?? 0) === 0;
  const ins = await supabase.from("employee_role_assignments").insert({
    organization_id: orgId,
    employee_id: employeeId,
    staff_role_id: staffRoleId,
    is_primary: isPrimary,
  });
  if (ins.error) return { error: ins.error.message };
  revalidatePath("/app/employees");
  return { ok: true };
}

export async function assignEmployeeRoleForm(formData: FormData) {
  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const staffRoleId = String(formData.get("staff_role_id") ?? "").trim();
  if (!employeeId || !staffRoleId) return { error: "Missing fields" };
  return ensureEmployeeRoleAssignment(employeeId, staffRoleId);
}

export async function removeEmployeeRoleForm(formData: FormData) {
  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const staffRoleId = String(formData.get("staff_role_id") ?? "").trim();
  if (!employeeId || !staffRoleId) return { error: "Missing fields" };
  return removeEmployeeRole(employeeId, staffRoleId);
}

export async function assignEmployeeRoleFormAction(formData: FormData): Promise<void> {
  await assignEmployeeRoleForm(formData);
}

export async function removeEmployeeRoleFormAction(formData: FormData): Promise<void> {
  await removeEmployeeRoleForm(formData);
}
