"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommandCard } from "./command-card";
import type { OpsSeverity, ShiftChecklistProgress } from "./mock-data";
import { ListChecks } from "lucide-react";

function worst(a: OpsSeverity, b: OpsSeverity): OpsSeverity {
  const o = { normal: 0, warning: 1, problem: 2 };
  return o[a] >= o[b] ? a : b;
}

export function ChecklistProgressCard({ items }: { items: ShiftChecklistProgress[] }) {
  const severity = items.reduce<OpsSeverity>((acc, r) => worst(acc, r.severity), "normal");

  return (
    <CommandCard
      title="Checklist progress by shift"
      eyebrow="Execution"
      severity={severity}
      badge={
        <span className="inline-flex items-center gap-1 rounded border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          <ListChecks className="h-3 w-3" />
          Runs
        </span>
      }
      dense
    >
      {/* TODO: Supabase — shift_checklist_runs + count run_items completed vs total per employee_shift_id */}
      {items.length === 0 ? (
        <p className="px-3 py-5 text-center text-xs text-muted-foreground">No runs for today yet.</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {items.map((r) => {
            const pct = r.totalTasks === 0 ? 100 : Math.round((100 * r.completedTasks) / r.totalTasks);
            return (
              <li key={r.id} className="px-3 py-2.5 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{r.displayName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.roleLabel} · {r.locationName}
                    </p>
                  </div>
                  <Badge
                    variant={
                      r.runStatus === "completed"
                        ? "success"
                        : r.severity === "warning"
                          ? "warning"
                          : "secondary"
                    }
                    className="text-[10px]"
                  >
                    {r.runStatus === "completed" ? "Done" : r.runStatus === "not_started" ? "Not started" : "Active"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/80 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono tabular-nums text-muted-foreground w-14 text-right">
                    {r.completedTasks}/{r.totalTasks}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" asChild>
                    <Link href={`/app/checklist-runs`}>View run</Link>
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[11px]" asChild>
                    <Link href={`/app/shift-ops`}>Shift ops</Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </CommandCard>
  );
}
