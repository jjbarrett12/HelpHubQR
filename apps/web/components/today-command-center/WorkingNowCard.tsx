"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommandCard, formatTimeShort } from "./command-card";
import type { OpsSeverity, WorkingNowPerson } from "./mock-data";
import { MessageSquare, UserRound } from "lucide-react";

function worst(a: OpsSeverity, b: OpsSeverity): OpsSeverity {
  const o = { normal: 0, warning: 1, problem: 2 };
  return o[a] >= o[b] ? a : b;
}

export function WorkingNowCard({ items }: { items: WorkingNowPerson[] }) {
  const severity = items.reduce<OpsSeverity>((acc, r) => worst(acc, r.severity), "normal");

  return (
    <CommandCard
      title="Working now"
      eyebrow="Staffing"
      severity={severity}
      badge={
        items.length > 0 ? (
          <Badge variant="secondary" className="text-[10px] tabular-nums">
            {items.length} on floor
          </Badge>
        ) : null
      }
      dense
    >
      {/* TODO: Supabase — employee_shifts for today where status = active / in_progress; join employees, locations */}
      {items.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">No active shifts in this window.</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {items.map((p) => (
            <li key={p.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm text-foreground">{p.displayName}</span>
                  {p.severity === "problem" ? (
                    <Badge variant="destructive" className="text-[10px]">
                      Attention
                    </Badge>
                  ) : p.severity === "warning" ? (
                    <Badge variant="warning" className="text-[10px]">
                      Behind
                    </Badge>
                  ) : null}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {p.roleLabel} · {p.locationName} · {p.shiftTypeLabel} · since {formatTimeShort(p.startedAt)}
                </p>
                <p className="text-[11px] font-mono text-muted-foreground mt-1">
                  Checklist {p.checklistProgress.done}/{p.checklistProgress.total}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1">
                <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                  <Link href={`/app/shift-ops?highlight=${encodeURIComponent(p.employeeId)}`}>View shift</Link>
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" type="button" title="TODO: wire messaging">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Message
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" type="button" title="TODO: employee profile">
                  <UserRound className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </CommandCard>
  );
}
