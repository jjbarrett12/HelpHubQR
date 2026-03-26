"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CommandCard, formatRelativeMinutes } from "./command-card";
import type { RecentlyCompletedShift } from "./mock-data";
import { CheckCircle2 } from "lucide-react";

export function RecentlyCompletedCard({ items }: { items: RecentlyCompletedShift[] }) {
  return (
    <CommandCard
      title="Recently completed shifts"
      eyebrow="Today"
      severity="normal"
      badge={
        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />
          Closed runs
        </span>
      }
      dense
    >
      {/* TODO: Supabase — shift_checklist_runs where status=completed and updated_at > start of day */}
      {items.length === 0 ? (
        <p className="px-3 py-5 text-center text-xs text-muted-foreground">No completions yet today.</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {items.map((r) => (
            <li key={r.id} className="flex flex-col gap-1.5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">{r.displayName}</p>
                <p className="text-[11px] text-muted-foreground">{r.roleLabel}</p>
                <p className="text-[11px] font-mono text-foreground/80 mt-0.5">{r.runSummary}</p>
                <p className="text-[10px] text-muted-foreground">{formatRelativeMinutes(r.completedAt)}</p>
              </div>
              <Button size="sm" variant="ghost" className="h-8 text-xs shrink-0" asChild>
                <Link href="/app/checklist-runs">Audit</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </CommandCard>
  );
}
