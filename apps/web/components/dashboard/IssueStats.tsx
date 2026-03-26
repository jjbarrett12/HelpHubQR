import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Inbox } from "lucide-react";
import { startOfTodayISO, formatInDefaultTZ } from "@/lib/date";

export async function IssueStats({ siteId }: { siteId: string }) {
  const supabase = await createClient();
  const todayIso = startOfTodayISO();

  const [{ count: openCount }, { count: newTodayCount }, { count: resolvedTodayCount }, { data: dailyStats }] = await Promise.all([
    supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("site_id", siteId)
      .in("status", ["new", "in_progress"]),
    supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("site_id", siteId)
      .gte("created_at", todayIso),
    supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("site_id", siteId)
      .eq("status", "resolved")
      .not("resolved_at", "is", null)
      .gte("resolved_at", todayIso),
    supabase
      .from("site_daily_stats")
      .select("stat_date, issues_incoming, issues_resolved")
      .eq("site_id", siteId)
      .order("stat_date", { ascending: false })
      .limit(7),
  ]);

  const open = openCount ?? 0;
  const newToday = newTodayCount ?? 0;
  const resolvedToday = resolvedTodayCount ?? 0;

  return (
    <section className="space-y-5" aria-labelledby="issue-stats-heading">
      <h2 id="issue-stats-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Issue tracking</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="premium-card border-border/60">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <span className="text-sm font-medium text-muted-foreground">Open</span>
            <Inbox className="h-5 w-5 text-muted-foreground/80" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight">{open}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">New + in progress</p>
          </CardContent>
        </Card>
        <Card className="premium-card border-border/60">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <span className="text-sm font-medium text-muted-foreground">New today</span>
            <AlertCircle className="h-5 w-5 text-muted-foreground/80" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight">{newToday}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Issues received</p>
          </CardContent>
        </Card>
        <Card className="premium-card border-border/60">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <span className="text-sm font-medium text-muted-foreground">Resolved today</span>
            <CheckCircle className="h-5 w-5 text-muted-foreground/80" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight">{resolvedToday}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>
      {dailyStats && dailyStats.length > 0 && (
        <Card className="premium-card border-border/60">
          <CardHeader>
            <span className="text-sm font-medium text-muted-foreground">Last 7 days (incoming / resolved)</span>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-4 text-sm">
              {dailyStats.map((row) => (
                <li key={row.stat_date} className="flex gap-2">
                  <span className="text-muted-foreground">
                    {formatInDefaultTZ(row.stat_date + "Z", { month: "short", day: "numeric" })}
                  </span>
                  <span>
                    <strong>{row.issues_incoming}</strong> / {row.issues_resolved}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
