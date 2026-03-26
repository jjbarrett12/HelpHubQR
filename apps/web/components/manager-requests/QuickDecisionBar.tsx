"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function QuickDecisionBar({
  decisionDisabled,
  decisionPending,
  onApprove,
  onDeny,
  onReview,
  onMessage,
  className,
}: {
  /** When false, Approve/Deny are enabled (pending manager action). */
  decisionDisabled?: boolean;
  decisionPending?: boolean;
  onApprove: () => void;
  onDeny: () => void;
  onReview: () => void;
  onMessage: () => void;
  className?: string;
}) {
  const busy = Boolean(decisionPending);
  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 border-t border-border/60 bg-muted/30 px-3 py-3 -mx-1 -mb-1 mt-4 rounded-b-lg",
        className
      )}
    >
      <Button type="button" size="sm" className="h-9" disabled={decisionDisabled || busy} onClick={onApprove}>
        {busy ? "Working…" : "Approve"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        className="h-9"
        disabled={decisionDisabled || busy}
        onClick={onDeny}
      >
        {busy ? "Working…" : "Deny"}
      </Button>
      <Button type="button" size="sm" variant="secondary" className="h-9" onClick={onReview}>
        Review
      </Button>
      <Button type="button" size="sm" variant="outline" className="h-9" onClick={onMessage}>
        Message
      </Button>
      <p className="w-full text-[10px] text-muted-foreground pt-1">
        Approve/Deny call workforce server actions by <span className="font-mono">source_table</span> +{" "}
        <span className="font-mono">source_id</span> (see <span className="font-mono">approveRequestFromFeed</span>).
      </p>
    </div>
  );
}
