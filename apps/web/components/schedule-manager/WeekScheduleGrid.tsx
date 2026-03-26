"use client";

import { cn } from "@/lib/utils";
import type { ScheduleGridRowMock, ScheduleShiftMock } from "./mock-data";
import { ShiftBlock } from "./ShiftBlock";
import type { ScheduleViewMode } from "./ScheduleFilters";

export interface WeekScheduleGridProps {
  viewMode: ScheduleViewMode;
  days: { date: string; weekdayShort: string; dayNum: number }[];
  /** When day view, only this column */
  focusDay: string | null;
  rows: ScheduleGridRowMock[];
  shiftsByRowAndDay: Map<string, ScheduleShiftMock[]>;
  selectedShiftId: string | null;
  onSelectShift: (id: string) => void;
  /** Role/station view: days as rows, tracks as columns */
  layout?: "trackThenDay" | "dayThenTrack";
  className?: string;
}

function cellKey(rowId: string, date: string) {
  return `${rowId}|${date}`;
}

export function WeekScheduleGrid({
  viewMode,
  days,
  focusDay,
  rows,
  shiftsByRowAndDay,
  selectedShiftId,
  onSelectShift,
  layout = "trackThenDay",
  className,
}: WeekScheduleGridProps) {
  const visibleDays =
    viewMode === "day" && focusDay ? days.filter((d) => d.date === focusDay) : days;

  const trackHeader =
    viewMode === "role" ? "Role / station" : "Track";

  if (layout === "dayThenTrack") {
    return (
      <div className={cn("flex flex-col min-h-0 rounded-lg border border-border/70 bg-card overflow-hidden", className)}>
        <div
          className="grid border-b border-border/60 bg-muted/40"
          style={{
            gridTemplateColumns: `minmax(100px,0.8fr) repeat(${rows.length}, minmax(104px,1fr))`,
          }}
        >
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border-r border-border/50">
            Day
          </div>
          {rows.map((row) => (
            <div key={row.id} className="px-2 py-2 text-left border-l border-border/50 first:border-l-0">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground line-clamp-2">
                {row.roleName}
              </div>
              <div className="text-[11px] font-bold leading-tight line-clamp-2">{row.locationName}</div>
            </div>
          ))}
        </div>

        <div className="overflow-auto max-h-[min(70vh,720px)]">
          {visibleDays.map((d) => (
            <div
              key={d.date}
              className="grid border-b border-border/50 last:border-b-0"
              style={{
                gridTemplateColumns: `minmax(100px,0.8fr) repeat(${rows.length}, minmax(104px,1fr))`,
              }}
            >
              <div className="px-3 py-2 border-r border-border/50 bg-muted/20">
                <div className="text-[10px] font-semibold uppercase text-muted-foreground">{d.weekdayShort}</div>
                <div className="text-sm font-bold tabular-nums">{d.dayNum}</div>
              </div>
              {rows.map((row) => {
                const key = cellKey(row.id, d.date);
                const list = shiftsByRowAndDay.get(key) ?? [];
                return (
                  <div
                    key={key}
                    className="border-l border-border/40 first:border-l-0 p-1.5 min-h-[72px] align-top space-y-1"
                  >
                    {list.length === 0 ? (
                      <div className="h-full min-h-[56px] rounded border border-dashed border-border/50 bg-muted/10" />
                    ) : (
                      list.map((sh) => (
                        <ShiftBlock
                          key={sh.id}
                          shift={sh}
                          selected={selectedShiftId === sh.id}
                          onSelect={onSelectShift}
                          compact={list.length > 2}
                        />
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <Legend />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col min-h-0 rounded-lg border border-border/70 bg-card overflow-hidden", className)}>
      <div
        className="grid border-b border-border/60 bg-muted/40"
        style={{
          gridTemplateColumns: `minmax(140px,1fr) repeat(${visibleDays.length}, minmax(100px,1fr))`,
        }}
      >
        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border-r border-border/50">
          {trackHeader}
        </div>
        {visibleDays.map((d) => (
          <div
            key={d.date}
            className="px-2 py-2 text-center border-l border-border/50 first:border-l-0"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {d.weekdayShort}
            </div>
            <div className="text-sm font-bold tabular-nums">{d.dayNum}</div>
          </div>
        ))}
      </div>

      <div className="overflow-auto max-h-[min(70vh,720px)]">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid border-b border-border/50 last:border-b-0"
            style={{
              gridTemplateColumns: `minmax(140px,1fr) repeat(${visibleDays.length}, minmax(100px,1fr))`,
            }}
          >
            <div className="px-3 py-2 border-r border-border/50 bg-muted/20">
              <div className="text-xs font-semibold leading-tight">{row.roleName}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{row.locationName}</div>
            </div>
            {visibleDays.map((d) => {
              const key = cellKey(row.id, d.date);
              const list = shiftsByRowAndDay.get(key) ?? [];
              return (
                <div
                  key={key}
                  className="border-l border-border/40 first:border-l-0 p-1.5 min-h-[72px] align-top space-y-1"
                >
                  {list.length === 0 ? (
                    <div className="h-full min-h-[56px] rounded border border-dashed border-border/50 bg-muted/10" />
                  ) : (
                    list.map((sh) => (
                      <ShiftBlock
                        key={sh.id}
                        shift={sh}
                        selected={selectedShiftId === sh.id}
                        onSelect={onSelectShift}
                        compact={list.length > 2}
                      />
                    ))
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <Legend />
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 px-3 py-2 border-t border-border/60 bg-muted/20 text-[10px] text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Assigned
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-sm bg-amber-500" /> Unassigned
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-sm bg-sky-500" /> Open claim
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-sm bg-violet-500" /> Active
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-sm bg-red-500" /> Conflict
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-sm bg-zinc-400" /> Done
      </span>
    </div>
  );
}
