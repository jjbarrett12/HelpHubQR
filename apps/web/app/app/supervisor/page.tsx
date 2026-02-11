import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type Filter = "open" | "overdue" | "escalated";

function isOverdue(task: { created_at: string; sla_minutes: number }): boolean {
  const due = new Date(task.created_at).getTime() + task.sla_minutes * 60 * 1000;
  return due < Date.now();
}

export default async function SupervisorPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: filterParam } = await searchParams;
  const filter: Filter = filterParam === "overdue" || filterParam === "escalated" ? filterParam : "open";

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    redirect("/login");
  }

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("supervisor_profiles")
    .select("property_id")
    .eq("user_id", user.id)
    .single();

  if (!profile?.property_id) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">You are not assigned to a property. Contact your admin.</p>
      </div>
    );
  }

  const propertyId = profile.property_id as string;
  const { data: tasks } = await admin
    .from("tasks")
    .select(`
      id,
      status,
      priority,
      sla_minutes,
      created_at,
      last_event_at,
      location:locations(identifier, type),
      request_type:request_types(code, label, department)
    `)
    .eq("property_id", propertyId)
    .in("status", ["open", "assigned", "in_progress"])
    .order("last_event_at", { ascending: false })
    .limit(100);

  const { data: escalatedRows } = await admin
    .from("task_events")
    .select("task_id")
    .eq("property_id", propertyId)
    .eq("event_type", "escalated");
  const escalatedTaskIds = new Set((escalatedRows ?? []).map((r) => r.task_id));

  const all = (tasks ?? []) as Array<{
    id: string;
    status: string;
    created_at: string;
    sla_minutes: number;
    last_event_at: string;
    location: unknown;
    request_type: unknown;
  }>;
  const open = all.filter((t) => t.status === "open");
  const overdue = all.filter((t) => isOverdue(t));
  const escalated = all.filter((t) => escalatedTaskIds.has(t.id));

  let filtered: typeof all = open;
  if (filter === "overdue") filtered = overdue;
  if (filter === "escalated") filtered = escalated;
  const sorted = [...filtered].sort(
    (a, b) => new Date(a.created_at).getTime() + a.sla_minutes * 60 * 1000 - (new Date(b.created_at).getTime() + b.sla_minutes * 60 * 1000)
  );

  return (
    <div className="p-6">
      <nav className="mb-6 flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app">Dashboard</Link>
        </Button>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-2xl font-semibold tracking-tight">Supervisor – Tasks</h1>
        <Button variant="ghost" size="sm" asChild className="ml-2">
          <Link href="/app/supervisor/reports">Reports</Link>
        </Button>
      </nav>

      <div className="mb-4 flex gap-2">
        <Button variant={filter === "open" ? "default" : "outline"} size="sm" asChild>
          <Link href="/app/supervisor?filter=open">Open ({open.length})</Link>
        </Button>
        <Button variant={filter === "overdue" ? "default" : "outline"} size="sm" asChild>
          <Link href="/app/supervisor?filter=overdue">Overdue ({overdue.length})</Link>
        </Button>
        <Button variant={filter === "escalated" ? "default" : "outline"} size="sm" asChild>
          <Link href="/app/supervisor?filter=escalated">Escalated ({escalated.length})</Link>
        </Button>
      </div>

      <section>
        <h2 className="mb-2 font-medium text-foreground">
          {filter === "open" && "Open"}
          {filter === "overdue" && "Overdue (past SLA)"}
          {filter === "escalated" && "Escalated"}
          {" "}({sorted.length})
        </h2>
        <ul className="space-y-2">
          {sorted.slice(0, 50).map((t) => {
              const locRaw = (t.location as unknown) as { identifier: string; type: string } | { identifier: string; type: string }[] | null;
              const rtRaw = (t.request_type as unknown) as { code: string; label: string } | { code: string; label: string }[] | null;
              const loc = Array.isArray(locRaw) ? locRaw[0] ?? null : locRaw;
              const rt = Array.isArray(rtRaw) ? rtRaw[0] ?? null : rtRaw;
              return (
                <li key={t.id}>
                  <Link
                    href={`/app/supervisor/tasks/${t.id}`}
                    className="block rounded border p-3 text-sm hover:bg-muted/50"
                  >
                    <span className="font-medium">{rt?.label ?? rt?.code ?? "Task"}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      – {loc?.identifier}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
    </div>
  );
}
