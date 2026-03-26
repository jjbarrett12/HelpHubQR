import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { DEFAULT_TIMEZONE } from "@/lib/date";
import type { SupervisorProperty } from "@/lib/operations/supervisor-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays } from "date-fns/addDays";
import { fromZonedTime } from "date-fns-tz/fromZonedTime";
import { formatInTimeZone } from "date-fns-tz/formatInTimeZone";

export async function PropertyTaskSchedule({
  propertyId,
  property,
  offset,
}: {
  propertyId: string;
  property: SupervisorProperty;
  offset: number;
}) {
  const admin = createServiceRoleClient();
  const tz = property.timezone?.trim() || DEFAULT_TIMEZONE;

  const todayYmd = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const windowEndDay = addDays(fromZonedTime(`${todayYmd}T12:00:00`, tz), -offset);
  const dayKeys: { ymd: string; label: string; sub: string }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(windowEndDay, -i);
    dayKeys.push({
      ymd: formatInTimeZone(d, tz, "yyyy-MM-dd"),
      label: formatInTimeZone(d, tz, "EEE d"),
      sub: formatInTimeZone(d, tz, "MMM"),
    });
  }

  const rangeStartIso = fromZonedTime(`${dayKeys[0].ymd}T00:00:00`, tz).toISOString();
  const rangeEndIso = fromZonedTime(`${dayKeys[13].ymd}T23:59:59.999`, tz).toISOString();

  const [{ data: createdRows }, { data: completedRows }] = await Promise.all([
    admin
      .from("tasks")
      .select("created_at")
      .eq("property_id", propertyId)
      .gte("created_at", rangeStartIso)
      .lte("created_at", rangeEndIso),
    admin
      .from("tasks")
      .select("completed_at")
      .eq("property_id", propertyId)
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .gte("completed_at", rangeStartIso)
      .lte("completed_at", rangeEndIso),
  ]);

  const createdByDay = new Map<string, number>();
  const completedByDay = new Map<string, number>();

  for (const r of createdRows ?? []) {
    const key = formatInTimeZone(new Date(r.created_at), tz, "yyyy-MM-dd");
    createdByDay.set(key, (createdByDay.get(key) ?? 0) + 1);
  }
  for (const r of completedRows ?? []) {
    if (!r.completed_at) continue;
    const key = formatInTimeZone(new Date(r.completed_at), tz, "yyyy-MM-dd");
    completedByDay.set(key, (completedByDay.get(key) ?? 0) + 1);
  }

  const prevOffset = offset + 14;
  const nextOffset = Math.max(0, offset - 14);

  return (
    <div className="min-h-full">
      <header className="border-b border-border/60 bg-[var(--app-bg)]/90 backdrop-blur-md px-6 py-6 md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between max-w-5xl">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Property schedule
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">{property.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-xl">
              Task volume by day (guest-submitted runs vs. completed). For shift planning with employees, use an
              organization in the bar above.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-1" asChild>
              <Link href={`/app/schedule?offset=${prevOffset}`}>
                <ChevronLeft className="h-4 w-4" />
                Earlier
              </Link>
            </Button>
            {offset === 0 ? (
              <Button variant="outline" size="sm" className="gap-1" disabled>
                Later
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="gap-1" asChild>
                <Link href={`/app/schedule?offset=${nextOffset}`}>
                  Later
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
            <Button size="sm" asChild>
              <Link href="/app/checklist-runs">Open runs</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6 md:p-8 max-w-5xl space-y-8">
        <section aria-labelledby="legend" className="flex flex-wrap gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="h-2 w-6 rounded-full bg-primary/80" />
            Submitted
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-6 rounded-full bg-emerald-600 dark:bg-emerald-500" />
            Completed
          </div>
        </section>

        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
          {dayKeys.map((day) => {
            const created = createdByDay.get(day.ymd) ?? 0;
            const completed = completedByDay.get(day.ymd) ?? 0;
            const max = Math.max(1, created + completed);
            const createdH = Math.round((created / max) * 100);
            const doneH = Math.round((completed / max) * 100);
            return (
              <Card key={day.ymd} className="border-border/60 shadow-sm overflow-hidden">
                <CardContent className="p-3 pt-4 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{day.sub}</p>
                    <p className="text-sm font-bold text-foreground">{day.label}</p>
                  </div>
                  <div className="flex gap-1.5 h-16 items-end">
                    <div
                      className="flex-1 rounded-md bg-primary/20 min-h-[4px] transition-all"
                      style={{ height: `${Math.max(8, createdH)}%` }}
                      title={`Submitted: ${created}`}
                    />
                    <div
                      className="flex-1 rounded-md bg-emerald-600/30 dark:bg-emerald-500/25 min-h-[4px] transition-all"
                      style={{ height: `${Math.max(8, doneH)}%` }}
                      title={`Completed: ${completed}`}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5 tabular-nums">
                    <p>
                      In <span className="font-medium text-foreground">{created}</span>
                    </p>
                    <p>
                      Out <span className="font-medium text-foreground">{completed}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">Day boundaries use {tz}.</p>
      </div>
    </div>
  );
}
