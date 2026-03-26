"use server";

import { revalidatePath } from "next/cache";
import { requireEmployeeContext } from "@/lib/helphub/employee-context";
import { fetchOrCreateWorkforceSettings } from "@/lib/helphub/workforce/settings";
import { logWorkforceEvent } from "@/lib/helphub/workforce/log";
import { remapRunItemsAfterShiftOwnerChange } from "@/lib/helphub/workforce/remap";
import {
  isEmployeeEligibleForShiftPeerAction,
  loadShiftEligibilityContext,
} from "@/lib/helphub/workforce/eligibility";
import { notifyTaskOfferAvailable, notifyShiftTradeProposed } from "@/lib/helphub/workforce/notify-stub";
import { createHelpHubServiceClient } from "@/lib/helphub/supabase-service";
import { applyShiftTradeApproval } from "@/lib/helphub/workforce/execute-shift-trade";
import {
  recordShiftAssignmentFairness,
  recordTaskAssignmentFairness,
  recordVoluntaryShiftPickupFairness,
} from "@/lib/helphub/fairness/record";

async function applyTaskTransferAssignment(
  orgId: string,
  runItemId: string,
  runId: string,
  toEmployeeId: string,
  fromEmployeeId: string
) {
  const supabase = createHelpHubServiceClient();
  const now = new Date().toISOString();
  await supabase
    .from("shift_checklist_run_items")
    .update({
      assigned_employee_id: toEmployeeId,
      reassigned_from_employee_id: fromEmployeeId,
      reassigned_at: now,
      assignment_status: "assigned",
      override_source: "employee_request",
      updated_at: now,
    })
    .eq("id", runItemId)
    .eq("completed", false);
  await logWorkforceEvent(supabase, {
    organization_id: orgId,
    event_type: "task_offer_claimed",
    actor_employee_id: toEmployeeId,
    shift_checklist_run_id: runId,
    shift_checklist_run_item_id: runItemId,
    payload: { from: fromEmployeeId, to: toEmployeeId },
  });
  void recordTaskAssignmentFairness({
    organizationId: orgId,
    runItemId,
    assignedEmployeeId: toEmployeeId,
    source: "task_transfer_auto",
  });
}

export async function createTaskTransferRequest(params: {
  runItemId: string;
  toEmployeeId: string | null;
  mode: "direct" | "open_offer";
  reason?: string;
}) {
  const ctx = await requireEmployeeContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, employeeId, user } = ctx;

  const settings = await fetchOrCreateWorkforceSettings(supabase, orgId);
  if (!settings.allow_employee_task_offers) return { error: "Task offers are disabled" };

  const { data: item } = await supabase
    .from("shift_checklist_run_items")
    .select("id, shift_checklist_run_id, assigned_employee_id, completed, suppressed")
    .eq("id", params.runItemId)
    .single();
  if (!item) return { error: "Task not found" };
  const it = item as {
    id: string;
    shift_checklist_run_id: string;
    assigned_employee_id: string | null;
    completed: boolean;
    suppressed: boolean;
  };
  if (it.suppressed || it.completed) return { error: "Task not available" };
  if (it.assigned_employee_id !== employeeId) return { error: "Not your task" };

  const { data: run } = await supabase
    .from("shift_checklist_runs")
    .select("id, organization_id")
    .eq("id", it.shift_checklist_run_id)
    .single();
  if (!run || (run as { organization_id: string }).organization_id !== orgId) {
    return { error: "Run not found" };
  }

  const { data: existing } = await supabase
    .from("shift_task_transfer_requests")
    .select("id")
    .eq("shift_checklist_run_item_id", params.runItemId)
    .in("status", ["pending", "accepted"])
    .maybeSingle();
  if (existing) return { error: "A request is already in progress for this task" };

  if (params.mode === "direct" && !params.toEmployeeId) {
    return { error: "Choose a coworker" };
  }

  const mgr = settings.manager_approval_required_for_task_transfer;
  const ins = await supabase.from("shift_task_transfer_requests").insert({
    organization_id: orgId,
    shift_checklist_run_item_id: params.runItemId,
    run_id: it.shift_checklist_run_id,
    from_employee_id: employeeId,
    to_employee_id: params.toEmployeeId,
    request_mode: params.mode,
    status: "pending",
    requested_by_employee_id: employeeId,
    reason: params.reason ?? null,
    manager_approval_required: mgr,
  });
  if (ins.error) {
    if (ins.error.code === "23505") {
      return { error: "A request is already in progress for this task" };
    }
    return { error: ins.error.message };
  }

  const { data: created } = await supabase
    .from("shift_task_transfer_requests")
    .select("id")
    .eq("shift_checklist_run_item_id", params.runItemId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  await logWorkforceEvent(supabase, {
    organization_id: orgId,
    event_type: "task_offer_created",
    actor_user_id: user.id,
    actor_employee_id: employeeId,
    shift_checklist_run_id: it.shift_checklist_run_id,
    shift_checklist_run_item_id: params.runItemId,
    related_request_id: created?.id as string,
    payload: { mode: params.mode },
  });
  await notifyTaskOfferAvailable({
    organizationId: orgId,
    requestId: (created?.id as string) ?? "",
  });
  revalidatePath("/app/my-requests");
  revalidatePath("/app/shift-ops");
  return { ok: true };
}

export async function acceptTaskTransferRequest(requestId: string) {
  const ctx = await requireEmployeeContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, employeeId, user } = ctx;

  const { data: req } = await supabase
    .from("shift_task_transfer_requests")
    .select("*")
    .eq("id", requestId)
    .eq("organization_id", orgId)
    .single();
  if (!req) return { error: "Not found" };
  const q = req as Record<string, unknown>;
  if (q.status !== "pending") return { error: "Not pending" };

  const toId = (q.to_employee_id as string | null) ?? null;
  const mode = q.request_mode as string;
  if (mode === "open_offer") {
    if (toId && toId !== employeeId) return { error: "Already assigned" };
  } else if (toId !== employeeId) {
    return { error: "Not your offer" };
  }

  const fromId = q.from_employee_id as string;
  const runItemId = q.shift_checklist_run_item_id as string;
  const runId = q.run_id as string;
  const mgr = q.manager_approval_required as boolean;

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    to_employee_id: employeeId,
    updated_at: now,
  };

  if (mgr) {
    updates.status = "accepted";
  } else {
    updates.status = "approved";
    updates.approved_at = now;
  }

  const claim = await supabase
    .from("shift_task_transfer_requests")
    .update(updates)
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!claim.data?.id) {
    return { error: "Request no longer pending" };
  }

  if (!mgr) {
    await applyTaskTransferAssignment(orgId, runItemId, runId, employeeId, fromId);
  } else {
    await logWorkforceEvent(supabase, {
      organization_id: orgId,
      event_type: "task_transfer_accepted_pending_approval",
      actor_user_id: user.id,
      actor_employee_id: employeeId,
      related_request_id: requestId,
      payload: {},
    });
  }

  revalidatePath("/app/my-requests");
  revalidatePath("/app/shift-ops");
  return { ok: true };
}

export async function requestShiftCoverage(params: { shiftId: string; reason?: string }) {
  const ctx = await requireEmployeeContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, employeeId, user } = ctx;

  const settings = await fetchOrCreateWorkforceSettings(supabase, orgId);
  if (!settings.allow_open_shift_claims) return { error: "Coverage requests are disabled" };

  const { data: shift } = await supabase
    .from("employee_shifts")
    .select("id, employee_id, organization_id")
    .eq("id", params.shiftId)
    .single();
  if (!shift || (shift as { organization_id: string }).organization_id !== orgId) {
    return { error: "Shift not found" };
  }
  if ((shift as { employee_id: string }).employee_id !== employeeId) {
    return { error: "Not your shift" };
  }

  const { data: dup } = await supabase
    .from("shift_coverage_requests")
    .select("id")
    .eq("employee_shift_id", params.shiftId)
    .in("status", ["pending", "claimed"])
    .maybeSingle();
  if (dup) return { error: "A coverage request already exists" };

  const ins = await supabase.from("shift_coverage_requests").insert({
    organization_id: orgId,
    employee_shift_id: params.shiftId,
    requested_by_employee_id: employeeId,
    request_type: "open_claim",
    status: "pending",
    reason: params.reason ?? null,
    manager_approval_required: settings.manager_approval_required_for_shift_claim,
  });
  if (ins.error) {
    if (ins.error.code === "23505") {
      return { error: "A coverage request already exists" };
    }
    return { error: ins.error.message };
  }

  await logWorkforceEvent(supabase, {
    organization_id: orgId,
    event_type: "shift_coverage_requested",
    actor_user_id: user.id,
    actor_employee_id: employeeId,
    employee_shift_id: params.shiftId,
    payload: {},
  });
  revalidatePath("/app/my-shifts");
  revalidatePath("/app/shift-ops");
  return { ok: true };
}

export async function claimOpenShift(shiftId: string) {
  const ctx = await requireEmployeeContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, employeeId, user } = ctx;

  const settings = await fetchOrCreateWorkforceSettings(supabase, orgId);
  if (!settings.allow_open_shift_claims) return { error: "Disabled" };

  const { data: shift } = await supabase
    .from("employee_shifts")
    .select(
      "id, employee_id, organization_id, is_open_for_claim, staff_role_id, location_id, shift_date, shift_type"
    )
    .eq("id", shiftId)
    .eq("organization_id", orgId)
    .single();
  if (!shift) return { error: "Shift not found" };
  const s = shift as {
    employee_id: string;
    is_open_for_claim: boolean;
    staff_role_id: string;
    location_id: string | null;
    shift_date: string;
    shift_type: string;
  };
  if (!s.is_open_for_claim) return { error: "Shift is not open for claim" };
  if (s.employee_id === employeeId) return { error: "This is already your shift" };

  const ctxEl = { staff_role_id: s.staff_role_id, location_id: s.location_id };
  const ok = await isEmployeeEligibleForShiftPeerAction(supabase, settings, ctxEl, employeeId);
  if (!ok) return { error: "Not eligible for this shift" };

  const { data: dup } = await supabase
    .from("shift_coverage_requests")
    .select("id")
    .eq("employee_shift_id", shiftId)
    .in("status", ["pending", "claimed"])
    .maybeSingle();
  if (dup) return { error: "Someone already requested or claimed this shift" };

  const mgr = settings.manager_approval_required_for_shift_claim;
  const ins = await supabase.from("shift_coverage_requests").insert({
    organization_id: orgId,
    employee_shift_id: shiftId,
    requested_by_employee_id: s.employee_id,
    request_type: "open_claim",
    claimed_by_employee_id: employeeId,
    status: mgr ? "claimed" : "approved",
    manager_approval_required: mgr,
    reason: "Open shift claim",
  });
  if (ins.error) {
    if (ins.error.code === "23505") {
      return { error: "Someone already requested or claimed this shift" };
    }
    return { error: ins.error.message };
  }

  const { data: reqRow } = await supabase
    .from("shift_coverage_requests")
    .select("id")
    .eq("employee_shift_id", shiftId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!mgr) {
    const oldOwner = s.employee_id;
    const now = new Date().toISOString();
    const admin = createHelpHubServiceClient();
    const shUp = await admin
      .from("employee_shifts")
      .update({ employee_id: employeeId, updated_at: now })
      .eq("id", shiftId)
      .eq("organization_id", orgId);
    if (shUp.error) {
      return { error: shUp.error.message };
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
        newEmployeeId: employeeId,
        actorUserId: user.id,
      });
      if (mapRes.error) {
        await admin
          .from("employee_shifts")
          .update({ employee_id: oldOwner, updated_at: new Date().toISOString() })
          .eq("id", shiftId)
          .eq("organization_id", orgId);
        await admin.from("shift_coverage_requests").delete().eq("id", reqRow?.id as string);
        return { error: "Could not finalize checklist assignments for this shift. Try again." };
      }
    }
    await supabase
      .from("shift_coverage_requests")
      .update({
        approved_by_user_id: user.id,
        approved_at: now,
        updated_at: now,
      })
      .eq("id", reqRow?.id as string);

    void recordVoluntaryShiftPickupFairness({
      organizationId: orgId,
      employeeId,
      employeeShiftId: shiftId,
      reason: "open_shift_claim",
    });
    void recordShiftAssignmentFairness({
      organizationId: orgId,
      employeeShiftId: shiftId,
      employeeId,
      shiftType: s.shift_type,
      shiftDate: s.shift_date,
    });
  }

  await logWorkforceEvent(supabase, {
    organization_id: orgId,
    event_type: mgr ? "shift_claimed" : "shift_claimed_auto",
    actor_user_id: user.id,
    actor_employee_id: employeeId,
    employee_shift_id: shiftId,
    related_request_id: reqRow?.id as string,
    payload: {},
  });
  revalidatePath("/app/my-shifts");
  revalidatePath("/app/shift-ops");
  return { ok: true };
}

export async function claimCoverageRequest(requestId: string) {
  const ctx = await requireEmployeeContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, employeeId, user } = ctx;

  const { data: req } = await supabase
    .from("shift_coverage_requests")
    .select("*")
    .eq("id", requestId)
    .eq("organization_id", orgId)
    .single();
  if (!req) return { error: "Not found" };
  const q = req as Record<string, unknown>;
  if (q.status !== "pending") return { error: "Not available" };
  if (q.requested_by_employee_id === employeeId) return { error: "Cannot claim your own request" };

  const shiftId = q.employee_shift_id as string;
  const shiftCtx = await loadShiftEligibilityContext(supabase, shiftId);
  if (!shiftCtx) return { error: "Shift not found" };
  const settings = await fetchOrCreateWorkforceSettings(supabase, orgId);
  const ok = await isEmployeeEligibleForShiftPeerAction(supabase, settings, shiftCtx, employeeId);
  if (!ok) return { error: "Not eligible" };

  const mgr = q.manager_approval_required as boolean;
  const claimCov = await supabase
    .from("shift_coverage_requests")
    .update({
      claimed_by_employee_id: employeeId,
      status: mgr ? "claimed" : "approved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!claimCov.data?.id) {
    return { error: "Request no longer available" };
  }

  if (!mgr) {
    const oldOwner = shiftCtx.employee_id;
    const now = new Date().toISOString();
    const admin = createHelpHubServiceClient();
    const shUp2 = await admin
      .from("employee_shifts")
      .update({ employee_id: employeeId, updated_at: now })
      .eq("id", shiftId)
      .eq("organization_id", orgId);
    if (shUp2.error) {
      return { error: shUp2.error.message };
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
        newEmployeeId: employeeId,
        actorUserId: user.id,
      });
      if (mapRes.error) {
        await admin
          .from("employee_shifts")
          .update({ employee_id: oldOwner, updated_at: new Date().toISOString() })
          .eq("id", shiftId)
          .eq("organization_id", orgId);
        await admin
          .from("shift_coverage_requests")
          .update({
            status: "pending",
            claimed_by_employee_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", requestId);
        return { error: "Could not finalize checklist assignments for this shift. Try again." };
      }
    }
    await supabase
      .from("shift_coverage_requests")
      .update({
        approved_by_user_id: user.id,
        approved_at: now,
      })
      .eq("id", requestId);

    void recordVoluntaryShiftPickupFairness({
      organizationId: orgId,
      employeeId,
      employeeShiftId: shiftId,
      reason: "coverage_claim_auto",
    });
    void recordShiftAssignmentFairness({
      organizationId: orgId,
      employeeShiftId: shiftId,
      employeeId,
      shiftType: shiftCtx.shift_type,
      shiftDate: shiftCtx.shift_date,
    });
  }

  await logWorkforceEvent(supabase, {
    organization_id: orgId,
    event_type: "shift_coverage_claimed",
    actor_employee_id: employeeId,
    employee_shift_id: shiftId,
    related_request_id: requestId,
    payload: {},
  });
  revalidatePath("/app/my-shifts");
  revalidatePath("/app/shift-ops");
  return { ok: true };
}

export async function proposeShiftTrade(params: {
  offeredShiftId: string;
  requestedShiftId?: string | null;
  targetEmployeeId?: string | null;
  reason?: string;
}) {
  const ctx = await requireEmployeeContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, employeeId, user } = ctx;

  const settings = await fetchOrCreateWorkforceSettings(supabase, orgId);
  if (!settings.allow_shift_trades) return { error: "Trades disabled" };

  const { data: off } = await supabase
    .from("employee_shifts")
    .select("id, employee_id, organization_id")
    .eq("id", params.offeredShiftId)
    .single();
  if (!off || (off as { organization_id: string }).organization_id !== orgId) {
    return { error: "Shift not found" };
  }
  if ((off as { employee_id: string }).employee_id !== employeeId) {
    return { error: "Not your shift" };
  }

  if (params.requestedShiftId) {
    const { data: reqS } = await supabase
      .from("employee_shifts")
      .select("employee_id, organization_id")
      .eq("id", params.requestedShiftId)
      .single();
    if (!reqS || (reqS as { organization_id: string }).organization_id !== orgId) {
      return { error: "Requested shift not found" };
    }
    if (params.targetEmployeeId && (reqS as { employee_id: string }).employee_id !== params.targetEmployeeId) {
      return { error: "Target does not own that shift" };
    }
  }

  const ins = await supabase.from("shift_trade_offers").insert({
    organization_id: orgId,
    offered_shift_id: params.offeredShiftId,
    requested_shift_id: params.requestedShiftId ?? null,
    offering_employee_id: employeeId,
    target_employee_id: params.targetEmployeeId ?? null,
    status: "pending",
    reason: params.reason ?? null,
    manager_approval_required: settings.manager_approval_required_for_shift_trade,
  });
  if (ins.error) return { error: ins.error.message };

  const { data: tr } = await supabase
    .from("shift_trade_offers")
    .select("id")
    .eq("offered_shift_id", params.offeredShiftId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  await logWorkforceEvent(supabase, {
    organization_id: orgId,
    event_type: "shift_trade_proposed",
    actor_employee_id: employeeId,
    related_request_id: tr?.id as string,
    payload: {},
  });
  await notifyShiftTradeProposed({ organizationId: orgId, tradeId: (tr?.id as string) ?? "" });
  revalidatePath("/app/my-requests");
  revalidatePath("/app/shift-ops");
  return { ok: true };
}

export async function acceptShiftTrade(tradeId: string) {
  const ctx = await requireEmployeeContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, employeeId, user } = ctx;

  const { data: tr } = await supabase
    .from("shift_trade_offers")
    .select("*")
    .eq("id", tradeId)
    .eq("organization_id", orgId)
    .single();
  if (!tr) return { error: "Not found" };
  const t = tr as Record<string, unknown>;
  if (t.status !== "pending") return { error: "Not pending" };

  const target = t.target_employee_id as string | null;
  if (target && target !== employeeId) return { error: "Not for you" };
  if (!target && t.offering_employee_id === employeeId) return { error: "Cannot accept your own trade" };

  const mgr = t.manager_approval_required as boolean;
  const now = new Date().toISOString();

  if (mgr) {
    const acc = await supabase
      .from("shift_trade_offers")
      .update({
        accepted_by_employee_id: employeeId,
        status: "accepted",
        updated_at: now,
      })
      .eq("id", tradeId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!acc.data?.id) {
      return { error: "Trade is no longer available" };
    }
  } else {
    const acc = await supabase
      .from("shift_trade_offers")
      .update({
        accepted_by_employee_id: employeeId,
        updated_at: now,
      })
      .eq("id", tradeId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!acc.data?.id) {
      return { error: "Trade is no longer available" };
    }
    const res = await applyShiftTradeApproval({
      organizationId: orgId,
      tradeId,
      actorUserId: user.id,
    });
    if (res.error) return { error: res.error };
  }

  await logWorkforceEvent(supabase, {
    organization_id: orgId,
    event_type: "shift_trade_accepted",
    actor_employee_id: employeeId,
    related_request_id: tradeId,
    payload: { awaitingManager: mgr },
  });
  revalidatePath("/app/my-requests");
  revalidatePath("/app/shift-ops");
  return { ok: true };
}
