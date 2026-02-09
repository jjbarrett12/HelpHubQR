import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";

export async function requirePlatformAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_admin")
    .eq("user_id", user.id)
    .single();
  if (!profile?.is_platform_admin) return null;
  return { user, supabase };
}

export type TenantWithProfiles = {
  id: string;
  name: string;
  logo_url: string | null;
  billing_email: string | null;
  billing_name: string | null;
  billing_address: string | null;
  created_at: string;
  profiles: { user_id: string; role: string }[];
  userEmails: Record<string, string>;
};

export async function getTenantWithUserEmails(tenantId: string): Promise<TenantWithProfiles | null> {
  const ctx = await requirePlatformAdmin();
  if (!ctx) return null;
  const { supabase } = ctx;
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id, name, logo_url, billing_email, billing_name, billing_address, created_at")
    .eq("id", tenantId)
    .single();
  if (tenantError || !tenant) return null;
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, role")
    .eq("tenant_id", tenantId);
  const userIds = (profiles ?? []).map((p) => p.user_id);
  const admin = createServiceRoleClient();
  const userEmails: Record<string, string> = {};
  await Promise.all(
    userIds.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      if (data?.user?.email) userEmails[id] = data.user.email;
    })
  );
  return {
    ...tenant,
    profiles: profiles ?? [],
    userEmails,
  };
}
