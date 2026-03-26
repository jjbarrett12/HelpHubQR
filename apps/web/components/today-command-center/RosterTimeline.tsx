"use client";

import { CommandCard } from "./command-card";
import type { RosterTimelineBlock } from "./mock-data";
import { cn } from "@/lib/utils";

const toneBg: Record<RosterTimelineBlock["blocks"][0]["tone"], string> = {
  work: "bg-primary/70 dark:bg-primary/50",
  break: "bg-amber-500/40 dark:bg-amber-500/30",
  off: "bg-muted",
};

/** Simple 6am–10pm strip (mock scale). TODO: Supabase — build from employee_shifts + breaks table. */
export function RosterTimeline({ blocks }: { blocks: RosterTimelineBlock[] }) {
  const dayStart = 6;
  const dayEnd = 22;
  const range = dayEnd - dayStart;

  return (
    <CommandCard title="Roster timeline" eyebrow="Today" severity="normal" dense>
      <div className="overflow-x-auto px-2 pb-2">
        <div className="flex min-w-[640px] gap-4 pt-1">
          <div className="w-28 shrink-0" />
          <div className="relative flex-1 border-b border-border/50 pb-1">
            <div className="flex justify-between text-[9px] font-mono text-muted-foreground px-0.5">
              {Array.from({ length: 5 }, (_, i) => {
                const h = dayStart + Math.round((i * range) / 4);
                return (
                  <span key={h}>{h > 12 ? h - 12 : h}{h >= 12 ? "p" : "a"}</span>
                );
              })}
            </div>
          </div>
        </div>
        <ul className="space-y-2 min-w-[640px]">
          {blocks.map((row) => (
            <li key={row.id} className="flex gap-4 items-center">
              <div className="w-28 shrink-0">
                <p className="text-xs font-medium truncate">{row.displayName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{row.roleLabel}</p>
              </div>
              <div className="relative h-8 flex-1 rounded-lg bg-muted/40 ring-1 ring-inset ring-border/40 overflow-hidden">
                {row.blocks.map((b, idx) => {
                  const left = ((b.startHour - dayStart) / range) * 100;
                  const width = ((b.endHour - b.startHour) / range) * 100;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "absolute top-1 bottom-1 rounded-sm flex items-center justify-center text-[9px] font-medium text-primary-foreground overflow-hidden px-0.5",
                        toneBg[b.tone]
                      )}
                      style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(0.5, width)}%` }}
                      title={`${b.label}`}
                    >
                      <span className="truncate">{b.label}</span>
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      </div>
      {/* TODO: realtime — subscribe to employee_shifts changes for org */}
    </CommandCard>
  );
}
