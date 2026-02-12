import { GuestRequestForm } from "@/components/GuestRequestForm";
import { InvalidLinkBlock } from "@/components/public/InvalidLinkBlock";
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
  if (!qrId?.trim()) {
    return (
      <InvalidLinkBlock
        message="This QR link is invalid."
        hint="Scan the QR code again or ask the front desk for assistance."
      />
    );
  }
  const resolved = await resolveQrAndRequestTypes(qrId);
  if (!resolved) {
    return (
      <InvalidLinkBlock
        message="This QR link is invalid or expired."
        hint="Scan the QR code in your room again, or ask the front desk for assistance."
      />
    );
  }

  const branding = resolved.property.branding as { logo_url?: string | null } | undefined;
  const logoUrl = branding?.logo_url ?? null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="guest-card flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {logoUrl && (
            <img
              src={logoUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded object-contain"
            />
          )}
          <div className="min-w-0">
            <h1 className="truncate font-semibold text-[#0f172a]">
              {resolved.location.identifier}
            </h1>
            {resolved.property.name && (
              <p className="truncate text-xs guest-text-muted">{resolved.property.name}</p>
            )}
          </div>
        </div>
      </header>
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
