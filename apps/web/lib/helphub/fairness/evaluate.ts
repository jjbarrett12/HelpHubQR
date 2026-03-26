import type { SupabaseClient } from "@supabase/supabase-js";
import { ledgerTaskKeyFromSnapshots, normalizeTaskKey } from "./task-key";
import { fetchOrCreateOrganizationFairnessSettings } from "./fairness-settings";
import { orgWeekdayFromShiftDate, shiftDateLookbackFrom } from "./shift-weekday";
import { CLOSE_SHIFT_REPEAT_HINT_THRESHOLD } from "./constants";

export type TaskFairnessSignal = {
  taskKey: string;
  preferenceLevel: string;
  hints: string[];
};

/**
 * Operational hints for a run item + assignee (manager UI). Uses authenticated supabase (RLS).
 */
export async function evaluateTaskFairnessSignal(
  supabase: SupabaseClient,
  organizationId: string,
  params: {
    taskKeySnapshot: string | null;
    taskTextSnapshot: string | null;
    assignedEmployeeId: string | null;
  }
): Promise<TaskFairnessSignal | null> {
  if (!params.assignedEmployeeId) return null;

  const settings = await fetchOrCreateOrganizationFairnessSettings(supabase, organizationId);
  if (!settings.enable_fairness_warnings) return null;

  const taskKey = ledgerTaskKeyFromSnapshots(params.taskKeySnapshot, params.taskTextSnapshot);

  const { data: pref } = await supabase
    .from("employee_task_preferences")
    .select("preference_level")
    .eq("organization_id", organizationId)
    .eq("employee_id", params.assignedEmployeeId)
    .eq("preference_key", taskKey)
    .maybeSingle();
  const preferenceLevel =
    (pref as { preference_level: string } | null)?.preference_level ?? "neutral";

  const hints: string[] = [];
  if (preferenceLevel === "prefer") hints.push("Prefers this task category");
  if (preferenceLevel === "avoid") hints.push("Avoids this task category");

  const orgBad = new Set(
    settings.undesirable_task_keys
      .map((k) => normalizeTaskKey(k))
      .filter((k) => k !== "unnamed_task")
  );
  if (orgBad.has(taskKey)) hints.push("Org-marked undesirable task");

  const since = new Date();
  since.setDate(since.getDate() - settings.fairness_lookback_days);
  const { count } = await supabase
    .from("fairness_assignment_ledger")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("employee_id", params.assignedEmployeeId)
    .eq("preference_key", taskKey)
    .in("event_type", ["avoided_task_assigned", "undesirable_task_repeated"])
    .gte("created_at", since.toISOString());

  if ((count ?? 0) >= 3) hints.push(`Heavy load on this task category (${count} in lookback)`);

  const { data: work } = await supabase
    .from("employee_work_preferences")
    .select("wants_extra_hours")
    .eq("organization_id", organizationId)
    .eq("employee_id", params.assignedEmployeeId)
    .maybeSingle();
  if ((work as { wants_extra_hours?: boolean } | null)?.wants_extra_hours) {
    hints.push("Wants extra hours");
  }

  return { taskKey, preferenceLevel, hints };
}

export type ShiftFairnessSignal = { hints: string[] };

export async function evaluateShiftFairnessSignal(
  supabase: SupabaseClient,
  organizationId: string,
  params: {
    employeeId: string;
    shiftType: string;
    shiftDate: string;
  }
): Promise<ShiftFairnessSignal> {
  const settings = await fetchOrCreateOrganizationFairnessSettings(supabase, organizationId);
  const hints: string[] = [];
  if (!settings.enable_fairness_warnings) return { hints };

  const wd = orgWeekdayFromShiftDate(params.shiftDate);
  if (settings.undesirable_shift_types.includes(params.shiftType)) {
    hints.push("Org-marked undesirable shift type");
  }
  if (settings.undesirable_weekdays.includes(wd)) hints.push("Org-marked undesirable weekday");

  const { data: rows } = await supabase
    .from("employee_schedule_preferences")
    .select("weekday, shift_type, preference_level")
    .eq("organization_id", organizationId)
    .eq("employee_id", params.employeeId);

  for (const r of rows ?? []) {
    const row = r as {
      weekday: number | null;
      shift_type: string | null;
      preference_level: string;
    };
    const dayMatch = row.weekday === null || row.weekday === wd;
    const typeMatch = row.shift_type === null || row.shift_type === params.shiftType;
    if (!dayMatch || !typeMatch) continue;
    if (row.preference_level === "prefer") hints.push("Prefers this day/shift pattern");
    if (row.preference_level === "avoid" || row.preference_level === "unavailable") {
      hints.push("Marked avoid/unavailable for this pattern");
    }
  }

  if (params.shiftType === "close") {
    const fromStr = shiftDateLookbackFrom(params.shiftDate, settings.fairness_lookback_days);
    const { count } = await supabase
      .from("employee_shifts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("employee_id", params.employeeId)
      .eq("shift_type", "close")
      .lte("shift_date", params.shiftDate)
      .gte("shift_date", fromStr);
    if ((count ?? 0) >= CLOSE_SHIFT_REPEAT_HINT_THRESHOLD) {
      hints.push("Many closing shifts recently");
    }
  }

  return { hints };
}

export async function getFairnessWarningsForRunAssignment(
  supabase: SupabaseClient,
  organizationId: string,
  params: {
    taskKeySnapshot: string | null;
    taskTextSnapshot: string | null;
    assignedEmployeeId: string | null;
  }
): Promise<string[]> {
  const r = await evaluateTaskFairnessSignal(supabase, organizationId, params);
  return r?.hints ?? [];
}

export async function getFairnessWarningsForShiftClaim(
  supabase: SupabaseClient,
  organizationId: string,
  params: { employeeId: string; shiftType: string; shiftDate: string }
): Promise<string[]> {
  const r = await evaluateShiftFairnessSignal(supabase, organizationId, params);
  return r.hints;
}
