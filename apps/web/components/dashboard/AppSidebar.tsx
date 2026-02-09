import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SiteNavWithSearch } from "@/components/dashboard/SiteNavWithSearch";
import { LayoutDashboard, Settings, LogOut } from "lucide-react";

export async function AppSidebar() {
  const supabase = await createClient();
  const { data: sites, error } = await supabase.from("sites").select("id, name").order("name");
  if (error) {
    console.error("AppSidebar sites error:", error.message);
  }
  const siteList = sites ?? [];

  return (
    <aside className="w-56 border-r border-sidebar bg-card/80 backdrop-blur-sm flex flex-col shadow-sm dark:bg-sidebar-dark dark:border-primary/40 dark:shadow-neon-sm">
      <div className="p-4 border-b border-sidebar dark:border-primary/30 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Link href="/app" className="flex items-center gap-2 min-w-0 focus:outline-none focus:ring-2 focus:ring-ring rounded-md">
            <Image
              src="/vanguard-logo.png"
              alt="Vanguard"
              width={100}
              height={44}
              className="h-9 w-auto object-contain shrink-0 dark:[filter:invert(1)_hue-rotate(180deg)]"
            />
          </Link>
          <ThemeToggle />
        </div>
        <Link href="/app" className="font-semibold flex items-center gap-2 text-neon focus:outline-none focus:ring-2 focus:ring-ring rounded-md">
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          HelpHub
        </Link>
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-auto min-h-0">
        <p className="px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Sites
        </p>
        <SiteNavWithSearch sites={siteList} />
        <div className="pt-4">
          <Link href="/app/admin/sites">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Settings className="h-4 w-4" />
              Admin – Customers
            </Button>
          </Link>
        </div>
      </nav>
      <div className="p-2 border-t border-sidebar">
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
