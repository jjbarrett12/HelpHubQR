"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { EmployeeFitSummaryMock } from "./mock-data";

export interface EmployeeFitSummaryCardProps {
  fit: EmployeeFitSummaryMock | null;
  className?: string;
}

export function EmployeeFitSummaryCard({ fit, className }: EmployeeFitSummaryCardProps) {
  if (!fit) {
    return (
      <Card className={cn("border-border/60 shadow-none", className)}>
        <CardHeader className="py-3 px-3">
          <CardTitle className="text-sm">Assignee</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 text-xs text-muted-foreground">
          No employee assigned — pick someone to see availability and preferences.
          {/* TODO: Supabase — employees + employee_availability + preferences */}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-border/60 shadow-none", className)}>
      <CardHeader className="py-3 px-3 space-y-0">
        <CardTitle className="text-sm">{fit.displayName}</CardTitle>
        <p className="text-[11px] text-muted-foreground font-normal mt-0.5">{fit.roleName}</p>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-2 text-xs">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Availability</p>
          <p className="mt-0.5 leading-snug">{fit.availabilityNote}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Preferences</p>
          <p className="mt-0.5 leading-snug">{fit.preferenceSummary}</p>
        </div>
        <div className="flex flex-wrap gap-3 pt-1 border-t border-border/50">
          <div>
            <p className="text-[10px] text-muted-foreground">Hours this week</p>
            <p className="font-semibold tabular-nums">{fit.hoursThisWeek}h</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Last same role</p>
            <p className="font-medium">{fit.lastWorkedSameRole ?? "—"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
