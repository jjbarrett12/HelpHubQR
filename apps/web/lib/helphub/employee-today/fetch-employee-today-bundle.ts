import type { SupabaseClient } from "@supabase/supabase-js";
import { mapEmployeeTodayRpcToBundle } from "./map-rpc-response";
import type { EmployeeTodayBundle } from "./types";

export type FetchEmployeeTodayParams = {
  organizationId: string;
  /** IANA timezone for calendar "today" (must match shift_date semantics). */
  timeZone?: string;
};

/**
 * Calls `hh_employee_today_bundle` with the current auth session (JWT).
 * iOS can call the same RPC via supabase-swift, or hit `GET /api/employee/today`.
 * v4+: `shift_notes` in the RPC payload maps to `shiftNotes` after `mapEmployeeTodayRpcToBundle` (manager briefing from `public.shift_notes`).
 */
export async function fetchEmployeeTodayBundle(
  supabase: SupabaseClient,
  params: FetchEmployeeTodayParams
): Promise<EmployeeTodayBundle> {
  const timeZone = params.timeZone?.trim() || "America/Denver";
  const { data, error } = await supabase.rpc("hh_employee_today_bundle", {
    p_organization_id: params.organizationId,
    p_time_zone: timeZone,
  });

  if (error) {
    return {
      ok: false,
      error: "RPC_ERROR",
      message: error.message,
    };
  }

  return mapEmployeeTodayRpcToBundle(data, params.organizationId);
}
