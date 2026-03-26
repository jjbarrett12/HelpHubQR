import type { SupabaseClient } from "@supabase/supabase-js";
import { runStatusAfterSend } from "@/lib/helphub/run-status";
import type { ShiftChecklistRunStatus } from "@/lib/helphub/types";

/** Do not move a shift backward (e.g. in_progress → sent) after a late delivery event. */
export async function updateEmployeeShiftAfterOutboundSend(
  admin: SupabaseClient,
  employeeShiftId: string,
  nowIso: string
): Promise<void> {
  const { data: shift } = await admin
    .from("employee_shifts")
    .select("status")
    .eq("id", employeeShiftId)
    .maybeSingle();
  const st = (shift?.status as string | undefined) ?? "";
  if (st !== "scheduled" && st !== "sent") return;

  await admin
    .from("employee_shifts")
    .update({ status: "sent", updated_at: nowIso })
    .eq("id", employeeShiftId)
    .in("status", ["scheduled", "sent"]);
}

/** After a successful outbound delivery, advance run + shift status (idempotent). */
export async function markRunSentIfNeeded(admin: SupabaseClient, runId: string): Promise<void> {
  const { data: run } = await admin
    .from("shift_checklist_runs")
    .select("status, employee_shift_id")
    .eq("id", runId)
    .single();
  if (!run) return;

  const next = runStatusAfterSend(run.status as ShiftChecklistRunStatus);
  if (next === run.status) return;

  const now = new Date().toISOString();
  await admin
    .from("shift_checklist_runs")
    .update({ status: next, sent_at: now })
    .eq("id", runId);

  await updateEmployeeShiftAfterOutboundSend(admin, run.employee_shift_id as string, now);
}
