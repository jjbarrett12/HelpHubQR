import { createHelpHubServiceClient } from "@/lib/helphub/supabase-service";
import { logWorkforceEvent } from "./log";
import {
  recordOverrideTaskAssignmentFairness,
  recordTaskAssignmentFairness,
} from "@/lib/helphub/fairness/record";

/**
 * After employee_shifts.employee_id changes, re-point run task assignments that still referenced the old shift owner.
 * Uses service role so employee-initiated claims can apply safely under RLS.
 * Skips completed template items and completed/suppressed override tasks.
 */
export async function remapRunItemsAfterShiftOwnerChange(params: {
  organizationId: string;
  runId: string;
  oldEmployeeId: string;
  newEmployeeId: string;
  actorUserId: string | null;
}): Promise<{ error?: string }> {
  const supabase = createHelpHubServiceClient();
  const { organizationId, runId, oldEmployeeId, newEmployeeId, actorUserId } = params;
  const now = new Date().toISOString();
  const { data: updatedItems, error: itemsErr } = await supabase
    .from("shift_checklist_run_items")
    .update({
      assigned_employee_id: newEmployeeId,
      reassigned_from_employee_id: oldEmployeeId,
      reassigned_at: now,
      assignment_status: "assigned",
      updated_at: now,
    })
    .eq("shift_checklist_run_id", runId)
    .eq("assigned_employee_id", oldEmployeeId)
    .eq("completed", false)
    .select("id, assigned_employee_id");

  if (itemsErr) {
    return { error: itemsErr.message };
  }

  const { data: updatedOverrides, error: ovErr } = await supabase
    .from("shift_run_override_tasks")
    .update({
      assigned_employee_id: newEmployeeId,
      updated_at: now,
    })
    .eq("run_id", runId)
    .eq("organization_id", organizationId)
    .eq("assigned_employee_id", oldEmployeeId)
    .eq("status", "active")
    .is("completed_at", null)
    .select("id, assigned_employee_id");

  if (ovErr) {
    return { error: ovErr.message };
  }

  await logWorkforceEvent(supabase, {
    organization_id: organizationId,
    event_type: "run_tasks_remapped_after_shift_claim",
    actor_user_id: actorUserId,
    shift_checklist_run_id: runId,
    payload: { oldEmployeeId, newEmployeeId },
  });

  for (const row of updatedItems ?? []) {
    const r = row as { id: string; assigned_employee_id: string | null };
    if (r.assigned_employee_id) {
      void recordTaskAssignmentFairness({
        organizationId,
        runItemId: r.id,
        assignedEmployeeId: r.assigned_employee_id,
        source: "shift_owner_remap",
      });
    }
  }

  for (const row of updatedOverrides ?? []) {
    const r = row as { id: string; assigned_employee_id: string | null };
    if (r.assigned_employee_id) {
      void logWorkforceEvent(supabase, {
        organization_id: organizationId,
        event_type: "override_task_reassigned",
        actor_user_id: actorUserId,
        shift_checklist_run_id: runId,
        shift_run_override_task_id: r.id,
        payload: { from: oldEmployeeId, to: r.assigned_employee_id, reason: "shift_owner_remap" },
      });
      void recordOverrideTaskAssignmentFairness({
        organizationId,
        overrideTaskId: r.id,
        assignedEmployeeId: r.assigned_employee_id,
        source: "shift_owner_remap_override",
      });
    }
  }

  return {};
}
