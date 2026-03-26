import type { SupabaseClient } from "@supabase/supabase-js";

/** Earliest active membership (stable “default” tenant for legacy dashboard UI). */
export async function getDefaultTenantIdForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.tenant_id as string | undefined) ?? null;
}

export async function getTenantMembership(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<{ role: string; status: string } | null> {
  const { data } = await supabase
    .from("tenant_memberships")
    .select("role, status")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  return { role: data.role as string, status: data.status as string };
}

export async function isPlatformAdminUser(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_profiles")
    .select("is_platform_admin")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.is_platform_admin === true;
}

/** Tenant dashboard admin (branding, sites, etc.) — role `admin` on membership. */
export async function isTenantDashboardAdmin(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<boolean> {
  const m = await getTenantMembership(supabase, userId, tenantId);
  return m?.role === "admin";
}
