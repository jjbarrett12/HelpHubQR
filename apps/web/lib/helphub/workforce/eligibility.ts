import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrgWorkforceSettings } from "./settings";

export async function loadShiftEligibilityContext(
  supabase: SupabaseClient,
  employeeShiftId: string
): Promise<{
  organization_id: string;
  location_id: string | null;
  staff_role_id: string;
  employee_id: string;
  shift_date: string;
  shift_type: string;
} | null> {
  const { data, error } = await supabase
    .from("employee_shifts")
    .select("organization_id, location_id, staff_role_id, employee_id, shift_date, shift_type")
    .eq("id", employeeShiftId)
    .single();
  if (error || !data) return null;
  return data as {
    organization_id: string;
    location_id: string | null;
    staff_role_id: string;
    employee_id: string;
    shift_date: string;
    shift_type: string;
  };
}

/**
 * Coworker can cover/claim if same org, active, same location (if shift has location), same role unless settings allow cross-role.
 */
export async function isEmployeeEligibleForShiftPeerAction(
  supabase: SupabaseClient,
  settings: OrgWorkforceSettings,
  shiftCtx: { location_id: string | null; staff_role_id: string },
  candidateEmployeeId: string
): Promise<boolean> {
  const { data: emp, error } = await supabase
    .from("employees")
    .select("id, is_active, location_id, organization_id")
    .eq("id", candidateEmployeeId)
    .single();
  if (error || !emp || !emp.is_active) return false;

  const { data: roles } = await supabase
    .from("employee_role_assignments")
    .select("staff_role_id")
    .eq("employee_id", candidateEmployeeId);

  const roleIds = new Set((roles ?? []).map((r) => r.staff_role_id as string));
  if (!settings.allow_cross_role_claims && !roleIds.has(shiftCtx.staff_role_id)) {
    return false;
  }

  if (shiftCtx.location_id) {
    const empLoc = emp.location_id as string | null;
    if (empLoc && empLoc !== shiftCtx.location_id) return false;
  }

  return true;
}
