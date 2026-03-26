"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RunStatusBadge } from "@/components/operations/RunStatusBadge";
import { cn } from "@/lib/utils";

export type ChecklistRunRow = {
  id: string;
  status: string;
  created_at: string;
  sla_minutes: number;
  completed_at: string | null;
  location: { identifier: string; type: string } | null;
  request_type: { code: string; label: string; department: string } | null;
  escalated: boolean;
};

type Filter = "all" | "open" | "active" | "done" | "escalated" | "overdue";

function isOverdue(t: ChecklistRunRow): boolean {
  if (t.status === "completed" || t.status === "canceled") return false;
  const due = new Date(t.created_at).getTime() + t.sla_minutes * 60 * 1000;
  return due < Date.now();
}

function runProgressPct(t: ChecklistRunRow): number {
  if (t.status === "completed") return 100;
  if (t.status === "in_progress" || t.status === "assigned") return 50;
  return 0;
}

export function ChecklistRunsClient({
  propertyName,
  tasks,
  initialFilter = "all",
}: {
  propertyName: string;
  tasks: ChecklistRunRow[];
  initialFilter?: Filter;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>(initialFilter);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (filter === "open" && t.status !== "open") return false;
      if (filter === "active" && !["assigned", "in_progress"].includes(t.status)) return false;
      if (filter === "done" && t.status !== "completed") return false;
      if (filter === "escalated" && !t.escalated) return false;
      if (filter === "overdue" && !isOverdue(t)) return false;
      if (!needle) return true;
      const loc = t.location?.identifier ?? "";
      const label = t.request_type?.label ?? t.request_type?.code ?? "";
      const dept = t.request_type?.department ?? "";
      const hay = `${loc} ${label} ${dept}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [tasks, q, filter]);

  const chips: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "open", label: "New" },
    { id: "active", label: "In progress" },
    { id: "overdue", label: "Overdue" },
    { id: "escalated", label: "Escalated" },
    { id: "done", label: "Done" },
  ];

  return (
    <div className="min-h-full">
      <header className="border-b border-border/60 bg-[var(--app-bg)]/90 backdrop-blur-md px-6 py-6 md:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Checklist runs
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">{propertyName}</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Scan status, SLA risk, and completion. Click a row for the full timeline.
        </p>
      </header>

      <div className="p-6 md:p-8 max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Input
            placeholder="Search room, type, or team…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full max-w-md bg-background/80 md:max-w-lg lg:max-w-xl"
            aria-label="Search runs"
          />
          <p className="text-sm text-muted-foreground tabular-nums">
            Showing {filtered.length} of {tasks.length}
          </p>
        </div>

        <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Filter runs">
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
            {filtered.map((t) => {
              const overdue = isOverdue(t);
              const pct = runProgressPct(t);
              const loc = t.location?.identifier ?? "—";
              const title = t.request_type?.label ?? t.request_type?.code ?? "Run";
              return (
                <li key={t.id}>
                  <Link
                    href={`/app/supervisor/tasks/${t.id}`}
                    className={cn(
                      "block rounded-xl border bg-card/40 px-4 py-3 shadow-sm transition hover:bg-card/70 hover:border-primary/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      overdue && t.status !== "completed" && "border-amber-500/35 bg-amber-500/[0.03]"
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground truncate">{title}</span>
                          <RunStatusBadge status={t.status} />
                          {t.escalated && (
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-destructive">
                              Escalated
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground/90">{loc}</span>
                          {t.request_type?.department && (
                            <span> · {t.request_type.department}</span>
                          )}
                          <span className="text-muted-foreground/80">
                            {" "}
                            · {new Date(t.created_at).toLocaleString()}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-4 sm:w-44 shrink-0">
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
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
