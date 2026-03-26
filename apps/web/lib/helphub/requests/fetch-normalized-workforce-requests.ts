import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseNormalizedWorkforceRequestRows,
  type NormalizedWorkforceRequestRow,
} from "@/lib/helphub/requests/normalized-workforce-request";

export async function fetchNormalizedWorkforceRequests(
  supabase: SupabaseClient,
  organizationId: string,
  options?: { limit?: number }
): Promise<{ rows: NormalizedWorkforceRequestRow[]; error?: string }> {
  const limit = Math.min(Math.max(options?.limit ?? 150, 1), 500);
  const { data, error } = await supabase
    .from("hh_workforce_requests_normalized")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { rows: [], error: error.message };
  }

  return { rows: parseNormalizedWorkforceRequestRows(data ?? []) };
}
