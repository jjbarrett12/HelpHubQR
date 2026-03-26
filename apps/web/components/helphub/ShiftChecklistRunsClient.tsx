"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ShiftRunStatusBadge } from "@/components/helphub/ShiftRunStatusBadge";
import { RunDeliveryActions } from "@/components/helphub/RunDeliveryActions";
import { cn } from "@/lib/utils";
import type { ShiftChecklistRunStatus } from "@/lib/helphub/types";
import type { DeliveryChannelHint } from "@/lib/delivery/delivery-status";

export type ShiftRunRow = {
  id: string;
  status: ShiftChecklistRunStatus;
  updated_at: string;
  sent_at: string | null;
  checklistName: string;
  employeeName: string;
  roleName: string;
  shiftDate: string;
  items?: Array<{ taskText: string; completed: boolean }>;
  deliveryHints?: DeliveryChannelHint[];
};

type Filter = "all" | ShiftChecklistRunStatus;

function progressApprox(status: ShiftChecklistRunStatus): number {
  if (status === "completed") return 100;
  if (status === "opened") return 55;
  if (status === "sent") return 30;
  if (status === "pending") return 0;
  return 0;
}

export function ShiftChecklistRunsClient({
  organizationName,
  runs,
  initialFilter = "all",
}: {
  organizationName: string;
  runs: ShiftRunRow[];
  initialFilter?: Filter;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>(initialFilter);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return runs.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!needle) return true;
      const hay = `${r.checklistName} ${r.employeeName} ${r.roleName} ${r.shiftDate}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [runs, q, filter]);

  const chips: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "sent", label: "Sent" },
    { id: "opened", label: "Opened" },
    { id: "completed", label: "Done" },
    { id: "expired", label: "Expired" },
  ];

  return (
    <div className="min-h-full">
      <header className="border-b border-border/60 bg-[var(--app-bg)]/90 backdrop-blur-md px-6 py-6 md:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Checklist runs
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">{organizationName}</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Shifts and checklist delivery at a glance. Search by employee, role, or checklist name.
        </p>
      </header>

      <div className="p-6 md:p-8 max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Input
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full max-w-md bg-background/80 md:max-w-lg lg:max-w-xl"
            aria-label="Search runs"
          />
          <p className="text-sm text-muted-foreground tabular-nums">
            Showing {filtered.length} of {runs.length}
          </p>
        </div>

        <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Filter by status">
          {chips.map((c) => (
            <Button
              key={c.id}
              type="button"
              size="sm"
              variant={filter === c.id ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setFilter(c.id)}
            >
              {c.label}
            </Button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 py-14 text-center text-sm text-muted-foreground">
            No runs match this view.
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((r) => {
              const pct = progressApprox(r.status);
              return (
                <li key={r.id}>
                  <div
                    className={cn(
                      "rounded-xl border bg-card/40 px-4 py-3 shadow-sm border-border/60"
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground truncate">{r.checklistName}</span>
                          <ShiftRunStatusBadge status={r.status} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">{r.employeeName}</span>
                          <span> · {r.roleName}</span>
                          <span className="text-muted-foreground/90"> · Shift {r.shiftDate}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Updated {new Date(r.updated_at).toLocaleString()}
                          {r.sent_at && ` · Sent ${new Date(r.sent_at).toLocaleString()}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-4 sm:w-52 shrink-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-1">
                            <span>Progress</span>
                            <span className="tabular-nums font-medium text-foreground">{pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-[width]",
                                pct >= 100 ? "bg-emerald-600 dark:bg-emerald-500" : "bg-primary/70"
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 w-full sm:flex-row sm:flex-wrap sm:justify-end">
                          <Button type="button" size="sm" variant="default" className="w-full sm:w-auto" asChild>
                            <Link href={`/app/checklists/runs/${r.id}`}>Run review</Link>
                          </Button>
                          {r.items && r.items.length > 0 ? (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button type="button" size="sm" variant="secondary" className="w-full sm:w-auto">
                                  Quick peek
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Checklist items</DialogTitle>
                                </DialogHeader>
                                <ul className="space-y-2 text-sm">
                                  {r.items.map((it, idx) => (
                                    <li
                                      key={idx}
                                      className="flex justify-between gap-2 border-b border-border/40 pb-2"
                                    >
                                      <span className={it.completed ? "text-muted-foreground line-through" : ""}>
                                        {it.taskText}
                                      </span>
                                      <span className="text-xs shrink-0 text-muted-foreground">
                                        {it.completed ? "Done" : "Open"}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </DialogContent>
                            </Dialog>
                          ) : null}
                          {r.deliveryHints && r.deliveryHints.length > 0 ? (
                            <RunDeliveryActions runId={r.id} hints={r.deliveryHints} />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
