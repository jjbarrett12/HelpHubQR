"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CommandCard } from "./command-card";
import type { FairnessAlertRow, OpsSeverity } from "./mock-data";
import { Scale } from "lucide-react";

function worst(a: OpsSeverity, b: OpsSeverity): OpsSeverity {
  const o = { normal: 0, warning: 1, problem: 2 };
  return o[a] >= o[b] ? a : b;
}

export function FairnessAlertsCard({ items }: { items: FairnessAlertRow[] }) {
  const severity = items.reduce<OpsSeverity>((acc, r) => worst(acc, r.severity), "normal");

  return (
    <CommandCard
      title="Fairness alerts"
      eyebrow="Actions · advisory"
      severity={severity}
      badge={
        <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400/90">
          <Scale className="h-3 w-3" />
          Intel only
        </span>
      }
      dense
    >
      {/* TODO: Supabase — fairness_assignment_ledger rollups / thresholds; never block assignments from this card */}
      <p className="px-3 pt-2 pb-1 text-[10px] text-muted-foreground border-b border-border/40">
        Advisory signals — not enforcement. Use to balance workload over time.
      </p>
      {items.length === 0 ? (
        <p className="px-3 py-5 text-center text-xs text-muted-foreground">No advisory flags in the current window.</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {items.map((f) => (
            <li key={f.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm text-foreground leading-snug">{f.message}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {f.employeeName ? `${f.employeeName}` : "Team"}
                  {f.taskKeyLabel ? ` · ${f.taskKeyLabel}` : ""}
                </p>
              </div>
              <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" asChild>
                <Link href="/app/fairness">Drill down</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </CommandCard>
  );
}
