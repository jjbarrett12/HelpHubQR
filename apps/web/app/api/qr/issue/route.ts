import { NextRequest, NextResponse } from "next/server";
import { createHelpHubServiceClient } from "@/lib/helphub/supabase-service";
import { isValidPublicQrSlug } from "@/lib/qr/slug";
import { checkQrIssueRateLimit } from "@/lib/qr/issue-rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { slug?: unknown; message?: unknown; contact?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const contact = typeof body.contact === "string" ? body.contact.trim().slice(0, 240) : "";

  if (!isValidPublicQrSlug(slug)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (message.length < 3 || message.length > 4000) {
    return NextResponse.json({ error: "Message must be 3–4000 characters" }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "anon";
  if (!checkQrIssueRateLimit(`${ip}:${slug}`)) {
    return NextResponse.json({ error: "Too many submissions. Try again later." }, { status: 429 });
  }

  let supabase: ReturnType<typeof createHelpHubServiceClient>;
  try {
    supabase = createHelpHubServiceClient();
  } catch {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 503 });
  }

  const codeRes = await supabase
    .from("qr_codes")
    .select("id, organization_id, qr_destination_id")
    .eq("slug", slug)
    .maybeSingle();

  if (codeRes.error || !codeRes.data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const code = codeRes.data as {
    id: string;
    organization_id: string;
    qr_destination_id: string;
  };

  const destRes = await supabase
    .from("qr_destinations")
    .select("id, type, is_active, organization_id")
    .eq("id", code.qr_destination_id)
    .maybeSingle();

  const dest = destRes.data as {
    id: string;
    type: string;
    is_active: boolean;
    organization_id: string;
  } | null;

  if (
    !dest?.is_active ||
    dest.type !== "issue_report" ||
    dest.organization_id !== code.organization_id
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ins = await supabase.from("qr_issue_reports").insert({
    organization_id: code.organization_id,
    qr_code_id: code.id,
    message,
    contact: contact || null,
  });

  if (ins.error) {
    return NextResponse.json({ error: "Could not save report" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
