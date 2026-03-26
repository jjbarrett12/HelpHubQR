import type { SupabaseClient } from "@supabase/supabase-js";
import { parseRequestFeedJson, type RequestFeedItem } from "@/lib/helphub/requests/request-feed";

export async function fetchEmployeeRequestFeed(
  supabase: SupabaseClient,
  employeeId: string,
  limit = 150
): Promise<{ items: RequestFeedItem[]; error?: string }> {
  const { data, error } = await supabase.rpc("hh_employee_requests_feed", {
    p_employee_id: employeeId,
    p_limit: limit,
  });
  if (error) return { items: [], error: error.message };
  return { items: parseRequestFeedJson(data) };
}

export async function fetchManagerRequestFeed(
  supabase: SupabaseClient,
  organizationId: string,
  options?: { includeHistorical?: boolean; limit?: number }
): Promise<{ items: RequestFeedItem[]; error?: string }> {
  const { data, error } = await supabase.rpc("hh_manager_requests_feed", {
    p_organization_id: organizationId,
    p_include_historical: options?.includeHistorical ?? false,
    p_limit: options?.limit ?? 200,
  });
  if (error) return { items: [], error: error.message };
  return { items: parseRequestFeedJson(data) };
}
