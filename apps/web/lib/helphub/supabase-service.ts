import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for server-only operations that cannot run under end-user RLS
 * (public checklist token flows, fairness ledger inserts, some workforce remaps).
 * Every query must still be scoped by org/token/shift/run id — never broad scans.
 */
export function createHelpHubServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for public checklist access");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
