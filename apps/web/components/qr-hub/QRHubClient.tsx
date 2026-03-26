"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QRHubSummary } from "./QRHubSummary";
import { QRFilters, type QRStatusFilter } from "./QRFilters";
import { QRDirectoryTable } from "./QRDirectoryTable";
import { QRDetailPanel } from "./QRDetailPanel";
import { QRCreateDialog } from "./QRCreateDialog";
import { RecentScansCard } from "./RecentScansCard";
import type { QRHubDestination, QRHubDestinationType } from "./mock-data";
import { MOCK_RECENT_SCANS } from "./mock-data";

function matchesSearch(d: QRHubDestination, q: string): boolean {
  if (!q.trim()) return true;
  const n = q.toLowerCase();
  return (
    d.name.toLowerCase().includes(n) ||
    d.zoneOrStation.toLowerCase().includes(n) ||
    d.slugPreview.toLowerCase().includes(n) ||
    d.destinationTarget.toLowerCase().includes(n) ||
    d.locationName.toLowerCase().includes(n)
  );
}

export function QRHubClient({
  organizationLabel,
  initialDestinations,
}: {
  organizationLabel: string;
  initialDestinations: QRHubDestination[];
}) {
  const [destinations, setDestinations] = useState(initialDestinations);
  const [selectedId, setSelectedId] = useState<string | null>(initialDestinations[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState("all");
  const [typeFilter, setTypeFilter] = useState<QRHubDestinationType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<QRStatusFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    return destinations.filter((d) => {
      if (locationId !== "all" && d.locationId !== locationId) return false;
      if (typeFilter !== "all" && d.type !== typeFilter) return false;
      if (statusFilter === "active" && !d.isActive) return false;
      if (statusFilter === "inactive" && d.isActive) return false;
      if (!matchesSearch(d, search)) return false;
      return true;
    });
  }, [destinations, locationId, typeFilter, statusFilter, search]);

  useEffect(() => {
    if (selectedId && !filtered.some((d) => d.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId]);

  const selected = selectedId ? destinations.find((d) => d.id === selectedId) ?? null : null;

  const onUpdateLocal = useCallback((row: QRHubDestination) => {
    setDestinations((prev) => prev.map((d) => (d.id === row.id ? row : d)));
  }, []);

  const onCreate = useCallback((row: QRHubDestination) => {
    setDestinations((prev) => [row, ...prev]);
    setSelectedId(row.id);
  }, []);

  const clearFilters = useCallback(() => {
    setSearch("");
    setLocationId("all");
    setTypeFilter("all");
    setStatusFilter("all");
  }, []);

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-border/60 bg-card/50 backdrop-blur-md px-4 py-5 md:px-6 lg:px-8">
        <p className="ds-section-title">Workplace infrastructure</p>
        <div className="flex flex-wrap items-end justify-between gap-4 mt-2">
          <div>
            <h1 className="ds-page-title">QR hub</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
              Tie physical placements to operational destinations — {organizationLabel}. Mock catalog until Supabase drives
              this view.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setCreateOpen(true)}>Create destination</Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/qr-codes">Issued codes</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/qr-issues">Issue inbox</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="p-4 md:p-6 lg:px-8 space-y-6 flex-1">
        <QRHubSummary destinations={destinations} />

        <QRFilters
          search={search}
          onSearch={setSearch}
          locationId={locationId}
          onLocationId={setLocationId}
          typeFilter={typeFilter}
          onTypeFilter={setTypeFilter}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          onClear={clearFilters}
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] items-start">
          <div className="space-y-3 min-w-0">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Showing <span className="font-medium text-foreground tabular-nums">{filtered.length}</span> of{" "}
                <span className="tabular-nums">{destinations.length}</span>
              </span>
            </div>
            <QRDirectoryTable rows={filtered} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
          <div className="space-y-4 lg:sticky lg:top-4">
            <QRDetailPanel destination={selected} onUpdateLocal={onUpdateLocal} />
            <RecentScansCard scans={MOCK_RECENT_SCANS} />
          </div>
        </div>
      </div>

      <QRCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={onCreate} />
    </div>
  );
}
