import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SiteNavWithSearch } from "@/components/dashboard/SiteNavWithSearch";
import { getDefaultTenantIdForUser, getTenantMembership, isPlatformAdminUser } from "@/lib/tenant-auth/context";
import {
  LayoutDashboard,
  Settings,
  Users,
  LogOut,
  Palette,
  HelpCircle,
  ListChecks,
  ClipboardList,
  CalendarDays,
  MapPin,
  Briefcase,
  ImagePlus,
  Mail,
  QrCode,
  UserCog,
  Inbox,
  Scale,
  SlidersHorizontal,
  Tags,
} from "lucide-react";

export async function AppSidebar() {
  const supabase = await createClient();
  const { data: sites, error } = await supabase
    .from("sites")
    .select("id, name")
    .is("archived_at", null)
    .order("name");
  if (error) {
    console.error("AppSidebar sites error:", error.message);
  }
  const siteList = sites ?? [];
  const { data: { user } } = await supabase.auth.getUser();
  const defaultTenantId = user ? await getDefaultTenantIdForUser(supabase, user.id) : null;
  const isPlatformAdmin = user ? await isPlatformAdminUser(supabase, user.id) : false;
  const membership = user && defaultTenantId ? await getTenantMembership(supabase, user.id, defaultTenantId) : null;
  const isTenantAdmin = membership?.role === "admin";

  const { data: tenant } = defaultTenantId
    ? await supabase.from("tenants").select("name, logo_url").eq("id", defaultTenantId).single()
    : { data: null };

  let sidebarLogoUrl = tenant?.logo_url ?? null;
  let sidebarLogoAlt = tenant?.name ?? "HelpHub";
  if (!sidebarLogoUrl && defaultTenantId) {
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
      sidebarLogoUrl = firstSiteWithLogo.logo_url;
      sidebarLogoAlt = firstSiteWithLogo.name ?? "Customer";
    }
  }

  return (
    <aside className="premium-sidebar flex w-60 flex-col border-r dark:bg-sidebar-dark dark:border-primary/30 dark:shadow-neon-sm">
      <div className="px-4 pt-5 pb-4 border-b border-border/50 space-y-4">
        <Link href="/app/dashboard" className="block w-full focus:outline-none focus:ring-2 focus:ring-ring rounded-md focus:ring-offset-2 focus:ring-offset-card">
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
          <Link href="/app/dashboard" className="font-semibold flex items-center gap-2 text-neon focus:outline-none focus:ring-2 focus:ring-ring rounded-md" title={sidebarLogoUrl ? "Dashboard" : "HelpHub"}>
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            {sidebarLogoUrl ? sidebarLogoAlt : "HelpHub"}
          </Link>
          <ThemeToggle />
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-auto min-h-0">
        <div className="pb-3 space-y-1">
          <p className="px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
            Shift checklists
          </p>
          <Link href="/app/dashboard">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Today
            </Button>
          </Link>
          <Link href="/app/employees">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Users className="h-4 w-4" />
              Employees
            </Button>
          </Link>
          <Link href="/app/roles">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Briefcase className="h-4 w-4" />
              Roles
            </Button>
          </Link>
          <Link href="/app/locations">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <MapPin className="h-4 w-4" />
              Locations
            </Button>
          </Link>
          <Link href="/app/checklists">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <ClipboardList className="h-4 w-4" />
              Checklists
            </Button>
          </Link>
          <Link href="/app/checklists/import">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <ImagePlus className="h-4 w-4" />
              Import checklist
            </Button>
          </Link>
          <Link href="/app/task-taxonomy">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Tags className="h-4 w-4" />
              Task taxonomy
            </Button>
          </Link>
          <Link href="/app/schedule">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <CalendarDays className="h-4 w-4" />
              Schedule
            </Button>
          </Link>
          <Link href="/app/checklist-runs">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <ListChecks className="h-4 w-4" />
              Today&apos;s runs
            </Button>
          </Link>
          <Link href="/app/shift-ops">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <UserCog className="h-4 w-4" />
              Shift operations
            </Button>
          </Link>
          <Link href="/app/fairness">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Scale className="h-4 w-4" />
              Fairness
            </Button>
          </Link>
          <Link href="/app/my-shifts">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <CalendarDays className="h-4 w-4 opacity-90" />
              My shifts
            </Button>
          </Link>
          <Link href="/app/my-requests">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Inbox className="h-4 w-4" />
              My requests
            </Button>
          </Link>
          <Link href="/app/my-preferences">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              My preferences
            </Button>
          </Link>
          <Link href="/app/delivery-settings">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Mail className="h-4 w-4" />
              Delivery settings
            </Button>
          </Link>
          <Link href="/app/qr-destinations">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <QrCode className="h-4 w-4" />
              QR destinations
            </Button>
          </Link>
          <Link href="/app/qr-codes">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <QrCode className="h-4 w-4 opacity-80" />
              QR codes
            </Button>
          </Link>
          <Link href="/app/qr-issues">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <QrCode className="h-4 w-4 opacity-60" />
              QR issue inbox
            </Button>
          </Link>
        </div>
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
          <Link href="/app/help">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <HelpCircle className="h-4 w-4" />
              Help
            </Button>
          </Link>
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
