"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CommandCard, formatRelativeMinutes } from "./command-card";
import type { ApprovalInboxItem, ApprovalKind, OpsSeverity } from "./mock-data";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { approveRequestFromFeed, denyRequestFromFeed } from "@/app/app/helphub/actions/workforce";
import { labelRequestFeedStatusForManager } from "@/lib/helphub/requests/request-feed-labels";

function worst(a: OpsSeverity, b: OpsSeverity): OpsSeverity {
  const o = { normal: 0, warning: 1, problem: 2 };
  return o[a] >= o[b] ? a : b;
}

const kindLabel: Record<ApprovalKind, string> = {
  task_transfer: "Task transfer",
  shift_coverage: "Coverage",
  shift_trade: "Trade",
  open_shift_pickup: "Open shift",
};

type DecisionMode = "approve" | "deny" | null;

export function ApprovalsInboxCard({
  items,
  canManageApprovals,
  approvalsActionsEnabled,
}: {
  items: ApprovalInboxItem[];
  /** Server: `userCanManageOrganization` — without this, actions are review-only. */
  canManageApprovals: boolean;
  /** False when feed failed to load; keeps mock Today from calling real approve. */
  approvalsActionsEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialogItem, setDialogItem] = useState<ApprovalInboxItem | null>(null);
  const [decisionMode, setDecisionMode] = useState<DecisionMode>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const severity = items.reduce<OpsSeverity>((acc, r) => worst(acc, r.severity), "normal");

  const openDecision = useCallback((item: ApprovalInboxItem, mode: DecisionMode) => {
    setError(null);
    setDialogItem(item);
    setDecisionMode(mode);
    setNoteDraft("");
  }, []);

  const closeDialog = useCallback(() => {
    setDialogItem(null);
    setDecisionMode(null);
    setNoteDraft("");
    setError(null);
  }, []);

  const submitDecision = useCallback(() => {
    if (!dialogItem || !decisionMode) return;
    const notes = noteDraft.trim() || undefined;
    setError(null);
    startTransition(async () => {
      const res =
        decisionMode === "approve"
          ? await approveRequestFromFeed({
              sourceTable: dialogItem.sourceTable,
              sourceId: dialogItem.sourceId,
              notes,
            })
          : await denyRequestFromFeed({
              sourceTable: dialogItem.sourceTable,
              sourceId: dialogItem.sourceId,
              notes,
            });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      closeDialog();
      router.refresh();
    });
  }, [closeDialog, decisionMode, dialogItem, noteDraft, router]);

  const canUseInlineActions = approvalsActionsEnabled && canManageApprovals;

  return (
    <>
      <CommandCard
        title="Approvals inbox"
        eyebrow="Actions"
        severity={severity}
        badge={
          items.length > 0 ? (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <Inbox className="h-3 w-3" />
              {items.length}
            </Badge>
          ) : (
            <Badge variant="success" className="text-[10px]">
              Inbox clear
            </Badge>
          )
        }
        dense
      >
      {items.length === 0 ? (
        <div className="px-2 py-2">
          <EmptyState
            icon={Inbox}
            title="Inbox clear"
            description="No approvals waiting. New requests appear here during the shift."
            className="border-border/50 bg-transparent py-10"
          />
        </div>
      ) : (
          <ul className="divide-y divide-border/50">
            {items.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="pending" className="normal-case">
                    {kindLabel[a.kind]}
                  </Badge>
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {labelRequestFeedStatusForManager(a.feedStatus)}
                    </Badge>
                    <span className="text-sm font-medium">{a.title}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{a.summary}</p>
                  {a.latestDecisionNote ? (
                    <p className="text-[10px] text-muted-foreground mt-1 border-l-2 border-border pl-2">
                      Last note: {a.latestDecisionNote}
                    </p>
                  ) : null}
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">
                    {formatRelativeMinutes(a.requestedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  {canUseInlineActions ? (
                    <>
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        disabled={pending}
                        onClick={() => openDecision(a, "approve")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        disabled={pending}
                        onClick={() => openDecision(a, "deny")}
                      >
                        Deny
                      </Button>
                    </>
                  ) : null}
                  <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                    <Link href="/app/requests">Review</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!canManageApprovals && items.length > 0 ? (
          <p className="px-3 pb-2 text-[10px] text-muted-foreground">
            Manager role required to approve from Today — use Review for full context.
          </p>
        ) : null}
      </CommandCard>

      <Dialog open={dialogItem != null && decisionMode != null} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{decisionMode === "approve" ? "Approve request" : "Deny request"}</DialogTitle>
          </DialogHeader>
          {dialogItem ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">{dialogItem.summary}</p>
              <div className="space-y-1.5">
                <Label htmlFor="approval-note">Note (optional)</Label>
                <Textarea
                  id="approval-note"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  rows={3}
                  placeholder="Visible in workforce event log"
                />
              </div>
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
            </div>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeDialog} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" onClick={submitDecision} disabled={pending}>
              {pending ? "Saving…" : decisionMode === "approve" ? "Confirm approve" : "Confirm deny"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
