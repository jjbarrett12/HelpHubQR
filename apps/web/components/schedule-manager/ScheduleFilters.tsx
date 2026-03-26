"use client";

import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ScheduleViewMode = "week" | "day" | "role";

export interface ScheduleFiltersProps {
  weekStartsOn: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  viewMode: ScheduleViewMode;
  onViewMode: (m: ScheduleViewMode) => void;
  /** yyyy-MM-dd within current week for day view */
  focusDay: string;
  onFocusDay: (date: string) => void;
  dayOptions: { date: string; label: string }[];
  roleFilter: string;
  onRoleFilter: (id: string) => void;
  locationFilter: string;
  onLocationFilter: (id: string) => void;
  roleOptions: { id: string; name: string }[];
  locationOptions: { id: string; name: string }[];
  className?: string;
}

export function ScheduleFilters({
  weekStartsOn,
  onPrevWeek,
  onNextWeek,
  onToday,
  viewMode,
  onViewMode,
  focusDay,
  onFocusDay,
  dayOptions,
  roleFilter,
  onRoleFilter,
  locationFilter,
  onLocationFilter,
  roleOptions,
  locationOptions,
  className,
}: ScheduleFiltersProps) {
  const weekEnd = dayOptions[6]?.date ?? weekStartsOn;
  const rangeLabel =
    weekStartsOn && weekEnd
      ? `${format(new Date(weekStartsOn + "T12:00:00"), "MMM d")} – ${format(new Date(weekEnd + "T12:00:00"), "MMM d, yyyy")}`
      : "";

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Week
        </p>
        <p className="text-sm font-medium mt-1 tabular-nums">{rangeLabel}</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onPrevWeek}>
            Prev
          </Button>
          <Button type="button" variant="secondary" size="sm" className="h-8 text-xs" onClick={onToday}>
            This week
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onNextWeek}>
            Next
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">View</Label>
        <div className="grid grid-cols-3 gap-1">
          {(
            [
              ["week", "Week"],
              ["day", "Day"],
              ["role", "Role / station"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={viewMode === key ? "default" : "outline"}
              className="h-8 text-[11px] px-1"
              onClick={() => onViewMode(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {viewMode === "day" && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Day</Label>
          <Select value={focusDay} onValueChange={onFocusDay}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Pick day" />
            </SelectTrigger>
            <SelectContent>
              {dayOptions.map((d) => (
                <SelectItem key={d.date} value={d.date} className="text-xs">
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Role</Label>
        <Select value={roleFilter} onValueChange={onRoleFilter}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              All roles
            </SelectItem>
            {roleOptions.map((r) => (
              <SelectItem key={r.id} value={r.id} className="text-xs">
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Location / station</Label>
        <Select value={locationFilter} onValueChange={onLocationFilter}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="All locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              All locations
            </SelectItem>
            {locationOptions.map((l) => (
              <SelectItem key={l.id} value={l.id} className="text-xs">
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-[10px] text-muted-foreground leading-relaxed">
        {/* TODO: Supabase — filter shifts by staff_role_id, location_id; week from employee_shifts.shift_date */}
        Filters are client-side on mock data. Wire selects to query params or server loader.
      </div>
    </div>
  );
}
