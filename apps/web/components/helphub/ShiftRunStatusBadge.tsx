import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ShiftChecklistRunStatus } from "@/lib/helphub/types";

const LABELS: Record<ShiftChecklistRunStatus, string> = {
  pending: "Pending",
  sent: "Sent",
  opened: "Opened",
  completed: "Done",
  expired: "Expired",
};

export function ShiftRunStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const label = LABELS[status as ShiftChecklistRunStatus] ?? status;
  const variant =
    status === "completed"
      ? ("success" as const)
      : status === "expired"
        ? ("muted" as const)
        : status === "opened"
          ? ("warning" as const)
          : status === "sent"
            ? ("secondary" as const)
            : ("outline" as const);
  return (
    <Badge variant={variant} className={cn("shrink-0 capitalize", className)}>
      {label}
    </Badge>
  );
}
