import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { publicQrScanUrl } from "@/lib/qr/urls";
import { qrTextToPngBuffer } from "@/lib/qr/generate-image";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const codeId = req.nextUrl.searchParams.get("codeId");
  if (!codeId) {
    return new NextResponse("Missing codeId", { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const orgId = await resolveActiveOrganizationId(supabase, user.id);
  if (!orgId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { data: row, error } = await supabase
    .from("qr_codes")
    .select("slug")
    .eq("id", codeId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (error || !row?.slug) {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = publicQrScanUrl(row.slug as string);
  const png = await qrTextToPngBuffer(url);
  const safeName = String(row.slug).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 16) || "qr";

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="qr-${safeName}.png"`,
    },
  });
}
