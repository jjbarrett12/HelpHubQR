import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { userCanManageOrganization } from "@/lib/helphub/require-org";
import { RequestsManagerClient } from "@/components/manager-requests/RequestsManagerClient";
import { loadManagerRequestsInbox } from "@/lib/helphub/requests/load-manager-requests-inbox";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function ManagerRequestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const orgId = await resolveActiveOrganizationId(supabase, user.id);
  if (!orgId) {
    return (
      <div className="min-h-full p-8 max-w-lg space-y-4">
        <h1 className="text-lg font-semibold">Requests & approvals</h1>
        <p className="text-sm text-muted-foreground">
          Select or create an organization to use the manager inbox. You can still review shift operations from the
          property tools path if you have supervisor access.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/app/shift-ops">Shift operations</Link>
        </Button>
      </div>
    );
  }

  const { data: orgRow } = await supabase.from("organizations").select("name").eq("id", orgId).single();
  const organizationLabel = (orgRow?.name as string | undefined)?.trim() || "Your organization";

  const canManage = await userCanManageOrganization(supabase, user.id, orgId);
  const { requests, error: loadErr } = await loadManagerRequestsInbox(supabase, orgId, {
    includeHistorical: canManage,
  });

  return (
    <RequestsManagerClient
      organizationLabel={organizationLabel}
      requests={requests}
      loadError={loadErr}
      isManagerRole={canManage}
    />
  );
}
