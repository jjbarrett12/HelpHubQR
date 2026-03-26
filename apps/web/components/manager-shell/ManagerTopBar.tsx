"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { ManagerOrgSelector } from "./ManagerOrgSelector";
import { mockTopBarAlerts, mockAlertSummary } from "./mock-top-bar";
import { Bell, Menu, Plus } from "lucide-react";

type Props = {
  organizations: { id: string; name: string }[];
  activeOrganizationId: string | null;
  /** ISO date string from server (local calendar day label) */
  operationalDateLabel: string;
  onMenuClick?: () => void;
};

export function ManagerTopBar({
  organizations,
  activeOrganizationId,
  operationalDateLabel,
  onMenuClick,
}: Props) {
  const alerts = mockTopBarAlerts;
  const summary = mockAlertSummary(alerts);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/90 px-3 backdrop-blur-md md:px-5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="md:hidden shrink-0"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="hidden min-w-0 flex-1 items-center gap-4 md:flex">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono tabular-nums text-foreground/90">{operationalDateLabel}</span>
          <span className="hidden lg:inline">·</span>
          <span className="hidden lg:inline truncate">Operations day (manager view)</span>
        </div>
        <ManagerOrgSelector organizations={organizations} activeOrganizationId={activeOrganizationId} />
      </div>

      <div className="flex min-w-0 flex-1 items-center md:hidden">
        <span className="font-mono text-xs text-muted-foreground tabular-nums">{operationalDateLabel}</span>
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <Button size="sm" className="hidden sm:inline-flex h-8 gap-1 text-xs" asChild>
          <Link href="/app/shift-ops">
            <Plus className="h-3.5 w-3.5" />
            Quick action
          </Link>
        </Button>

        <details className="relative">
          <summary className="relative flex h-9 w-9 shrink-0 cursor-pointer list-none items-center justify-center rounded-md border border-border/80 bg-background hover:bg-muted/80 [&::-webkit-details-marker]:hidden">
            <Bell className="h-4 w-4" />
            {summary.total > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {summary.total > 9 ? "9+" : summary.total}
              </span>
            ) : null}
          </summary>
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-border/80 bg-card p-3 shadow-lg">
            <p className="text-xs text-muted-foreground mb-2">
              Advisory alerts (mock) — wire to workforce / fairness signals next.
            </p>
            <ul className="space-y-2 border-t border-border/50 pt-2">
              {alerts.map((a) => (
                <li key={a.id} className="text-sm">
                  <p className="text-foreground">{a.title}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{a.severity}</p>
                </li>
              ))}
            </ul>
            <div className="mt-3 border-t border-border/50 pt-2">
              <Link href="/app/fairness" className="text-sm font-medium text-primary hover:underline">
                Open fairness overview
              </Link>
            </div>
          </div>
        </details>

        <ThemeToggle />
      </div>
    </header>
  );
}
