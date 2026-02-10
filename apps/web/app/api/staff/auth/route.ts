import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { staffAuthBodySchema } from "@/lib/validation/schemas";
import { signStaffJwt } from "@/lib/auth/staffSession";

const JWT_TTL_HOURS = 10;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = staffAuthBodySchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msg = flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0] ?? "Validation failed";
    return NextResponse.json({ error: String(msg) }, { status: 400 });
  }
  const { qrId, key, roleHint } = parsed.data;
  const supabase = createServiceRoleClient();

  const { data: qr, error: qrError } = await supabase
    .from("qr_codes")
    .select("property_id")
    .eq("id", qrId)
    .eq("status", "active")
    .single();

  if (qrError || !qr) {
    return NextResponse.json({ error: "Invalid QR" }, { status: 404 });
  }

  const propertyId = qr.property_id as string;
  const { data: shiftToken } = await supabase
    .from("shift_tokens")
    .select("id, role")
    .eq("property_id", propertyId)
    .eq("token", key)
    .lte("valid_from", new Date().toISOString())
    .gte("valid_to", new Date().toISOString())
    .maybeSingle();

  if (shiftToken) {
    const jwt = signStaffJwt({
      property_id: propertyId,
      role: shiftToken.role as "hk" | "eng" | "sup",
      shift_token_id: shiftToken.id,
    });
    const exp = new Date(Date.now() + JWT_TTL_HOURS * 60 * 60 * 1000);
    return NextResponse.json({
      staffSessionToken: jwt,
      role: shiftToken.role,
      expiresAt: exp.toISOString(),
    });
  }

  return NextResponse.json({ error: "Invalid key" }, { status: 401 });
}
