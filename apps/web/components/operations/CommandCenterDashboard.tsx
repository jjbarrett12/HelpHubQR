import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DEFAULT_TIMEZONE, startOfTodayISOInTimeZone } from "@/lib/date";
import type { SupervisorProperty } from "@/lib/operations/supervisor-context";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  LayoutGrid,
  ListChecks,
  QrCode,
  Send,
} from "lucide-react";

type CommandCenterDashboardProps = {
  propertyId: string;
  property: SupervisorProperty;
};

export async function CommandCenterDashboard({ propertyId, property }: CommandCenterDashboardProps) {
  const admin = createServiceRoleClient();
  const tz = property.timezone?.trim() || DEFAULT_TIMEZONE;
  const todayIso = startOfTodayISOInTimeZone(tz);

  const [
    { count: sentToday },
    { count: completedToday },
    { count: activeNow },
    { count: openNew },
    { data: openTasks },
    { data: locationsWithOpen },
  ] = await Promise.all([
    admin
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("property_id", propertyId)
      .gte("created_at", todayIso),
    admin
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("property_id", propertyId)
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .gte("completed_at", todayIso),
    admin
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("property_id", propertyId)
      .in("status", ["assigned", "in_progress"]),
    admin
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("property_id", propertyId)
      .eq("status", "open"),
    admin
      .from("tasks")
      .select(
        `
        id,
        status,
        created_at,
        sla_minutes,
        location:locations(identifier),
        request_type:request_types(department, label, code)
      `
      )
      .eq("property_id", propertyId)
      .in("status", ["open", "assigned", "in_progress"])
      .order("created_at", { ascending: true })
      .limit(400),
    admin
      .from("tasks")
      .select("location_id")
      .eq("property_id", propertyId)
      .in("status", ["open", "assigned", "in_progress"]),
  ]);

  const sent = sentToday ?? 0;
  const completed = completedToday ?? 0;
  const opened = activeNow ?? 0;

  const completionPct =
    sent === 0 ? 100 : Math.min(100, Math.round((100 * completed) / sent));

  const locIds = new Set((locationsWithOpen ?? []).map((r) => r.location_id).filter(Boolean));
  const incompleteLocations = locIds.size;

  const byDept = new Map<string, { total: number; overdue: number }>();
  const rows = (openTasks ?? []) as Array<{
    id: string;
    status: string;
    created_at: string;
    sla_minutes: number;
    location: unknown;
    request_type: unknown;
  }>;
  const now = Date.now();
  for (const t of rows) {
    const rtRaw = t.request_type as { department?: string; label?: string } | null;
    const dept = (rtRaw?.department || "General").trim() || "General";
    const due = new Date(t.created_at).getTime() + t.sla_minutes * 60 * 1000;
    const overdue = due < now;
    const cur = byDept.get(dept) ?? { total: 0, overdue: 0 };
    cur.total += 1;
    if (overdue) cur.overdue += 1;
    byDept.set(dept, cur);
  }
  const deptEntries = [...byDept.entries()].sort((a, b) => b[1].total - a[1].total);

  const urgentOpen = rows.filter((t) => {
    const due = new Date(t.created_at).getTime() + t.sla_minutes * 60 * 1000;
    return due < now && t.status === "open";
  }).length;

  return (
    <div className="min-h-full">
      <header className="border-b border-border/60 bg-[var(--app-bg)]/90 backdrop-blur-md px-6 py-6 md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between max-w-6xl">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Operations
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              {property.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-xl">
              Shift checklist activity for today. Scan runs, completion, and open work at a glance.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-1.5" asChild>
              <Link href="/app/checklists">
                <ClipboardList className="h-4 w-4" />
                Checklists
              </Link>
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" asChild>
              <Link href="/app/schedule">
                <LayoutGrid className="h-4 w-4" />
                Schedule
              </Link>
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" asChild>
              <Link href="/app/admin/property">
                <QrCode className="h-4 w-4" />
                QR &amp; property
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6 md:p-8 max-w-6xl space-y-10">
        <section aria-labelledby="today-kpis" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="today-kpis" className="text-sm font-semibold text-foreground">
              Today
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums">Timezone: {tz}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/60 shadow-sm overflow-hidden">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <span className="text-sm font-medium text-muted-foreground">Completion</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tracking-tight tabular-nums">{completionPct}%</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {completed} of {sent} runs submitted today
                </p>
                <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500 transition-[width]"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <span className="text-sm font-medium text-muted-foreground">Runs today</span>
                <Send className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tracking-tight tabular-nums">{sent}</p>
                <p className="mt-1 text-xs text-muted-foreground">Submitted / scheduled today</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <span className="text-sm font-medium text-muted-foreground">Opened</span>
                <ListChecks className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tracking-tight tabular-nums">{opened}</p>
                <p className="mt-1 text-xs text-muted-foreground">In progress or assigned now</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <span className="text-sm font-medium text-muted-foreground">Completed</span>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tracking-tight tabular-nums">{completed}</p>
                <p className="mt-1 text-xs text-muted-foreground">Finished today</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section aria-labelledby="funnel" className="space-y-4">
          <h2 id="funnel" className="text-sm font-semibold text-foreground">
            Pipeline
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card
              className={`border-border/60 shadow-sm ${urgentOpen > 0 ? "border-amber-500/40 bg-amber-500/[0.04]" : ""}`}
            >
              <CardHeader className="pb-2">
                <span className="text-sm font-medium text-muted-foreground">Still new</span>
              </CardHeader>
              <CardContent className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-2xl font-bold tabular-nums">{openNew ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Not started yet</p>
                </div>
                {urgentOpen > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-900 dark:text-amber-100">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {urgentOpen} past SLA
                  </span>
                )}
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <span className="text-sm font-medium text-muted-foreground">Locations with open work</span>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">{incompleteLocations}</p>
                <p className="text-xs text-muted-foreground mt-1">Rooms or areas not yet cleared</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <span className="text-sm font-medium text-muted-foreground">Total open runs</span>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">{rows.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Across all active statuses</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section aria-labelledby="by-role" className="space-y-4">
          <h2 id="by-role" className="text-sm font-semibold text-foreground">
            Open work by team
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {deptEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-full">No open runs. Good job.</p>
            ) : (
              deptEntries.map(([dept, { total, overdue }]) => (
                <Card
                  key={dept}
                  className={`border-border/60 shadow-sm ${overdue > 0 ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-border"}`}
                >
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">{dept}</p>
                        <p className="text-2xl font-bold tabular-nums mt-1">{total}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">open items</p>
                      </div>
                      {overdue > 0 && (
                        <span className="text-xs font-medium text-amber-800 dark:text-amber-200 whitespace-nowrap">
                          {overdue} overdue
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </section>

        <section aria-labelledby="quick-actions" className="space-y-4">
          <h2 id="quick-actions" className="text-sm font-semibold text-foreground">
            Quick actions
          </h2>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="gap-2">
              <Link href="/app/checklists">
                <ClipboardList className="h-4 w-4" />
                Edit checklist templates
              </Link>
            </Button>
            <Button variant="secondary" asChild className="gap-2">
              <Link href="/app/schedule">
                <LayoutGrid className="h-4 w-4" />
                Review schedule
              </Link>
            </Button>
            <Button variant="outline" asChild className="gap-2">
              <Link href="/app/checklist-runs">
                <ListChecks className="h-4 w-4" />
                All runs
              </Link>
            </Button>
            <Button variant="outline" asChild className="gap-2">
              <Link href="/app/admin/pilot-guide">
                <Building2 className="h-4 w-4" />
                Shift keys &amp; pilot setup
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
