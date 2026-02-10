import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import { BrandingForm } from "./BrandingForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .single();
  if (!profile?.tenant_id || profile.role !== "admin") {
    redirect("/app");
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, logo_url")
    .eq("id", profile.tenant_id)
    .single();

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground">Branding</h1>
      <p className="mt-1 text-muted-foreground">
        Upload your company logo. It will appear in the sidebar when you’re logged in instead of the HelpHub logo.
      </p>

      <div className="mt-8 rounded-xl border border-border bg-card p-6 dark:border-card-border">
        <p className="text-sm font-medium text-foreground">Current logo</p>
        <div className="mt-3 flex items-center gap-4">
          {tenant?.logo_url ? (
            <Image
              src={tenant.logo_url}
              alt={tenant.name ?? "Company logo"}
              width={160}
              height={48}
              className="h-12 w-auto object-contain rounded border border-border bg-muted/30 p-2"
              unoptimized
            />
          ) : (
            <span className="text-sm text-muted-foreground">No logo uploaded. HelpHub logo is shown in the sidebar.</span>
          )}
        </div>

        <BrandingForm className="mt-6" />
      </div>
    </div>
  );
}
