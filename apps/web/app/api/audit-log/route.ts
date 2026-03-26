import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { entityType?: string; entityId?: string; action?: string; payload?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { entityType, entityId, action, payload } = body;
  if (!entityType || !entityId || !action) {
    return NextResponse.json({ error: "entityType, entityId, action required" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  await admin.from("audit_log").insert({
    entity_type: entityType,
    entity_id: entityId,
    action,
    actor_user_id: user.id,
    payload: payload ?? {},
  });

  return NextResponse.json({ ok: true });
}
