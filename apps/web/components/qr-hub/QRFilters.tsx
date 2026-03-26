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
import { cn } from "@/lib/utils";
import type { QRHubDestinationType } from "./mock-data";
import { QR_HUB_TYPE_LABEL, MOCK_LOCATION_OPTIONS } from "./mock-data";

export type QRStatusFilter = "all" | "active" | "inactive";

export function QRFilters({
  search,
  onSearch,
  locationId,
  onLocationId,
  typeFilter,
  onTypeFilter,
  statusFilter,
  onStatusFilter,
  onClear,
}: {
  search: string;
  onSearch: (v: string) => void;
  locationId: string;
  onLocationId: (v: string) => void;
  typeFilter: QRHubDestinationType | "all";
  onTypeFilter: (v: QRHubDestinationType | "all") => void;
  statusFilter: QRStatusFilter;
  onStatusFilter: (v: QRStatusFilter) => void;
  onClear: () => void;
}) {
  const types = Object.keys(QR_HUB_TYPE_LABEL) as QRHubDestinationType[];

  const statusPills: { id: QRStatusFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "active", label: "Live" },
    { id: "inactive", label: "Off" },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/80 p-4 shadow-card md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="flex-1 min-w-[200px] max-w-md">
          <label className="ds-section-title mb-2 block">Search</label>
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Name, zone, slug, target…"
            className="h-10"
          />
        </div>
        <div className="w-full sm:w-[200px]">
          <label className="ds-section-title mb-2 block">Location</label>
          <Select value={locationId} onValueChange={onLocationId}>
            <SelectTrigger className="h-10 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MOCK_LOCATION_OPTIONS.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-[220px]">
          <label className="ds-section-title mb-2 block">Type</label>
          <Select value={typeFilter} onValueChange={(v) => onTypeFilter(v as QRHubDestinationType | "all")}>
            <SelectTrigger className="h-10 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {types.map((t) => (
                <SelectItem key={t} value={t}>
                  {QR_HUB_TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border/50 pt-4">
        <div>
          <span className="ds-section-title mb-2 block sm:mb-0 sm:mr-3 sm:inline">Status</span>
          <div className="mt-2 flex flex-wrap gap-2 sm:mt-0 sm:inline-flex">
            {statusPills.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onStatusFilter(p.id)}
                className={cn(
                  "ds-filter-pill",
                  statusFilter === p.id && "ds-filter-pill-active"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-9 shrink-0 text-muted-foreground" onClick={onClear}>
          Reset filters
        </Button>
      </div>
    </div>
  );
}
