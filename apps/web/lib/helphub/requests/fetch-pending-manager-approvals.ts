import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApprovalInboxItem } from "@/components/today-command-center/mock-data";
import {
  parseNormalizedWorkforceRequestRows,
} from "@/lib/helphub/requests/normalized-workforce-request";
import { mapNormalizedRowToApprovalInboxItem } from "@/lib/helphub/requests/map-normalized-to-approval-inbox";

/**
 * Manager-facing slice: rows with manager_action_required (via RPC wrapping the normalized view).
 */
export async function fetchPendingManagerApprovalsForToday(
  supabase: SupabaseClient,
  organizationId: string,
  limit = 25
): Promise<{ items: ApprovalInboxItem[]; error?: string }> {
  const { data, error } = await supabase.rpc("hh_workforce_requests_pending_manager_json", {
    p_organization_id: organizationId,
    p_limit: limit,
  });

  if (error) {
    return { items: [], error: error.message };
  }

  let arr: unknown[] = [];
  if (Array.isArray(data)) {
    arr = data;
  } else if (typeof data === "string") {
    try {
      const p = JSON.parse(data) as unknown;
      arr = Array.isArray(p) ? p : [];
    } catch {
      arr = [];
    }
  }

  const normalized = parseNormalizedWorkforceRequestRows(arr);
  return { items: normalized.map(mapNormalizedRowToApprovalInboxItem) };
}
