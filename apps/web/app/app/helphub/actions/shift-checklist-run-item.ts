"use server";

import { revalidatePath } from "next/cache";
import { requireEmployeeContext } from "@/lib/helphub/employee-context";
import {
  mutateShiftChecklistRunItem,
  type ShiftChecklistRunItemMutateResult,
} from "@/lib/helphub/shift-checklist-run-item-mutate";
import { shiftChecklistRunItemMutateBodySchema } from "@/lib/validation/schemas";
import { checkHelpHubMutationRateLimit } from "@/lib/rateLimitDistributed";
import { logServerEvent } from "@/lib/observability/server-log";

/**
 * Employee execution on a checklist **run item** (not template `checklist_items`).
 * Enforces org + assignment inside Postgres (`hh_shift_checklist_run_item_mutate`).
 */
export async function mutateShiftChecklistRunItemAction(
  raw: unknown
): Promise<ShiftChecklistRunItemMutateResult | { ok: false; error: string }> {
  const parsed = shiftChecklistRunItemMutateBodySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "INVALID_BODY" };
  }
  const { runItemId, action, payload } = parsed.data;

  const ctx = await requireEmployeeContext();
  if ("error" in ctx) {
    return { ok: false, error: ctx.error };
  }

  const rl = await checkHelpHubMutationRateLimit(ctx.user.id);
  if (!rl.allowed) {
    return { ok: false, error: "RATE_LIMITED" };
  }

  const out = await mutateShiftChecklistRunItem(ctx.supabase, {
    organizationId: ctx.orgId,
    runItemId,
    action,
    payload: payload as Record<string, unknown> | undefined,
  });

  if (out.ok) {
    revalidatePath("/app/dashboard");
    revalidatePath("/app/today");
    revalidatePath("/app/my-shifts");
    revalidatePath("/app/shift-ops");
    revalidatePath("/app/checklist-runs");
    logServerEvent("helphub_run_item_mutate_ok", {
      organization_id: ctx.orgId,
      user_id: ctx.user.id,
      run_item_id: runItemId,
      action,
    });
  } else {
    logServerEvent("helphub_run_item_mutate_rejected", {
      organization_id: ctx.orgId,
      user_id: ctx.user.id,
      run_item_id: runItemId,
      action,
      error: "error" in out ? out.error : "unknown",
    });
  }

  return out;
}
