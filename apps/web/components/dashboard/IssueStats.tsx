import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Inbox } from "lucide-react";

export async function IssueStats({ siteId }: { siteId: string }) {
  const supabase = await createClient();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayIso = today.toISOString();

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
    <section className="space-y-4" aria-labelledby="issue-stats-heading">
      <h2 id="issue-stats-heading" className="text-sm font-medium text-muted-foreground">Issue tracking</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center gap-2 pb-1">
            <Inbox className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Open</span>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{open}</p>
            <p className="text-xs text-muted-foreground">New + in progress</p>
          </CardContent>
        </Card>
        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center gap-2 pb-1">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">New today</span>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{newToday}</p>
            <p className="text-xs text-muted-foreground">Issues received</p>
          </CardContent>
        </Card>
        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center gap-2 pb-1">
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Resolved today</span>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{resolvedToday}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>
      {dailyStats && dailyStats.length > 0 && (
        <Card className="border-card-border">
          <CardHeader>
            <span className="text-sm font-medium">Last 7 days (incoming / resolved)</span>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-4 text-sm">
              {dailyStats.map((row) => (
                <li key={row.stat_date} className="flex gap-2">
                  <span className="text-muted-foreground">
                    {new Date(row.stat_date + "Z").toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
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
