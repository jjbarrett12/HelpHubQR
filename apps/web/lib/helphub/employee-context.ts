import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export type EmployeeContext = {
  supabase: SupabaseClient;
  orgId: string;
  user: User;
  employeeId: string;
};

/**
 * Logged-in user linked to an employees row (auth_user_id) in the active org.
 */
export async function resolveEmployeeInActiveOrg(
  supabase: SupabaseClient,
  userId: string,
  orgId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("employees")
    .select("id")
    .eq("organization_id", orgId)
    .eq("auth_user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function requireEmployeeContext(): Promise<EmployeeContext | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return { error: "Not signed in" };
  const orgId = await resolveActiveOrganizationId(supabase, user.id);
  if (!orgId) return { error: "No organization" };
  const employeeId = await resolveEmployeeInActiveOrg(supabase, user.id, orgId);
  if (!employeeId) return { error: "No employee profile linked to this account" };
  return { supabase, orgId, user, employeeId };
}
