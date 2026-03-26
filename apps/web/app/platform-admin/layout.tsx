import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdminUser } from "@/lib/tenant-auth/context";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, LogOut } from "lucide-react";

export default async function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
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
        <div className="flex items-center gap-4">
          <Link href="/platform-admin" className="flex items-center gap-2 min-w-0">
            <Image src="/helphub-logo.png" alt="HelpHub" width={100} height={34} className="h-8 w-auto object-contain" />
          </Link>
          <Link href="/platform-admin" className="font-semibold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-neon" />
            Platform Admin
          </Link>
          <nav className="flex gap-2">
            <Link href="/platform-admin">
              <Button variant="ghost" size="sm">Customers</Button>
            </Link>
            <Link href="/admin/onboarding">
              <Button variant="ghost" size="sm">Onboarding console</Button>
            </Link>
            <Link href="/platform-admin/onboarding">
              <Button variant="ghost" size="sm" className="text-muted-foreground">Legacy list</Button>
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
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
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}
