"use client";

import { cn } from "@/lib/utils";
import type { ManagerRequestListItem, RequestKind } from "./mock-data";
import { REQUEST_KIND_LABEL } from "./mock-data";

export interface SummaryCounts {
  totalOpen: number;
  needsManager: number;
  urgent: number;
  byKind: Record<RequestKind, number>;
}

function buildSummary(requests: ManagerRequestListItem[]): SummaryCounts {
  const open = requests.filter(
    (r) =>
      r.status === "pending_manager" ||
      r.status === "pending_peer" ||
      r.status === "pending_employee"
  );
  const byKind = {
    shift_swap: 0,
    coverage: 0,
    open_shift_pickup: 0,
    task_transfer: 0,
    schedule_change: 0,
    availability_change: 0,
  } as Record<RequestKind, number>;
  for (const r of open) {
    byKind[r.kind] += 1;
  }
  return {
    totalOpen: open.length,
    needsManager: open.filter((r) => r.needsManagerAction).length,
    urgent: open.filter((r) => r.urgency === "urgent").length,
    byKind,
  };
}

export function RequestsSummaryBar({
  requests,
  onFilterKind,
  activeKind,
}: {
  requests: ManagerRequestListItem[];
  onFilterKind: (kind: RequestKind | "all") => void;
  activeKind: RequestKind | "all";
}) {
  const s = buildSummary(requests);
  const kinds = Object.keys(REQUEST_KIND_LABEL) as RequestKind[];

  return (
    <div className="border-b border-border/60 bg-muted/25 px-4 py-3 md:px-6">
      <div className="flex flex-wrap items-stretch gap-2 md:gap-3">
        <button
          type="button"
          onClick={() => onFilterKind("all")}
          className={cn(
            "rounded-lg border px-3 py-2 text-left transition-colors min-w-[120px]",
            activeKind === "all"
              ? "border-primary bg-primary/10"
              : "border-border/70 bg-background/80 hover:bg-muted/50"
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Open</p>
          <p className="text-xl font-bold tabular-nums">{s.totalOpen}</p>
        </button>
        <div
          className="rounded-lg border border-border/70 bg-background/80 px-3 py-2 min-w-[120px]"
          title="Awaiting your decision"
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Your queue</p>
          <p className="text-xl font-bold tabular-nums text-amber-900 dark:text-amber-100">{s.needsManager}</p>
        </div>
        <div
          className={cn(
            "rounded-lg border px-3 py-2 min-w-[100px]",
            s.urgent > 0
              ? "border-red-500/40 bg-red-500/[0.08]"
              : "border-border/70 bg-background/80"
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Urgent</p>
          <p className="text-xl font-bold tabular-nums text-red-700 dark:text-red-300">{s.urgent}</p>
        </div>
        <div className="flex flex-1 flex-wrap gap-1.5 items-center min-w-0">
          {kinds.map((k) => {
            const n = s.byKind[k];
            if (n === 0) return null;
            return (
              <button
                key={k}
                type="button"
                onClick={() => onFilterKind(k)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  activeKind === k
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border/60 bg-background/70 text-muted-foreground hover:text-foreground"
                )}
              >
                {REQUEST_KIND_LABEL[k]}{" "}
                <span className="tabular-nums text-foreground">{n}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">
        {/* TODO: Supabase — aggregate counts from shift_trade_offers, shift_coverage_requests, shift_task_transfer_requests */}
        Counts from inbox payload; tap a type to filter the list.
      </p>
    </div>
  );
}
