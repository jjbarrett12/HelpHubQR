"use client";

import { TaskCard, type TaskCardTask } from "./TaskCard";
import { cn } from "@/lib/utils";

export type TaskListProps = {
  tasks: TaskCardTask[];
  onStart?: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
  onEscalate?: (taskId: string) => void;
  disabled?: boolean;
  className?: string;
  emptyMessage?: string;
};

export function TaskList({
  tasks,
  onStart,
  onComplete,
  onEscalate,
  disabled,
  className,
  emptyMessage = "No tasks for this location.",
}: TaskListProps) {
  if (!tasks.length) {
    return (
      <div className={cn("rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-muted-foreground", className)}>
        {emptyMessage}
      </div>
    );
  }
  return (
    <ul className={cn("space-y-3", className)}>
      {tasks.map((task) => (
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
