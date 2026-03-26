"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommandCard, formatRelativeMinutes } from "./command-card";
import type { AttendanceFlag, OpsSeverity } from "./mock-data";

function worst(a: OpsSeverity, b: OpsSeverity): OpsSeverity {
  const o = { normal: 0, warning: 1, problem: 2 };
  return o[a] >= o[b] ? a : b;
}

const flagLabel: Record<AttendanceFlag["flagType"], string> = {
  late: "Late",
  no_show: "No-show",
  unscheduled: "Unscheduled",
  early_leave: "Early leave",
};

export function AttendanceFlagsCard({ items }: { items: AttendanceFlag[] }) {
  const severity = items.reduce<OpsSeverity>((acc, r) => worst(acc, r.severity), "normal");

  return (
    <CommandCard
      title="Attendance flags"
      eyebrow="Staffing"
      severity={severity}
      badge={
        items.length > 0 ? (
          <Badge variant={severity === "problem" ? "destructive" : "warning"} className="text-[10px]">
            {items.length} open
          </Badge>
        ) : (
          <Badge variant="success" className="text-[10px]">
            Clear
          </Badge>
        )
      }
      dense
    >
      {/* TODO: Supabase — compare scheduled employee_shifts vs actual clock/presence signals; rules engine */}
      {items.length === 0 ? (
        <p className="px-3 py-5 text-center text-xs text-muted-foreground">No attendance exceptions right now.</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {items.map((f) => (
            <li key={f.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{f.displayName}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {flagLabel[f.flagType]}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{f.detail}</p>
                <p className="text-[10px] font-mono text-muted-foreground mt-1">{formatRelativeMinutes(f.since)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1">
                <Button size="sm" variant="default" className="h-8 text-xs" asChild>
                  <Link href={`/app/shift-ops?shift=${encodeURIComponent(f.employeeShiftId)}`}>Resolve</Link>
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" type="button" title="TODO: coverage flow">
                  Coverage
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </CommandCard>
  );
}
