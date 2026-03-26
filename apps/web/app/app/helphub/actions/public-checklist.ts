"use server";

import { revalidatePath } from "next/cache";
import { createHelpHubServiceClient } from "@/lib/helphub/supabase-service";
import { isLikelyChecklistToken } from "@/lib/helphub/tokens";
import { loadPublicChecklistByToken } from "@/lib/helphub/public-checklist";
import { recordOverrideTaskLifecycleFairness } from "@/lib/helphub/fairness/record";

async function loadRunForToken(token: string) {
  const supabase = createHelpHubServiceClient();
  const { data: run } = await supabase
    .from("shift_checklist_runs")
    .select("id, status, employee_shift_id")
    .eq("access_token", token)
    .maybeSingle();
  return { supabase, run };
}

export async function togglePublicChecklistItem(
  token: string,
  runItemId: string,
  completed: boolean,
  overrideTaskId?: string | null
) {
  if (!isLikelyChecklistToken(token)) return { error: "Invalid link" };
  const { supabase, run } = await loadRunForToken(token);
  if (!run) return { error: "Not found" };

  if (run.status === "completed" || run.status === "expired") {
    return { error: "This checklist is closed" };
  }

  const { data: shift } = await supabase
    .from("employee_shifts")
    .select("employee_id")
    .eq("id", run.employee_shift_id as string)
    .single();
  const shiftEmployeeId = (shift as { employee_id: string } | null)?.employee_id;
  if (!shiftEmployeeId) return { error: "Not found" };

  const now = new Date().toISOString();

  if (overrideTaskId) {
    const { data: ov } = await supabase
      .from("shift_run_override_tasks")
      .select("id, run_id, status, assigned_employee_id")
      .eq("id", overrideTaskId)
      .eq("run_id", run.id)
      .maybeSingle();
    if (!ov) return { error: "Item not found" };
    const row = ov as {
      id: string;
      status: string;
      assigned_employee_id: string | null;
    };
    if (row.status === "suppressed") return { error: "Item not available" };
    const vis =
      row.assigned_employee_id === null || row.assigned_employee_id === shiftEmployeeId;
    if (!vis) return { error: "Item not assigned to you" };

    const nextStatus = completed ? "completed" : "active";
    const u = await supabase
      .from("shift_run_override_tasks")
      .update({
        status: nextStatus,
        completed_at: completed ? now : null,
        updated_at: now,
      })
      .eq("id", overrideTaskId)
      .eq("status", completed ? "active" : "completed")
      .select("id")
      .maybeSingle();
    if (u.error) return { error: u.error.message };
    if (!u.data?.id) return { error: "Item not available" };

    if (completed) {
      const { data: runRow } = await supabase
        .from("shift_checklist_runs")
        .select("id, organization_id, employee_shift_id")
        .eq("id", run.id as string)
        .single();
      const rr = runRow as {
        id: string;
        organization_id: string;
        employee_shift_id: string;
      } | null;
      if (rr) {
        const { data: sh } = await supabase
          .from("employee_shifts")
          .select("employee_id")
          .eq("id", rr.employee_shift_id)
          .single();
        const shiftOwner = (sh as { employee_id: string } | null)?.employee_id ?? null;
        const { data: ovFull } = await supabase
          .from("shift_run_override_tasks")
          .select("task_text_snapshot, task_key_snapshot, assigned_employee_id")
          .eq("id", overrideTaskId)
          .single();
        const of = ovFull as {
          task_text_snapshot: string;
          task_key_snapshot: string | null;
          assigned_employee_id: string | null;
        } | null;
        const ledgerEmployeeId = of?.assigned_employee_id ?? shiftOwner ?? shiftEmployeeId;
        if (of && ledgerEmployeeId) {
          void recordOverrideTaskLifecycleFairness({
            organizationId: rr.organization_id,
            overrideTaskId: overrideTaskId,
            employeeId: ledgerEmployeeId,
            employeeShiftId: rr.employee_shift_id,
            shiftChecklistRunId: rr.id,
            eventType: "override_task_completed",
            taskTextSnapshot: of.task_text_snapshot,
            taskKeySnapshot: of.task_key_snapshot,
            source: "public_checklist_complete",
            actorEmployeeId: shiftEmployeeId,
          });
        }
      }
    }

    revalidatePath(`/public/checklist/${token}`);
    return { ok: true };
  }

  const { data: row } = await supabase
    .from("shift_checklist_run_items")
    .select("id, suppressed, assigned_employee_id, completed")
    .eq("id", runItemId)
    .eq("shift_checklist_run_id", run.id)
    .maybeSingle();
  if (!row) return { error: "Item not found" };

  const r = row as {
    id: string;
    suppressed: boolean;
    assigned_employee_id: string | null;
    completed: boolean;
  };
  if (r.suppressed) return { error: "Item not available" };
  const vis =
    r.assigned_employee_id === null || r.assigned_employee_id === shiftEmployeeId;
  if (!vis) return { error: "Item not assigned to you" };

  const u = await supabase
    .from("shift_checklist_run_items")
    .update({
      completed,
      completed_at: completed ? now : null,
      assignment_status: completed ? "completed" : "assigned",
      updated_at: now,
    })
    .eq("id", runItemId)
    .eq("completed", completed ? false : true)
    .select("id")
    .maybeSingle();
  if (u.error) return { error: u.error.message };
  if (!u.data?.id) return { error: "Item not available" };

  revalidatePath(`/public/checklist/${token}`);
  return { ok: true };
}

export async function completePublicChecklistRun(token: string) {
  if (!isLikelyChecklistToken(token)) return { error: "Invalid link" };
  const payload = await loadPublicChecklistByToken(token);
  if (!payload) return { error: "Not found" };

  if (payload.runStatus === "completed" || payload.runStatus === "expired") {
    return { error: "This checklist is closed" };
  }

  if (payload.items.length === 0) {
    return { error: "No tasks are visible for you on this shift" };
  }

  if (!payload.items.every((i) => i.completed)) {
    return { error: "Complete every item first" };
  }

  const supabase = createHelpHubServiceClient();
  const { data: run } = await supabase
    .from("shift_checklist_runs")
    .select("id, employee_shift_id, status")
    .eq("access_token", token)
    .maybeSingle();
  if (!run) return { error: "Not found" };

  const now = new Date().toISOString();
  const u = await supabase
    .from("shift_checklist_runs")
    .update({ status: "completed", completed_at: now, updated_at: now })
    .eq("id", run.id)
    .in("status", ["pending", "sent", "opened"])
    .select("id")
    .maybeSingle();
  if (u.error) return { error: u.error.message };
  if (!u.data?.id) {
    return { error: "This checklist is already finished" };
  }

  await supabase
    .from("employee_shifts")
    .update({ status: "completed", updated_at: now })
    .eq("id", run.employee_shift_id as string)
    .neq("status", "completed");

  revalidatePath(`/public/checklist/${token}`);
  return { ok: true };
}
