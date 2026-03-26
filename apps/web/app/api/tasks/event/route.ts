import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { tasksEventBodySchema } from "@/lib/validation/schemas";
import { verifyStaffJwt } from "@/lib/auth/staffSession";
import { createClient } from "@/lib/supabase/server";

function mapEventToStatus(eventType: string): string | null {
  switch (eventType) {
    case "started":
      return "in_progress";
    case "completed":
      return "completed";
    case "escalated":
      return "open";
    default:
      return null;
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = tasksEventBodySchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msg = flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0] ?? "Validation failed";
    return NextResponse.json({ error: String(msg) }, { status: 400 });
  }
  const { taskId, eventType, note, photoPath, qrId } = parsed.data;

  let propertyId: string | null = null;
  let actorType: "staff" | "supervisor" = "staff";
  let actorRole: "hk" | "eng" | "sup" = "hk";
  let shiftTokenId: string | null = null;
  let deviceId: string | null = null;
  let qrScanId: string | null = null;

  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (bearer) {
    const staff = verifyStaffJwt(bearer);
    if (staff) {
      propertyId = staff.property_id;
      actorType = "staff";
      actorRole = staff.role;
      shiftTokenId = staff.shift_token_id ?? null;
      deviceId = staff.device_id ?? null;
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
      if (profile) {
        propertyId = profile.property_id as string;
        actorType = "supervisor";
        actorRole = "sup";
      }
    }
  }

  if (!propertyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: task, error: taskErr } = await supabase
    .from("tasks")
    .select("id, property_id, location_id, status")
    .eq("id", taskId)
    .eq("property_id", propertyId)
    .single();

  if (taskErr || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const taskRow = task as { id: string; property_id: string; location_id: string; status: string };
  if (qrId) {
    const { data: scan } = await supabase
      .from("qr_scans")
      .insert({
        qr_id: qrId,
        property_id: propertyId,
        location_id: taskRow.location_id,
        scan_context: actorType,
        device_id: deviceId,
        metadata: {},
      })
      .select("id")
      .single();
    if (scan) qrScanId = scan.id;
  }

  const { data: ev, error: evErr } = await supabase
    .from("task_events")
    .insert({
      task_id: taskId,
      property_id: propertyId,
      event_type: eventType,
      actor_type: actorType,
      actor_role: actorRole,
      shift_token_id: shiftTokenId,
      qr_scan_id: qrScanId,
      metadata: { note: note ?? null, photoPath: photoPath ?? null },
    })
    .select("id")
    .single();

  if (evErr) {
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
  }

  const newStatus = mapEventToStatus(eventType);
  const updates: { status?: string; completed_at?: string; last_event_at: string } = {
    last_event_at: new Date().toISOString(),
  };
  if (newStatus) updates.status = newStatus;
  if (eventType === "completed") updates.completed_at = new Date().toISOString();

  await supabase.from("tasks").update(updates).eq("id", taskId);

  if (eventType === "completed") {
    await supabase.from("proof_of_work").insert({
      task_id: taskId,
      property_id: propertyId,
      completed_event_id: ev.id,
      photo_path: photoPath ?? null,
      note: note ?? null,
    });
  }

  return NextResponse.json({ eventId: ev.id });
}
