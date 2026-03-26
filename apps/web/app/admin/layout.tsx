import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdminUser } from "@/lib/tenant-auth/context";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, LogOut, Rocket } from "lucide-react";
import { ADMIN_ONBOARDING_BASE_PATH } from "@/lib/admin-onboarding/constants";

/**
 * Internal platform admin shell (is_platform_admin).
 * URL: /admin/* — distinct from tenant manager routes under /app/admin/*.
 */
export default async function InternalAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    redirect("/login");
  }
  const isAdmin = await isPlatformAdminUser(supabase, user.id);
  if (!isAdmin) {
    redirect("/app");
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] flex flex-col">
      <header className="border-b border-border bg-card/80 px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/platform-admin" className="flex items-center gap-2 shrink-0">
            <Image src="/helphub-logo.png" alt="HelpHub" width={100} height={34} className="h-8 w-auto object-contain" />
          </Link>
          <span className="text-muted-foreground hidden sm:inline">|</span>
          <Link href={ADMIN_ONBOARDING_BASE_PATH} className="font-semibold text-foreground flex items-center gap-2 shrink-0">
            <Rocket className="h-5 w-5 text-neon" />
            Onboarding console
          </Link>
          <nav className="hidden md:flex gap-1 items-center">
            <Link href="/platform-admin">
              <Button variant="ghost" size="sm" className="gap-1">
                <Users className="h-4 w-4" />
                Customers
              </Button>
            </Link>
            <Link href={ADMIN_ONBOARDING_BASE_PATH}>
              <Button variant="ghost" size="sm">
                All orgs
              </Button>
            </Link>
            <Link href={`${ADMIN_ONBOARDING_BASE_PATH}/new`}>
              <Button variant="ghost" size="sm">
                New org
              </Button>
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/app">
            <Button variant="outline" size="sm">
              <LayoutDashboard className="h-4 w-4 mr-1" />
              App
            </Button>
          </Link>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="ghost" size="sm">
              <LogOut className="h-4 w-4 mr-1" />
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
