"use client";

import { QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { QRHubDestination } from "./mock-data";
import { QR_HUB_TYPE_LABEL } from "./mock-data";

export function QRDirectoryTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: QRHubDestination[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={QrCode}
        title="No destinations match"
        description="Clear filters or create a new QR destination for this organization."
        className="bg-muted/10"
      />
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card shadow-card overflow-hidden">
      <div className="overflow-x-auto max-h-[min(52vh,560px)] overflow-y-auto">
        <div className="min-w-[720px]">
          <div className="ds-table-header grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_auto] gap-2 px-4 py-3 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Name</span>
            <span>Location</span>
            <span>Zone / station</span>
            <span>Type</span>
            <span className="text-right">7d scans</span>
            <span className="sr-only">Open</span>
          </div>
          <div>
            {rows.map((r, idx) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onSelect(r.id)}
                className={cn(
                  "ds-table-row w-full grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_auto] gap-2 border-b border-border/40 px-4 py-3 text-left text-sm",
                  idx % 2 === 1 && "bg-muted/[0.12]",
                  selectedId === r.id && "bg-primary/[0.06] ring-1 ring-inset ring-primary/20"
                )}
              >
                <span className="min-w-0">
                  <span className="font-medium block truncate">{r.name}</span>
                  <span className="text-[11px] text-muted-foreground font-mono truncate block">/{r.slugPreview}</span>
                </span>
                <span className="text-xs text-muted-foreground self-center truncate">{r.locationName}</span>
                <span className="text-xs self-center truncate">{r.zoneOrStation}</span>
                <span className="self-center">
                  <Badge variant="secondary" className="normal-case font-medium max-w-full truncate">
                    {QR_HUB_TYPE_LABEL[r.type]}
                  </Badge>
                </span>
                <span className="tabular-nums text-xs text-right self-center text-muted-foreground">
                  {r.scansLast7Days}
                </span>
                <span className="self-center flex justify-end gap-1 shrink-0">
                  {!r.isActive ? (
                    <Badge variant="muted" className="normal-case">
                      Off
                    </Badge>
                  ) : (
                    <Badge variant="completed" className="normal-case">
                      Live
                    </Badge>
                  )}
                  <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" tabIndex={-1}>
                    View
                  </Button>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
