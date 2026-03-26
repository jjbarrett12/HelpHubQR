import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  title: string;
  description?: string;
  /** Eyebrow / context line above title (e.g. module name) */
  kicker?: string;
  actions?: ReactNode;
  className?: string;
};

/**
 * Consistent command-center page title row. Keep descriptions one short sentence.
 */
export function PageHeader({ title, description, kicker, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-border/60 bg-card/40 px-4 py-6 md:flex-row md:items-end md:justify-between md:px-8",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        {kicker ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{kicker}</p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{title}</h1>
        {description ? <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
