import type { ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDefaultTenantIdForUser } from "@/lib/tenant-auth/context";
import {
  isQrRolloutLikelyComplete,
  isTenantOnboardingComplete,
} from "@/lib/tenant/onboarding";
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

export async function TenantSitesOverview() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const defaultTenantId = user ? await getDefaultTenantIdForUser(supabase, user.id) : null;

  const { data: sites } = await supabase
    .from("sites")
    .select("id, name, archived_at")
    .order("name");

  const sitesList = sites ?? [];
  if (sitesList.length === 0) {
    const { redirect } = await import("next/navigation");
    redirect("/app/admin/sites");
  }

  const activeSites = sitesList.filter((s) => !s.archived_at);
  const archivedSites = sitesList.filter((s) => !!s.archived_at);

  let onboardingBanner: ReactNode = null;
  if (defaultTenantId) {
    const { data: ob } = await supabase
      .from("tenant_onboarding")
      .select("status, completed_at, sites_created_count, rooms_created_count")
      .eq("tenant_id", defaultTenantId)
      .maybeSingle();
    if (ob && !isTenantOnboardingComplete(ob) && !isQrRolloutLikelyComplete(ob)) {
      onboardingBanner = (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          <p className="font-medium">Finish setup</p>
          <p className="text-muted-foreground mt-1">
            Add at least one customer (site) and locations with QR codes under{" "}
            <Link href="/app/admin/sites" className="underline font-medium text-foreground">
              Customers
            </Link>
            . Add more dashboard users through your onboarding contact or platform operator if you need extra admins or
            managers.
          </p>
        </div>
      );
    }
  }

  const weekStart = startOfWeekISO();
  const openCounts = await Promise.all(
    activeSites.map(async (site) => {
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
      <header className="border-b border-border/60 bg-[var(--app-bg)]/90 backdrop-blur-md px-6 py-6 md:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Tenant overview
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground md:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-xl">
          Pick a site to work guest requests and tickets.
        </p>
      </header>
      <div className="p-6 md:p-8 max-w-5xl space-y-8">
        {onboardingBanner}
        {activeSites.length === 0 && archivedSites.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
            <p className="font-medium text-foreground">No active customers</p>
            <p className="text-muted-foreground mt-1">
              All sites are archived. Open an archived site below to view ticket history, or add a new customer under{" "}
              <Link href="/app/admin/sites" className="underline">
                Customers
              </Link>
              .
            </p>
          </div>
        )}
        <section aria-labelledby="ticket-kpis" className="space-y-4">
          <h2 id="ticket-kpis" className="text-sm font-semibold text-foreground">
            All sites
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-border/60 shadow-sm">
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Inbox className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight tabular-nums">{totalOpen}</p>
                  <p className="text-sm text-muted-foreground">Open across all sites</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight tabular-nums">{totalNewThisWeek}</p>
                  <p className="text-sm text-muted-foreground">New this week</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
        <section aria-labelledby="sites-list" className="space-y-4">
          <h2 id="sites-list" className="text-sm font-semibold text-foreground">
            Active sites
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {openCounts.map(({ siteId, name, open, newThisWeek }) => (
              <Link
                key={siteId}
                href={`/app/sites/${siteId}`}
                className="group flex items-center gap-4 rounded-xl border border-border/60 bg-card/30 p-5 shadow-sm transition hover:border-primary/25 hover:bg-card/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground truncate">{name}</p>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Inbox className="h-4 w-4 shrink-0" />
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
          {archivedSites.length > 0 && (
            <div className="mt-8 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Archived customers (history only)
              </h3>
              <ul className="space-y-2 text-sm">
                {archivedSites.map((s) => (
                  <li key={s.id}>
                    <Link href={`/app/sites/${s.id}`} className="text-muted-foreground underline hover:text-foreground">
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
