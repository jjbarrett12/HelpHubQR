import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TenantTheme } from "@/components/theme/TenantTheme";
import { ManagerChrome } from "@/components/manager-shell/ManagerChrome";
import { getHelpHubContext } from "@/app/app/helphub/actions/org";
import { getDefaultTenantIdForUser } from "@/lib/tenant-auth/context";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    redirect("/login");
  }

  const defaultTenantId = await getDefaultTenantIdForUser(supabase, user.id);
  const { data: tenant } = defaultTenantId
    ? await supabase.from("tenants").select("branding").eq("id", defaultTenantId).single()
    : { data: null };
  const branding = (tenant?.branding as { primary_color?: string | null } | null) ?? null;

  const ctx = await getHelpHubContext();

  let sidebarLogoUrl: string | null = null;
  let sidebarLogoAlt = "HelpHubQR";
  if (defaultTenantId) {
    const { data: t } = await supabase.from("tenants").select("name, logo_url").eq("id", defaultTenantId).single();
    sidebarLogoUrl = (t?.logo_url as string | null) ?? null;
    sidebarLogoAlt = (t?.name as string) ?? sidebarLogoAlt;
    if (!sidebarLogoUrl) {
      const { data: firstSiteWithLogo } = await supabase
        .from("sites")
        .select("name, logo_url")
        .eq("tenant_id", defaultTenantId)
        .is("archived_at", null)
        .not("logo_url", "is", null)
        .order("name")
        .limit(1)
        .maybeSingle();
      if (firstSiteWithLogo?.logo_url) {
        sidebarLogoUrl = firstSiteWithLogo.logo_url as string;
        sidebarLogoAlt = (firstSiteWithLogo.name as string) ?? sidebarLogoAlt;
      }
    }
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)]">
      <TenantTheme branding={branding} />
      <ManagerChrome
        organizations={ctx.organizations}
        activeOrganizationId={ctx.organizationId}
        sidebarLogoUrl={sidebarLogoUrl}
        sidebarLogoAlt={sidebarLogoAlt}
      >
        {children}
      </ManagerChrome>
    </div>
  );
}
