"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommandCard } from "./command-card";
import type { OpsSeverity, OpenShiftRow } from "./mock-data";
import { DoorOpen } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

function worst(a: OpsSeverity, b: OpsSeverity): OpsSeverity {
  const o = { normal: 0, warning: 1, problem: 2 };
  return o[a] >= o[b] ? a : b;
}

export function OpenShiftsCard({ items }: { items: OpenShiftRow[] }) {
  const severity = items.reduce<OpsSeverity>((acc, r) => worst(acc, r.severity), "normal");

  return (
    <CommandCard
      title="Open shifts"
      eyebrow="Actions"
      severity={severity}
      badge={
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <DoorOpen className="h-3 w-3" />
          Claims
        </span>
      }
      dense
    >
      {/* TODO: Supabase — employee_shifts where is_open_for_claim or status; count pending claims */}
      {items.length === 0 ? (
        <div className="px-2 py-2">
          <EmptyState
            icon={DoorOpen}
            title="No open shifts"
            description="Postings will show here when shifts need coverage."
            className="border-border/50 bg-transparent py-10"
          />
        </div>
      ) : (
        <ul className="divide-y divide-border/50">
          {items.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {s.roleLabel} · {s.locationName}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{s.windowLabel}</p>
                <Badge variant="secondary" className="mt-1.5 text-[10px]">
                  {s.claimCount} claim{s.claimCount === 1 ? "" : "s"}
                </Badge>
              </div>
              <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" asChild>
                <Link href="/app/shift-ops">Assign / review</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </CommandCard>
  );
}
