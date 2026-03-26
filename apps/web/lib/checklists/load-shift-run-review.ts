import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RunReviewTaskView, RunReviewViewModel } from "./run-review-view-model";

function one<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null;
  return Array.isArray(x) ? x[0] ?? null : x;
}

/**
 * Load a single shift checklist run for manager review UI.
 * TODO: signed URLs for proof_photo_storage_path via private bucket helper.
 */
export async function loadShiftRunReviewViewModel(
  supabase: SupabaseClient,
  args: { organizationId: string; runId: string }
): Promise<RunReviewViewModel | null> {
  const { organizationId, runId } = args;

  const { data: run, error } = await supabase
    .from("shift_checklist_runs")
    .select(
      `
      id,
      status,
      sent_at,
      started_at,
      completed_at,
      updated_at,
      checklist_id,
      checklist:checklists(id, name),
      employee_shift:employee_shifts(
        shift_date,
        shift_type,
        location_id,
        employee:employees(full_name),
        staff_role:staff_roles(name),
        location:locations(name)
      )
    `
    )
    .eq("id", runId)
    .eq("organization_id", organizationId)
    .single();

  if (error || !run) return null;

  const checklist = one(run.checklist as { id: string; name: string } | { id: string; name: string }[] | null);
  const es = one(
    run.employee_shift as unknown as {
      shift_date: string;
      shift_type: string;
      location_id: string | null;
      employee: { full_name: string } | { full_name: string }[] | null;
      staff_role: { name: string } | { name: string }[] | null;
      location: { name: string } | { name: string }[] | null;
    } | null
  );
  const emp = one(es?.employee ?? null);
  const role = one(es?.staff_role ?? null);
  const loc = one(es?.location ?? null);

  const { data: rawItems, error: itemsErr } = await supabase
    .from("shift_checklist_run_items")
    .select(
      `
      id,
      checklist_item_id,
      completed,
      completed_at,
      notes,
      task_text_snapshot,
      task_key_snapshot,
      override_source,
      override_reason,
      suppressed,
      assignment_status,
      assigned_employee_id,
      proof_photo_storage_path,
      checklist_item:checklist_items(
        task_text,
        requires_photo,
        task_key,
        section_title,
        duration_estimate_minutes,
        sort_order
      )
    `
    )
    .eq("shift_checklist_run_id", runId)
    .order("created_at", { ascending: true });

  if (itemsErr) return null;

  const assigneeIds = [
    ...new Set(
      (rawItems ?? [])
        .map((r) => r.assigned_employee_id as string | null)
        .filter((x): x is string => Boolean(x))
    ),
  ];
  const { data: assignees } =
    assigneeIds.length > 0
      ? await supabase.from("employees").select("id, full_name").in("id", assigneeIds)
      : { data: [] as { id: string; full_name: string }[] };
  const nameByEmp = new Map((assignees ?? []).map((e) => [e.id, e.full_name]));

  const tasksWithOrder: Array<{ task: RunReviewTaskView; sortOrder: number }> = (rawItems ?? []).map((row) => {
    const ci = one(
      row.checklist_item as unknown as {
        task_text: string;
        requires_photo: boolean;
        task_key: string | null;
        section_title: string | null;
        duration_estimate_minutes: number | null;
        sort_order: number;
      } | null
    );
    const text =
      (row.task_text_snapshot as string | null)?.trim() ||
      ci?.task_text ||
      "Task";
    const requiresPhoto = ci?.requires_photo ?? false;
    const completed = Boolean(row.completed);
    const proofPath = (row.proof_photo_storage_path as string | null) ?? null;
    const missingProof = completed && requiresPhoto && !proofPath?.trim();
    const suppressed = Boolean(row.suppressed);
    const overrideSource = (row.override_source as RunReviewTaskView["overrideSource"]) ?? "template";
    const blockedReason = suppressed ? "Suppressed on this run" : null;

    const task: RunReviewTaskView = {
      id: row.id as string,
      checklistItemId: row.checklist_item_id as string,
      taskText: text,
      taskKeySnapshot: (row.task_key_snapshot as string | null) ?? ci?.task_key ?? null,
      sectionTitle: ci?.section_title ?? null,
      durationEstimateMinutes: ci?.duration_estimate_minutes ?? null,
      requiresPhoto,
      completed,
      completedAt: (row.completed_at as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      proofPhotoStoragePath: proofPath,
      overrideSource,
      overrideReason: (row.override_reason as string | null) ?? null,
      suppressed,
      assignmentStatus: String(row.assignment_status ?? "assigned"),
      assignedEmployeeName: row.assigned_employee_id
        ? nameByEmp.get(row.assigned_employee_id as string) ?? null
        : null,
      blockedReason,
      problemReason: missingProof ? "Marked complete without photo proof" : null,
    };
    return { task, sortOrder: ci?.sort_order ?? 0 };
  });

  tasksWithOrder.sort((a, b) => a.sortOrder - b.sortOrder);
  const tasks = tasksWithOrder.map((x) => x.task);

  return {
    runId: run.id as string,
    status: run.status as string,
    checklistName: checklist?.name ?? "Checklist",
    templateId: (run.checklist_id as string) ?? checklist?.id ?? "",
    shiftDate: es?.shift_date ?? "—",
    shiftType: es?.shift_type ?? "—",
    employeeName: emp?.full_name ?? "Employee",
    roleName: role?.name ?? "Role",
    stationName: loc?.name ?? null,
    sentAt: (run.sent_at as string | null) ?? null,
    startedAt: (run.started_at as string | null) ?? null,
    completedAt: (run.completed_at as string | null) ?? null,
    updatedAt: run.updated_at as string,
    tasks,
  };
}
