"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { OpsSeverity } from "./mock-data";

const severityAccent: Record<OpsSeverity, string> = {
  normal: "before:bg-[hsl(var(--status-completed)/0.85)]",
  warning: "before:bg-[hsl(var(--status-late))]",
  problem: "before:bg-[hsl(var(--status-problem))]",
};

export function CommandCard({
  title,
  eyebrow,
  severity = "normal",
  badge,
  actions,
  children,
  className,
  dense,
  interactive,
}: {
  title: string;
  eyebrow?: string;
  severity?: OpsSeverity;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  dense?: boolean;
  /** Subtle hover when the whole card is clickable (future use). */
  interactive?: boolean;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/70 bg-card text-card-foreground shadow-card",
        "before:absolute before:left-0 before:top-0 before:z-0 before:h-full before:w-1 before:content-['']",
        severityAccent[severity],
        interactive && "transition-shadow hover:shadow-md hover:border-border",
        className
      )}
    >
      <div className="relative flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3.5 sm:px-5">
        <div className="min-w-0 pl-2">
          {eyebrow ? <p className="ds-section-title mb-1">{eyebrow}</p> : null}
          <h3 className="ds-card-title">{title}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {badge}
          {actions}
        </div>
      </div>
      <div className={cn("relative", dense ? "p-0" : "p-4 sm:p-5")}>{children}</div>
    </section>
  );
}

export function formatTimeShort(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export function formatRelativeMinutes(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}
