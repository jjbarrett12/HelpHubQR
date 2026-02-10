import { createServiceRoleClient } from "@/lib/supabase/server-admin";

type TaskRow = {
  id: string;
  request_type_id: string;
  created_at: string;
  completed_at: string | null;
  sla_minutes: number;
  status: string;
};

export async function getSupervisorReportData(propertyId: string) {
  const admin = createServiceRoleClient();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: tasks } = await admin
    .from("tasks")
    .select("id, request_type_id, created_at, completed_at, sla_minutes, status")
    .eq("property_id", propertyId)
    .gte("created_at", thirtyDaysAgo);

  const { data: requestTypes } = await admin
    .from("request_types")
    .select("id, code, label")
    .eq("property_id", propertyId)
    .order("code");

  const list = (tasks ?? []) as TaskRow[];
  const byType = new Map<string, { label: string; code: string; last7: number; last30: number; completed: number; totalResolutionMs: number }>();
  for (const rt of requestTypes ?? []) {
    byType.set(rt.id, { label: rt.label, code: rt.code, last7: 0, last30: 0, completed: 0, totalResolutionMs: 0 });
  }
  for (const t of list) {
    const bucket = byType.get(t.request_type_id);
    if (!bucket) continue;
    const created = new Date(t.created_at).getTime();
    if (created >= new Date(sevenDaysAgo).getTime()) bucket.last7++;
    if (created >= new Date(thirtyDaysAgo).getTime()) bucket.last30++;
    if (t.completed_at) {
      bucket.completed++;
      bucket.totalResolutionMs += new Date(t.completed_at).getTime() - created;
    }
  }

  const byRequestType = Array.from(byType.entries()).map(([id, b]) => ({
    request_type_id: id,
    label: b.label,
    code: b.code,
    last7: b.last7,
    last30: b.last30,
    completed: b.completed,
    avgResolutionMinutes: b.completed > 0 ? Math.round(b.totalResolutionMs / 60000 / b.completed) : null as number | null,
  }));

  const completed = list.filter((t) => t.completed_at);
  const overdueOpen = list.filter((t) => {
    if (t.completed_at) return false;
    if (!["open", "assigned", "in_progress"].includes(t.status)) return false;
    const due = new Date(t.created_at).getTime() + t.sla_minutes * 60 * 1000;
    return due < Date.now();
  });
  const completedWithinSla = completed.filter((t) => {
    const due = new Date(t.created_at).getTime() + t.sla_minutes * 60 * 1000;
    return new Date(t.completed_at!).getTime() <= due;
  });
  const slaCompliancePercent = completed.length === 0 ? 100 : Math.round((completedWithinSla.length / completed.length) * 100);

  return {
    byRequestType,
    summary: {
      totalLast30: list.length,
      completedLast30: completed.length,
      overdueOpen: overdueOpen.length,
      slaCompliancePercent,
    },
  };
}
