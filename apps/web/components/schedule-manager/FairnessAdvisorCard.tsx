"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FairnessAdvisorLineMock } from "./mock-data";

export interface FairnessAdvisorCardProps {
  lines: FairnessAdvisorLineMock[];
  className?: string;
}

export function FairnessAdvisorCard({ lines, className }: FairnessAdvisorCardProps) {
  return (
    <Card className={cn("border-dashed border-primary/25 bg-primary/[0.03] shadow-none", className)}>
      <CardHeader className="py-3 px-3 space-y-0">
        <CardTitle className="text-xs font-semibold flex items-center gap-2">
          <span className="rounded-sm bg-primary/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-primary">
            Advisory
          </span>
          Fairness context
        </CardTitle>
        <p className="text-[11px] text-muted-foreground font-normal mt-1">
          Does not block scheduling — use when rebalancing or explaining decisions.
        </p>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 space-y-2">
        {lines.length === 0 ? (
          <p className="text-xs text-muted-foreground">No fairness notes for this shift.</p>
        ) : (
          <ul className="space-y-1.5">
            {lines.map((l) => (
              <li key={l.id} className="text-xs leading-relaxed text-foreground/90 pl-2 border-l-2 border-primary/30">
                {l.text}
              </li>
            ))}
          </ul>
        )}
        <p className="text-[10px] text-muted-foreground">
          {/* TODO: Supabase — fairness_assignment_ledger, shift pickup counts, consecutive late shifts */}
        </p>
      </CardContent>
    </Card>
  );
}
