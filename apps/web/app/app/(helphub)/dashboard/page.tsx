import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { OrgTodayDashboard } from "@/components/helphub/OrgTodayDashboard";
import { CommandCenterDashboard } from "@/components/operations/CommandCenterDashboard";
import { TenantSitesOverview } from "@/components/dashboard/TenantSitesOverview";
import { getSupervisorPropertyForUser } from "@/lib/operations/supervisor-context";

export default async function AppDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const orgId = await resolveActiveOrganizationId(supabase, user.id);
  if (orgId) {
    return <OrgTodayDashboard orgId={orgId} />;
  }

  const supervisor = await getSupervisorPropertyForUser(user.id);
  if (supervisor) {
    return <CommandCenterDashboard propertyId={supervisor.propertyId} property={supervisor.property} />;
  }

  return <TenantSitesOverview />;
}
