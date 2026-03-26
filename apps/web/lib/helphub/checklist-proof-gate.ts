import type { SupabaseClient } from "@supabase/supabase-js";

export type ProofUploadGateResult = { ok: true; runId: string } | { ok: false; error: string };

type GateRow = { ok?: boolean; error?: string; run_id?: unknown; run_status?: unknown };

function parseRunId(raw: unknown): string | null {
  if (typeof raw === "string" && raw.length > 0) return raw;
  return null;
}

/**
 * Calls `hh_checklist_proof_upload_gate` with the **caller's JWT** so authorization matches
 * `hh_shift_*_mutate` set_proof (defense in depth vs app-layer checks before service-role signing).
 */
export async function runChecklistProofUploadGate(
  supabase: SupabaseClient,
  organizationId: string,
  opts: { runItemId: string; overrideTaskId?: undefined } | { runItemId?: undefined; overrideTaskId: string }
): Promise<ProofUploadGateResult> {
  const runItemId = "runItemId" in opts ? opts.runItemId : null;
  const overrideTaskId = "overrideTaskId" in opts ? opts.overrideTaskId : null;
  const { data, error } = await supabase.rpc("hh_checklist_proof_upload_gate", {
    p_organization_id: organizationId,
    p_run_item_id: runItemId,
    p_override_task_id: overrideTaskId,
  });
  if (error) {
    return { ok: false, error: "GATE_RPC_ERROR" };
  }
  const row = data as GateRow | null;
  if (row?.ok === true) {
    const runId = parseRunId(row.run_id);
    if (!runId) return { ok: false, error: "GATE_INVALID_RESPONSE" };
    return { ok: true, runId };
  }
  const code = typeof row?.error === "string" && row.error.length > 0 ? row.error : "GATE_DENIED";
  return { ok: false, error: code };
}

/** Map gate error codes to HTTP status for the signing route. */
export function proofGateErrorToHttp(error: string): { status: number; body: string } {
  switch (error) {
    case "NOT_AUTHENTICATED":
      return { status: 401, body: "Unauthorized" };
    case "NOT_ORG_MEMBER":
    case "EMPLOYEE_NOT_LINKED":
    case "NOT_ASSIGNED":
      return { status: 403, body: "Forbidden" };
    case "RUN_ITEM_NOT_FOUND":
    case "OVERRIDE_TASK_NOT_FOUND":
    case "RUN_NOT_FOUND":
    case "SHIFT_NOT_FOUND":
      return { status: 404, body: "Not found" };
    case "RUN_CLOSED":
    case "ITEM_SUPPRESSED":
    case "OVERRIDE_SUPPRESSED":
    case "ASSIGNMENT_DECLINED":
      return { status: 409, body: error };
    case "INVALID_PAYLOAD":
    case "GATE_INVALID_RESPONSE":
    case "GATE_RPC_ERROR":
      return { status: 400, body: "Invalid request" };
    default:
      return { status: 403, body: "Forbidden" };
  }
}
