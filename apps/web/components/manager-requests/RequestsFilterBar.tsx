"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RequestKind, RequestStatus, RequestUrgency } from "./mock-data";
import { REQUEST_KIND_LABEL, REQUEST_STATUS_LABEL } from "./mock-data";

export type InboxStatusFilter = "all_open" | RequestStatus | "all";

export function RequestsFilterBar({
  search,
  onSearch,
  statusFilter,
  onStatusFilter,
  urgencyFilter,
  onUrgencyFilter,
  kindFilter,
  onClearKind,
}: {
  search: string;
  onSearch: (v: string) => void;
  statusFilter: InboxStatusFilter;
  onStatusFilter: (v: InboxStatusFilter) => void;
  urgencyFilter: "all" | RequestUrgency;
  onUrgencyFilter: (v: "all" | RequestUrgency) => void;
  kindFilter: RequestKind | "all";
  onClearKind: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end border-b border-border/50 px-4 py-3 md:px-6 bg-background/50">
      <div className="flex-1 min-w-[200px] max-w-md">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Search</label>
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Employee, task, date…"
          className="h-9 mt-1"
          aria-label="Search requests"
        />
      </div>
      <div className="w-full sm:w-[200px]">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Status</label>
        <Select value={statusFilter} onValueChange={(v) => onStatusFilter(v as InboxStatusFilter)}>
          <SelectTrigger className="h-9 mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_open">Open only</SelectItem>
            <SelectItem value="pending_manager">Needs manager</SelectItem>
            <SelectItem value="pending_employee">Awaiting employee</SelectItem>
            <SelectItem value="pending_peer">Awaiting peer (legacy)</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="executed">Executed</SelectItem>
            <SelectItem value="denied">Denied</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="w-full sm:w-[160px]">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Urgency</label>
        <Select value={urgencyFilter} onValueChange={(v) => onUrgencyFilter(v as "all" | RequestUrgency)}>
          <SelectTrigger className="h-9 mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="soon">Soon</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {kindFilter !== "all" ? (
        <div className="flex items-end">
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={onClearKind}>
            Clear type: {REQUEST_KIND_LABEL[kindFilter]}
          </Button>
        </div>
      ) : null}
      <p className="w-full text-[10px] text-muted-foreground sm:ml-auto sm:w-auto">
        {REQUEST_STATUS_LABEL.pending_manager} = your Approve/Deny queue when you have manager role.
      </p>
    </div>
  );
}
