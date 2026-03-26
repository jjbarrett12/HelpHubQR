import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type OperationalSectionProps = {
  title: string;
  description?: string;
  /** Optional status / meta strip (e.g. live counts, advisory label) */
  status?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Tighter padding for dense tables */
  dense?: boolean;
};

/**
 * Section card tuned for operations UIs — clear separation, not dashboard widget clutter.
 */
export function OperationalSection({
  title,
  description,
  status,
  children,
  className,
  dense,
}: OperationalSectionProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border/80 bg-card shadow-sm dark:border-border/50 dark:bg-card/80",
        className
      )}
    >
      <div className="flex flex-col gap-1 border-b border-border/50 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{description}</p>
          ) : null}
        </div>
        {status ? <div className="mt-2 flex shrink-0 items-center md:mt-0">{status}</div> : null}
      </div>
      <div className={cn(dense ? "p-0" : "p-4 md:p-5")}>{children}</div>
    </section>
  );
}
