"use client";

import { cn } from "@/lib/utils";
import type { ScheduleShiftMock, ShiftBlockVisualStatus } from "./mock-data";

const statusStyles: Record<ShiftBlockVisualStatus, string> = {
  assigned:
    "border-l-[3px] border-l-emerald-500 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.12]",
  unassigned:
    "border-l-[3px] border-l-amber-500 border-dashed bg-amber-500/[0.1] hover:bg-amber-500/[0.14]",
  open_claim:
    "border-l-[3px] border-l-sky-500 bg-sky-500/[0.1] hover:bg-sky-500/[0.14]",
  active_now:
    "border-l-[3px] border-l-violet-500 ring-1 ring-violet-500/40 bg-violet-500/[0.1] hover:bg-violet-500/[0.14]",
  completed:
    "border-l-[3px] border-l-zinc-400 bg-muted/40 opacity-90 hover:opacity-100",
  conflict:
    "border-l-[3px] border-l-red-500 bg-red-500/[0.12] ring-1 ring-red-500/30 hover:bg-red-500/[0.16]",
  late_start:
    "border-l-[3px] border-l-orange-500 bg-orange-500/[0.1] hover:bg-orange-500/[0.14]",
};

export interface ShiftBlockProps {
  shift: ScheduleShiftMock;
  selected: boolean;
  onSelect: (shiftId: string) => void;
  compact?: boolean;
}

export function ShiftBlock({ shift, selected, onSelect, compact }: ShiftBlockProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(shift.id)}
      className={cn(
        "w-full text-left rounded-md border border-border/70 px-2 py-1.5 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        statusStyles[shift.visualStatus],
        selected && "ring-2 ring-primary ring-offset-1 ring-offset-background"
      )}
    >
      <div className={cn("font-semibold text-foreground leading-tight", compact ? "text-[11px]" : "text-xs")}>
        {shift.employeeName ?? "Unassigned"}
      </div>
      <div className={cn("text-muted-foreground mt-0.5", compact ? "text-[10px]" : "text-[11px]")}>
        {shift.timeWindow}
      </div>
      {!compact && (
        <div className="text-[10px] text-muted-foreground/90 mt-0.5 uppercase tracking-wide">
          {shift.label}
        </div>
      )}
    </button>
  );
}
