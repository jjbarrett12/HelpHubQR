"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type OfflineBadgeProps = {
  isOffline: boolean;
  className?: string;
};

export function OfflineBadge({ isOffline, className }: OfflineBadgeProps) {
  if (!isOffline) return null;
  return (
    <Badge variant="outline" className={cn("shrink-0 border-amber-500 text-amber-700 dark:text-amber-400", className)}>
      Offline
    </Badge>
  );
}
