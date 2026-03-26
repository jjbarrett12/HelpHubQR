"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StaffingAlertMock } from "./mock-data";

export interface StaffingAlertsCardProps {
  alerts: StaffingAlertMock[];
  onAlertClick?: (relatedShiftId: string | undefined) => void;
  className?: string;
}

export function StaffingAlertsCard({ alerts, onAlertClick, className }: StaffingAlertsCardProps) {
  return (
    <Card className={cn("border-border/70 shadow-none", className)}>
      <CardHeader className="py-3 px-3 space-y-0">
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Quick staffing alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 space-y-2">
        {alerts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No flagged issues for this week.</p>
        ) : (
          alerts.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={!a.relatedShiftId}
              onClick={() => a.relatedShiftId && onAlertClick?.(a.relatedShiftId)}
              className={cn(
                "w-full text-left rounded-md border px-2.5 py-2 transition-colors",
                a.severity === "problem"
                  ? "border-red-500/35 bg-red-500/[0.06]"
                  : "border-amber-500/35 bg-amber-500/[0.06]",
                a.relatedShiftId && "hover:opacity-90 cursor-pointer",
                !a.relatedShiftId && "cursor-default opacity-95"
              )}
            >
              <div className="text-xs font-semibold">{a.title}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{a.detail}</p>
            </button>
          ))
        )}
        <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">
          {/* TODO: Supabase — compute from employee_shifts gaps, overlap detection, SLA / min coverage rules */}
          Advisory signals only; managers decide.
        </p>
      </CardContent>
    </Card>
  );
}
