import type { PublicChecklistPayload, ShiftChecklistRunStatus } from "./types";
import { createHelpHubServiceClient } from "./supabase-service";
import { isLikelyChecklistToken } from "./tokens";
import { runStatusAfterOpen } from "./run-status";

function visibleToShiftEmployee(
  assignedEmployeeId: string | null,
  shiftEmployeeId: string
): boolean {
  return assignedEmployeeId === null || assignedEmployeeId === shiftEmployeeId;
}

export async function loadPublicChecklistByToken(token: string): Promise<PublicChecklistPayload | null> {
  if (!isLikelyChecklistToken(token)) return null;
  let supabase: ReturnType<typeof createHelpHubServiceClient>;
  try {
    supabase = createHelpHubServiceClient();
  } catch {
    return null;
  }

  const runRes = await supabase
    .from("shift_checklist_runs")
    .select("id, status, checklist_id, employee_shift_id, organization_id")
    .eq("access_token", token)
    .maybeSingle();
  if (runRes.error || !runRes.data) return null;

  const run = runRes.data as {
    id: string;
    status: ShiftChecklistRunStatus;
    checklist_id: string;
    employee_shift_id: string;
    organization_id: string;
  };

  const [shiftRes, checklistRes, itemsRes, overridesRes] = await Promise.all([
    supabase
      .from("employee_shifts")
      .select("employee_id")
      .eq("id", run.employee_shift_id)
      .single(),
    supabase.from("checklists").select("name").eq("id", run.checklist_id).single(),
    supabase
      .from("shift_checklist_run_items")
      .select(
        "id, completed, checklist_item_id, task_text_snapshot, suppressed, assigned_employee_id, assignment_status"
      )
      .eq("shift_checklist_run_id", run.id),
    supabase
      .from("shift_run_override_tasks")
      .select("id, task_text_snapshot, status, sort_order, requires_photo, assigned_employee_id")
      .eq("run_id", run.id)
      .eq("organization_id", run.organization_id),
  ]);

  if (shiftRes.error || checklistRes.error || itemsRes.error || overridesRes.error) return null;

  const shiftEmployeeId = (shiftRes.data as { employee_id: string }).employee_id;

  const empRes = await supabase
    .from("employees")
    .select("full_name")
    .eq("id", shiftEmployeeId)
    .single();
  const employeeName = empRes.data?.full_name ?? "Team member";
  const checklistTitle = (checklistRes.data as { name: string } | null)?.name ?? "Shift checklist";

  const itemRows = (itemsRes.data ?? []) as Array<{
    id: string;
    completed: boolean;
    checklist_item_id: string;
    task_text_snapshot: string | null;
    suppressed: boolean;
    assigned_employee_id: string | null;
    assignment_status: string;
  }>;

  const templateItems: PublicChecklistPayload["items"] = [];

  for (const row of itemRows) {
    if (row.suppressed) continue;
    if (!visibleToShiftEmployee(row.assigned_employee_id, shiftEmployeeId)) continue;

    const ci = await supabase
      .from("checklist_items")
      .select("task_text, sort_order, requires_photo")
      .eq("id", row.checklist_item_id)
      .single();
    if (ci.error || !ci.data) continue;
    const d = ci.data as { task_text: string; sort_order: number; requires_photo: boolean };
    const taskText = (row.task_text_snapshot?.trim() ? row.task_text_snapshot : d.task_text) ?? d.task_text;
    templateItems.push({
      id: row.id,
      kind: "template",
      taskText,
      requiresPhoto: d.requires_photo,
      completed: row.completed,
      sortOrder: d.sort_order,
    });
  }

  const overrideRows = (overridesRes.data ?? []) as Array<{
    id: string;
    task_text_snapshot: string;
    status: string;
    sort_order: number;
    requires_photo: boolean;
    assigned_employee_id: string | null;
  }>;

  const overrideItems: PublicChecklistPayload["items"] = [];
  for (const o of overrideRows) {
    if (o.status === "suppressed") continue;
    if (!visibleToShiftEmployee(o.assigned_employee_id, shiftEmployeeId)) continue;
    const done = o.status === "completed";
    overrideItems.push({
      id: `ov:${o.id}`,
      kind: "override",
      overrideTaskId: o.id,
      taskText: o.task_text_snapshot,
      requiresPhoto: o.requires_photo,
      completed: done,
      sortOrder: 10000 + o.sort_order,
    });
  }

  const items = [...templateItems, ...overrideItems].sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    runId: run.id,
    employeeName,
    checklistTitle,
    runStatus: run.status,
    items,
  };
}

export async function markPublicRunOpenedIfNeeded(token: string): Promise<void> {
  if (!isLikelyChecklistToken(token)) return;
  const supabase = createHelpHubServiceClient();
  const { data: run, error } = await supabase
    .from("shift_checklist_runs")
    .select("id, status, employee_shift_id, started_at")
    .eq("access_token", token)
    .maybeSingle();
  if (error || !run) return;

  const next = runStatusAfterOpen(run.status as ShiftChecklistRunStatus);
  if (next === run.status) return;

  const now = new Date().toISOString();
  const patch: Record<string, string> = {
    status: next,
    updated_at: now,
    ...(next === "opened" && !run.started_at ? { started_at: now } : {}),
  };

  await supabase.from("shift_checklist_runs").update(patch).eq("id", run.id);

  await supabase
    .from("employee_shifts")
    .update({ status: "in_progress", updated_at: now })
    .eq("id", run.employee_shift_id as string)
    .neq("status", "completed");
}
