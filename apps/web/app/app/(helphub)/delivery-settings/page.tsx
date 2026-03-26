import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { fetchOrCreateDeliverySettings } from "@/lib/delivery/checklist-delivery";
import { DeliverySettingsForm } from "@/components/helphub/DeliverySettingsForm";

export const dynamic = "force-dynamic";

export default async function DeliverySettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const orgId = await resolveActiveOrganizationId(supabase, user.id);
  if (!orgId) {
    return (
      <div className="p-8 max-w-lg">
        <h1 className="text-lg font-semibold">Delivery settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Select an organization above to configure SMS and email.</p>
      </div>
    );
  }

  const { data: orgRow } = await supabase.from("organizations").select("name").eq("id", orgId).single();
  const settings = await fetchOrCreateDeliverySettings(supabase, orgId);

  return (
    <div className="min-h-full">
      <header className="border-b border-border/60 bg-[var(--app-bg)]/90 backdrop-blur-md px-6 py-6 md:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Settings</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">Checklist delivery</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          {orgRow?.name ?? "Organization"} — automated sends at shift start (cron) and manual send from the schedule or runs
          screens.
        </p>
      </header>
      <div className="p-6 md:p-8 max-w-xl">
        <DeliverySettingsForm initial={settings} />
      </div>
    </div>
  );
}
