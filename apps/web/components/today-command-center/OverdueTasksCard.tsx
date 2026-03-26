"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommandCard, formatTimeShort } from "./command-card";
import type { OpsSeverity, OverdueTask } from "./mock-data";

function worst(a: OpsSeverity, b: OpsSeverity): OpsSeverity {
  const o = { normal: 0, warning: 1, problem: 2 };
  return o[a] >= o[b] ? a : b;
}

export function OverdueTasksCard({ items }: { items: OverdueTask[] }) {
  const severity = items.reduce<OpsSeverity>((acc, r) => worst(acc, r.severity), "normal");

  return (
    <CommandCard
      title="Overdue tasks"
      eyebrow="Execution"
      severity={severity}
      badge={
        items.length > 0 ? (
          <Badge variant="destructive" className="text-[10px]">
            {items.length} overdue
          </Badge>
        ) : (
          <Badge variant="success" className="text-[10px]">
            None
          </Badge>
        )
      }
      dense
    >
      {/* TODO: Supabase — shift_checklist_run_items where not completed and due_at < now(); join assignee */}
      {items.length === 0 ? (
        <p className="px-3 py-5 text-center text-xs text-muted-foreground">Nothing past due on active runs.</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {items.map((t) => (
            <li key={t.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug">{t.taskText}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{t.assigneeName}</p>
                <p className="text-[10px] font-mono text-destructive mt-1">
                  Due {formatTimeShort(t.dueBy)} · +{t.minutesOver}m
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1">
                <Button size="sm" variant="default" className="h-8 text-xs" asChild>
                  <Link href="/app/shift-ops">Reassign</Link>
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                  <Link href="/app/checklist-runs">Review</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </CommandCard>
  );
}
