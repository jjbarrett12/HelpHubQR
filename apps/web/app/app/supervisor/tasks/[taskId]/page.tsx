import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { RunStatusBadge } from "@/components/operations/RunStatusBadge";

export const dynamic = "force-dynamic";

export default async function SupervisorTaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("supervisor_profiles")
    .select("property_id")
    .eq("user_id", user.id)
    .single();

  if (!profile?.property_id) notFound();

  const { data: task, error: taskErr } = await admin
    .from("tasks")
    .select(`
      id,
      status,
      priority,
      sla_minutes,
      created_at,
      completed_at,
      last_event_at,
      location:locations(identifier, type),
      request_type:request_types(code, label, department)
    `)
    .eq("id", taskId)
    .eq("property_id", profile.property_id)
    .single();

  if (taskErr || !task) notFound();

  const { data: events } = await admin
    .from("task_events")
    .select("id, event_type, actor_type, actor_role, timestamp, metadata")
    .eq("task_id", taskId)
    .order("timestamp", { ascending: true });

  const { data: proof } = await admin
    .from("proof_of_work")
    .select("id, photo_path, note, created_at")
    .eq("task_id", taskId)
    .maybeSingle();

  const locRaw = (task.location as unknown) as { identifier: string; type: string } | { identifier: string; type: string }[] | null;
  const rtRaw = (task.request_type as unknown) as { code: string; label: string; department: string } | { code: string; label: string; department: string }[] | null;
  const loc = Array.isArray(locRaw) ? locRaw[0] ?? null : locRaw;
  const rt = Array.isArray(rtRaw) ? rtRaw[0] ?? null : rtRaw;

  return (
    <div className="min-h-full p-6 md:p-8 max-w-3xl space-y-8">
      <nav className="flex flex-wrap items-center gap-2 text-sm">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link href="/app/checklist-runs">← Runs</Link>
        </Button>
      </nav>

      <header className="space-y-3 border-b border-border/60 pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Run detail
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {rt?.label ?? rt?.code ?? "Task"}
          </h1>
          <RunStatusBadge status={task.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{loc?.identifier}</span>
          {loc?.type && <span> · {loc.type}</span>}
          {rt?.department && <span> · {rt.department}</span>}
        </p>
      </header>

      <div className="space-y-4">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <span className="text-sm font-medium text-muted-foreground">Timeline</span>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>
              Created <span className="text-foreground">{new Date(task.created_at).toLocaleString()}</span>
            </p>
            {task.completed_at && (
              <p>
                Completed <span className="text-foreground">{new Date(task.completed_at).toLocaleString()}</span>
              </p>
            )}
            <p className="text-xs">SLA {task.sla_minutes} min · Priority {task.priority}</p>
          </CardContent>
        </Card>

        {proof && (
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <span className="text-sm font-medium text-foreground">Proof of work</span>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              {proof.photo_path && <p className="text-muted-foreground break-all">Photo: {proof.photo_path}</p>}
              {proof.note && <p>{proof.note}</p>}
            </CardContent>
          </Card>
        )}

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <span className="text-sm font-medium text-foreground">Activity</span>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {(events ?? []).map((ev) => (
                <li key={ev.id} className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:gap-x-2 border-b border-border/40 last:border-0 last:pb-0 pb-3">
                  <span className="text-muted-foreground tabular-nums shrink-0">
                    {new Date(ev.timestamp).toLocaleString()}
                  </span>
                  <span className="font-medium capitalize">{ev.event_type.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground text-xs sm:text-sm">
                    {ev.actor_type} / {ev.actor_role}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
