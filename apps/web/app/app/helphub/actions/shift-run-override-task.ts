"use server";

import { revalidatePath } from "next/cache";
import { requireEmployeeContext } from "@/lib/helphub/employee-context";
import {
  mutateShiftRunOverrideTask,
  type ShiftRunOverrideTaskMutateResult,
} from "@/lib/helphub/shift-run-override-task-mutate";
import { shiftRunOverrideTaskMutateBodySchema } from "@/lib/validation/schemas";
import { checkHelpHubMutationRateLimit } from "@/lib/rateLimitDistributed";
import { logServerEvent } from "@/lib/observability/server-log";

/**
 * Employee execution on a **shift_run_override_tasks** row (not template / not run_item mutate).
 * Validates org + assignment inside Postgres (`hh_shift_run_override_task_mutate`).
 */
export async function mutateShiftRunOverrideTaskAction(
  raw: unknown
): Promise<ShiftRunOverrideTaskMutateResult | { ok: false; error: string }> {
  const parsed = shiftRunOverrideTaskMutateBodySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "INVALID_BODY" };
  }
  const { overrideTaskId, action, payload } = parsed.data;

  const ctx = await requireEmployeeContext();
  if ("error" in ctx) {
    return { ok: false, error: ctx.error };
  }

  const rl = await checkHelpHubMutationRateLimit(ctx.user.id);
  if (!rl.allowed) {
    return { ok: false, error: "RATE_LIMITED" };
  }

  const out = await mutateShiftRunOverrideTask(ctx.supabase, {
    organizationId: ctx.orgId,
    overrideTaskId,
    action,
    payload: payload as Record<string, unknown> | undefined,
  });

  if (out.ok) {
    revalidatePath("/app/dashboard");
    revalidatePath("/app/today");
    revalidatePath("/app/my-shifts");
    revalidatePath("/app/shift-ops");
    revalidatePath("/app/checklist-runs");
    logServerEvent("helphub_override_task_mutate_ok", {
      organization_id: ctx.orgId,
      user_id: ctx.user.id,
      override_task_id: overrideTaskId,
      action,
    });
  } else {
    logServerEvent("helphub_override_task_mutate_rejected", {
      organization_id: ctx.orgId,
      user_id: ctx.user.id,
      override_task_id: overrideTaskId,
      action,
      error: "error" in out ? out.error : "unknown",
    });
  }

  return out;
}
