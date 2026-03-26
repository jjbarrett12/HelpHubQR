import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export type OrgContext = { supabase: SupabaseClient; orgId: string; user: User };

/** Owner, manager, or admin in the organization (matches RLS hh_user_can_manage_org). */
export async function userCanManageOrganization(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return false;
  const role = (data as { role: string }).role;
  return role === "owner" || role === "manager" || role === "admin";
}

export async function requireOrgContext(): Promise<OrgContext | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return { error: "Not signed in" };
  const orgId = await resolveActiveOrganizationId(supabase, user.id);
  if (!orgId) return { error: "No organization" };
  return { supabase, orgId, user };
}
