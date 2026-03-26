"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QRHubScanEvent } from "./mock-data";

export function RecentScansCard({ scans }: { scans: QRHubScanEvent[] }) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="py-3 px-4 space-y-0">
        <CardTitle className="text-sm font-semibold">Recent scan activity</CardTitle>
        <p className="text-[11px] text-muted-foreground font-normal">
          Latest touches on destinations (mock stream).
        </p>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <ul className="space-y-2">
          {scans.map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2 text-xs"
            >
              <div className="font-medium text-foreground leading-tight">{s.destinationName}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                <span className="tabular-nums">{new Date(s.scannedAt).toLocaleString()}</span>
                <span>·</span>
                <span>{s.locationLabel}</span>
                <span>·</span>
                <span>{s.clientHint}</span>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-muted-foreground mt-3 border-t border-border/50 pt-2">
          {/* TODO: query scan fact table or parse access logs; filter by org + destination */}
        </p>
      </CardContent>
    </Card>
  );
}
