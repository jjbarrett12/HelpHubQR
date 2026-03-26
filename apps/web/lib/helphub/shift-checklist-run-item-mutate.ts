import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/** RPC `p_action` values for `hh_shift_checklist_run_item_mutate`. */
export const shiftChecklistRunItemMutateActions = [
  "complete",
  "reopen",
  "set_proof",
  "set_note",
  "flag_problem",
  "request_help",
  "clear_problem",
  "clear_help",
] as const;

export type ShiftChecklistRunItemMutateAction = (typeof shiftChecklistRunItemMutateActions)[number];

const rpcErrorCodes = [
  "NOT_AUTHENTICATED",
  "INVALID_ACTION",
  "NOT_ORG_MEMBER",
  "EMPLOYEE_NOT_LINKED",
  "RUN_ITEM_NOT_FOUND",
  "RUN_NOT_FOUND",
  "RUN_CLOSED",
  "SHIFT_NOT_FOUND",
  "ITEM_SUPPRESSED",
  "NOT_ASSIGNED",
  "ASSIGNMENT_DECLINED",
  "VERSION_CONFLICT",
  "REQUIRES_PHOTO",
  "MISSING_STORAGE_PATH",
  "MISSING_NOTE",
  "NOTE_TOO_LONG",
  "MESSAGE_TOO_LONG",
  "INVALID_RPC_RESPONSE",
  "INVALID_PAYLOAD",
  "RPC_ERROR",
] as const;

export type ShiftChecklistRunItemMutateErrorCode = (typeof rpcErrorCodes)[number];

export type ShiftChecklistRunItemRow = Record<string, unknown>;

export type ShiftChecklistRunItemMutateSuccess = {
  ok: true;
  idempotent: boolean;
  action: ShiftChecklistRunItemMutateAction;
  run_item: ShiftChecklistRunItemRow;
  event_id: string | null;
  escalation_id: string | null;
};

export type ShiftChecklistRunItemMutateFailure = {
  ok: false;
  error: ShiftChecklistRunItemMutateErrorCode | string;
  current_updated_at?: string | null;
  /** Present when `error === "RUN_CLOSED"` (from `shift_checklist_runs.status`). */
  run_status?: string | null;
};

export type ShiftChecklistRunItemMutateResult =
  | ShiftChecklistRunItemMutateSuccess
  | ShiftChecklistRunItemMutateFailure;

const rpcPayloadSchema = z.record(z.string(), z.unknown());

const rpcOkTrueSchema = z.object({
  ok: z.literal(true),
  error: z.null().optional(),
  idempotent: z.boolean(),
  action: z.enum(shiftChecklistRunItemMutateActions),
  run_item: z.record(z.string(), z.unknown()),
  event_id: z.string().uuid().nullable(),
  escalation_id: z.string().uuid().nullable(),
});

const rpcOkFalseSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  current_updated_at: z.unknown().optional(),
  run_status: z.unknown().optional(),
});

/**
 * Parses JSON returned by `hh_shift_checklist_run_item_mutate`.
 */
export function parseShiftChecklistRunItemMutateResult(raw: unknown): ShiftChecklistRunItemMutateResult {
  const asObj = typeof raw === "object" && raw !== null ? raw : {};
  const ok = (asObj as { ok?: unknown }).ok;
  if (ok === true) {
    const p = rpcOkTrueSchema.safeParse(asObj);
    if (p.success) {
      return {
        ok: true,
        idempotent: p.data.idempotent,
        action: p.data.action,
        run_item: p.data.run_item,
        event_id: p.data.event_id,
        escalation_id: p.data.escalation_id,
      };
    }
  }
  if (ok === false) {
    const p = rpcOkFalseSchema.safeParse(asObj);
    if (p.success) {
      const cur = p.data.current_updated_at;
      const rs = p.data.run_status;
      return {
        ok: false,
        error: p.data.error,
        current_updated_at:
          typeof cur === "string" ? cur : cur != null ? String(cur) : undefined,
        run_status: typeof rs === "string" ? rs : rs != null ? String(rs) : undefined,
      };
    }
  }
  return { ok: false, error: "INVALID_RPC_RESPONSE" };
}

/** Next.js App Router: cookie session + active org (same contract as `mutateShiftChecklistRunItemAction`). */
export const SHIFT_CHECKLIST_RUN_ITEM_MUTATE_POST_PATH = "/api/helphub/shift-checklist-run-item/mutate" as const;

export type MutateShiftChecklistRunItemParams = {
  organizationId: string;
  runItemId: string;
  action: ShiftChecklistRunItemMutateAction;
  /** Passed as `p_payload` (JSON object). */
  payload?: Record<string, unknown>;
};

/**
 * Server-owned execution mutation on a **run item** (`shift_checklist_run_items.id`).
 * Caller must use a Supabase client authenticated as the employee (`auth.uid()` → `employees.auth_user_id`).
 */
export async function mutateShiftChecklistRunItem(
  supabase: SupabaseClient,
  params: MutateShiftChecklistRunItemParams
): Promise<ShiftChecklistRunItemMutateResult> {
  const payloadParsed = rpcPayloadSchema.safeParse(params.payload ?? {});
  if (!payloadParsed.success) {
    return { ok: false, error: "INVALID_PAYLOAD" };
  }

  const { data, error } = await supabase.rpc("hh_shift_checklist_run_item_mutate", {
    p_organization_id: params.organizationId,
    p_run_item_id: params.runItemId,
    p_action: params.action,
    p_payload: payloadParsed.data,
  });

  if (error) {
    return { ok: false, error: error.message || "RPC_ERROR" };
  }

  return parseShiftChecklistRunItemMutateResult(data);
}
