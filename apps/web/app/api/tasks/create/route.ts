import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { tasksCreateBodySchema } from "@/lib/validation/schemas";
import { rateLimitKey } from "@/lib/rateLimit";
import { checkGuestRateLimitDistributed } from "@/lib/rateLimitDistributed";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = tasksCreateBodySchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msg = flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0] ?? "Validation failed";
    return NextResponse.json({ error: String(msg) }, { status: 400 });
  }
  const { qrId, requestTypeCode, note, deviceId: bodyDeviceId } = parsed.data;
  const deviceId = bodyDeviceId ?? request.headers.get("x-device-id") ?? null;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;
  const key = rateLimitKey(qrId, deviceId, ip);
  const rl = await checkGuestRateLimitDistributed(key);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again in a few minutes." }, { status: 429 });
  }
  const supabase = createServiceRoleClient();

  const { data: qr, error: qrError } = await supabase
    .from("qr_codes")
    .select("property_id, location_id")
    .eq("id", qrId)
    .eq("status", "active")
    .single();

  if (qrError || !qr) {
    return NextResponse.json({ error: "Invalid QR" }, { status: 404 });
  }

  const { data: requestType } = await supabase
    .from("request_types")
    .select("id, default_priority, default_sla_minutes")
    .eq("property_id", qr.property_id)
    .eq("code", requestTypeCode)
    .eq("is_active", true)
    .maybeSingle();

  if (!requestType) {
    return NextResponse.json({ error: "Invalid request type" }, { status: 400 });
  }

  const { data: scan, error: scanError } = await supabase
    .from("qr_scans")
    .insert({
      qr_id: qrId,
      property_id: qr.property_id,
      location_id: qr.location_id,
      scan_context: "guest",
      device_id: deviceId,
      metadata: {},
    })
    .select("id")
    .single();

  if (scanError) {
    return NextResponse.json({ error: "Failed to record scan" }, { status: 500 });
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      property_id: qr.property_id,
      location_id: qr.location_id,
      request_type_id: requestType.id,
      status: "open",
      priority: requestType.default_priority,
      sla_minutes: requestType.default_sla_minutes,
    })
    .select("id")
    .single();

  if (taskError) {
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }

  const { error: eventError } = await supabase.from("task_events").insert({
    task_id: task.id,
    property_id: qr.property_id,
    event_type: "created",
    actor_type: "guest",
    actor_role: "guest",
    qr_scan_id: scan.id,
    metadata: { note: note ?? null },
  });

  if (eventError) {
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
  }

  return NextResponse.json({ taskId: task.id });
}
