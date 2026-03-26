"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext, userCanManageOrganization } from "@/lib/helphub/require-org";
import { fetchOrCreateWorkforceSettings } from "@/lib/helphub/workforce/settings";
import { logWorkforceEvent } from "@/lib/helphub/workforce/log";
import { remapRunItemsAfterShiftOwnerChange } from "@/lib/helphub/workforce/remap";
import { applyShiftTradeApproval } from "@/lib/helphub/workforce/execute-shift-trade";
import {
  notifyShiftOpenForClaim,
  notifyTaskOfferAvailable,
  notifyWorkforceApprovalResult,
  notifyShiftTradeProposed,
} from "@/lib/helphub/workforce/notify-stub";
import {
  recordOverrideTaskAssignmentFairness,
  recordOverrideTaskLifecycleFairness,
  recordShiftAssignmentFairness,
  recordTaskAssignmentFairness,
  recordVoluntaryShiftPickupFairness,
} from "@/lib/helphub/fairness/record";
import { normalizeTaskKey } from "@/lib/helphub/fairness/task-key";
import { FEED_APPROVAL_SOURCE_TABLES } from "@/lib/helphub/requests/feed-dispatch";
import { checkManagerApprovalRateLimit } from "@/lib/rateLimitDistributed";
import { logServerEvent } from "@/lib/observability/server-log";

const FEED_APPROVAL_TABLES = FEED_APPROVAL_SOURCE_TABLES;

async function guardManagerRateLimit(userId: string, orgId: string): Promise<{ error: string } | null> {
  const r = await checkManagerApprovalRateLimit(userId, orgId);
  if (!r.allowed) {
    return { error: "Too many requests. Please wait and try again." };
  }
  return null;
}

async function assertRunInOrg(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  runId: string,
  orgId: string
) {
  const { data } = await supabase
    .from("shift_checklist_runs")
    .select("id, employee_shift_id, organization_id")
    .eq("id", runId)
    .eq("organization_id", orgId)
    .single();
  return data as
    | { id: string; employee_shift_id: string; organization_id: string }
    | null;
}

export async function updateWorkforceSettings(formData: FormData) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;

  await fetchOrCreateWorkforceSettings(supabase, orgId);
  const patch = {
    allow_employee_task_offers: formData.has("allow_employee_task_offers"),
    allow_open_shift_claims: formData.has("allow_open_shift_claims"),
    allow_shift_trades: formData.has("allow_shift_trades"),
    manager_approval_required_for_task_transfer: formData.has(
      "manager_approval_required_for_task_transfer"
    ),
    manager_approval_required_for_shift_claim: formData.has(
      "manager_approval_required_for_shift_claim"
    ),
    manager_approval_required_for_shift_trade: formData.has(
      "manager_approval_required_for_shift_trade"
    ),
    allow_cross_role_claims: formData.has("allow_cross_role_claims"),
  };

  const up = await supabase.from("organization_workforce_settings").update(patch).eq("organization_id", orgId);
  if (up.error) return { error: up.error.message };
  await logWorkforceEvent(supabase, {
    organization_id: orgId,
    event_type: "workforce_settings_updated",
    actor_user_id: user.id,
    payload: patch,
  });
  revalidatePath("/app/shift-ops");
  return { ok: true };
}

export async function reassignRunTask(runItemId: string, toEmployeeId: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;

  const { data: row } = await supabase
    .from("shift_checklist_run_items")
    .select(
      "id, shift_checklist_run_id, completed, assigned_employee_id, suppressed"
    )
    .eq("id", runItemId)
    .maybeSingle();
  if (!row) return { error: "Task not found" };

  const r = row as {
    id: string;
    shift_checklist_run_id: string;
    completed: boolean;
    assigned_employee_id: string | null;
    suppressed: boolean;
  };

  const run = await assertRunInOrg(supabase, r.shift_checklist_run_id, orgId);
  if (!run) return { error: "Run not found" };

  if (r.completed) return { error: "Completed tasks cannot be reassigned" };
  if (r.suppressed) return { error: "Suppressed task" };

  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("id", toEmployeeId)
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .single();
  if (!emp) return { error: "Employee not found" };

  const prev = r.assigned_employee_id;
  const now = new Date().toISOString();
  const up = await supabase
    .from("shift_checklist_run_items")
    .update({
      assigned_employee_id: toEmployeeId,
      assigned_by_user_id: user.id,
      reassigned_from_employee_id: prev,
      reassigned_at: now,
      assignment_status: "assigned",
      override_source: "manager_override",
      updated_at: now,
    })
    .eq("id", runItemId)
    .eq("completed", false)
    .select("id")
    .maybeSingle();
  if (up.error) return { error: up.error.message };
  if (!up.data?.id) return { error: "Task was completed or not found" };

  await logWorkforceEvent(supabase, {
    organization_id: orgId,
    event_type: "task_reassigned",
    actor_user_id: user.id,
    shift_checklist_run_id: r.shift_checklist_run_id,
    shift_checklist_run_item_id: runItemId,
    payload: { from: prev, to: toEmployeeId },
  });
  void recordTaskAssignmentFairness({
    organizationId: orgId,
    runItemId,
    assignedEmployeeId: toEmployeeId,
    source: "manager_reassign",
  });
  revalidatePath("/app/shift-ops");
  revalidatePath("/app/checklist-runs");
  return { ok: true };
}

export async function suppressRunTask(runItemId: string, reason?: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;

  const { data: row } = await supabase
    .from("shift_checklist_run_items")
    .select("id, shift_checklist_run_id, suppressed")
    .eq("id", runItemId)
    .maybeSingle();
  if (!row) return { error: "Not found" };
  const r = row as { id: string; shift_checklist_run_id: string };
  const run = await assertRunInOrg(supabase, r.shift_checklist_run_id, orgId);
  if (!run) return { error: "Run not found" };

  const now = new Date().toISOString();
  const up = await supabase
    .from("shift_checklist_run_items")
    .update({
      suppressed: true,
      override_source: "manager_override",
      override_reason: reason ?? null,
      updated_at: now,
    })
    .eq("id", runItemId);
  if (up.error) return { error: up.error.message };

  await logWorkforceEvent(supabase, {
    organization_id: orgId,
    event_type: "task_suppressed",
    actor_user_id: user.id,
    shift_checklist_run_id: r.shift_checklist_run_id,
    shift_checklist_run_item_id: runItemId,
    payload: { reason: reason ?? null },
  });
  revalidatePath("/app/shift-ops");
  return { ok: true };
}

export async function restoreSuppressedRunTask(runItemId: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;

  const { data: row } = await supabase
    .from("shift_checklist_run_items")
    .select("id, shift_checklist_run_id")
    .eq("id", runItemId)
    .maybeSingle();
  if (!row) return { error: "Not found" };
  const r = row as { id: string; shift_checklist_run_id: string };
  const run = await assertRunInOrg(supabase, r.shift_checklist_run_id, orgId);
  if (!run) return { error: "Run not found" };

  const now = new Date().toISOString();
  await supabase
    .from("shift_checklist_run_items")
    .update({ suppressed: false, updated_at: now })
    .eq("id", runItemId);

  await logWorkforceEvent(supabase, {
    organization_id: orgId,
    event_type: "task_restored",
    actor_user_id: user.id,
    shift_checklist_run_id: r.shift_checklist_run_id,
    shift_checklist_run_item_id: runItemId,
    payload: {},
  });
  revalidatePath("/app/shift-ops");
  return { ok: true };
}

export async function rewordRunTask(runItemId: string, newText: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;
  const text = newText.trim();
  if (!text) return { error: "Text required" };

  const { data: row } = await supabase
    .from("shift_checklist_run_items")
    .select("id, shift_checklist_run_id, checklist_item_id")
    .eq("id", runItemId)
    .maybeSingle();
  if (!row) return { error: "Not found" };
  const r = row as { id: string; shift_checklist_run_id: string; checklist_item_id: string };
  const run = await assertRunInOrg(supabase, r.shift_checklist_run_id, orgId);
  if (!run) return { error: "Run not found" };

  let task_key_snapshot = normalizeTaskKey(text);
  const { data: ci } = await supabase
    .from("checklist_items")
    .select("task_key")
    .eq("id", r.checklist_item_id)
    .maybeSingle();
  const explicit = (ci as { task_key?: string | null } | null)?.task_key?.trim();
  if (explicit) task_key_snapshot = normalizeTaskKey(explicit);

  const now = new Date().toISOString();
  await supabase
    .from("shift_checklist_run_items")
    .update({
      task_text_snapshot: text,
      task_key_snapshot,
      override_source: "manager_override",
      updated_at: now,
    })
    .eq("id", runItemId);

  await logWorkforceEvent(supabase, {
    organization_id: orgId,
    event_type: "task_reworded",
    actor_user_id: user.id,
    shift_checklist_run_id: r.shift_checklist_run_id,
    shift_checklist_run_item_id: runItemId,
    payload: {},
  });
  revalidatePath("/app/shift-ops");
  return { ok: true };
}

export async function addRunOverrideTask(params: {
  runId: string;
  taskText: string;
  /** Optional explicit fairness key; normalized. When omitted, derived from task text. */
  taskKey?: string | null;
  assignedEmployeeId?: string | null;
  requiresPhoto?: boolean;
  sortOrder?: number;
}) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;

  if (!(await userCanManageOrganization(supabase, user.id, orgId))) {
    return { error: "Only owners, managers, and admins can manage one-off tasks." };
  }

  const run = await assertRunInOrg(supabase, params.runId, orgId);
  if (!run) return { error: "Run not found" };

  const text = params.taskText.trim();
  if (!text) return { error: "Text required" };

  const taskKeyRaw = params.taskKey?.trim() ?? "";
  const task_key_snapshot = normalizeTaskKey(taskKeyRaw.length > 0 ? taskKeyRaw : text);

  if (params.assignedEmployeeId) {
    const { data: e } = await supabase
      .from("employees")
      .select("id")
      .eq("id", params.assignedEmployeeId)
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .maybeSingle();
    if (!e) return { error: "Assignee not found or inactive in this organization." };
  }

  const ins = await supabase
    .from("shift_run_override_tasks")
    .insert({
      organization_id: orgId,
      run_id: params.runId,
      task_text_snapshot: text,
      task_key_snapshot,
      assigned_employee_id: params.assignedEmployeeId ?? null,
      created_by_user_id: user.id,
      requires_photo: params.requiresPhoto ?? false,
      sort_order: params.sortOrder ?? 0,
      status: "active",
    })
    .select("id")
    .single();
  if (ins.error) return { error: ins.error.message };
  const overrideId = ins.data?.id as string;

  await logWorkforceEvent(supabase, {
    organization_id: orgId,
    event_type: "override_task_added",
    actor_user_id: user.id,
    shift_checklist_run_id: params.runId,
    shift_run_override_task_id: overrideId,
    payload: { taskText: text, assignedEmployeeId: params.assignedEmployeeId ?? null },
  });

  if (params.assignedEmployeeId) {
    await logWorkforceEvent(supabase, {
      organization_id: orgId,
      event_type: "override_task_assigned",
      actor_user_id: user.id,
      shift_checklist_run_id: params.runId,
      shift_run_override_task_id: overrideId,
      payload: { assignedEmployeeId: params.assignedEmployeeId },
    });
  }

  const { data: runFair } = await supabase
    .from("shift_checklist_runs")
    .select("employee_shift_id")
    .eq("id", params.runId)
    .eq("organization_id", orgId)
    .maybeSingle();
  let shiftOwnerId: string | null = null;
  if (runFair) {
    const { data: shRow } = await supabase
      .from("employee_shifts")
      .select("employee_id")
      .eq("id", (runFair as { employee_shift_id: string }).employee_shift_id)
      .maybeSingle();
    shiftOwnerId = (shRow as { employee_id: string } | null)?.employee_id ?? null;
  }
  const fairnessEmployeeId = params.assignedEmployeeId ?? shiftOwnerId;
  if (fairnessEmployeeId) {
    void recordOverrideTaskAssignmentFairness({
      organizationId: orgId,
      overrideTaskId: overrideId,
      assignedEmployeeId: fairnessEmployeeId,
      source: params.assignedEmployeeId ? "override_created" : "override_created_shift_owner_implicit",
    });
  }

  revalidatePath("/app/shift-ops");
  return { ok: true };
}

export async function suppressOverrideTask(overrideId: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;

  if (!(await userCanManageOrganization(supabase, user.id, orgId))) {
    return { error: "Only owners, managers, and admins can manage one-off tasks." };
  }

  const { data: row } = await supabase
    .from("shift_run_override_tasks")
    .select(
      "id, run_id, task_text_snapshot, task_key_snapshot, assigned_employee_id, organization_id, status"
    )
    .eq("id", overrideId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!row) return { error: "Not found" };
  const ov = row as {
    id: string;
    run_id: string;
    task_text_snapshot: string;
    task_key_snapshot: string | null;
    assigned_employee_id: string | null;
    organization_id: string;
    status: string;
  };
  if (ov.status !== "active") {
    return { error: "Only active one-off tasks can be suppressed." };
  }

  const { data: run } = await supabase
    .from("shift_checklist_runs")
    .select("id, employee_shift_id")
    .eq("id", ov.run_id)
    .eq("organization_id", orgId)
    .maybeSingle();
  const runRow = run as { id: string; employee_shift_id: string } | null;
  let shiftOwnerEmployeeId: string | null = null;
  if (runRow) {
    const { data: sh } = await supabase
      .from("employee_shifts")
      .select("employee_id")
      .eq("id", runRow.employee_shift_id)
      .maybeSingle();
    shiftOwnerEmployeeId = (sh as { employee_id: string } | null)?.employee_id ?? null;
  }

  const now = new Date().toISOString();
  const supUp = await supabase
    .from("shift_run_override_tasks")
    .update({ status: "suppressed", updated_at: now })
    .eq("id", overrideId)
    .eq("status", "active")
    .select("id")
    .maybeSingle();
  if (!supUp.data?.id) return { error: "Task is not active or was already updated." };

  const ledgerEmployeeId = ov.assigned_employee_id ?? shiftOwnerEmployeeId;
  if (ledgerEmployeeId && runRow) {
    void recordOverrideTaskLifecycleFairness({
      organizationId: orgId,
      overrideTaskId: overrideId,
      employeeId: ledgerEmployeeId,
      employeeShiftId: runRow.employee_shift_id,
      shiftChecklistRunId: runRow.id,
      eventType: "override_task_suppressed",
      taskTextSnapshot: ov.task_text_snapshot,
      taskKeySnapshot: ov.task_key_snapshot,
      source: "manager_suppress",
      actorUserId: user.id,
    });
  } else {
    await logWorkforceEvent(supabase, {
      organization_id: orgId,
      event_type: "override_task_suppressed",
      actor_user_id: user.id,
      shift_checklist_run_id: ov.run_id,
      shift_run_override_task_id: overrideId,
      employee_shift_id: runRow?.employee_shift_id ?? null,
      payload: { overrideId, note: "ledger_skipped_missing_context" },
    });
  }

  revalidatePath("/app/shift-ops");
  return { ok: true };
}

/**
 * Manager reassigns an active override task. Execution + fairness parity with remap; no separate assignment table.
 */
export async function reassignOverrideTask(overrideId: string, toEmployeeId: string | null) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;

  if (!(await userCanManageOrganization(supabase, user.id, orgId))) {
    return { error: "Only owners, managers, and admins can manage one-off tasks." };
  }

  const { data: row } = await supabase
    .from("shift_run_override_tasks")
    .select(
      "id, run_id, assigned_employee_id, organization_id, status, task_text_snapshot, task_key_snapshot"
    )
    .eq("id", overrideId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!row) return { error: "Not found" };
  const ov = row as {
    id: string;
    run_id: string;
    assigned_employee_id: string | null;
    organization_id: string;
    status: string;
    task_text_snapshot: string;
    task_key_snapshot: string | null;
  };
  if (ov.status !== "active") {
    return { error: "Only active one-off tasks can be reassigned." };
  }

  const { data: run } = await supabase
    .from("shift_checklist_runs")
    .select("id, employee_shift_id")
    .eq("id", ov.run_id)
    .eq("organization_id", orgId)
    .maybeSingle();
  const runRow = run as { id: string; employee_shift_id: string } | null;
  if (!runRow) return { error: "Run not found" };

  const { data: sh } = await supabase
    .from("employee_shifts")
    .select("employee_id")
    .eq("id", runRow.employee_shift_id)
    .maybeSingle();
  const shiftOwnerEmployeeId = (sh as { employee_id: string } | null)?.employee_id ?? null;

  if (toEmployeeId) {
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("id", toEmployeeId)
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .maybeSingle();
    if (!emp) return { error: "Target employee not found or inactive in this organization." };
  }

  const fromAssignee = ov.assigned_employee_id;
  if (fromAssignee === toEmployeeId) {
    revalidatePath("/app/shift-ops");
    return { ok: true };
  }

  const now = new Date().toISOString();
  const up = await supabase
    .from("shift_run_override_tasks")
    .update({
      assigned_employee_id: toEmployeeId,
      updated_at: now,
    })
    .eq("id", overrideId)
    .eq("organization_id", orgId)
    .eq("status", "active")
    .is("completed_at", null)
    .select("id")
    .maybeSingle();
  if (!up.data?.id) {
    return {
      error:
        "Could not reassign. Task must be active, not completed, and still in this organization.",
    };
  }

  await logWorkforceEvent(supabase, {
    organization_id: orgId,
    event_type: "override_task_reassigned",
    actor_user_id: user.id,
    shift_checklist_run_id: ov.run_id,
    shift_run_override_task_id: overrideId,
    employee_shift_id: runRow.employee_shift_id,
    payload: {
      from_employee_id: fromAssignee,
      to_employee_id: toEmployeeId,
      task_text_snapshot: ov.task_text_snapshot,
      task_key_snapshot: ov.task_key_snapshot,
      source: "manager_reassign",
    },
  });

  const fairnessSubject = toEmployeeId ?? shiftOwnerEmployeeId;
  if (fairnessSubject) {
    void recordOverrideTaskAssignmentFairness({
      organizationId: orgId,
      overrideTaskId: overrideId,
      assignedEmployeeId: fairnessSubject,
      source: "manager_override_reassign",
    });
  }

  revalidatePath("/app/shift-ops");
  return { ok: true };
}

export async function restoreOverrideTask(overrideId: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;

  if (!(await userCanManageOrganization(supabase, user.id, orgId))) {
    return { error: "Only owners, managers, and admins can manage one-off tasks." };
  }

  const { data: row } = await supabase
    .from("shift_run_override_tasks")
    .select(
      "id, run_id, task_text_snapshot, task_key_snapshot, assigned_employee_id, organization_id, status"
    )
    .eq("id", overrideId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!row) return { error: "Not found" };
  const ov = row as {
    id: string;
    run_id: string;
    task_text_snapshot: string;
    task_key_snapshot: string | null;
    assigned_employee_id: string | null;
    organization_id: string;
    status: string;
  };
  if (ov.status !== "suppressed") return { error: "Only suppressed one-off tasks can be restored" };

  const { data: run } = await supabase
    .from("shift_checklist_runs")
    .select("id, employee_shift_id")
    .eq("id", ov.run_id)
    .eq("organization_id", orgId)
    .maybeSingle();
  const runRow = run as { id: string; employee_shift_id: string } | null;
  if (!runRow) return { error: "Run not found" };

  const { data: sh } = await supabase
    .from("employee_shifts")
    .select("employee_id")
    .eq("id", runRow.employee_shift_id)
    .maybeSingle();
  const shiftOwnerEmployeeId = (sh as { employee_id: string } | null)?.employee_id ?? null;

  const now = new Date().toISOString();
  const up = await supabase
    .from("shift_run_override_tasks")
    .update({ status: "active", completed_at: null, updated_at: now })
    .eq("id", overrideId)
    .eq("status", "suppressed")
    .select("id")
    .maybeSingle();
  if (!up.data?.id) return { error: "Could not restore (state changed?)" };

  const ledgerEmployeeId = ov.assigned_employee_id ?? shiftOwnerEmployeeId;
  if (ledgerEmployeeId) {
    void recordOverrideTaskLifecycleFairness({
      organizationId: orgId,
      overrideTaskId: overrideId,
      employeeId: ledgerEmployeeId,
      employeeShiftId: runRow.employee_shift_id,
      shiftChecklistRunId: runRow.id,
      eventType: "override_task_restored",
      taskTextSnapshot: ov.task_text_snapshot,
      taskKeySnapshot: ov.task_key_snapshot,
      source: "manager_restore",
      actorUserId: user.id,
    });
    void recordOverrideTaskAssignmentFairness({
      organizationId: orgId,
      overrideTaskId: overrideId,
      assignedEmployeeId: ledgerEmployeeId,
      source: "override_restored",
    });
  } else {
    await logWorkforceEvent(supabase, {
      organization_id: orgId,
      event_type: "override_task_restored",
      actor_user_id: user.id,
      shift_checklist_run_id: ov.run_id,
      shift_run_override_task_id: overrideId,
      employee_shift_id: runRow.employee_shift_id,
      payload: { note: "ledger_skipped_no_assignee_context" },
    });
  }

  revalidatePath("/app/shift-ops");
  return { ok: true };
}

export async function approveTaskTransferRequest(requestId: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;

  const { data: req } = await supabase
    .from("shift_task_transfer_requests")
    .select("*")
    .eq("id", requestId)
    .eq("organization_id", orgId)
    .single();
  if (!req) return { error: "Not found" };
  const q = req as Record<string, unknown>;
  if (q.status !== "accepted") {
    return { error: "Request is not awaiting manager approval" };
  }
  const toId = q.to_employee_id as string | null;
  if (!toId) return { error: "No assignee on request" };

  const now = new Date().toISOString();
  const itemId = q.shift_checklist_run_item_id as string;
  const fromId = q.from_employee_id as string;

  const reqClaim = await supabase
    .from("shift_task_transfer_requests")
    .update({
      status: "approved",
      approved_by_user_id: user.id,
      approved_at: now,
      updated_at: now,
    })
    .eq("id", requestId)
    .eq("status", "accepted")
    .select("id")
    .maybeSingle();
  if (!reqClaim.data?.id) {
    return { error: "Request already processed or not awaiting approval" };
  }

  const itemUp = await supabase
    .from("shift_checklist_run_items")
    .update({
      assigned_employee_id: toId,
      assigned_by_user_id: user.id,
      reassigned_from_employee_id: fromId,
      reassigned_at: now,
      assignment_status: "assigned",
      updated_at: now,
    })
    .eq("id", itemId)
    .eq("assigned_employee_id", fromId)
    .eq("completed", false)
    .select("id")
    .maybeSingle();

  if (!itemUp.data?.id) {
    await supabase
      .from("shift_task_transfer_requests")
      .update({
        status: "accepted",
        approved_by_user_id: null,
        approved_at: null,
        updated_at: now,
      })
      .eq("id", requestId)
      .eq("status", "approved");
    return { error: "Task was completed or reassigned; reopen the request if needed" };
  }

  await logWorkforceEvent(supabase, {
    organization_id: orgId,
    event_type: "task_transfer_approved",
    actor_user_id: user.id,
    shift_checklist_run_id: q.run_id as string,
    shift_checklist_run_item_id: itemId,
    related_request_id: requestId,
    payload: {},
  });
  await notifyWorkforceApprovalResult({
    organizationId: orgId,
    kind: "task_transfer",
    requestId,
    approved: true,
  });
  void recordTaskAssignmentFairness({
    organizationId: orgId,
    runItemId: itemId,
    assignedEmployeeId: toId,
    source: "task_transfer_approved",
  });
  revalidatePath("/app/shift-ops");
  revalidatePath("/app/my-requests");
  logServerEvent("manager_request_approved", {
    organization_id: orgId,
    user_id: user.id,
    request_id: requestId,
    kind: "task_transfer",
  });
  return { ok: true };
}

export async function denyTaskTransferRequest(requestId: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;
  const rl = await guardManagerRateLimit(user.id, orgId);
  if (rl) return rl;

  const { data: prev } = await supabase
    .from("shift_task_transfer_requests")
    .select("from_employee_id")
    .eq("id", requestId)
    .eq("organization_id", orgId)
    .maybeSingle();
  const fromEmp = (prev as { from_employee_id: string } | null)?.from_employee_id;

  const now = new Date().toISOString();
  const up = await supabase
    .from("shift_task_transfer_requests")
    .update({
      status: "denied",
      declined_at: now,
      updated_at: now,
    })
    .eq("id", requestId)
    .eq("organization_id", orgId)
    .in("status", ["pending", "accepted"])
    .select("id")
    .maybeSingle();
  if (!up.data?.id) {
    return { error: "Request already finalized" };
  }

  await logWorkforceEvent(supabase, {
    organization_id: orgId,
    event_type: "task_transfer_denied",
    actor_user_id: user.id,
    related_request_id: requestId,
    payload: {},
  });
  await notifyWorkforceApprovalResult({
    organizationId: orgId,
    kind: "task_transfer",
    requestId,
    approved: false,
  });
  revalidatePath("/app/shift-ops");
  logServerEvent("manager_request_denied", {
    organization_id: orgId,
    user_id: user.id,
    request_id: requestId,
    kind: "task_transfer",
  });
  return { ok: true };
}

export async function setShiftOpenForClaim(shiftId: string, open: boolean) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;

  const up = await supabase
    .from("employee_shifts")
    .update({ is_open_for_claim: open, updated_at: new Date().toISOString() })
    .eq("id", shiftId)
    .eq("organization_id", orgId);
  if (up.error) return { error: up.error.message };

  await logWorkforceEvent(supabase, {
    organization_id: orgId,
    event_type: open ? "shift_marked_open" : "shift_marked_closed",
    actor_user_id: user.id,
    employee_shift_id: shiftId,
    payload: {},
  });
  await notifyShiftOpenForClaim({ organizationId: orgId, shiftId });
  revalidatePath("/app/shift-ops");
  revalidatePath("/app/my-shifts");
  return { ok: true };
}

export async function approveShiftCoverageRequest(requestId: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;
  const rl = await guardManagerRateLimit(user.id, orgId);
  if (rl) return rl;

  const { data: req } = await supabase
    .from("shift_coverage_requests")
    .select("*")
    .eq("id", requestId)
    .eq("organization_id", orgId)
    .single();
  if (!req) return { error: "Not found" };
  const q = req as Record<string, unknown>;
  if (q.status !== "claimed" && q.status !== "pending") {
    return { error: "Invalid status for approval" };
  }

  const shiftId = q.employee_shift_id as string;
  let newOwner: string | null =
    (q.claimed_by_employee_id as string | null) ?? (q.target_employee_id as string | null);
  if (!newOwner && q.status === "pending" && q.request_type === "direct_cover") {
    newOwner = q.target_employee_id as string | null;
  }
  if (!newOwner) return { error: "No claimant or target employee" };

  const { data: shift } = await supabase
    .from("employee_shifts")
    .select("employee_id, shift_type, shift_date")
    .eq("id", shiftId)
    .single();
  const shiftRow = shift as { employee_id: string; shift_type: string; shift_date: string } | null;
  const oldOwner = shiftRow?.employee_id;
  if (!oldOwner || !shiftRow) return { error: "Shift not found" };

  const priorCoverageStatus = q.status as string;
  const now = new Date().toISOString();
  const shUp = await supabase
    .from("employee_shifts")
    .update({ employee_id: newOwner, updated_at: now })
    .eq("id", shiftId)
    .eq("organization_id", orgId)
    .eq("employee_id", oldOwner)
    .select("id")
    .maybeSingle();
  if (!shUp.data?.id) {
    return { error: "Shift owner changed; refresh and retry" };
  }

  const covUp = await supabase
    .from("shift_coverage_requests")
    .update({
      status: "approved",
      approved_by_user_id: user.id,
      approved_at: now,
      updated_at: now,
    })
    .eq("id", requestId)
    .eq("organization_id", orgId)
    .in("status", ["pending", "claimed"])
    .select("id")
    .maybeSingle();

  if (!covUp.data?.id) {
    await supabase
      .from("employee_shifts")
      .update({ employee_id: oldOwner, updated_at: new Date().toISOString() })
      .eq("id", shiftId)
      .eq("organization_id", orgId)
      .eq("employee_id", newOwner);
    return { error: "Request already processed or no longer pending" };
  }

  const { data: run } = await supabase
    .from("shift_checklist_runs")
    .select("id")
    .eq("employee_shift_id", shiftId)
    .maybeSingle();
  if (run?.id) {
    const mapRes = await remapRunItemsAfterShiftOwnerChange({
      organizationId: orgId,
      runId: run.id as string,
      oldEmployeeId: oldOwner,
      newEmployeeId: newOwner,
      actorUserId: user.id,
    });
    if (mapRes.error) {
      await supabase
        .from("employee_shifts")
        .update({ employee_id: oldOwner, updated_at: new Date().toISOString() })
        .eq("id", shiftId)
        .eq("organization_id", orgId)
        .eq("employee_id", newOwner);
      await supabase
        .from("shift_coverage_requests")
        .update({
          status: priorCoverageStatus,
          approved_by_user_id: null,
          approved_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .eq("organization_id", orgId)
        .eq("status", "approved");
      logServerEvent("shift_coverage_approve_remap_failed", {
        organization_id: orgId,
        user_id: user.id,
        request_id: requestId,
        message: mapRes.error,
      });
      return { error: "Checklist assignments could not be updated; nothing was finalized. Refresh and retry." };
    }
  }

  await logWorkforceEvent(supabase, {
    organization_id: orgId,
    event_type: "shift_coverage_approved",
    actor_user_id: user.id,
    employee_shift_id: shiftId,
    related_request_id: requestId,
    payload: { oldOwner, newOwner },
  });
  await notifyWorkforceApprovalResult({
    organizationId: orgId,
    kind: "shift_claim",
    requestId,
    approved: true,
  });
  void recordVoluntaryShiftPickupFairness({
    organizationId: orgId,
    employeeId: newOwner,
    employeeShiftId: shiftId,
    reason: "shift_coverage_approved",
  });
  void recordShiftAssignmentFairness({
    organizationId: orgId,
    employeeShiftId: shiftId,
    employeeId: newOwner,
    shiftType: shiftRow.shift_type,
    shiftDate: shiftRow.shift_date,
  });
  revalidatePath("/app/shift-ops");
  revalidatePath("/app/my-shifts");
  logServerEvent("manager_request_approved", {
    organization_id: orgId,
    user_id: user.id,
    request_id: requestId,
    kind: "shift_coverage",
  });
  return { ok: true };
}

export async function denyShiftCoverageRequest(requestId: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;
  const rl = await guardManagerRateLimit(user.id, orgId);
  if (rl) return rl;

  const denyCov = await supabase
    .from("shift_coverage_requests")
    .update({ status: "denied", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("organization_id", orgId)
    .in("status", ["pending", "claimed"])
    .select("id")
    .maybeSingle();
  if (!denyCov.data?.id) {
    return { error: "Request already finalized" };
  }

  await logWorkforceEvent(supabase, {
    organization_id: orgId,
    event_type: "shift_coverage_denied",
    actor_user_id: user.id,
    related_request_id: requestId,
    payload: {},
  });
  await notifyWorkforceApprovalResult({
    organizationId: orgId,
    kind: "shift_claim",
    requestId,
    approved: false,
  });
  revalidatePath("/app/shift-ops");
  logServerEvent("manager_request_denied", {
    organization_id: orgId,
    user_id: user.id,
    request_id: requestId,
    kind: "shift_coverage",
  });
  return { ok: true };
}

export async function approveShiftTrade(tradeId: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;
  const rl = await guardManagerRateLimit(user.id, orgId);
  if (rl) return rl;

  const { data: tr } = await supabase
    .from("shift_trade_offers")
    .select("status")
    .eq("id", tradeId)
    .eq("organization_id", orgId)
    .single();
  if (!tr) return { error: "Not found" };
  if ((tr as { status: string }).status !== "accepted") {
    return { error: "Trade not in accepted state" };
  }

  const res = await applyShiftTradeApproval({
    organizationId: orgId,
    tradeId,
    actorUserId: user.id,
  });
  if (res.error) return { error: res.error };

  if (!res.alreadyApplied) {
    await logWorkforceEvent(supabase, {
      organization_id: orgId,
      event_type: "shift_trade_approved_by_manager",
      actor_user_id: user.id,
      related_request_id: tradeId,
      payload: {},
    });
    await notifyWorkforceApprovalResult({
      organizationId: orgId,
      kind: "shift_trade",
      requestId: tradeId,
      approved: true,
    });
  }
  revalidatePath("/app/shift-ops");
  revalidatePath("/app/my-requests");
  logServerEvent("manager_request_approved", {
    organization_id: orgId,
    user_id: user.id,
    request_id: tradeId,
    kind: "shift_trade",
  });
  return { ok: true };
}

export async function denyShiftTrade(tradeId: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;
  const rl = await guardManagerRateLimit(user.id, orgId);
  if (rl) return rl;

  const denyUp = await supabase
    .from("shift_trade_offers")
    .update({ status: "denied", updated_at: new Date().toISOString() })
    .eq("id", tradeId)
    .eq("organization_id", orgId)
    .in("status", ["pending", "accepted"])
    .select("id")
    .maybeSingle();

  if (!denyUp.data?.id) {
    return { error: "Trade already finalized" };
  }

  await logWorkforceEvent(supabase, {
    organization_id: orgId,
    event_type: "shift_trade_denied",
    actor_user_id: user.id,
    related_request_id: tradeId,
    payload: {},
  });
  await notifyWorkforceApprovalResult({
    organizationId: orgId,
    kind: "shift_trade",
    requestId: tradeId,
    approved: false,
  });
  revalidatePath("/app/shift-ops");
  logServerEvent("manager_request_denied", {
    organization_id: orgId,
    user_id: user.id,
    request_id: tradeId,
    kind: "shift_trade",
  });
  return { ok: true };
}

function isLikelyUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim());
}

/** Manager inbox: dispatch approve by normalized feed provenance (see `hh_request_feed`). */
export async function approveRequestFromFeed(input: {
  sourceTable: string;
  sourceId: string;
  notes?: string;
}) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;

  const canManage = await userCanManageOrganization(supabase, user.id, orgId);
  if (!canManage) {
    return { error: "Only organization managers can approve from this inbox" };
  }

  const sourceTable = input.sourceTable.trim();
  const sourceId = input.sourceId.trim();
  if (!FEED_APPROVAL_TABLES.has(sourceTable)) {
    return { error: "Unknown or unsupported request source" };
  }
  if (!isLikelyUuid(sourceId)) {
    return { error: "Invalid request id" };
  }

  switch (sourceTable) {
    case "shift_task_transfer_requests": {
      const r = await approveTaskTransferRequest(sourceId);
      if ("error" in r) return r;
      break;
    }
    case "shift_coverage_requests": {
      const r = await approveShiftCoverageRequest(sourceId);
      if ("error" in r) return r;
      break;
    }
    case "shift_trade_offers": {
      const r = await approveShiftTrade(sourceId);
      if ("error" in r) return r;
      break;
    }
    default:
      return { error: "Unknown request source" };
  }

  const notes = input.notes?.trim();
  if (notes) {
    await logWorkforceEvent(supabase, {
      organization_id: orgId,
      event_type: "request_feed_decision_note",
      actor_user_id: user.id,
      related_request_id: sourceId,
      payload: { source_table: sourceTable, decision: "approve", notes },
    });
  }

  revalidatePath("/app/requests");
  revalidatePath("/app/today");
  revalidatePath("/app/my-requests");
  return { ok: true as const };
}

/** Manager inbox: dispatch deny by normalized feed provenance. */
export async function denyRequestFromFeed(input: {
  sourceTable: string;
  sourceId: string;
  notes?: string;
}) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;

  const canManage = await userCanManageOrganization(supabase, user.id, orgId);
  if (!canManage) {
    return { error: "Only organization managers can deny from this inbox" };
  }

  const sourceTable = input.sourceTable.trim();
  const sourceId = input.sourceId.trim();
  if (!FEED_APPROVAL_TABLES.has(sourceTable)) {
    return { error: "Unknown or unsupported request source" };
  }
  if (!isLikelyUuid(sourceId)) {
    return { error: "Invalid request id" };
  }

  switch (sourceTable) {
    case "shift_task_transfer_requests": {
      const r = await denyTaskTransferRequest(sourceId);
      if ("error" in r) return r;
      break;
    }
    case "shift_coverage_requests": {
      const r = await denyShiftCoverageRequest(sourceId);
      if ("error" in r) return r;
      break;
    }
    case "shift_trade_offers": {
      const r = await denyShiftTrade(sourceId);
      if ("error" in r) return r;
      break;
    }
    default:
      return { error: "Unknown request source" };
  }

  const notes = input.notes?.trim();
  if (notes) {
    await logWorkforceEvent(supabase, {
      organization_id: orgId,
      event_type: "request_feed_decision_note",
      actor_user_id: user.id,
      related_request_id: sourceId,
      payload: { source_table: sourceTable, decision: "deny", notes },
    });
  }

  revalidatePath("/app/requests");
  revalidatePath("/app/today");
  revalidatePath("/app/my-requests");
  return { ok: true as const };
}
