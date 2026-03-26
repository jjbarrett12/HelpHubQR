"use client";

import { cn } from "@/lib/utils";
import type { QRHubDestination } from "./mock-data";
import { summarizeDestinations } from "./mock-data";

export function QRHubSummary({ destinations, className }: { destinations: QRHubDestination[]; className?: string }) {
  const s = summarizeDestinations(destinations);

  const cards = [
    { label: "Destinations", value: s.total, sub: `${s.active} active`, tone: "default" as const },
    { label: "Locations in use", value: s.locationsCovered, sub: "distinct sites", tone: "default" as const },
    { label: "Scans (24h)", value: s.scans24h, sub: "all codes · mock", tone: "accent" as const },
    { label: "Scans (7d)", value: s.scans7d, sub: "rolling window", tone: "muted" as const },
  ];

  return (
    <div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-3", className)}>
      {cards.map((c) => (
        <div
          key={c.label}
          className={cn(
            "rounded-xl border px-4 py-3",
            c.tone === "accent"
              ? "border-primary/35 bg-primary/[0.06]"
              : "border-border/70 bg-card/40"
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{c.label}</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{c.value}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{c.sub}</p>
        </div>
      ))}
      <p className="col-span-full text-[10px] text-muted-foreground">
        {/* TODO: Supabase — aggregate from scan_events / analytics; join qr_codes → qr_destinations */}
        Counts derived from mock rows; wire real telemetry for production dashboards.
      </p>
    </div>
  );
}
