import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { Button } from "@/components/ui/button";
import { PropertyForm } from "./PropertyForm";
import { RequestTypeRow } from "./RequestTypeRow";
import { MvpQrExportPanel } from "./MvpQrExportPanel";
import { PropertyAlertRules } from "./PropertyAlertRules";

export const dynamic = "force-dynamic";

export default async function AdminPropertyPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("supervisor_profiles")
    .select("property_id")
    .eq("user_id", user.id)
    .single();

  if (!profile?.property_id) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">You are not assigned to a property.</p>
      </div>
    );
  }

  const propertyId = profile.property_id as string;
  const { data: property } = await admin
    .from("properties")
    .select("id, name, timezone, branding")
    .eq("id", propertyId)
    .single();

  if (!property) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Property not found.</p>
      </div>
    );
  }

  const branding = property.branding as Record<string, unknown> ?? {};
  const { data: requestTypes } = await admin
    .from("request_types")
    .select("id, code, label, department, default_priority, default_sla_minutes, is_active")
    .eq("property_id", propertyId)
    .order("code");

  const { data: locations } = await admin
    .from("locations")
    .select("id, type, identifier")
    .eq("property_id", propertyId)
    .order("identifier");
  const locationIds = (locations ?? []).map((l) => l.id);
  const { data: qrRows } =
    locationIds.length > 0
      ? await admin
          .from("qr_codes")
          .select("id, location_id")
          .eq("property_id", propertyId)
          .eq("status", "active")
      : { data: [] as { id: string; location_id: string }[] };
  const qrByLocationId = new Map((qrRows ?? []).map((q) => [q.location_id, q.id]));
  const locationsWithQr = (locations ?? []).map((l) => ({
    id: l.id,
    type: l.type,
    identifier: l.identifier,
    qrId: qrByLocationId.get(l.id) ?? null,
  }));

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://helphubqr.com";

  const { data: alertRules } = await admin
    .from("property_alert_rules")
    .select("id, channel, target, enabled")
    .eq("property_id", propertyId)
    .order("created_at");

  return (
    <div className="p-6">
      <nav className="mb-6 flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app">Dashboard</Link>
        </Button>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-2xl font-semibold tracking-tight">Property – MVP config</h1>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/admin/pilot-guide" className="text-muted-foreground">
            Pilot onboarding checklist →
          </Link>
        </Button>
      </nav>

      <div className="space-y-6">
        <PropertyAlertRules rules={alertRules ?? []} />

        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-medium text-foreground">Property & branding</h2>
          <PropertyForm
            name={property.name}
            timezone={property.timezone}
            logoUrl={(branding.logo_url as string) ?? null}
            primaryColor={(branding.primary_color as string) ?? null}
            supportPhone={(branding.support_phone as string) ?? null}
          />
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium text-foreground">QR code export</h2>
          <MvpQrExportPanel propertyName={property.name} locations={locationsWithQr} baseUrl={baseUrl} />
        </section>

        <section>
          <h2 className="mb-2 font-medium text-foreground">Request types</h2>
          <ul className="space-y-2">
            {(requestTypes ?? []).map((rt) => (
              <li key={rt.id}>
                <RequestTypeRow
                  id={rt.id}
                  code={rt.code}
                  label={rt.label}
                  department={rt.department}
                  defaultSlaMinutes={rt.default_sla_minutes}
                  isActive={rt.is_active}
                />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
