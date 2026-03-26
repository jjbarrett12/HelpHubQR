import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  open: "New",
  assigned: "Assigned",
  in_progress: "In progress",
  completed: "Completed",
  canceled: "Canceled",
};

export function RunStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const label = LABELS[status] ?? status.replace(/_/g, " ");
  const variant =
    status === "completed"
      ? ("success" as const)
      : status === "canceled"
        ? ("muted" as const)
        : status === "in_progress" || status === "assigned"
          ? ("warning" as const)
          : ("default" as const);
  return (
    <Badge variant={variant} className={cn("shrink-0 capitalize tabular-nums", className)}>
      {label}
    </Badge>
  );
}
