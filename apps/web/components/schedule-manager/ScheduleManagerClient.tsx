"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { buildMockWeek } from "./mock-data";
import type { ScheduleShiftMock } from "./mock-data";
import { ScheduleFilters, type ScheduleViewMode } from "./ScheduleFilters";
import { WeekScheduleGrid } from "./WeekScheduleGrid";
import { OpenShiftsPanel } from "./OpenShiftsPanel";
import { StaffingAlertsCard } from "./StaffingAlertsCard";
import { ShiftDetailPanel } from "./ShiftDetailPanel";
import { addWeeks, mondayOfWeekContaining, parseWeekParam } from "./schedule-week-utils";

function cellKey(rowId: string, date: string) {
  return `${rowId}|${date}`;
}

export interface ScheduleManagerClientProps {
  initialWeekMonday: string;
  organizationLabel?: string;
}

export function ScheduleManagerClient({ initialWeekMonday, organizationLabel }: ScheduleManagerClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const weekFromUrl = parseWeekParam(searchParams.get("week"));
  const weekStartsOn = weekFromUrl ?? initialWeekMonday;

  const setWeek = useCallback(
    (monday: string) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("week", monday);
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const [viewMode, setViewMode] = useState<ScheduleViewMode>("week");
  const [focusDay, setFocusDay] = useState<string>(() => weekStartsOn);
  const [roleFilter, setRoleFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  const data = useMemo(() => buildMockWeek(weekStartsOn), [weekStartsOn]);

  useEffect(() => {
    const inWeek = data.days.some((d) => d.date === focusDay);
    if (!inWeek) setFocusDay(data.days[0]?.date ?? weekStartsOn);
  }, [data.days, focusDay, weekStartsOn]);

  const dayOptions = useMemo(
    () =>
      data.days.map((d) => ({
        date: d.date,
        label: `${d.weekdayShort} ${format(new Date(d.date + "T12:00:00"), "MMM d")}`,
      })),
    [data.days]
  );

  const roleOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of data.rows) m.set(r.roleId, r.roleName);
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [data.rows]);

  const locationOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of data.rows) m.set(r.locationId, r.locationName);
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [data.rows]);

  const filteredRows = useMemo(() => {
    return data.rows.filter((r) => {
      if (roleFilter !== "all" && r.roleId !== roleFilter) return false;
      if (locationFilter !== "all" && r.locationId !== locationFilter) return false;
      return true;
    });
  }, [data.rows, roleFilter, locationFilter]);

  const shiftsByRowAndDay = useMemo(() => {
    const map = new Map<string, ScheduleShiftMock[]>();
    const allowedRow = new Set(filteredRows.map((r) => r.id));
    for (const s of data.shifts) {
      if (!allowedRow.has(s.rowId)) continue;
      const k = cellKey(s.rowId, s.date);
      const list = map.get(k) ?? [];
      list.push(s);
      map.set(k, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.timeWindow.localeCompare(b.timeWindow));
    }
    return map;
  }, [data.shifts, filteredRows]);

  const shiftByEmployeeShiftId = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of data.shifts) m.set(s.employeeShiftId, s.id);
    return m;
  }, [data.shifts]);

  const detail = selectedShiftId ? data.shiftDetails[selectedShiftId] ?? null : null;

  const onPrevWeek = () => setWeek(addWeeks(weekStartsOn, -1));
  const onNextWeek = () => setWeek(addWeeks(weekStartsOn, 1));
  const onToday = () => setWeek(mondayOfWeekContaining(new Date()));

  const gridLayout = viewMode === "role" ? ("dayThenTrack" as const) : ("trackThenDay" as const);

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-border/60 bg-[var(--app-bg)]/90 backdrop-blur-md px-4 py-4 md:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Workforce schedule
            </p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight md:text-3xl">Schedule</h1>
            {organizationLabel ? (
              <p className="mt-1 text-sm text-muted-foreground">{organizationLabel}</p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
                Plan coverage, see open shifts, and act on staffing risk — mock data until Supabase is wired.
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 grid gap-4 p-4 md:p-6 lg:grid-cols-[minmax(240px,280px)_1fr_minmax(280px,360px)] lg:gap-0 lg:divide-x lg:divide-border/60">
        <aside className="lg:pr-4 space-y-4 min-w-0">
          <ScheduleFilters
            weekStartsOn={weekStartsOn}
            onPrevWeek={onPrevWeek}
            onNextWeek={onNextWeek}
            onToday={onToday}
            viewMode={viewMode}
            onViewMode={setViewMode}
            focusDay={focusDay}
            onFocusDay={setFocusDay}
            dayOptions={dayOptions}
            roleFilter={roleFilter}
            onRoleFilter={setRoleFilter}
            locationFilter={locationFilter}
            onLocationFilter={setLocationFilter}
            roleOptions={roleOptions}
            locationOptions={locationOptions}
          />
          <OpenShiftsPanel
            openShifts={data.openShifts}
            unassigned={data.unassigned}
            onPickShiftFromOpen={(esid) => {
              const id = shiftByEmployeeShiftId.get(esid);
              if (id) setSelectedShiftId(id);
            }}
          />
          <StaffingAlertsCard
            alerts={data.alerts}
            onAlertClick={(sid) => sid && setSelectedShiftId(sid)}
          />
        </aside>

        <main className="lg:px-4 min-w-0 py-2 lg:py-0">
          <WeekScheduleGrid
            viewMode={viewMode}
            days={data.days}
            focusDay={focusDay}
            rows={filteredRows}
            shiftsByRowAndDay={shiftsByRowAndDay}
            selectedShiftId={selectedShiftId}
            onSelectShift={setSelectedShiftId}
            layout={gridLayout}
          />
        </main>

        <aside className="lg:pl-4 min-w-0 space-y-3 pb-8">
          <ShiftDetailPanel detail={detail} />
        </aside>
      </div>
    </div>
  );
}
