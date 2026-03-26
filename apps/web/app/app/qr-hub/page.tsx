import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { QRHubClient } from "@/components/qr-hub/QRHubClient";
import { MOCK_QR_DESTINATIONS } from "@/components/qr-hub/mock-data";
import { Button } from "@/components/ui/button";

export default async function QRHubPage() {
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
        <h1 className="text-lg font-semibold">QR hub</h1>
        <p className="text-sm text-muted-foreground">
          Select or create an organization to manage QR destinations. You can still open legacy destination screens from the
          links below.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/qr-destinations">QR destinations</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/qr-codes">QR codes</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { data: orgRow } = await supabase.from("organizations").select("name").eq("id", orgId).single();
  const organizationLabel = (orgRow?.name as string | undefined)?.trim() || "Your organization";

  return <QRHubClient organizationLabel={organizationLabel} initialDestinations={MOCK_QR_DESTINATIONS} />;
}
