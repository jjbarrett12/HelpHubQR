"use client";

import { TaskCard, type TaskCardTask } from "./TaskCard";
import { cn } from "@/lib/utils";

export type TaskListProps = {
  tasks: TaskCardTask[];
  onStart?: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
  onEscalate?: (taskId: string) => void;
  disabled?: boolean;
  /** Extra classes for the empty state only */
  className?: string;
  /** Applied to the task grid (e.g. md:grid-cols-2 on tablet) */
  gridClassName?: string;
  emptyMessage?: string;
};

function sortTasksForStaff(a: TaskCardTask, b: TaskCardTask): number {
  const score = (t: TaskCardTask) => {
    if (t.status === "completed" || t.status === "canceled") return 2;
    if (t.status === "in_progress") return 0;
    return 1;
  };
  const ds = score(a) - score(b);
  if (ds !== 0) return ds;
  return new Date(b.last_event_at || b.created_at).getTime() - new Date(a.last_event_at || a.created_at).getTime();
}

export function TaskList({
  tasks,
  onStart,
  onComplete,
  onEscalate,
  disabled,
  className,
  gridClassName,
  emptyMessage = "No tasks for this location.",
}: TaskListProps) {
  if (!tasks.length) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-dashed border-border/80 bg-muted/15 px-4 py-12 text-center text-muted-foreground text-sm",
          className
        )}
      >
        {emptyMessage}
      </div>
    );
  }

  const sorted = [...tasks].sort(sortTasksForStaff);

  return (
    <ul className={cn("grid grid-cols-1 gap-4", gridClassName)}>
      {sorted.map((task) => (
        <li key={task.id}>
          <TaskCard
            task={task}
            onStart={onStart}
            onComplete={onComplete}
            onEscalate={onEscalate}
            disabled={disabled}
          />
        </li>
      ))}
    </ul>
  );
}
