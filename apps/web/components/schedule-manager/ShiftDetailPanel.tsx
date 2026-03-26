"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ShiftDetailMock } from "./mock-data";
import { EmployeeFitSummaryCard } from "./EmployeeFitSummaryCard";
import { FairnessAdvisorCard } from "./FairnessAdvisorCard";

export interface ShiftDetailPanelProps {
  detail: ShiftDetailMock | null;
  className?: string;
}

const swapStatusClass: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-900 dark:text-amber-100",
  approved: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100",
  denied: "bg-muted text-muted-foreground",
};

export function ShiftDetailPanel({ detail, className }: ShiftDetailPanelProps) {
  if (!detail) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-center text-sm text-muted-foreground",
          className
        )}
      >
        Select a shift in the grid to inspect coverage, swaps, and fairness context.
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="rounded-lg border border-border/70 bg-card p-4 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold leading-tight">{detail.headline}</h2>
            <p className="text-xs text-muted-foreground mt-1">{detail.subhead}</p>
          </div>
          <Badge variant="outline" className="shrink-0 capitalize">
            {detail.statusLabel}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="button" size="sm" variant="default" className="h-8 text-xs">
            Assign
          </Button>
          <Button type="button" size="sm" variant="secondary" className="h-8 text-xs">
            Edit
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs">
            Post open shift
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs">
            Approve change
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 text-xs">
            Message employee
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {/* TODO: wire — PATCH employee_shifts, workforce_requests, messaging */}
          Placeholder actions; connect to mutations and staff comms.
        </p>
      </div>

      <EmployeeFitSummaryCard fit={detail.employeeFit} />

      <div className="grid gap-3 sm:grid-cols-1">
        <Card className="border-border/60 shadow-none">
          <CardHeader className="py-3 px-3 space-y-0">
            <CardTitle className="text-sm">Coverage history</CardTitle>
            <p className="text-[11px] text-muted-foreground font-normal">Who changed what and when</p>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-2">
            {detail.coverageHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground">No history yet.</p>
            ) : (
              <ul className="space-y-2">
                {detail.coverageHistory.map((c) => (
                  <li key={c.id} className="text-xs border-l-2 border-border pl-2">
                    <span className="text-muted-foreground tabular-nums">{c.at}</span>
                    <span className="mx-1">·</span>
                    <span>{c.summary}</span>
                    <span className="text-muted-foreground"> ({c.actor})</span>
                  </li>
                ))}
              </ul>
            )}
            {/* TODO: audit_log / shift_activity where you store schedule edits */}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-none">
          <CardHeader className="py-3 px-3 space-y-0">
            <CardTitle className="text-sm">Swaps & coverage requests</CardTitle>
            <p className="text-[11px] text-muted-foreground font-normal">Visible pipeline for this slot</p>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-2">
            {detail.swapHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground">No open requests.</p>
            ) : (
              <ul className="space-y-2">
                {detail.swapHistory.map((w) => (
                  <li key={w.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                        swapStatusClass[w.status] ?? "bg-muted"
                      )}
                    >
                      {w.status}
                    </span>
                    <span className="text-muted-foreground tabular-nums">{w.at}</span>
                    <span>{w.summary}</span>
                  </li>
                ))}
              </ul>
            )}
            {/* TODO: shift_trades, shift_coverage_requests, task_transfer_requests */}
          </CardContent>
        </Card>
      </div>

      <FairnessAdvisorCard lines={detail.fairnessLines} />
    </div>
  );
}
