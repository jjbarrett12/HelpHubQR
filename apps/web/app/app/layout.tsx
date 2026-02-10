import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { TenantTheme } from "@/components/theme/TenantTheme";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    redirect("/login");
  }
  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", user.id).single();
  const { data: tenant } = profile?.tenant_id
    ? await supabase.from("tenants").select("branding").eq("id", profile.tenant_id).single()
    : { data: null };
  const branding = (tenant?.branding as { primary_color?: string | null } | null) ?? null;

  return (
    <div className="flex min-h-screen bg-[var(--app-bg)]">
      <TenantTheme branding={branding} />
      <AppSidebar />
      <main className="flex-1 overflow-auto border-l border-border/50 min-h-screen bg-[var(--app-bg)] text-foreground focus:outline-none" aria-label="Main content">
        {children}
      </main>
    </div>
  );
}
