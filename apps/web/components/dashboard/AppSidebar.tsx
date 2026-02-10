import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SiteNavWithSearch } from "@/components/dashboard/SiteNavWithSearch";
import { LayoutDashboard, Settings, Users, LogOut, Palette } from "lucide-react";

export async function AppSidebar() {
  const supabase = await createClient();
  const { data: sites, error } = await supabase.from("sites").select("id, name").order("name");
  if (error) {
    console.error("AppSidebar sites error:", error.message);
  }
  const siteList = sites ?? [];
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("tenant_id, is_platform_admin, role").eq("user_id", user.id).single()
    : { data: null };
  const isPlatformAdmin = profile?.is_platform_admin === true;
  const isTenantAdmin = profile?.role === "admin";

  const { data: tenant } = profile?.tenant_id
    ? await supabase.from("tenants").select("name, logo_url").eq("id", profile.tenant_id).single()
    : { data: null };

  let sidebarLogoUrl = tenant?.logo_url ?? null;
  let sidebarLogoAlt = tenant?.name ?? "HelpHub";
  if (!sidebarLogoUrl && profile?.tenant_id) {
    const { data: firstSiteWithLogo } = await supabase
      .from("sites")
      .select("name, logo_url")
      .eq("tenant_id", profile.tenant_id)
      .not("logo_url", "is", null)
      .order("name")
      .limit(1)
      .maybeSingle();
    if (firstSiteWithLogo?.logo_url) {
      sidebarLogoUrl = firstSiteWithLogo.logo_url;
      sidebarLogoAlt = firstSiteWithLogo.name ?? "Customer";
    }
  }

  return (
    <aside className="premium-sidebar flex w-60 flex-col border-r dark:bg-sidebar-dark dark:border-primary/30 dark:shadow-neon-sm">
      <div className="px-4 pt-5 pb-4 border-b border-border/50 space-y-4">
        <Link href="/app" className="block w-full focus:outline-none focus:ring-2 focus:ring-ring rounded-md focus:ring-offset-2 focus:ring-offset-card">
          {sidebarLogoUrl ? (
            <img
              src={sidebarLogoUrl}
              alt={sidebarLogoAlt}
              className="w-full h-auto min-h-10 object-contain object-left"
              width={224}
              height={80}
            />
          ) : (
            <Image
              src="/helphub-logo.png"
              alt="HelpHub"
              width={224}
              height={80}
              className="w-full h-auto min-h-10 object-contain object-left"
            />
          )}
        </Link>
        <div className="flex items-center justify-between gap-2">
          <Link href="/app" className="font-semibold flex items-center gap-2 text-neon focus:outline-none focus:ring-2 focus:ring-ring rounded-md" title={sidebarLogoUrl ? "Dashboard" : "HelpHub"}>
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            {sidebarLogoUrl ? sidebarLogoAlt : "HelpHub"}
          </Link>
          <ThemeToggle />
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-auto min-h-0">
        <p className="px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
          Sites
        </p>
        <SiteNavWithSearch sites={siteList} />
        <div className="pt-4 space-y-1">
          <Link href="/app/admin/sites">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Settings className="h-4 w-4" />
              Admin – Customers
            </Button>
          </Link>
          {isTenantAdmin && (
            <Link href="/app/settings">
              <Button variant="ghost" className="w-full justify-start gap-2">
                <Palette className="h-4 w-4" />
                Branding
              </Button>
            </Link>
          )}
          {isPlatformAdmin && (
            <Link href="/platform-admin">
              <Button variant="ghost" className="w-full justify-start gap-2">
                <Users className="h-4 w-4" />
                Platform Admin
              </Button>
            </Link>
          )}
        </div>
      </nav>
      <div className="p-3 border-t border-border/50">
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="ghost" className="w-full justify-start gap-2">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}
