import { format } from "date-fns";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { calendarDateInTimeZone, DEFAULT_TIMEZONE } from "@/lib/date";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShiftRunStatusBadge } from "@/components/helphub/ShiftRunStatusBadge";
import { OperationalOrgRealtimeRefresh } from "@/components/helphub/OperationalOrgRealtimeRefresh";
import { ClipboardList, ListChecks, CalendarDays, Users } from "lucide-react";

export async function OrgTodayDashboard({ orgId }: { orgId: string }) {
  const supabase = await createClient();
  const scheduleTz = process.env.CRON_SCHEDULE_TZ?.trim() || DEFAULT_TIMEZONE;
  const today = calendarDateInTimeZone(scheduleTz);

  const { data: orgRow } = await supabase.from("organizations").select("name").eq("id", orgId).single();
  const orgName = orgRow?.name ?? "Organization";

  const { data: shiftsToday } = await supabase
    .from("employee_shifts")
    .select("id, employee_id, staff_role_id, status")
    .eq("organization_id", orgId)
    .eq("shift_date", today);

  const shiftList = shiftsToday ?? [];
  const shiftIds = shiftList.map((s) => s.id as string);

  const { data: runsToday } =
    shiftIds.length > 0
      ? await supabase
          .from("shift_checklist_runs")
          .select("id, status, employee_shift_id, updated_at, sent_at, started_at")
          .eq("organization_id", orgId)
          .in("employee_shift_id", shiftIds)
      : { data: [] as Record<string, unknown>[] };

  const runs = runsToday ?? [];
  const completedRuns = runs.filter((r) => r.status === "completed").length;
  const totalRuns = runs.length;
  const sentCount = runs.filter((r) => r.status === "sent").length;
  const openedCount = runs.filter((r) => r.status === "opened").length;
  const completedStatusCount = runs.filter((r) => r.status === "completed").length;

  const incompleteShifts = shiftList.filter((s) => {
    const run = runs.find((r) => r.employee_shift_id === s.id);
    if (!run) return true;
    return run.status !== "completed";
  });

  const completionPct = totalRuns === 0 ? 100 : Math.min(100, Math.round((100 * completedRuns) / totalRuns));

  const { data: employees } = await supabase
    .from("employees")
    .select("id, full_name")
    .eq("organization_id", orgId)
    .eq("is_active", true);

  const { data: roles } = await supabase.from("staff_roles").select("id, name").eq("organization_id", orgId);

  const empMap = new Map((employees ?? []).map((e) => [e.id as string, e.full_name as string]));
  const roleMap = new Map((roles ?? []).map((r) => [r.id as string, r.name as string]));

  const byRole: Record<string, { total: number; done: number }> = {};
  for (const s of shiftList) {
    const rn = roleMap.get(s.staff_role_id as string) ?? "Role";
    if (!byRole[rn]) byRole[rn] = { total: 0, done: 0 };
    byRole[rn].total += 1;
    const run = runs.find((r) => r.employee_shift_id === s.id);
    if (run?.status === "completed") byRole[rn].done += 1;
  }

  const { data: recentRuns } = await supabase
    .from("shift_checklist_runs")
    .select("id, status, updated_at, employee_shift_id")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(12);

  const recent = recentRuns ?? [];
  const recentShiftIds = [...new Set(recent.map((r) => r.employee_shift_id as string))];
  const { data: recentShifts } =
    recentShiftIds.length > 0
      ? await supabase.from("employee_shifts").select("id, shift_date").in("id", recentShiftIds)
      : { data: [] as { id: string; shift_date: string }[] };

  const shiftDateMap = new Map((recentShifts ?? []).map((s) => [s.id, s.shift_date]));

  return (
    <div className="min-h-full">
      <OperationalOrgRealtimeRefresh organizationId={orgId} scope="manager-dashboard" />
      <header className="border-b border-border/60 bg-[var(--app-bg)]/90 backdrop-blur-md px-6 py-6 md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between max-w-6xl">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Command center
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">{orgName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Intl.DateTimeFormat("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
                timeZone: scheduleTz,
              }).format(new Date())}{" "}
              · Today&apos;s shift checklists
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
                <CalendarDays className="h-4 w-4" />
                Schedule
              </Link>
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" asChild>
              <Link href="/app/checklist-runs">
                <ListChecks className="h-4 w-4" />
                Runs
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6 md:p-8 space-y-10 max-w-6xl">
        <section aria-labelledby="today-kpis" className="space-y-4">
          <h2 id="today-kpis" className="text-sm font-semibold text-foreground">
            Today
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/60 shadow-sm overflow-hidden">
              <CardHeader className="pb-2 text-sm font-medium text-muted-foreground">Completion</CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums">{completionPct}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {totalRuns === 0
                    ? "No runs linked to today's shifts yet"
                    : `${completedRuns} of ${totalRuns} runs completed`}
                </p>
                <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500" style={{ width: `${completionPct}%` }} />
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 text-sm font-medium text-muted-foreground">Shifts scheduled</CardHeader>
              <CardContent className="text-3xl font-bold tabular-nums">{shiftList.length}</CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 text-sm font-medium text-muted-foreground">Runs today</CardHeader>
              <CardContent className="text-3xl font-bold tabular-nums">{totalRuns}</CardContent>
            </Card>
            <Card
              className={`border-border/60 shadow-sm ${
                incompleteShifts.length > 0 ? "border-l-4 border-l-amber-500" : ""
              }`}
            >
              <CardHeader className="pb-2 text-sm font-medium text-muted-foreground">Incomplete</CardHeader>
              <CardContent className="text-3xl font-bold tabular-nums">{incompleteShifts.length}</CardContent>
            </Card>
          </div>
        </section>

        <section aria-labelledby="funnel" className="space-y-4">
          <h2 id="funnel" className="text-sm font-semibold text-foreground">
            Delivery
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 text-sm text-muted-foreground">Sent</CardHeader>
              <CardContent className="text-2xl font-bold tabular-nums">{sentCount}</CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 text-sm text-muted-foreground">Opened</CardHeader>
              <CardContent className="text-2xl font-bold tabular-nums">{openedCount}</CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 text-sm text-muted-foreground">Completed</CardHeader>
              <CardContent className="text-2xl font-bold tabular-nums">{completedStatusCount}</CardContent>
            </Card>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="font-semibold text-foreground">By role</span>
              <Button variant="outline" size="sm" asChild>
                <Link href="/app/schedule">Schedule</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.keys(byRole).length === 0 ? (
                <p className="text-sm text-muted-foreground">No shifts scheduled for today.</p>
              ) : (
                Object.entries(byRole).map(([role, v]) => {
                  const pct = v.total ? Math.round((100 * v.done) / v.total) : 0;
                  return (
                    <div key={role} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium">{role}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {v.done}/{v.total}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="font-semibold text-foreground">Needs attention</span>
              <Button variant="outline" size="sm" className="gap-1" asChild>
                <Link href="/app/employees">
                  <Users className="h-3.5 w-3.5" />
                  Team
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {incompleteShifts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open shifts for today.</p>
              ) : (
                incompleteShifts.slice(0, 12).map((s) => (
                  <div
                    key={s.id as string}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm"
                  >
                    <span className="font-medium truncate">{empMap.get(s.employee_id as string) ?? "Employee"}</span>
                    <Badge variant="secondary" className="shrink-0">
                      {roleMap.get(s.staff_role_id as string) ?? "Role"}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="font-semibold text-foreground">Recent activity</span>
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/checklist-runs">All runs</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No checklist runs yet.</p>
            ) : (
              recent.map((r) => (
                <div
                  key={r.id as string}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-transparent px-2 py-2 text-sm hover:bg-muted/30"
                >
                  <span className="text-muted-foreground tabular-nums">
                    {(shiftDateMap.get(r.employee_shift_id as string) as string) ?? "—"}
                  </span>
                  <ShiftRunStatusBadge status={r.status as string} />
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(r.updated_at as string), "MMM d, h:mm a")}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
