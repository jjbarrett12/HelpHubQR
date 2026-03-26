"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  hk: "Housekeeping",
  eng: "Engineering",
  sup: "Supervisor",
};

export type RoleChipProps = {
  role: "hk" | "eng" | "sup";
  className?: string;
};

export function RoleChip({ role, className }: RoleChipProps) {
  const label = ROLE_LABELS[role] ?? role;
  return (
    <Badge variant="secondary" className={cn("shrink-0", className)}>
      {label}
    </Badge>
  );
}
