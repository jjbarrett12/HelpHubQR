"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommandCard, formatRelativeMinutes } from "./command-card";
import type { OpsIssue, OpsSeverity } from "./mock-data";
import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

function worst(a: OpsSeverity, b: OpsSeverity): OpsSeverity {
  const o = { normal: 0, warning: 1, problem: 2 };
  return o[a] >= o[b] ? a : b;
}

const sourceLabel: Record<OpsIssue["source"], string> = {
  qr: "QR",
  checklist: "Checklist",
  guest: "Guest",
  internal: "Internal",
};

export function IssuesCard({ items }: { items: OpsIssue[] }) {
  const severity = items.reduce<OpsSeverity>((acc, r) => worst(acc, r.severity), "normal");

  return (
    <CommandCard
      title="Issues"
      eyebrow="Actions"
      severity={severity}
      badge={
        items.length > 0 ? (
          <Badge variant={severity === "problem" ? "problem" : "warning"} className="normal-case">
            {items.length} open
          </Badge>
        ) : (
          <Badge variant="success" className="text-[10px]">
            Clear
          </Badge>
        )
      }
      dense
    >
      {/* TODO: Supabase — qr_issue_reports + future issues table; rollup by org, open state */}
      {items.length === 0 ? (
        <div className="px-2 py-2">
          <EmptyState
            icon={AlertTriangle}
            title="No open issues"
            description="QR and checklist problems surface here for fast triage."
            className="border-border/50 bg-transparent py-10"
          />
        </div>
      ) : (
        <ul className="divide-y divide-border/50">
          {items.map((i) => (
            <li key={i.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="muted" className="normal-case font-medium">
                    {sourceLabel[i.source]}
                  </Badge>
                  <span className="text-sm font-medium">{i.title}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{i.locationName}</p>
                <p className="text-[10px] font-mono text-muted-foreground mt-1">{formatRelativeMinutes(i.openedAt)}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="default" className="h-8 text-xs" asChild>
                  <Link href="/app/issues">Triage</Link>
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" asChild>
                  <Link href="/app/qr-issues">QR inbox</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </CommandCard>
  );
}
