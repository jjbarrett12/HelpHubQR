import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { calendarDateInTimeZone, DEFAULT_TIMEZONE } from "@/lib/date";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { getSupervisorPropertyForUser } from "@/lib/operations/supervisor-context";
import { PropertyTaskSchedule } from "@/components/operations/PropertyTaskSchedule";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  createEmployeeShiftFormAction,
  deleteEmployeeShiftFormAction,
} from "@/app/app/helphub/actions/shifts";
import { ShiftQuickActions } from "@/components/helphub/ShiftQuickActions";
import { fetchOrCreateDeliverySettings } from "@/lib/delivery/checklist-delivery";
import { buildDeliveryChannelHints, indexLatestDeliveriesByRun } from "@/lib/delivery/delivery-status";
import { ScheduleManagerClient } from "@/components/schedule-manager";
import { mondayOfWeekContaining, parseWeekParam } from "@/components/schedule-manager/schedule-week-utils";

const SHIFT_LABEL: Record<string, string> = {
  open: "Open",
  mid: "Mid",
  close: "Close",
  custom: "Custom",
};

function firstString(p: string | string[] | undefined): string | undefined {
  if (typeof p === "string") return p;
  if (Array.isArray(p) && typeof p[0] === "string") return p[0];
  return undefined;
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const rawDate = firstString(searchParams.date);
  const scheduleTz = process.env.CRON_SCHEDULE_TZ?.trim() || DEFAULT_TIMEZONE;
  const dateStr =
    typeof rawDate === "string" && rawDate.length > 0 ? rawDate : calendarDateInTimeZone(scheduleTz);
  const offsetRaw = firstString(searchParams.offset);
  const offset = Math.min(
    56,
    Math.max(0, parseInt(offsetRaw ?? "0", 10) || 0)
  );

  const tab = firstString(searchParams.tab) ?? "plan";
  const weekMonday =
    parseWeekParam(firstString(searchParams.week)) ?? mondayOfWeekContaining(new Date());

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const orgId = await resolveActiveOrganizationId(supabase, user.id);
  if (!orgId) {
    const supervisor = await getSupervisorPropertyForUser(user.id);
    if (supervisor) {
      return (
        <PropertyTaskSchedule
          propertyId={supervisor.propertyId}
          property={supervisor.property}
          offset={offset}
        />
      );
    }
    return (
      <div className="p-8 max-w-lg">
        <h1 className="text-lg font-semibold">Schedule</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Select or create an organization above, or get supervisor access to a property for task history by day.
        </p>
      </div>
    );
  }

  const { data: orgRow } = await supabase.from("organizations").select("name").eq("id", orgId).single();
  const organizationLabel = (orgRow?.name as string | undefined)?.trim();

  if (tab !== "checklists") {
    return (
      <div className="min-h-full">
        <div className="border-b border-border/60 bg-muted/30 px-4 py-2 md:px-6 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">Manager planning view (mock week data)</span>
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
            <Link href={`/app/schedule?tab=checklists&date=${encodeURIComponent(dateStr)}`}>
              Daily checklist links & add shift →
            </Link>
          </Button>
        </div>
        <Suspense
          fallback={<div className="p-8 text-sm text-muted-foreground">Loading schedule…</div>}
        >
          <ScheduleManagerClient
            initialWeekMonday={weekMonday}
            organizationLabel={organizationLabel}
          />
        </Suspense>
      </div>
    );
  }

  const [{ data: shifts }, { data: employees }, { data: roles }, { data: locations }, deliverySettings] =
    await Promise.all([
      supabase
        .from("employee_shifts")
        .select("*")
        .eq("organization_id", orgId)
        .eq("shift_date", dateStr)
        .order("created_at", { ascending: true }),
      supabase
        .from("employees")
        .select("id, full_name, phone, email")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("full_name"),
      supabase.from("staff_roles").select("id, name").eq("organization_id", orgId).order("name"),
      supabase.from("locations").select("id, name").eq("organization_id", orgId).order("name"),
      fetchOrCreateDeliverySettings(supabase, orgId),
    ]);

  const shiftIds = (shifts ?? []).map((s) => s.id as string);
  const { data: runs } =
    shiftIds.length > 0
      ? await supabase
          .from("shift_checklist_runs")
          .select("id, employee_shift_id, access_token, status")
          .eq("organization_id", orgId)
          .in("employee_shift_id", shiftIds)
      : { data: [] as Record<string, unknown>[] };

  const runByShift = new Map<string, { id: string; access_token: string; status: string }>();
  for (const r of runs ?? []) {
    runByShift.set(r.employee_shift_id as string, {
      id: r.id as string,
      access_token: r.access_token as string,
      status: r.status as string,
    });
  }

  const scheduleRunIds = [...runByShift.values()].map((r) => r.id);
  const { data: scheduleDeliveryRows } =
    scheduleRunIds.length > 0
      ? await supabase
          .from("message_deliveries")
          .select("shift_checklist_run_id, channel, status, error_message, sent_at, created_at")
          .eq("organization_id", orgId)
          .in("shift_checklist_run_id", scheduleRunIds)
          .order("created_at", { ascending: false })
      : { data: [] as Record<string, unknown>[] };

  const latestDeliveriesSchedule = indexLatestDeliveriesByRun(
    (scheduleDeliveryRows ?? []).map((row) => ({
      shift_checklist_run_id: row.shift_checklist_run_id as string,
      channel: row.channel as string,
      status: row.status as string,
      error_message: (row.error_message as string | null) ?? null,
      sent_at: (row.sent_at as string | null) ?? null,
    }))
  );

  const empName = new Map((employees ?? []).map((e) => [e.id as string, e.full_name as string]));
  const empContact = new Map(
    (employees ?? []).map((e) => [
      e.id as string,
      {
        phonePresent: Boolean((e.phone as string | null)?.trim()),
        emailPresent: Boolean((e.email as string | null)?.trim()),
      },
    ])
  );
  const roleName = new Map((roles ?? []).map((r) => [r.id as string, r.name as string]));

  const prev = new Date(dateStr + "T12:00:00");
  prev.setDate(prev.getDate() - 1);
  const next = new Date(dateStr + "T12:00:00");
  next.setDate(next.getDate() + 1);

  return (
    <div className="min-h-full">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-2 md:px-6 flex flex-wrap items-center justify-between gap-2 text-xs">
        <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
          <Link href="/app/schedule">← Weekly operations schedule</Link>
        </Button>
      </div>
      <header className="border-b border-border/60 bg-[var(--app-bg)]/90 backdrop-blur-md px-6 py-6 md:px-8 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Shift checklist tools
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">Schedule · Checklists</h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-xl">
              Create shifts for a single day, then generate a secure checklist link for each employee.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/app/schedule?tab=checklists&date=${format(prev, "yyyy-MM-dd")}`}>Previous day</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/app/schedule?tab=checklists&date=${format(next, "yyyy-MM-dd")}`}>Next day</Link>
            </Button>
          </div>
        </div>
        <form method="get" className="flex flex-wrap gap-2 items-center text-sm">
          <input type="hidden" name="tab" value="checklists" />
          <label className="text-muted-foreground">Date</label>
          <input
            type="date"
            name="date"
            defaultValue={dateStr}
            className="rounded-md border border-input bg-background px-2 py-1.5"
          />
          <Button type="submit" size="sm" variant="secondary">
            Go
          </Button>
        </form>
      </header>

      <div className="p-6 grid gap-8 lg:grid-cols-2 max-w-6xl">
        <section className="rounded-md border border-border/60 p-4 space-y-3">
          <p className="text-sm font-medium">Add shift</p>
          <form action={createEmployeeShiftFormAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="shift_date" value={dateStr} />
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm">Employee</label>
              <select
                name="employee_id"
                required
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                {(employees ?? []).map((e) => (
                  <option key={e.id as string} value={e.id as string}>
                    {e.full_name as string}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm">Role for this shift</label>
              <select
                name="staff_role_id"
                required
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                {(roles ?? []).map((r) => (
                  <option key={r.id as string} value={r.id as string}>
                    {r.name as string}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm">Location (optional)</label>
              <select name="location_id" className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                <option value="">Any / not set</option>
                {(locations ?? []).map((l) => (
                  <option key={l.id as string} value={l.id as string}>
                    {l.name as string}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm">Shift type</label>
              <select
                name="shift_type"
                required
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                <option value="open">Open</option>
                <option value="mid">Mid</option>
                <option value="close">Close</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="flex items-end sm:col-span-2">
              <Button type="submit">Add shift</Button>
            </div>
          </form>
        </section>

        <section className="space-y-3">
          <p className="text-sm font-medium">Shifts on {dateStr}</p>
          {(shifts ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No shifts for this day.</p>
          ) : (
            <ul className="space-y-3">
              {(shifts ?? []).map((s) => {
                const run = runByShift.get(s.id as string) ?? null;
                const contact = empContact.get(s.employee_id as string) ?? {
                  phonePresent: false,
                  emailPresent: false,
                };
                const deliveryHints =
                  run != null
                    ? buildDeliveryChannelHints({
                        orgSendSms: deliverySettings.send_sms,
                        orgSendEmail: deliverySettings.send_email,
                        phonePresent: contact.phonePresent,
                        emailPresent: contact.emailPresent,
                        latest: latestDeliveriesSchedule.get(run.id) ?? {},
                      })
                    : [];
                return (
                  <li key={s.id as string} className="rounded-md border border-border/60 p-3 space-y-2">
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <div className="font-medium">{empName.get(s.employee_id as string) ?? "Employee"}</div>
                        <div className="text-xs text-muted-foreground">
                          {roleName.get(s.staff_role_id as string) ?? "Role"} ·{" "}
                          {SHIFT_LABEL[String(s.shift_type)] ?? s.shift_type}
                        </div>
                      </div>
                      <Badge variant="outline">{String(s.status)}</Badge>
                    </div>
                    <ShiftQuickActions shiftId={s.id as string} run={run} deliveryHints={deliveryHints} />
                    <form action={deleteEmployeeShiftFormAction}>
                      <input type="hidden" name="id" value={s.id as string} />
                      <Button type="submit" size="sm" variant="ghost" className="text-destructive h-8 px-2">
                        Delete shift
                      </Button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
