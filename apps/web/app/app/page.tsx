import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Building2, ChevronRight, Inbox, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

function startOfWeekISO() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default async function AppHomePage() {
  const supabase = await createClient();
  const { data: sites } = await supabase.from("sites").select("id, name").order("name");

  const sitesList = sites ?? [];
  if (sitesList.length === 0) {
    const { redirect } = await import("next/navigation");
    redirect("/app/admin/sites");
  }

  const weekStart = startOfWeekISO();
  const openCounts = await Promise.all(
    sitesList.map(async (site) => {
      const [{ count: open }, { count: newThisWeek }] = await Promise.all([
        supabase
          .from("tickets")
          .select("*", { count: "exact", head: true })
          .eq("site_id", site.id)
          .in("status", ["new", "in_progress"]),
        supabase
          .from("tickets")
          .select("*", { count: "exact", head: true })
          .eq("site_id", site.id)
          .gte("created_at", weekStart),
      ]);
      return {
        siteId: site.id,
        name: site.name,
        open: open ?? 0,
        newThisWeek: newThisWeek ?? 0,
      };
    })
  );

  const totalOpen = openCounts.reduce((s, c) => s + c.open, 0);
  const totalNewThisWeek = openCounts.reduce((s, c) => s + c.newThisWeek, 0);

  return (
    <div className="min-h-full">
      <header className="border-b border-border/50 bg-[var(--app-bg)]/80 backdrop-blur-md px-6 py-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Select a site to view tickets and activity.</p>
      </header>
      <div className="p-6 md:p-8 max-w-5xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="premium-card border-border/60">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Inbox className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">{totalOpen}</p>
                <p className="text-sm text-muted-foreground">Open across all sites</p>
              </div>
            </CardContent>
          </Card>
          <Card className="premium-card border-border/60">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">{totalNewThisWeek}</p>
                <p className="text-sm text-muted-foreground">New this week</p>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {openCounts.map(({ siteId, name, open, newThisWeek }) => (
            <Link
              key={siteId}
              href={`/app/sites/${siteId}`}
              className="group premium-card flex items-center gap-4 rounded-2xl border border-border/60 p-5 transition hover:border-primary/30 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground truncate">{name}</p>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Inbox className="h-4 w-4" />
                  {open} open
                  {newThisWeek > 0 && (
                    <span className="text-primary"> · {newThisWeek} this week</span>
                  )}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
