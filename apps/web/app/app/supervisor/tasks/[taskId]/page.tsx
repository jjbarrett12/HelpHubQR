import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { Button } from "@/components/ui/button";

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
    <div className="p-6">
      <nav className="mb-6 flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/supervisor">Tasks</Link>
        </Button>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-xl font-semibold tracking-tight">
          {rt?.label ?? rt?.code ?? "Task"} – {loc?.type === "room" ? `Room ${loc?.identifier}` : loc?.identifier}
        </h1>
      </nav>

      <div className="space-y-6">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Status</p>
          <p className="font-medium capitalize">{task.status.replace("_", " ")}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Created {new Date(task.created_at).toLocaleString()}
            {task.completed_at && ` · Completed ${new Date(task.completed_at).toLocaleString()}`}
          </p>
        </div>

        {proof && (
          <div className="rounded-lg border p-4">
            <p className="mb-2 text-sm font-medium text-foreground">Proof of work</p>
            {proof.photo_path && (
              <p className="text-sm text-muted-foreground">Photo: {proof.photo_path}</p>
            )}
            {proof.note && <p className="mt-1 text-sm">{proof.note}</p>}
          </div>
        )}

        <div className="rounded-lg border p-4">
          <p className="mb-2 text-sm font-medium text-foreground">Event timeline</p>
          <ul className="space-y-2 text-sm">
            {(events ?? []).map((ev) => (
              <li key={ev.id} className="flex gap-2">
                <span className="text-muted-foreground">
                  {new Date(ev.timestamp).toLocaleString()}
                </span>
                <span className="capitalize">{ev.event_type.replace("_", " ")}</span>
                <span className="text-muted-foreground">
                  ({ev.actor_type} / {ev.actor_role})
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
