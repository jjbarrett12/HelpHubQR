import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { resolveQrQuerySchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = resolveQrQuerySchema.safeParse({ qrId: searchParams.get("qrId") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: "qrId is required" }, { status: 400 });
  }
  const { qrId } = parsed.data;
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

  if (error || !qr) {
    return NextResponse.json({ error: "Invalid or expired QR" }, { status: 404 });
  }

  const prop = (qr.property as unknown) as { id: string; name: string; branding: Record<string, unknown> } | { id: string; name: string; branding: Record<string, unknown> }[] | null;
  const loc = (qr.location as unknown) as { id: string; type: string; identifier: string } | { id: string; type: string; identifier: string }[] | null;
  const property = Array.isArray(prop) ? prop[0] ?? null : prop;
  const location = Array.isArray(loc) ? loc[0] ?? null : loc;
  if (!property || !location) {
    return NextResponse.json({ error: "Invalid QR data" }, { status: 500 });
  }

  return NextResponse.json({
    property: { id: property.id, name: property.name, branding: property.branding ?? {} },
    location: { id: location.id, type: location.type, identifier: location.identifier },
    mode_default: qr.mode_default ?? "auto",
  });
}
