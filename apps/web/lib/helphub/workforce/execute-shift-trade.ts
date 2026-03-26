import { createHelpHubServiceClient } from "@/lib/helphub/supabase-service";
import { remapRunItemsAfterShiftOwnerChange } from "./remap";
import { logWorkforceEvent } from "./log";
import { recordShiftAssignmentFairness } from "@/lib/helphub/fairness/record";

export type ApplyShiftTradeResult = { error?: string; alreadyApplied?: boolean };

/**
 * Applies DB updates for an approved shift trade (swap or handoff). Uses service role.
 * Idempotent: duplicate calls after success are no-ops (alreadyApplied).
 */
export async function applyShiftTradeApproval(params: {
  organizationId: string;
  tradeId: string;
  actorUserId: string | null;
}): Promise<ApplyShiftTradeResult> {
  const supabase = createHelpHubServiceClient();
  const { organizationId, tradeId, actorUserId } = params;

  const { data: tr, error: trErr } = await supabase
    .from("shift_trade_offers")
    .select("*")
    .eq("id", tradeId)
    .eq("organization_id", organizationId)
    .single();
  if (trErr || !tr) return { error: "Trade not found" };
  const t = tr as Record<string, unknown>;

  if (t.status === "approved") {
    return { alreadyApplied: true };
  }

  const tradeStatus = t.status as string;
  const mgrRequired = t.manager_approval_required as boolean;
  if (mgrRequired && tradeStatus !== "accepted") {
    return { error: "Trade not in accepted state" };
  }
  if (!mgrRequired && tradeStatus !== "pending" && tradeStatus !== "accepted") {
    return { error: "Trade not applicable" };
  }

  const offeredShiftId = t.offered_shift_id as string;
  const requestedShiftId = t.requested_shift_id as string | null;
  const accepter = t.accepted_by_employee_id as string | null;
  const offerer = t.offering_employee_id as string;
  let handoffAccepter: string | null = null;

  const { data: offRow } = await supabase
    .from("employee_shifts")
    .select("employee_id")
    .eq("id", offeredShiftId)
    .single();
  const oldOffered = (offRow as { employee_id: string } | null)?.employee_id;
  if (!oldOffered) return { error: "Offered shift not found" };

  const now = new Date().toISOString();

  if (requestedShiftId) {
    const { data: curOffRow } = await supabase
      .from("employee_shifts")
      .select("employee_id")
      .eq("id", offeredShiftId)
      .single();
    const { data: curReqRow } = await supabase
      .from("employee_shifts")
      .select("employee_id")
      .eq("id", requestedShiftId)
      .single();
    const cOff = (curOffRow as { employee_id: string } | null)?.employee_id;
    const cReq = (curReqRow as { employee_id: string } | null)?.employee_id;
    if (!cOff || !cReq) return { error: "Shift not found" };
    if (cOff === cReq) return { error: "Invalid trade: identical shift owners" };

    const preSwap = cOff === offerer;
    const postSwap = cReq === offerer && cOff !== offerer;
    if (!preSwap && !postSwap) {
      return { error: "Shift state conflict; refresh and retry" };
    }

    if (preSwap) {
      const { error: rpcErr } = await supabase.rpc("hh_atomic_swap_shift_employees", {
        p_shift_a: offeredShiftId,
        p_shift_b: requestedShiftId,
      });
      if (rpcErr) return { error: rpcErr.message };
    }

    const offeredRunOld = offerer;
    const offeredRunNew = preSwap ? cReq : cOff;
    const requestedRunOld = preSwap ? cReq : cOff;
    const requestedRunNew = offerer;

    const { data: r1 } = await supabase
      .from("shift_checklist_runs")
      .select("id")
      .eq("employee_shift_id", offeredShiftId)
      .maybeSingle();
    const { data: r2 } = await supabase
      .from("shift_checklist_runs")
      .select("id")
      .eq("employee_shift_id", requestedShiftId)
      .maybeSingle();
    if (r1?.id) {
      const m1 = await remapRunItemsAfterShiftOwnerChange({
        organizationId,
        runId: r1.id as string,
        oldEmployeeId: offeredRunOld,
        newEmployeeId: offeredRunNew,
        actorUserId,
      });
      if (m1.error) return { error: m1.error };
    }
    if (r2?.id) {
      const m2 = await remapRunItemsAfterShiftOwnerChange({
        organizationId,
        runId: r2.id as string,
        oldEmployeeId: requestedRunOld,
        newEmployeeId: requestedRunNew,
        actorUserId,
      });
      if (m2.error) return { error: m2.error };
    }
  } else {
    if (!accepter) return { error: "No accepter" };
    const effectiveAccepter = accepter;
    handoffAccepter = effectiveAccepter;

    const { data: handoffUp } = await supabase
      .from("employee_shifts")
      .update({ employee_id: effectiveAccepter, updated_at: now })
      .eq("id", offeredShiftId)
      .eq("employee_id", oldOffered)
      .select("id")
      .maybeSingle();

    if (!handoffUp?.id) {
      const { data: cur } = await supabase
        .from("employee_shifts")
        .select("employee_id")
        .eq("id", offeredShiftId)
        .single();
      const curEmp = (cur as { employee_id: string } | null)?.employee_id;
      if (curEmp !== effectiveAccepter) {
        return { error: "Shift owner changed; trade cannot be applied" };
      }
    }

    const { data: r1 } = await supabase
      .from("shift_checklist_runs")
      .select("id")
      .eq("employee_shift_id", offeredShiftId)
      .maybeSingle();
    if (r1?.id) {
      const mh = await remapRunItemsAfterShiftOwnerChange({
        organizationId,
        runId: r1.id as string,
        oldEmployeeId: oldOffered,
        newEmployeeId: effectiveAccepter,
        actorUserId,
      });
      if (mh.error) return { error: mh.error };
    }
  }

  const { data: fin } = await supabase
    .from("shift_trade_offers")
    .update({
      status: "approved",
      approved_by_user_id: actorUserId,
      approved_at: now,
      updated_at: now,
    })
    .eq("id", tradeId)
    .eq("organization_id", organizationId)
    .in("status", mgrRequired ? ["accepted"] : ["pending", "accepted"])
    .select("id")
    .maybeSingle();

  if (!fin?.id) {
    const { data: again } = await supabase
      .from("shift_trade_offers")
      .select("status")
      .eq("id", tradeId)
      .single();
    if ((again as { status: string } | null)?.status === "approved") {
      return { alreadyApplied: true };
    }
    return { error: "Trade approval race lost" };
  }

  await logWorkforceEvent(supabase, {
    organization_id: organizationId,
    event_type: "shift_trade_applied",
    actor_user_id: actorUserId,
    related_request_id: tradeId,
    payload: {},
  });

  if (requestedShiftId) {
    const { data: offAfter } = await supabase
      .from("employee_shifts")
      .select("employee_id, shift_type, shift_date")
      .eq("id", offeredShiftId)
      .single();
    const { data: reqAfter } = await supabase
      .from("employee_shifts")
      .select("employee_id, shift_type, shift_date")
      .eq("id", requestedShiftId)
      .single();
    const oa = offAfter as { employee_id: string; shift_type: string; shift_date: string } | null;
    const ra = reqAfter as { employee_id: string; shift_type: string; shift_date: string } | null;
    if (oa) {
      void recordShiftAssignmentFairness({
        organizationId,
        employeeShiftId: offeredShiftId,
        employeeId: oa.employee_id,
        shiftType: oa.shift_type,
        shiftDate: oa.shift_date,
      });
    }
    if (ra) {
      void recordShiftAssignmentFairness({
        organizationId,
        employeeShiftId: requestedShiftId,
        employeeId: ra.employee_id,
        shiftType: ra.shift_type,
        shiftDate: ra.shift_date,
      });
    }
  } else if (handoffAccepter) {
    const { data: offMeta } = await supabase
      .from("employee_shifts")
      .select("shift_type, shift_date")
      .eq("id", offeredShiftId)
      .single();
    const om = offMeta as { shift_type: string; shift_date: string } | null;
    if (om) {
      void recordShiftAssignmentFairness({
        organizationId,
        employeeShiftId: offeredShiftId,
        employeeId: handoffAccepter,
        shiftType: om.shift_type,
        shiftDate: om.shift_date,
      });
    }
  }

  return {};
}
