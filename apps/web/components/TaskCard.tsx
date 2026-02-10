"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  assigned: "Assigned",
  in_progress: "In progress",
  completed: "Completed",
  canceled: "Canceled",
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
  const label = rt?.label ?? rt?.code ?? "Request";
  const statusLabel = STATUS_LABELS[task.status] ?? task.status;
  const isOpen = task.status === "open";
  const isInProgress = task.status === "in_progress";
  const isDone = task.status === "completed" || task.status === "canceled";

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-foreground">{label}</span>
          <Badge variant={isDone ? "secondary" : "default"}>{statusLabel}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Created {new Date(task.created_at).toLocaleString()}
        </p>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 pt-0">
        {!isDone && onStart && isOpen && (
          <Button
            size="sm"
            variant="default"
            onClick={() => onStart(task.id)}
            disabled={disabled}
          >
            Start
          </Button>
        )}
        {!isDone && onComplete && isInProgress && (
          <Button
            size="sm"
            variant="default"
            onClick={() => onComplete(task.id)}
            disabled={disabled}
          >
            Complete
          </Button>
        )}
        {!isDone && onEscalate && (isOpen || isInProgress) && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEscalate(task.id)}
            disabled={disabled}
          >
            Escalate
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
