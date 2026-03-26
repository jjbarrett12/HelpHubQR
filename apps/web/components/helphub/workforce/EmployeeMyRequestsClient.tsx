"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  acceptShiftTrade,
  acceptTaskTransferRequest,
  claimCoverageRequest,
} from "@/app/app/helphub/actions/workforce-employee";
import type { RequestFeedStatus } from "@/lib/helphub/requests/request-feed";

type TransferRow = {
  id: string;
  status: string;
  request_mode: string;
  from_employee_id: string;
  to_employee_id: string | null;
  from_name: string;
  to_name: string | null;
  task_preview: string;
  manager_approval_required: boolean;
  feed_status?: RequestFeedStatus;
  status_display_line?: string;
  latest_decision_note?: string | null;
};

type CoverageRow = {
  id: string;
  status: string;
  request_type: string;
  reason: string | null;
  requested_by_name: string;
  claimed_by_name: string | null;
  manager_approval_required: boolean;
  requested_by_employee_id: string;
  feed_status?: RequestFeedStatus;
  status_display_line?: string;
  latest_decision_note?: string | null;
};

type TradeRow = {
  id: string;
  status: string;
  reason: string | null;
  offering_name: string;
  target_name: string | null;
  target_employee_id: string | null;
  accepted_by_name: string | null;
  manager_approval_required: boolean;
  offering_employee_id: string;
  feed_status?: RequestFeedStatus;
  status_display_line?: string;
  latest_decision_note?: string | null;
};

type Props = {
  employeeId: string;
  transfers: TransferRow[];
  coverage: CoverageRow[];
  trades: TradeRow[];
};

/** Legacy fallback when row was not built from `hh_employee_requests_feed`. */
function statusNote(status: string, mgr: boolean): string {
  if (status === "pending" && mgr) return "Awaiting action";
  if (status === "accepted" && mgr) return "Pending manager approval";
  if (status === "approved") return "Approved";
  if (status === "denied") return "Denied";
  if (status === "declined") return "Declined";
  if (status === "cancelled") return "Cancelled";
  if (status === "claimed" && mgr) return "Claimed — pending manager";
  return status;
}

function rowStatusLine(
  r: { status: string; manager_approval_required: boolean; status_display_line?: string }
): string {
  if (r.status_display_line) return r.status_display_line;
  return statusNote(r.status, r.manager_approval_required);
}

function feedBucket(fs: RequestFeedStatus | undefined): "you" | "manager" | "closed" {
  if (!fs) return "you";
  if (fs === "pending_manager") return "manager";
  if (fs === "executed" || fs === "denied" || fs === "cancelled" || fs === "expired" || fs === "approved") {
    return "closed";
  }
  return "you";
}

export function EmployeeMyRequestsClient({ employeeId, transfers, coverage, trades }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const summary = useMemo(() => {
    const rows = [
      ...transfers.map((t) => t.feed_status),
      ...coverage.map((c) => c.feed_status),
      ...trades.map((tr) => tr.feed_status),
    ];
    let you = 0;
    let manager = 0;
    let closed = 0;
    for (const fs of rows) {
      const b = feedBucket(fs);
      if (b === "you") you += 1;
      else if (b === "manager") manager += 1;
      else closed += 1;
    }
    return { you, manager, closed, total: rows.length };
  }, [transfers, coverage, trades]);

  const run = (fn: () => Promise<{ error?: string }>) => {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      if ("error" in res && res.error) setMsg(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-8 p-4 max-w-lg mx-auto">
      {msg ? (
        <p className="text-sm text-destructive border border-destructive/30 rounded-md px-3 py-2">{msg}</p>
      ) : null}

      {summary.total > 0 ? (
        <p className="text-xs text-muted-foreground border border-border/60 rounded-md px-3 py-2 bg-muted/20">
          <span className="font-medium text-foreground">Status (feed)</span>: {summary.you} active / teammate step ·{" "}
          {summary.manager} waiting on manager · {summary.closed} closed
        </p>
      ) : null}

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Task transfers</h2>
        {transfers.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="space-y-3">
            {transfers.map((t) => {
              const iAmFrom = t.from_employee_id === employeeId;
              const canAccept =
                t.status === "pending" &&
                !iAmFrom &&
                (t.request_mode === "open_offer" && !t.to_employee_id
                  ? true
                  : t.to_employee_id === employeeId);

              return (
                <li key={t.id} className="border rounded-lg p-4 space-y-2 text-sm bg-card">
                  <p className="font-medium">{t.task_preview}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.from_name} → {t.to_name ?? "Open offer"} · {rowStatusLine(t)}
                  </p>
                  {t.latest_decision_note ? (
                    <p className="text-[11px] text-muted-foreground border-l-2 border-border pl-2">
                      Decision note: {t.latest_decision_note}
                    </p>
                  ) : null}
                  {canAccept ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() => run(async () => acceptTaskTransferRequest(t.id))}
                    >
                      Accept task
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Shift coverage</h2>
        {coverage.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="space-y-3">
            {coverage.map((c) => {
              const canClaim =
                c.status === "pending" &&
                c.requested_by_employee_id !== employeeId &&
                c.request_type === "open_claim";

              return (
                <li key={c.id} className="border rounded-lg p-4 space-y-2 text-sm bg-card">
                  <p className="text-xs text-muted-foreground">{c.request_type}</p>
                  <p>
                    Requested by {c.requested_by_name}
                    {c.claimed_by_name ? ` · Claimed by ${c.claimed_by_name}` : ""}
                  </p>
                  <p className="text-xs">{rowStatusLine(c)}</p>
                  {c.latest_decision_note ? (
                    <p className="text-[11px] text-muted-foreground border-l-2 border-border pl-2">
                      Decision note: {c.latest_decision_note}
                    </p>
                  ) : null}
                  {c.reason ? <p className="text-xs italic">&ldquo;{c.reason}&rdquo;</p> : null}
                  {canClaim ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() => run(async () => claimCoverageRequest(c.id))}
                    >
                      Claim coverage
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Shift trades</h2>
        {trades.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="space-y-3">
            {trades.map((tr) => {
              const canAccept =
                tr.status === "pending" &&
                tr.offering_employee_id !== employeeId &&
                (tr.target_employee_id === null || tr.target_employee_id === employeeId);
              return (
                <li key={tr.id} className="border rounded-lg p-4 space-y-2 text-sm bg-card">
                  <p>
                    {tr.offering_name}
                    {tr.target_name ? ` → ${tr.target_name}` : " · Open offer"}
                  </p>
                  <p className="text-xs">{rowStatusLine(tr)}</p>
                  {tr.latest_decision_note ? (
                    <p className="text-[11px] text-muted-foreground border-l-2 border-border pl-2">
                      Decision note: {tr.latest_decision_note}
                    </p>
                  ) : null}
                  {tr.reason ? <p className="text-xs italic">&ldquo;{tr.reason}&rdquo;</p> : null}
                  {canAccept ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() => run(async () => acceptShiftTrade(tr.id))}
                    >
                      Accept trade
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
