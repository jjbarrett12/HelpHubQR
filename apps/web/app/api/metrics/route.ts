import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("supervisor_profiles")
    .select("property_id")
    .eq("user_id", user.id)
    .single();
  if (!profile?.property_id) {
    return NextResponse.json({ error: "No property" }, { status: 403 });
  }
  const propertyId = profile.property_id as string;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const { count: openCount } = await admin
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId)
    .in("status", ["open", "assigned", "in_progress"]);
  const tasksOpen = openCount ?? 0;

  const { count: completedTodayCount } = await admin
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId)
    .eq("status", "completed")
    .gte("completed_at", todayStart);
  const tasksCompletedToday = completedTodayCount ?? 0;

  const { data: allActive } = await admin
    .from("tasks")
    .select("id, created_at, sla_minutes, completed_at")
    .eq("property_id", propertyId)
    .in("status", ["open", "assigned", "in_progress", "completed"]);
  const list = (allActive ?? []) as Array<{ id: string; created_at: string; sla_minutes: number; completed_at: string | null }>;
  const completed = list.filter((t) => t.completed_at);
  const overdueCount = list.filter((t) => {
    if (t.completed_at) return false;
    const due = new Date(t.created_at).getTime() + t.sla_minutes * 60 * 1000;
    return due < Date.now();
  }).length;
  const completedWithinSla = completed.filter((t) => {
    if (!t.completed_at) return false;
    const due = new Date(t.created_at).getTime() + t.sla_minutes * 60 * 1000;
    const completedAt = new Date(t.completed_at).getTime();
    return completedAt <= due;
  }).length;
  const slaCompliancePercent = completed.length === 0 ? 100 : Math.round((completedWithinSla / completed.length) * 100);

  return NextResponse.json({
    propertyId,
    tasksOpen,
    tasksCompletedToday,
    overdueCount,
    slaCompliancePercent,
    completedWithinSla,
    completedTotal: completed.length,
  });
}
