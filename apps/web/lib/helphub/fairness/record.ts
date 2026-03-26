import { createHelpHubServiceClient } from "@/lib/helphub/supabase-service";
import { logWorkforceEvent } from "@/lib/helphub/workforce/log";
import { ledgerTaskKeyFromSnapshots, normalizeTaskKey } from "./task-key";
import { fetchOrCreateOrganizationFairnessSettings } from "./fairness-settings";
import { orgWeekdayFromShiftDate, shiftDateLookbackFrom } from "./shift-weekday";
import { CLOSE_SHIFT_REPEAT_LEDGER_THRESHOLD } from "./constants";

export type FairnessLedgerInput = {
  organizationId: string;
  employeeId: string;
  employeeShiftId?: string | null;
  shiftChecklistRunId?: string | null;
  shiftChecklistRunItemId?: string | null;
  shiftRunOverrideTaskId?: string | null;
  /** Optional actor for mirrored workforce_event_log rows (e.g. who completed a task). */
  actorEmployeeId?: string | null;
  actorUserId?: string | null;
  eventType: string;
  fairnessCategory: string;
  preferenceKey?: string | null;
  shiftType?: string | null;
  weekday?: number | null;
  value?: number;
  metadata?: Record<string, unknown>;
};

/**
 * Inserts fairness_assignment_ledger (service role) + mirrors to workforce_event_log.
 * Safe no-op if service role is unavailable.
 * Does not assign work — analytics / hints only.
 */
export async function logFairnessEvent(input: FairnessLedgerInput): Promise<void> {
  try {
    const admin = createHelpHubServiceClient();
    const { error } = await admin.from("fairness_assignment_ledger").insert({
      organization_id: input.organizationId,
      employee_id: input.employeeId,
      employee_shift_id: input.employeeShiftId ?? null,
      shift_checklist_run_id: input.shiftChecklistRunId ?? null,
      shift_checklist_run_item_id: input.shiftChecklistRunItemId ?? null,
      shift_run_override_task_id: input.shiftRunOverrideTaskId ?? null,
      event_type: input.eventType,
      fairness_category: input.fairnessCategory,
      preference_key: input.preferenceKey ?? null,
      shift_type: input.shiftType ?? null,
      weekday: input.weekday ?? null,
      value: input.value ?? 1,
      metadata: input.metadata ?? {},
    });
    if (error) {
      console.error("fairness_assignment_ledger insert failed", error.message);
      return;
    }
    await logWorkforceEvent(admin, {
      organization_id: input.organizationId,
      event_type: input.eventType,
      actor_user_id: input.actorUserId ?? null,
      shift_checklist_run_id: input.shiftChecklistRunId ?? null,
      shift_checklist_run_item_id: input.shiftChecklistRunItemId ?? null,
      shift_run_override_task_id: input.shiftRunOverrideTaskId ?? null,
      employee_shift_id: input.employeeShiftId ?? null,
      actor_employee_id: input.actorEmployeeId ?? null,
      payload: {
        fairness_category: input.fairnessCategory,
        preference_key: input.preferenceKey ?? null,
        metadata: input.metadata ?? {},
      },
    });
  } catch (e) {
    console.error("logFairnessEvent", e instanceof Error ? e.message : e);
  }
}

function schedulePreferenceSeverity(level: string): number {
  if (level === "unavailable") return 4;
  if (level === "avoid") return 3;
  if (level === "prefer") return 2;
  if (level === "available") return 1;
  return 0;
}

function scheduleSignalFromLevel(level: string): "prefer" | "avoid" | "unavailable" | "available" | "neutral" {
  if (level === "prefer") return "prefer";
  if (level === "unavailable") return "unavailable";
  if (level === "avoid") return "avoid";
  if (level === "available") return "available";
  return "neutral";
}

async function countTaskKeyEvents(
  admin: ReturnType<typeof createHelpHubServiceClient>,
  orgId: string,
  employeeId: string,
  taskKey: string,
  sinceIso: string,
  eventTypes: string[]
): Promise<number> {
  const { count, error } = await admin
    .from("fairness_assignment_ledger")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("employee_id", employeeId)
    .eq("preference_key", taskKey)
    .in("event_type", eventTypes)
    .gte("created_at", sinceIso);
  if (error) return 0;
  return count ?? 0;
}

type TaskPrefFairnessContext = {
  organizationId: string;
  assignedEmployeeId: string;
  employeeShiftId: string;
  shiftChecklistRunId: string;
  shiftChecklistRunItemId: string | null;
  shiftRunOverrideTaskId: string | null;
  taskKey: string;
  taskTextSnapshot: string | null;
  shiftType: string;
  shiftDate: string;
  source: string;
  taskAssignmentSource: "template_run_item" | "override_task";
};

/**
 * Preferred / avoid / repeated-undesirable signals for an assignee (template run item or override task).
 */
async function applyTaskPreferenceFairnessSignals(
  admin: ReturnType<typeof createHelpHubServiceClient>,
  ctx: TaskPrefFairnessContext
): Promise<void> {
  const settings = await fetchOrCreateOrganizationFairnessSettings(admin, ctx.organizationId);

  const since = new Date();
  since.setDate(since.getDate() - settings.fairness_lookback_days);
  const sinceIso = since.toISOString();

  const { data: prefRow } = await admin
    .from("employee_task_preferences")
    .select("preference_level")
    .eq("organization_id", ctx.organizationId)
    .eq("employee_id", ctx.assignedEmployeeId)
    .eq("preference_key", ctx.taskKey)
    .maybeSingle();
  const prefLevel = (prefRow as { preference_level: string } | null)?.preference_level ?? "neutral";

  const orgUndesirable = new Set(
    settings.undesirable_task_keys
      .map((k) => normalizeTaskKey(k))
      .filter((k) => k !== "unnamed_task")
  );
  const isOrgUndesirable = orgUndesirable.has(ctx.taskKey);

  const wd = orgWeekdayFromShiftDate(ctx.shiftDate);
  const baseMeta = {
    task_key: ctx.taskKey,
    task_text_snapshot: ctx.taskTextSnapshot,
    task_assignment_source: ctx.taskAssignmentSource,
    fairness_eval_source: ctx.source,
  };

  if (prefLevel === "prefer") {
    await logFairnessEvent({
      organizationId: ctx.organizationId,
      employeeId: ctx.assignedEmployeeId,
      employeeShiftId: ctx.employeeShiftId,
      shiftChecklistRunId: ctx.shiftChecklistRunId,
      shiftChecklistRunItemId: ctx.shiftChecklistRunItemId,
      shiftRunOverrideTaskId: ctx.shiftRunOverrideTaskId,
      eventType: "preferred_task_assigned",
      fairnessCategory: "task_preference",
      preferenceKey: ctx.taskKey,
      shiftType: ctx.shiftType,
      weekday: wd,
      metadata: baseMeta,
    });
  }

  if (prefLevel === "avoid" || isOrgUndesirable) {
    await logFairnessEvent({
      organizationId: ctx.organizationId,
      employeeId: ctx.assignedEmployeeId,
      employeeShiftId: ctx.employeeShiftId,
      shiftChecklistRunId: ctx.shiftChecklistRunId,
      shiftChecklistRunItemId: ctx.shiftChecklistRunItemId,
      shiftRunOverrideTaskId: ctx.shiftRunOverrideTaskId,
      eventType: "avoided_task_assigned",
      fairnessCategory: prefLevel === "avoid" ? "task_preference" : "undesirable_distribution",
      preferenceKey: ctx.taskKey,
      shiftType: ctx.shiftType,
      weekday: wd,
      metadata: {
        ...baseMeta,
        from_employee_preference: prefLevel === "avoid",
        from_org_rule: isOrgUndesirable,
      },
    });

    const prior = await countTaskKeyEvents(
      admin,
      ctx.organizationId,
      ctx.assignedEmployeeId,
      ctx.taskKey,
      sinceIso,
      ["avoided_task_assigned", "undesirable_task_repeated"]
    );
    if (prior >= 2) {
      await logFairnessEvent({
        organizationId: ctx.organizationId,
        employeeId: ctx.assignedEmployeeId,
        employeeShiftId: ctx.employeeShiftId,
        shiftChecklistRunId: ctx.shiftChecklistRunId,
        shiftChecklistRunItemId: ctx.shiftChecklistRunItemId,
        shiftRunOverrideTaskId: ctx.shiftRunOverrideTaskId,
        eventType: "undesirable_task_repeated",
        fairnessCategory: "undesirable_distribution",
        preferenceKey: ctx.taskKey,
        shiftType: ctx.shiftType,
        weekday: wd,
        metadata: { ...baseMeta, prior_avoid_count_in_window: prior },
      });
    }
  }
}

/**
 * Records fairness signals when a run item is assigned to an employee (initial, reassign, transfer, remap).
 */
export async function recordTaskAssignmentFairness(params: {
  organizationId: string;
  runItemId: string;
  assignedEmployeeId: string;
  source?: string;
}): Promise<void> {
  try {
    const admin = createHelpHubServiceClient();
    const { data: item } = await admin
      .from("shift_checklist_run_items")
      .select("id, task_key_snapshot, task_text_snapshot, shift_checklist_run_id, suppressed")
      .eq("id", params.runItemId)
      .single();
    if (!item || (item as { suppressed: boolean }).suppressed) return;

    const it = item as {
      id: string;
      task_key_snapshot: string | null;
      task_text_snapshot: string | null;
      shift_checklist_run_id: string;
    };
    const taskKey = ledgerTaskKeyFromSnapshots(it.task_key_snapshot, it.task_text_snapshot);

    const { data: run } = await admin
      .from("shift_checklist_runs")
      .select("id, employee_shift_id")
      .eq("id", it.shift_checklist_run_id)
      .single();
    if (!run) return;
    const runRow = run as { id: string; employee_shift_id: string };

    const { data: shift } = await admin
      .from("employee_shifts")
      .select("id, shift_type, shift_date")
      .eq("id", runRow.employee_shift_id)
      .single();
    if (!shift) return;
    const sh = shift as { id: string; shift_type: string; shift_date: string };

    await applyTaskPreferenceFairnessSignals(admin, {
      organizationId: params.organizationId,
      assignedEmployeeId: params.assignedEmployeeId,
      employeeShiftId: sh.id,
      shiftChecklistRunId: runRow.id,
      shiftChecklistRunItemId: it.id,
      shiftRunOverrideTaskId: null,
      taskKey,
      taskTextSnapshot: it.task_text_snapshot,
      shiftType: sh.shift_type,
      shiftDate: sh.shift_date,
      source: params.source ?? "assignment",
      taskAssignmentSource: "template_run_item",
    });
  } catch (e) {
    console.error("recordTaskAssignmentFairness", e instanceof Error ? e.message : e);
  }
}

/**
 * Same preference / org-undesirable / repeated-load evaluation as template run items, for override tasks.
 */
export async function recordOverrideTaskAssignmentFairness(params: {
  organizationId: string;
  overrideTaskId: string;
  assignedEmployeeId: string;
  source?: string;
}): Promise<void> {
  try {
    const admin = createHelpHubServiceClient();
    const { data: ov } = await admin
      .from("shift_run_override_tasks")
      .select(
        "id, run_id, task_key_snapshot, task_text_snapshot, status, assigned_employee_id, organization_id"
      )
      .eq("id", params.overrideTaskId)
      .single();
    if (!ov) return;
    const row = ov as {
      id: string;
      run_id: string;
      task_key_snapshot: string | null;
      task_text_snapshot: string;
      status: string;
      assigned_employee_id: string | null;
      organization_id: string;
    };
    if (row.organization_id !== params.organizationId) return;
    if (row.status !== "active") return;
    if (!params.assignedEmployeeId) return;
    // Explicit assignee must match params; null assignee means "shift owner" semantics — caller passes that id.
    if (row.assigned_employee_id && row.assigned_employee_id !== params.assignedEmployeeId) return;

    const taskKey = ledgerTaskKeyFromSnapshots(row.task_key_snapshot, row.task_text_snapshot);

    const { data: run } = await admin
      .from("shift_checklist_runs")
      .select("id, employee_shift_id")
      .eq("id", row.run_id)
      .single();
    if (!run) return;
    const runRow = run as { id: string; employee_shift_id: string };

    const { data: shift } = await admin
      .from("employee_shifts")
      .select("id, shift_type, shift_date")
      .eq("id", runRow.employee_shift_id)
      .single();
    if (!shift) return;
    const sh = shift as { id: string; shift_type: string; shift_date: string };

    await applyTaskPreferenceFairnessSignals(admin, {
      organizationId: params.organizationId,
      assignedEmployeeId: params.assignedEmployeeId,
      employeeShiftId: sh.id,
      shiftChecklistRunId: runRow.id,
      shiftChecklistRunItemId: null,
      shiftRunOverrideTaskId: row.id,
      taskKey,
      taskTextSnapshot: row.task_text_snapshot,
      shiftType: sh.shift_type,
      shiftDate: sh.shift_date,
      source: params.source ?? "override_assignment",
      taskAssignmentSource: "override_task",
    });
  } catch (e) {
    console.error("recordOverrideTaskAssignmentFairness", e instanceof Error ? e.message : e);
  }
}

/**
 * Operational / lifecycle ledger rows for overrides (do not affect dashboard task preference totals).
 */
export async function recordOverrideTaskLifecycleFairness(params: {
  organizationId: string;
  overrideTaskId: string;
  employeeId: string;
  employeeShiftId: string;
  shiftChecklistRunId: string;
  eventType: "override_task_suppressed" | "override_task_completed" | "override_task_restored";
  taskTextSnapshot: string;
  taskKeySnapshot: string | null;
  source?: string;
  /** Employee who performed the action (e.g. completed on device), when different from ledger subject. */
  actorEmployeeId?: string | null;
  actorUserId?: string | null;
}): Promise<void> {
  try {
    const admin = createHelpHubServiceClient();
    const { data: shift } = await admin
      .from("employee_shifts")
      .select("shift_type, shift_date")
      .eq("id", params.employeeShiftId)
      .single();
    const sh = shift as { shift_type: string; shift_date: string } | null;
    const wd = sh ? orgWeekdayFromShiftDate(sh.shift_date) : null;

    await logFairnessEvent({
      organizationId: params.organizationId,
      employeeId: params.employeeId,
      employeeShiftId: params.employeeShiftId,
      shiftChecklistRunId: params.shiftChecklistRunId,
      shiftChecklistRunItemId: null,
      shiftRunOverrideTaskId: params.overrideTaskId,
      actorEmployeeId: params.actorEmployeeId ?? null,
      actorUserId: params.actorUserId ?? null,
      eventType: params.eventType,
      fairnessCategory: "override_lifecycle",
      preferenceKey: ledgerTaskKeyFromSnapshots(params.taskKeySnapshot, params.taskTextSnapshot),
      shiftType: sh?.shift_type ?? null,
      weekday: wd,
      value: 1,
      metadata: {
        task_assignment_source: "override_task",
        task_text_snapshot: params.taskTextSnapshot,
        task_key_snapshot: params.taskKeySnapshot,
        lifecycle_source: params.source ?? params.eventType,
        ...(params.actorEmployeeId
          ? { completed_by_employee_id: params.actorEmployeeId }
          : {}),
      },
    });
  } catch (e) {
    console.error("recordOverrideTaskLifecycleFairness", e instanceof Error ? e.message : e);
  }
}

/**
 * When a shift is scheduled / owned by an employee, evaluate day + shift type vs prefs and org rules.
 */
export async function recordShiftAssignmentFairness(params: {
  organizationId: string;
  employeeShiftId: string;
  employeeId: string;
  shiftType: string;
  shiftDate: string;
}): Promise<void> {
  try {
    const admin = createHelpHubServiceClient();
    const settings = await fetchOrCreateOrganizationFairnessSettings(admin, params.organizationId);
    const wd = orgWeekdayFromShiftDate(params.shiftDate);

    const { data: rows } = await admin
      .from("employee_schedule_preferences")
      .select("weekday, shift_type, preference_level")
      .eq("organization_id", params.organizationId)
      .eq("employee_id", params.employeeId);

    let maxSev = 0;
    let scheduleSignal: "prefer" | "avoid" | "unavailable" | "available" | "neutral" = "neutral";
    for (const r of rows ?? []) {
      const row = r as {
        weekday: number | null;
        shift_type: string | null;
        preference_level: string;
      };
      const dayMatch = row.weekday === null || row.weekday === wd;
      const typeMatch = row.shift_type === null || row.shift_type === params.shiftType;
      if (!dayMatch || !typeMatch) continue;
      const sev = schedulePreferenceSeverity(row.preference_level);
      if (sev > maxSev) {
        maxSev = sev;
        scheduleSignal = scheduleSignalFromLevel(row.preference_level);
      }
    }

    const badType = settings.undesirable_shift_types.includes(params.shiftType);
    const badDay = settings.undesirable_weekdays.includes(wd);

    const meta = { shift_date: params.shiftDate, schedule_signal: scheduleSignal };

    if (scheduleSignal === "prefer") {
      await logFairnessEvent({
        organizationId: params.organizationId,
        employeeId: params.employeeId,
        employeeShiftId: params.employeeShiftId,
        eventType: "preferred_shift_assigned",
        fairnessCategory: "schedule_preference",
        shiftType: params.shiftType,
        weekday: wd,
        metadata: meta,
      });
    }

    if (scheduleSignal === "avoid" || scheduleSignal === "unavailable" || badType || badDay) {
      await logFairnessEvent({
        organizationId: params.organizationId,
        employeeId: params.employeeId,
        employeeShiftId: params.employeeShiftId,
        eventType: "avoided_shift_assigned",
        fairnessCategory:
          scheduleSignal === "avoid" || scheduleSignal === "unavailable"
            ? "schedule_preference"
            : "shift_distribution",
        shiftType: params.shiftType,
        weekday: wd,
        metadata: {
          ...meta,
          org_undesirable_type: badType,
          org_undesirable_weekday: badDay,
        },
      });
    }

    if (params.shiftType === "close") {
      const fromStr = shiftDateLookbackFrom(params.shiftDate, settings.fairness_lookback_days);
      const { count } = await admin
        .from("employee_shifts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", params.organizationId)
        .eq("employee_id", params.employeeId)
        .eq("shift_type", "close")
        .lte("shift_date", params.shiftDate)
        .gte("shift_date", fromStr);
      if ((count ?? 0) >= CLOSE_SHIFT_REPEAT_LEDGER_THRESHOLD) {
        await logFairnessEvent({
          organizationId: params.organizationId,
          employeeId: params.employeeId,
          employeeShiftId: params.employeeShiftId,
          eventType: "undesirable_shift_repeated",
          fairnessCategory: "shift_distribution",
          shiftType: params.shiftType,
          weekday: wd,
          metadata: { ...meta, close_shift_count_in_lookback: count },
        });
      }
    }
  } catch (e) {
    console.error("recordShiftAssignmentFairness", e instanceof Error ? e.message : e);
  }
}

/** True “extra hours / bonus shift” signals (not open-shift or coverage pickups). */
export async function recordExtraShiftFairness(params: {
  organizationId: string;
  employeeId: string;
  employeeShiftId: string;
  reason: string;
}): Promise<void> {
  await logFairnessEvent({
    organizationId: params.organizationId,
    employeeId: params.employeeId,
    employeeShiftId: params.employeeShiftId,
    eventType: "extra_shift_awarded",
    fairnessCategory: "extra_hours",
    metadata: { reason: params.reason },
  });
}

/** Voluntary pickup of an open shift or approved coverage handoff — not the same as paid “extra shift”. */
export async function recordVoluntaryShiftPickupFairness(params: {
  organizationId: string;
  employeeId: string;
  employeeShiftId: string;
  reason: string;
}): Promise<void> {
  await logFairnessEvent({
    organizationId: params.organizationId,
    employeeId: params.employeeId,
    employeeShiftId: params.employeeShiftId,
    eventType: "voluntary_shift_pickup",
    fairnessCategory: "shift_pickup",
    metadata: { reason: params.reason },
  });
}

/**
 * Bulk fairness for **initial** run creation only. After remap/reassign, log per changed row only
 * (see remap + manager actions) to avoid duplicate exposure counts.
 */
export async function recordFairnessForAllRunItemsOnRun(params: {
  organizationId: string;
  runId: string;
  source?: string;
}): Promise<void> {
  try {
    const admin = createHelpHubServiceClient();
    const { data: items } = await admin
      .from("shift_checklist_run_items")
      .select("id, assigned_employee_id, suppressed")
      .eq("shift_checklist_run_id", params.runId);
    for (const row of items ?? []) {
      const it = row as { id: string; assigned_employee_id: string | null; suppressed: boolean };
      if (!it.assigned_employee_id || it.suppressed) continue;
      await recordTaskAssignmentFairness({
        organizationId: params.organizationId,
        runItemId: it.id,
        assignedEmployeeId: it.assigned_employee_id,
        source: params.source ?? "run_bulk",
      });
    }
  } catch (e) {
    console.error("recordFairnessForAllRunItemsOnRun", e instanceof Error ? e.message : e);
  }
}
