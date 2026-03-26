import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShiftRunStatusBadge } from "@/components/helphub/ShiftRunStatusBadge";
import type { ShiftChecklistRunStatus } from "@/lib/helphub/types";
import type { RunReviewViewModel } from "@/lib/checklists/run-review-view-model";

export function RunReviewHeader({
  model,
  backHref,
}: {
  model: RunReviewViewModel;
  backHref: string;
}) {
  return (
    <header className="border-b border-border/60 bg-[var(--app-bg)]/95 px-4 py-4 md:px-6 lg:px-8 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Shift run · execution record
          </p>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl break-words">{model.checklistName}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{model.employeeName}</span>
            <span>·</span>
            <span>{model.roleName}</span>
            {model.stationName ? (
              <>
                <span>·</span>
                <span>{model.stationName}</span>
              </>
            ) : null}
            <span>·</span>
            <span className="tabular-nums">Shift {model.shiftDate}</span>
            <Badge variant="outline" className="text-[10px] uppercase">
              {model.shiftType}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <ShiftRunStatusBadge status={model.status as ShiftChecklistRunStatus} />
          <Button variant="outline" size="sm" asChild>
            <Link href={backHref}>Back</Link>
          </Button>
        </div>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-t border-border/50 pt-3">
        <div>
          <dt className="text-muted-foreground">Sent</dt>
          <dd className="font-medium tabular-nums">{model.sentAt ? new Date(model.sentAt).toLocaleString() : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Started</dt>
          <dd className="font-medium tabular-nums">{model.startedAt ? new Date(model.startedAt).toLocaleString() : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Completed</dt>
          <dd className="font-medium tabular-nums">{model.completedAt ? new Date(model.completedAt).toLocaleString() : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Updated</dt>
          <dd className="font-medium tabular-nums">{new Date(model.updatedAt).toLocaleString()}</dd>
        </div>
      </dl>
      <p className="text-[11px] text-muted-foreground leading-relaxed max-w-3xl">
        {/* TODO: link to template in read-only peek — keep execution as source of truth */}
        Template ID <code className="text-[10px] font-mono">{model.templateId}</code> — edits to the template do not rewrite
        this run.
      </p>
    </header>
  );
}
