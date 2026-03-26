"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireOrgContext, userCanManageOrganization } from "@/lib/helphub/require-org";
import { resolveEmployeeInActiveOrg } from "@/lib/helphub/employee-context";
import { fetchOrCreateOrganizationFairnessSettings } from "@/lib/helphub/fairness/fairness-settings";
import { normalizeTaskKey } from "@/lib/helphub/fairness/task-key";

async function assertCanEditEmployee(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  targetEmployeeId: string
): Promise<boolean> {
  if (await userCanManageOrganization(supabase, userId, orgId)) return true;
  const self = await resolveEmployeeInActiveOrg(supabase, userId, orgId);
  return self === targetEmployeeId;
}

export async function upsertEmployeeTaskPreference(params: {
  employeeId: string;
  preferenceKey: string;
  preferenceLabel?: string | null;
  preferenceLevel: "prefer" | "neutral" | "avoid";
}) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;
  const key = normalizeTaskKey(params.preferenceKey);
  if (!key || key === "unnamed_task") return { error: "preference_key required" };

  const ok = await assertCanEditEmployee(supabase, orgId, user.id, params.employeeId);
  if (!ok) return { error: "Not allowed" };

  const { error } = await supabase.from("employee_task_preferences").upsert(
    {
      organization_id: orgId,
      employee_id: params.employeeId,
      preference_key: key,
      preference_label: params.preferenceLabel ?? null,
      preference_level: params.preferenceLevel,
      created_by_user_id: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,employee_id,preference_key" }
  );
  if (error) return { error: error.message };
  revalidatePath("/app/my-preferences");
  revalidatePath(`/app/employees/${params.employeeId}/preferences`);
  revalidatePath("/app/fairness");
  return { ok: true };
}

export async function deleteEmployeeTaskPreference(employeeId: string, preferenceKey: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;
  const ok = await assertCanEditEmployee(supabase, orgId, user.id, employeeId);
  if (!ok) return { error: "Not allowed" };
  const { error } = await supabase
    .from("employee_task_preferences")
    .delete()
    .eq("organization_id", orgId)
    .eq("employee_id", employeeId)
    .eq("preference_key", preferenceKey);
  if (error) return { error: error.message };
  revalidatePath("/app/my-preferences");
  revalidatePath(`/app/employees/${employeeId}/preferences`);
  return { ok: true };
}

export async function upsertEmployeeSchedulePreference(params: {
  employeeId: string;
  weekday: number | null;
  shiftType: string | null;
  preferenceLevel: "prefer" | "available" | "avoid" | "unavailable";
}) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;
  if (params.weekday === null && !params.shiftType) return { error: "Weekday or shift type required" };

  const ok = await assertCanEditEmployee(supabase, orgId, user.id, params.employeeId);
  if (!ok) return { error: "Not allowed" };

  let del = supabase
    .from("employee_schedule_preferences")
    .delete()
    .eq("organization_id", orgId)
    .eq("employee_id", params.employeeId);
  del = params.weekday === null ? del.is("weekday", null) : del.eq("weekday", params.weekday);
  del = params.shiftType === null ? del.is("shift_type", null) : del.eq("shift_type", params.shiftType);
  await del;

  const { error } = await supabase.from("employee_schedule_preferences").insert({
    organization_id: orgId,
    employee_id: params.employeeId,
    weekday: params.weekday,
    shift_type: params.shiftType,
    preference_level: params.preferenceLevel,
    created_by_user_id: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/app/my-preferences");
  revalidatePath(`/app/employees/${params.employeeId}/preferences`);
  return { ok: true };
}

export async function deleteEmployeeSchedulePreference(id: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;

  const { data: row } = await supabase
    .from("employee_schedule_preferences")
    .select("employee_id")
    .eq("id", id)
    .eq("organization_id", orgId)
    .single();
  if (!row) return { error: "Not found" };
  const empId = (row as { employee_id: string }).employee_id;
  const ok = await assertCanEditEmployee(supabase, orgId, user.id, empId);
  if (!ok) return { error: "Not allowed" };

  const { error } = await supabase.from("employee_schedule_preferences").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/app/my-preferences");
  revalidatePath(`/app/employees/${empId}/preferences`);
  return { ok: true };
}

export async function upsertEmployeeWorkPreferences(params: {
  employeeId: string;
  wants_extra_hours?: boolean;
  open_to_same_day_coverage?: boolean;
  open_to_weekend_shifts?: boolean;
  prefers_consistent_schedule?: boolean;
  max_shifts_per_week?: number | null;
  max_hours_per_week?: number | null;
  notes?: string | null;
}) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;
  const ok = await assertCanEditEmployee(supabase, orgId, user.id, params.employeeId);
  if (!ok) return { error: "Not allowed" };

  const patch = {
    organization_id: orgId,
    employee_id: params.employeeId,
    wants_extra_hours: params.wants_extra_hours ?? false,
    open_to_same_day_coverage: params.open_to_same_day_coverage ?? false,
    open_to_weekend_shifts: params.open_to_weekend_shifts ?? false,
    prefers_consistent_schedule: params.prefers_consistent_schedule ?? false,
    max_shifts_per_week: params.max_shifts_per_week ?? null,
    max_hours_per_week: params.max_hours_per_week ?? null,
    notes: params.notes ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("employee_work_preferences").upsert(patch, {
    onConflict: "organization_id,employee_id",
  });
  if (error) return { error: error.message };
  revalidatePath("/app/my-preferences");
  revalidatePath(`/app/employees/${params.employeeId}/preferences`);
  return { ok: true };
}

export async function updateOrganizationFairnessSettings(formData: FormData) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;
  if (!(await userCanManageOrganization(supabase, user.id, orgId))) {
    return { error: "Manager access required" };
  }

  await fetchOrCreateOrganizationFairnessSettings(supabase, orgId);

  const parseList = (name: string) =>
    String(formData.get(name) ?? "")
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const badTypes = parseList("undesirable_shift_types");
  const badDays = parseList("undesirable_weekdays")
    .map((s) => parseInt(s, 10))
    .filter((n) => n >= 0 && n <= 6);
  const badKeys = [
    ...new Set(
      parseList("undesirable_task_keys")
        .map((k) => normalizeTaskKey(k))
        .filter((k) => k.length > 0 && k !== "unnamed_task")
    ),
  ];
  const lookback = Math.min(
    730,
    Math.max(1, parseInt(String(formData.get("fairness_lookback_days") ?? "30"), 10) || 30)
  );

  const { error } = await supabase
    .from("organization_fairness_settings")
    .update({
      undesirable_shift_types: badTypes,
      undesirable_weekdays: badDays,
      undesirable_task_keys: badKeys,
      fairness_lookback_days: lookback,
      enable_fairness_warnings: formData.has("enable_fairness_warnings"),
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", orgId);
  if (error) return { error: error.message };
  revalidatePath("/app/fairness");
  revalidatePath("/app/shift-ops");
  return { ok: true };
}

/** Form `action` wrapper (Next.js expects void). */
export async function updateOrganizationFairnessSettingsFormAction(formData: FormData): Promise<void> {
  const res = await updateOrganizationFairnessSettings(formData);
  if ("error" in res && res.error) console.error("fairness settings:", res.error);
}
