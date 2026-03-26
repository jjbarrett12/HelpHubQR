"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { ManagerRequestListItem } from "./mock-data";
import { REQUEST_KIND_LABEL, REQUEST_STATUS_LABEL } from "./mock-data";

function urgencyStyles(u: ManagerRequestListItem["urgency"]) {
  if (u === "urgent") return "bg-red-500/15 text-red-800 dark:text-red-200 border-red-500/30";
  if (u === "soon") return "bg-amber-500/15 text-amber-900 dark:text-amber-100 border-amber-500/30";
  return "bg-muted text-muted-foreground border-border/60";
}

export function RequestInboxRow({
  request,
  selected,
  onSelect,
}: {
  request: ManagerRequestListItem;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const submitted = new Date(request.submittedAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <button
      type="button"
      onClick={() => onSelect(request.id)}
      className={cn(
        "w-full text-left rounded-lg border px-3 py-2.5 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-primary bg-primary/8 ring-1 ring-primary/25"
          : "border-border/70 bg-card/40 hover:bg-muted/50"
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[10px] font-medium">
          {REQUEST_KIND_LABEL[request.kind]}
        </Badge>
        <Badge className={cn("text-[10px] border", urgencyStyles(request.urgency))}>{request.urgency}</Badge>
        {request.needsManagerAction ? (
          <Badge variant="secondary" className="text-[10px]">
            Action
          </Badge>
        ) : null}
        <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">{submitted}</span>
      </div>
      <p className="text-sm font-semibold mt-1.5 leading-snug">{request.title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        <span className="font-medium text-foreground">{request.employeeName}</span>
        <span> · </span>
        {request.contextLine}
      </p>
      {request.reason ? (
        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">&ldquo;{request.reason}&rdquo;</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <span className="text-[10px] text-muted-foreground">{REQUEST_STATUS_LABEL[request.status]}</span>
        <span className="text-[10px] text-muted-foreground">·</span>
        <span className="text-[10px] font-medium text-foreground/90">{request.impactSummary}</span>
      </div>
    </button>
  );
}
