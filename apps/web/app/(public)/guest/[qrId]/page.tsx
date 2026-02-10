import { notFound } from "next/navigation";
import { GuestRequestForm } from "@/components/GuestRequestForm";
import { LocationHeader } from "@/components/LocationHeader";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";

async function resolveQrAndRequestTypes(qrId: string) {
  const supabase = createServiceRoleClient();
  const { data: qr, error } = await supabase
    .from("qr_codes")
    .select(`
      id,
      mode_default,
      property:properties(id, name, branding),
      location:locations(id, type, identifier)
    `)
    .eq("id", qrId)
    .eq("status", "active")
    .single();
  if (error || !qr) return null;
  const prop = (qr.property as unknown) as { id: string; name: string; branding: Record<string, unknown> } | { id: string; name: string; branding: Record<string, unknown> }[] | null;
  const loc = (qr.location as unknown) as { id: string; type: string; identifier: string } | { id: string; type: string; identifier: string }[] | null;
  const property = Array.isArray(prop) ? prop[0] ?? null : prop;
  const location = Array.isArray(loc) ? loc[0] ?? null : loc;
  if (!property || !location) return null;
  const { data: requestTypes } = await supabase
    .from("request_types")
    .select("code, label")
    .eq("property_id", property.id)
    .eq("is_active", true)
    .order("code");
  return {
    property,
    location,
    mode_default: qr.mode_default,
    requestTypes: (requestTypes ?? []) as { code: string; label: string }[],
  };
}

export default async function GuestPage({
  params,
}: {
  params: Promise<{ qrId: string }>;
}) {
  const { qrId } = await params;
  const resolved = await resolveQrAndRequestTypes(qrId);
  if (!resolved) notFound();

  const branding = resolved.property.branding as { logo_url?: string | null } | undefined;
  const logoUrl = branding?.logo_url ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LocationHeader
        locationIdentifier={resolved.location.identifier}
        locationType={resolved.location.type}
        propertyName={resolved.property.name}
        logoUrl={logoUrl}
      />
      <main className="flex-1 p-4">
        <div className="mx-auto max-w-md">
          <GuestRequestForm
            qrId={qrId}
            requestTypes={resolved.requestTypes}
            propertyName={resolved.property.name}
          />
        </div>
      </main>
    </div>
  );
}
