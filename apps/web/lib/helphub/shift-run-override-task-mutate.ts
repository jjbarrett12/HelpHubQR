import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/** RPC `p_action` values for `hh_shift_run_override_task_mutate` (parallel to run-item mutate). */
export const shiftRunOverrideTaskMutateActions = [
  "complete",
  "reopen",
  "set_proof",
  "set_note",
  "flag_problem",
  "request_help",
  "clear_problem",
  "clear_help",
] as const;

export type ShiftRunOverrideTaskMutateAction = (typeof shiftRunOverrideTaskMutateActions)[number];

const rpcErrorCodes = [
  "NOT_AUTHENTICATED",
  "INVALID_ACTION",
  "NOT_ORG_MEMBER",
  "EMPLOYEE_NOT_LINKED",
  "OVERRIDE_TASK_NOT_FOUND",
  "RUN_NOT_FOUND",
  "RUN_CLOSED",
  "SHIFT_NOT_FOUND",
  "OVERRIDE_SUPPRESSED",
  "NOT_ASSIGNED",
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

export type ShiftRunOverrideTaskMutateErrorCode = (typeof rpcErrorCodes)[number];

export type ShiftRunOverrideTaskRow = Record<string, unknown>;

export type ShiftRunOverrideTaskMutateSuccess = {
  ok: true;
  idempotent: boolean;
  action: ShiftRunOverrideTaskMutateAction;
  override_task: ShiftRunOverrideTaskRow;
  event_id: string | null;
  escalation_id: string | null;
};

export type ShiftRunOverrideTaskMutateFailure = {
  ok: false;
  error: ShiftRunOverrideTaskMutateErrorCode | string;
  current_updated_at?: string | null;
  run_status?: string | null;
};

export type ShiftRunOverrideTaskMutateResult =
  | ShiftRunOverrideTaskMutateSuccess
  | ShiftRunOverrideTaskMutateFailure;

const rpcPayloadSchema = z.record(z.string(), z.unknown());

const rpcOkTrueSchema = z.object({
  ok: z.literal(true),
  error: z.null().optional(),
  idempotent: z.boolean(),
  action: z.enum(shiftRunOverrideTaskMutateActions),
  override_task: z.record(z.string(), z.unknown()),
  event_id: z.string().uuid().nullable(),
  escalation_id: z.string().uuid().nullable(),
});

const rpcOkFalseSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  current_updated_at: z.unknown().optional(),
  run_status: z.unknown().optional(),
});

/** Parses JSON returned by `hh_shift_run_override_task_mutate`. */
export function parseShiftRunOverrideTaskMutateResult(raw: unknown): ShiftRunOverrideTaskMutateResult {
  const asObj = typeof raw === "object" && raw !== null ? raw : {};
  const ok = (asObj as { ok?: unknown }).ok;
  if (ok === true) {
    const p = rpcOkTrueSchema.safeParse(asObj);
    if (p.success) {
      return {
        ok: true,
        idempotent: p.data.idempotent,
        action: p.data.action,
        override_task: p.data.override_task,
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

export const SHIFT_RUN_OVERRIDE_TASK_MUTATE_POST_PATH =
  "/api/helphub/shift-run-override-task/mutate" as const;

export type MutateShiftRunOverrideTaskParams = {
  organizationId: string;
  overrideTaskId: string;
  action: ShiftRunOverrideTaskMutateAction;
  payload?: Record<string, unknown>;
};

/**
 * Employee execution on **`shift_run_override_tasks.id`** (not `shift_checklist_run_items`).
 * Caller must be authenticated as the employee (`auth.uid()` → `employees.auth_user_id`).
 */
export async function mutateShiftRunOverrideTask(
  supabase: SupabaseClient,
  params: MutateShiftRunOverrideTaskParams
): Promise<ShiftRunOverrideTaskMutateResult> {
  const payloadParsed = rpcPayloadSchema.safeParse(params.payload ?? {});
  if (!payloadParsed.success) {
    return { ok: false, error: "INVALID_PAYLOAD" };
  }

  const { data, error } = await supabase.rpc("hh_shift_run_override_task_mutate", {
    p_organization_id: params.organizationId,
    p_override_task_id: params.overrideTaskId,
    p_action: params.action,
    p_payload: payloadParsed.data,
  });

  if (error) {
    return { ok: false, error: error.message || "RPC_ERROR" };
  }

  return parseShiftRunOverrideTaskMutateResult(data);
}
