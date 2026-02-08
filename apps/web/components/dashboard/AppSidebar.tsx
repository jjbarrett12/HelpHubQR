import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LayoutDashboard, Settings, LogOut } from "lucide-react";

export async function AppSidebar() {
  const supabase = await createClient();
  const { data: sites, error } = await supabase.from("sites").select("id, name").order("name");
  if (error) {
    console.error("AppSidebar sites error:", error.message);
  }
  const siteList = sites ?? [];

  return (
    <aside className="w-56 border-r border-sidebar bg-card/80 backdrop-blur-sm flex flex-col shadow-sm dark:bg-sidebar-dark dark:border-border">
      <div className="p-4 border-b border-sidebar flex items-center justify-between dark:border-border">
        <Link href="/app" className="font-semibold flex items-center gap-2 text-primary focus:outline-none focus:ring-2 focus:ring-ring rounded-md">
          <LayoutDashboard className="h-5 w-5 shrink-0" />
          HelpHub
        </Link>
        <ThemeToggle />
      </div>
      <nav className="flex-1 p-2 space-y-1">
        <p className="px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Sites
        </p>
        {siteList.map((site) => (
          <Link key={site.id} href={`/app/sites/${site.id}`}>
            <Button variant="ghost" className="w-full justify-start font-normal">
              {site.name}
            </Button>
          </Link>
        ))}
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
