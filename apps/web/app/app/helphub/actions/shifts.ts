"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/helphub/require-org";
import { updateEmployeeShiftAfterOutboundSend } from "@/lib/delivery/mark-run-sent";
import { createChecklistRunFromShift } from "@/lib/helphub/shift-checklist";
import { runStatusAfterSend } from "@/lib/helphub/run-status";
import type { ShiftType } from "@/lib/helphub/types";
import { recordShiftAssignmentFairness } from "@/lib/helphub/fairness/record";

const SHIFT_TYPES: ShiftType[] = ["open", "mid", "close", "custom"];

function parseShiftType(raw: string): ShiftType | null {
  return SHIFT_TYPES.includes(raw as ShiftType) ? (raw as ShiftType) : null;
}

export async function createEmployeeShift(formData: FormData) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const staffRoleId = String(formData.get("staff_role_id") ?? "").trim();
  const shiftDate = String(formData.get("shift_date") ?? "").trim();
  const shiftType = parseShiftType(String(formData.get("shift_type") ?? ""));
  const locationIdRaw = String(formData.get("location_id") ?? "").trim();
  const locationId = locationIdRaw ? locationIdRaw : null;

  if (!employeeId || !staffRoleId || !shiftDate || !shiftType) {
    return { error: "Employee, role, date, and shift type are required" };
  }

  const ins = await supabase
    .from("employee_shifts")
    .insert({
      organization_id: orgId,
      employee_id: employeeId,
      staff_role_id: staffRoleId,
      shift_date: shiftDate,
      shift_type: shiftType,
      location_id: locationId,
      status: "scheduled",
    })
    .select("id")
    .single();
  if (ins.error) return { error: ins.error.message };
  const newShiftId = ins.data?.id as string;
  void recordShiftAssignmentFairness({
    organizationId: orgId,
    employeeShiftId: newShiftId,
    employeeId,
    shiftType,
    shiftDate,
  });
  revalidatePath("/app/schedule");
  revalidatePath("/app/dashboard");
  return { ok: true };
}

export async function deleteEmployeeShift(id: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const d = await supabase.from("employee_shifts").delete().eq("id", id).eq("organization_id", orgId);
  if (d.error) return { error: d.error.message };
  revalidatePath("/app/schedule");
  return { ok: true };
}

export async function deleteEmployeeShiftForm(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing id" };
  return deleteEmployeeShift(id);
}

export async function createEmployeeShiftFormAction(formData: FormData): Promise<void> {
  await createEmployeeShift(formData);
}

export async function deleteEmployeeShiftFormAction(formData: FormData): Promise<void> {
  await deleteEmployeeShiftForm(formData);
}

export async function createChecklistRunForShift(employeeShiftId: string, options?: { markSent?: boolean }) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const { data: shift, error } = await supabase
    .from("employee_shifts")
    .select("id, organization_id, location_id, staff_role_id, shift_type, employee_id")
    .eq("id", employeeShiftId)
    .eq("organization_id", orgId)
    .single();
  if (error || !shift) return { error: "Shift not found" };

  try {
    const result = await createChecklistRunFromShift(
      supabase,
      shift as {
        id: string;
        organization_id: string;
        location_id: string | null;
        staff_role_id: string;
        shift_type: ShiftType;
        employee_id: string;
      },
      options
    );
    revalidatePath("/app/schedule");
    revalidatePath("/app/checklist-runs");
    revalidatePath("/app/dashboard");
    return { ok: true, ...result };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create run" };
  }
}

export async function markRunSent(runId: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const { data: run, error } = await supabase
    .from("shift_checklist_runs")
    .select("id, status, employee_shift_id")
    .eq("id", runId)
    .eq("organization_id", orgId)
    .single();
  if (error || !run) return { error: "Run not found" };

  const next = runStatusAfterSend(run.status as import("@/lib/helphub/types").ShiftChecklistRunStatus);
  const now = new Date().toISOString();
  const u = await supabase
    .from("shift_checklist_runs")
    .update({ status: next, sent_at: now })
    .eq("id", runId);
  if (u.error) return { error: u.error.message };

  await updateEmployeeShiftAfterOutboundSend(supabase, run.employee_shift_id as string, now);

  revalidatePath("/app/schedule");
  revalidatePath("/app/checklist-runs");
  return { ok: true };
}
