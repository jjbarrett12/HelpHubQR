import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeTaskKey } from "./task-key";
import { fetchOrCreateOrganizationFairnessSettings } from "./fairness-settings";

export type RankedEmployee = { employeeId: string; score: number; reason: string };

/**
 * Fairness ranking helpers — **advisory / UX only**. They must not drive automatic assignment,
 * scheduling, or approvals. Operational truth stays on employee_shifts and shift_checklist_run_items.
 *
 * Higher score = better candidate to receive a task that others try to avoid (balance load).
 */
export async function rankEmployeesForUndesirableTaskBalance(
  supabase: SupabaseClient,
  organizationId: string,
  params: { taskKey: string; candidateEmployeeIds: string[] }
): Promise<RankedEmployee[]> {
  if (params.candidateEmployeeIds.length === 0) return [];
  const settings = await fetchOrCreateOrganizationFairnessSettings(supabase, organizationId);
  const since = new Date();
  since.setDate(since.getDate() - settings.fairness_lookback_days);
  const key = normalizeTaskKey(params.taskKey);

  const scores: RankedEmployee[] = [];
  for (const employeeId of params.candidateEmployeeIds) {
    const { count: avoided } = await supabase
      .from("fairness_assignment_ledger")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("employee_id", employeeId)
      .eq("preference_key", key)
      .eq("event_type", "avoided_task_assigned")
      .gte("created_at", since.toISOString());

    const { count: preferred } = await supabase
      .from("fairness_assignment_ledger")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("employee_id", employeeId)
      .eq("preference_key", key)
      .eq("event_type", "preferred_task_assigned")
      .gte("created_at", since.toISOString());

    const a = avoided ?? 0;
    const p = preferred ?? 0;
    const score = p * 2 - a * 3;
    scores.push({
      employeeId,
      score,
      reason: `avoided×${a}, preferred×${p} (lookback ${settings.fairness_lookback_days}d)`,
    });
  }
  scores.sort((x, y) => y.score - x.score);
  return scores;
}

/**
 * Higher score = better candidate for open shift if you want to spread pickup / extra-hour opportunities.
 * Counts voluntary_shift_pickup and legacy extra_* ledger rows (advisory only).
 */
export async function rankEmployeesForOpenShiftFairness(
  supabase: SupabaseClient,
  organizationId: string,
  candidateEmployeeIds: string[]
): Promise<RankedEmployee[]> {
  if (candidateEmployeeIds.length === 0) return [];
  const settings = await fetchOrCreateOrganizationFairnessSettings(supabase, organizationId);
  const since = new Date();
  since.setDate(since.getDate() - settings.fairness_lookback_days);

  const scores: RankedEmployee[] = [];
  for (const employeeId of candidateEmployeeIds) {
    const { count: pickups } = await supabase
      .from("fairness_assignment_ledger")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("employee_id", employeeId)
      .in("event_type", ["voluntary_shift_pickup", "extra_shift_awarded", "extra_hours_awarded"])
      .gte("created_at", since.toISOString());

    const { data: work } = await supabase
      .from("employee_work_preferences")
      .select("wants_extra_hours")
      .eq("organization_id", organizationId)
      .eq("employee_id", employeeId)
      .maybeSingle();
    const wants = Boolean((work as { wants_extra_hours?: boolean } | null)?.wants_extra_hours);

    const e = pickups ?? 0;
    let score = wants ? 5 : 0;
    score -= e * 2;
    scores.push({
      employeeId,
      score,
      reason: `shift_pickups×${e}, wants_extra=${wants}`,
    });
  }
  scores.sort((x, y) => y.score - x.score);
  return scores;
}

export async function rankEmployeesForPreferredTaskAssignment(
  supabase: SupabaseClient,
  organizationId: string,
  params: { taskKey: string; candidateEmployeeIds: string[] }
): Promise<RankedEmployee[]> {
  if (params.candidateEmployeeIds.length === 0) return [];
  const key = normalizeTaskKey(params.taskKey);
  const scores: RankedEmployee[] = [];
  for (const employeeId of params.candidateEmployeeIds) {
    const { data: pref } = await supabase
      .from("employee_task_preferences")
      .select("preference_level")
      .eq("organization_id", organizationId)
      .eq("employee_id", employeeId)
      .eq("preference_key", key)
      .maybeSingle();
    const level = (pref as { preference_level: string } | null)?.preference_level ?? "neutral";
    let score = 0;
    let reason = level;
    if (level === "prefer") {
      score = 10;
      reason = "Marked prefer";
    } else if (level === "avoid") {
      score = -10;
      reason = "Marked avoid";
    }
    scores.push({ employeeId, score, reason });
  }
  scores.sort((x, y) => y.score - x.score);
  return scores;
}
