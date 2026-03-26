"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { ManagerRequestDetail } from "./mock-data";
import { REQUEST_KIND_LABEL, REQUEST_STATUS_LABEL } from "./mock-data";
import { QuickDecisionBar } from "./QuickDecisionBar";
import { cn } from "@/lib/utils";
import { FEED_APPROVAL_SOURCE_TABLES } from "@/lib/helphub/requests/feed-dispatch";

function urgencyBadge(u: ManagerRequestDetail["urgency"]) {
  if (u === "urgent") return "bg-red-600 hover:bg-red-600 text-white";
  if (u === "soon") return "bg-amber-600 hover:bg-amber-600 text-white";
  return "bg-muted text-muted-foreground";
}

export function RequestDetailPanel({
  detail,
  decisionPending,
  canDecideAsManager,
  onApprove,
  onDeny,
  onPlaceholderAction,
}: {
  detail: ManagerRequestDetail | null;
  decisionPending?: boolean;
  /** When false, Approve/Deny stay disabled (RLS may still show rows you participate in). */
  canDecideAsManager: boolean;
  onApprove: (notes: string) => void;
  onDeny: (notes: string) => void;
  onPlaceholderAction: (action: string, notes: string) => void;
}) {
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setNotes("");
  }, [detail?.id]);

  if (!detail) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-8 text-center text-sm text-muted-foreground lg:min-h-[420px] flex flex-col items-center justify-center">
        Select a request to see full context, affected people, and decision actions.
      </div>
    );
  }

  const dispatchable = FEED_APPROVAL_SOURCE_TABLES.has(detail.sourceTable);
  const canDecide =
    canDecideAsManager &&
    dispatchable &&
    detail.status === "pending_manager" &&
    detail.needsManagerAction;

  return (
    <div className="rounded-xl border border-border/70 bg-card/50 shadow-sm overflow-hidden flex flex-col lg:min-h-[420px] lg:max-h-[calc(100vh-12rem)]">
      <div className="p-4 border-b border-border/60 space-y-2 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{REQUEST_KIND_LABEL[detail.kind]}</Badge>
          <Badge className={cn("text-[10px]", urgencyBadge(detail.urgency))}>{detail.urgency}</Badge>
          <Badge variant="secondary" className="text-[10px]">
            {REQUEST_STATUS_LABEL[detail.status]}
          </Badge>
        </div>
        <h2 className="text-lg font-bold leading-tight">{detail.title}</h2>
        <p className="text-sm text-muted-foreground tabular-nums">
          Submitted {new Date(detail.submittedAt).toLocaleString()}
        </p>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Context</p>
          <p className="text-sm mt-1 leading-relaxed">{detail.fullContext}</p>
          <p className="text-xs text-muted-foreground mt-2">
            <span className="font-medium text-foreground">{detail.employeeName}</span> · {detail.contextLine}
          </p>
          {detail.reason ? (
            <p className="text-sm mt-2 border-l-2 border-border pl-2 text-muted-foreground">
              Reason: <span className="text-foreground">{detail.reason}</span>
            </p>
          ) : null}
        </section>

        <section>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Who is affected</p>
          <ul className="mt-2 space-y-2">
            {detail.affectedParties.map((p) => (
              <li key={p.id} className="text-sm rounded-md border border-border/50 bg-background/60 px-2.5 py-2">
                <span className="text-[10px] uppercase text-muted-foreground">{p.role}</span>
                <span className="font-medium ml-2">{p.name}</span>
                {p.note ? <p className="text-xs text-muted-foreground mt-0.5">{p.note}</p> : null}
              </li>
            ))}
          </ul>
        </section>

        {detail.proposedCounterparty ? (
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Proposed pickup / counterparty
            </p>
            <div className="mt-2 rounded-md border border-sky-500/30 bg-sky-500/[0.06] px-2.5 py-2 text-sm">
              <p className="font-semibold">{detail.proposedCounterparty.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{detail.proposedCounterparty.relationship}</p>
            </div>
          </section>
        ) : null}

        <section>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            History & related actions
          </p>
          <ul className="mt-2 space-y-2">
            {detail.history.map((h) => (
              <li key={h.id} className="text-xs border-l-2 border-primary/25 pl-2">
                <span className="text-muted-foreground tabular-nums">{new Date(h.at).toLocaleString()}</span>
                <span className="mx-1">·</span>
                <span className="font-medium">{h.actor}</span>
                <span className="text-muted-foreground"> — {h.summary}</span>
              </li>
            ))}
          </ul>
        </section>

        {detail.fairnessAdvisory.length > 0 ? (
          <section className="rounded-lg border border-dashed border-primary/30 bg-primary/[0.04] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Fairness advisory</p>
            <ul className="mt-2 space-y-1.5 text-xs text-foreground/90">
              {detail.fairnessAdvisory.map((line, i) => (
                <li key={i} className="leading-relaxed">
                  {line}
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-muted-foreground mt-2">Advisory only — does not block approve/deny.</p>
          </section>
        ) : null}

        <section>
          <Label htmlFor="mgr-notes" className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Decision notes (optional audit when non-empty)
          </Label>
          <Textarea
            id="mgr-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Visible to audit log when mutations are wired…"
            className="mt-1 min-h-[72px] text-sm"
          />
        </section>

        <p className="text-[10px] text-muted-foreground font-mono break-all">Source: {detail.sourceTableHint}</p>
      </div>

      <QuickDecisionBar
        decisionDisabled={!canDecide}
        decisionPending={decisionPending}
        onApprove={() => onApprove(notes)}
        onDeny={() => onDeny(notes)}
        onReview={() => onPlaceholderAction("review", notes)}
        onMessage={() => onPlaceholderAction("message", notes)}
      />
    </div>
  );
}
