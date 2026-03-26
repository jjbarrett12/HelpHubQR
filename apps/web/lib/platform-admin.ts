import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { isPlatformAdminUser } from "@/lib/tenant-auth/context";

export async function requirePlatformAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const isAdmin = await isPlatformAdminUser(supabase, user.id);
  if (!isAdmin) return null;
  return { user, supabase };
}

export type TenantMemberRow = { user_id: string; role: string; status: string };

export type TenantWithProfiles = {
  id: string;
  name: string;
  logo_url: string | null;
  billing_email: string | null;
  billing_name: string | null;
  billing_address: string | null;
  created_at: string;
  /** @deprecated use `members` — kept for gradual UI migration */
  profiles: { user_id: string; role: string }[];
  members: TenantMemberRow[];
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

  const { data: membershipRows } = await supabase
    .from("tenant_memberships")
    .select("user_id, role, status")
    .eq("tenant_id", tenantId)
    .in("status", ["active", "invited"]);

  const members: TenantMemberRow[] = (membershipRows ?? []).map((r) => ({
    user_id: r.user_id as string,
    role: r.role as string,
    status: r.status as string,
  }));

  const profiles = members.filter((m) => m.status === "active").map((m) => ({ user_id: m.user_id, role: m.role }));

  const userIds = [...new Set(members.map((m) => m.user_id))];
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
    profiles,
    members,
    userEmails,
  };
}
