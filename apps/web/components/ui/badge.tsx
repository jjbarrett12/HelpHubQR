import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Operational badges: soft fill + darker same-hue text (Stripe/Linear-style).
 * Use semantic variants for real states only — not decoration.
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-full border-0 px-2.5 py-0.5 text-[11px] font-semibold leading-none transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive/15 text-destructive dark:bg-destructive/25 dark:text-destructive-foreground",
        outline: "border border-border bg-transparent text-foreground",
        success:
          "bg-emerald-500/12 text-emerald-800 dark:bg-emerald-500/18 dark:text-emerald-100",
        warning:
          "bg-amber-500/14 text-amber-900 dark:bg-amber-500/16 dark:text-amber-100",
        muted: "bg-muted/80 text-muted-foreground",
        info: "bg-sky-500/12 text-sky-900 dark:bg-sky-500/18 dark:text-sky-100",
        pending:
          "bg-[hsl(var(--status-pending)/0.14)] text-[hsl(var(--status-pending))] dark:bg-[hsl(var(--status-pending)/0.2)]",
        approved:
          "bg-[hsl(var(--status-completed)/0.14)] text-[hsl(var(--status-completed))] dark:bg-[hsl(var(--status-completed)/0.22)]",
        executed:
          "bg-emerald-500/12 text-emerald-800 dark:bg-emerald-500/18 dark:text-emerald-100",
        denied:
          "bg-[hsl(var(--status-problem)/0.12)] text-[hsl(var(--status-problem))] dark:bg-[hsl(var(--status-problem)/0.22)]",
        late: "bg-[hsl(var(--status-late)/0.14)] text-[hsl(var(--status-late))] dark:bg-[hsl(var(--status-late)/0.2)]",
        problem:
          "bg-[hsl(var(--status-problem)/0.12)] text-[hsl(var(--status-problem))] dark:bg-[hsl(var(--status-problem)/0.22)]",
        completed:
          "bg-[hsl(var(--status-completed)/0.14)] text-[hsl(var(--status-completed))] dark:bg-[hsl(var(--status-completed)/0.22)]",
        open: "bg-[hsl(var(--status-open-shift)/0.14)] text-[hsl(var(--status-open-shift))] dark:bg-[hsl(var(--status-open-shift)/0.22)]",
        active:
          "bg-[hsl(var(--status-active)/0.14)] text-[hsl(var(--status-active))] dark:bg-[hsl(var(--status-active)/0.22)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
