"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { OpenShiftRowMock, UnassignedShiftMock } from "./mock-data";

export interface OpenShiftsPanelProps {
  openShifts: OpenShiftRowMock[];
  unassigned: UnassignedShiftMock[];
  onPickShiftFromOpen: (employeeShiftId: string) => void;
  className?: string;
}

function severityBadge(sev: OpenShiftRowMock["severity"]) {
  if (sev === "problem") return "destructive" as const;
  if (sev === "warning") return "secondary" as const;
  return "outline" as const;
}

export function OpenShiftsPanel({
  openShifts,
  unassigned,
  onPickShiftFromOpen,
  className,
}: OpenShiftsPanelProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <section>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Open shifts
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Posted for claim or pickup — visibility only; approvals elsewhere.
        </p>
        <ul className="mt-2 space-y-2">
          {openShifts.length === 0 ? (
            <li className="text-xs text-muted-foreground py-2">No open shifts this week.</li>
          ) : (
            openShifts.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => onPickShiftFromOpen(o.employeeShiftId)}
                  className={cn(
                    "w-full text-left rounded-md border border-border/70 px-2.5 py-2 transition-colors",
                    "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold">{o.roleName}</div>
                      <div className="text-[11px] text-muted-foreground">{o.locationName}</div>
                      <div className="text-[11px] tabular-nums mt-0.5">{o.date} · {o.windowLabel}</div>
                    </div>
                    <Badge variant={severityBadge(o.severity)} className="shrink-0 text-[10px]">
                      {o.claimsPending} claims
                    </Badge>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Unassigned shifts
        </p>
        <ul className="mt-2 space-y-2">
          {unassigned.length === 0 ? (
            <li className="text-xs text-muted-foreground py-2">All slots have an assignee.</li>
          ) : (
            unassigned.map((u) => (
              <li
                key={u.id}
                className="rounded-md border border-dashed border-amber-500/40 bg-amber-500/[0.06] px-2.5 py-2"
              >
                <div className="text-xs font-semibold">{u.roleName}</div>
                <div className="text-[11px] text-muted-foreground">{u.locationName}</div>
                <div className="text-[11px] mt-0.5 tabular-nums">
                  {u.date} · {u.shiftType}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">{u.reason}</div>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
