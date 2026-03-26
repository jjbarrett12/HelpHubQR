"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CommandCard, formatTimeShort } from "./command-card";
import type { NextUpShift } from "./mock-data";
import { Clock } from "lucide-react";

export function NextUpCard({ items }: { items: NextUpShift[] }) {
  return (
    <CommandCard
      title="Next up today"
      eyebrow="Staffing"
      severity="normal"
      badge={
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          Scheduled
        </span>
      }
      dense
    >
      {/* TODO: Supabase — employee_shifts where shift_date = today and start_time > now(), ordered */}
      {items.length === 0 ? (
        <p className="px-3 py-5 text-center text-xs text-muted-foreground">No upcoming starts in the next window.</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {items.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{s.displayName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {s.roleLabel} · {s.locationName} · {s.shiftTypeLabel}
                </p>
                <p className="text-[11px] font-mono text-foreground/80 mt-1">Starts {formatTimeShort(s.startsAt)}</p>
              </div>
              <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" asChild>
                <Link href="/app/schedule">Open schedule</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </CommandCard>
  );
}
