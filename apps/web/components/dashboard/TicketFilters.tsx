"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "cancelled", label: "Cancelled" },
];

export function TicketFilters({ siteId }: { siteId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") ?? "all";

  function onStatusChange(value: string) {
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete("status");
    else next.set("status", value);
    router.push(`/app/sites/${siteId}?${next.toString()}`);
  }

  return (
    <div className="flex gap-2 items-center">
      <label htmlFor="ticket-status-filter" className="text-sm text-muted-foreground sr-only sm:not-sr-only sm:inline">
        Filter by status
      </label>
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger id="ticket-status-filter" className="w-[180px]" aria-label="Filter tickets by status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
