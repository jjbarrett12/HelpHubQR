"use client";

import { Button } from "@/components/ui/button";
import { RunStatusBadge } from "@/components/operations/RunStatusBadge";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type TaskCardTask = {
  id: string;
  status: string;
  priority: number;
  sla_minutes: number;
  created_at: string;
  last_event_at: string;
  request_type?: { code: string; label: string; department: string } | null;
};

export type TaskCardProps = {
  task: TaskCardTask;
  onStart?: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
  onEscalate?: (taskId: string) => void;
  disabled?: boolean;
  className?: string;
};

export function TaskCard({
  task,
  onStart,
  onComplete,
  onEscalate,
  disabled,
  className,
}: TaskCardProps) {
  const rt = task.request_type;
  const title = rt?.label ?? rt?.code ?? "Task";
  const isOpen = task.status === "open";
  const isInProgress = task.status === "in_progress";
  const isDone = task.status === "completed" || task.status === "canceled";

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card shadow-sm overflow-hidden transition-colors",
        isDone && "border-border/60 bg-muted/20",
        !isDone && isInProgress && "border-primary/35 ring-1 ring-primary/10",
        !isDone && isOpen && "border-border/80",
        className
      )}
    >
      <div className="flex gap-0">
        <div
          className={cn(
            "w-1.5 shrink-0",
            isDone && "bg-emerald-600/50",
            !isDone && isInProgress && "bg-primary",
            !isDone && isOpen && "bg-muted-foreground/25"
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1 p-4 pr-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {isDone && task.status === "completed" && (
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600/15 text-emerald-700 dark:text-emerald-300"
                    aria-hidden
                  >
                    <Check className="h-4 w-4 stroke-[3]" />
                  </span>
                )}
                <h2 className="text-base font-semibold leading-snug text-foreground">{title}</h2>
              </div>
              {rt?.department && (
                <p className="text-xs text-muted-foreground mt-1">{rt.department}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                {isDone ? "Updated " : "Received "}
                {new Date(task.last_event_at || task.created_at).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <RunStatusBadge status={task.status} className="self-start" />
          </div>

          {!isDone && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {onStart && isOpen && (
                <Button
                  type="button"
                  size="lg"
                  className="min-h-12 w-full sm:w-auto sm:min-w-[8.5rem] text-base font-semibold"
                  onClick={() => onStart(task.id)}
                  disabled={disabled}
                >
                  Start
                </Button>
              )}
              {onComplete && isInProgress && (
                <Button
                  type="button"
                  size="lg"
                  className="min-h-12 w-full sm:w-auto sm:min-w-[8.5rem] text-base font-semibold"
                  onClick={() => onComplete(task.id)}
                  disabled={disabled}
                >
                  Finish
                </Button>
              )}
              {onEscalate && (isOpen || isInProgress) && (
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="min-h-12 w-full sm:w-auto sm:min-w-[8.5rem] text-base"
                  onClick={() => onEscalate(task.id)}
                  disabled={disabled}
                >
                  Escalate
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
