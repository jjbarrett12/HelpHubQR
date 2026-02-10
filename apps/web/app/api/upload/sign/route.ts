import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { uploadSignBodySchema } from "@/lib/validation/schemas";
import { verifyStaffJwt } from "@/lib/auth/staffSession";
import { createClient } from "@/lib/supabase/server";

const BUCKET = process.env.UPLOAD_BUCKET ?? "proof";
const SIGNED_URL_TTL_SEC = 90;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = uploadSignBodySchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msg = flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0] ?? "Validation failed";
    return NextResponse.json({ error: String(msg) }, { status: 400 });
  }
  const { taskId, contentType } = parsed.data;

  let propertyId: string | null = null;
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (bearer) {
    const staff = verifyStaffJwt(bearer);
    if (staff) propertyId = staff.property_id;
  }
  if (!propertyId) {
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (user) {
      const supabase = createServiceRoleClient();
      const { data: profile } = await supabase
        .from("supervisor_profiles")
        .select("property_id")
        .eq("user_id", user.id)
        .single();
      if (profile) propertyId = profile.property_id as string;
    }
  }

  if (!propertyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: task, error: taskErr } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .eq("property_id", propertyId)
    .single();

  if (taskErr || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const ext = contentType.split("/")[1] ?? "jpg";
  const path = `${propertyId}/${taskId}/${crypto.randomUUID()}.${ext}`;

  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (signErr || !signed) {
    return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
  }

  return NextResponse.json({
    signedUrl: (signed as { signedUrl?: string; path: string }).signedUrl ?? (signed as { path: string }).path,
    path,
  });
}
