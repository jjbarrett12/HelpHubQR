import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { tasksListQuerySchema } from "@/lib/validation/schemas";
import { verifyStaffJwt } from "@/lib/auth/staffSession";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = {
    locationId: searchParams.get("locationId") ?? undefined,
    qrId: searchParams.get("qrId") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  };
  const parsed = tasksListQuerySchema.safeParse(q);
  if (!parsed.success) {
    return NextResponse.json({ error: "locationId or qrId required" }, { status: 400 });
  }
  const { locationId, qrId, status } = parsed.data;

  let propertyId: string | null = null;
  let locationIdResolved: string | null = locationId ?? null;

  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (bearer) {
    const staff = verifyStaffJwt(bearer);
    if (staff) {
      propertyId = staff.property_id;
    }
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

  if (qrId && !locationIdResolved) {
    const { data: qr } = await supabase
      .from("qr_codes")
      .select("location_id")
      .eq("id", qrId)
      .eq("property_id", propertyId)
      .single();
    if (qr) locationIdResolved = qr.location_id as string;
  }

  if (!locationIdResolved) {
    return NextResponse.json({ error: "Could not resolve location" }, { status: 400 });
  }

  let query = supabase
    .from("tasks")
    .select(`
      id,
      status,
      priority,
      sla_minutes,
      created_at,
      completed_at,
      last_event_at,
      request_type:request_types(code, label, department)
    `)
    .eq("property_id", propertyId)
    .eq("location_id", locationIdResolved)
    .order("last_event_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data: tasks, error } = await query.limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = (tasks ?? []).map((t) => ({
    id: t.id,
    status: t.status,
    priority: t.priority,
    sla_minutes: t.sla_minutes,
    created_at: t.created_at,
    completed_at: t.completed_at,
    last_event_at: t.last_event_at,
    request_type: t.request_type,
  }));

  return NextResponse.json({ tasks: list });
}
