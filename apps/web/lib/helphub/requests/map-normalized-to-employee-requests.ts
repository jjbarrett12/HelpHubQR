import type { NormalizedWorkforceRequestRow } from "@/lib/helphub/requests/normalized-workforce-request";
import type { RequestFeedStatus } from "@/lib/helphub/requests/request-feed";

/** Shapes expected by `EmployeeMyRequestsClient` (legacy three-list UI). */
export type EmployeeTransferRow = {
  id: string;
  status: string;
  request_mode: string;
  from_employee_id: string;
  to_employee_id: string | null;
  from_name: string;
  to_name: string | null;
  task_preview: string;
  manager_approval_required: boolean;
  /** Set when row is built from `hh_employee_requests_feed`. */
  feed_status?: RequestFeedStatus;
  status_display_line?: string;
  latest_decision_note?: string | null;
};

export type EmployeeCoverageRow = {
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

export type EmployeeTradeRow = {
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

function detailObj(row: NormalizedWorkforceRequestRow): Record<string, unknown> {
  return row.source_detail && typeof row.source_detail === "object"
    ? (row.source_detail as Record<string, unknown>)
    : {};
}

/**
 * Splits normalized feed rows into the three buckets the employee UI already renders.
 * Uses `source_id` (uuid) for mutation calls, not composite `id`.
 */
export function splitNormalizedRowsForEmployeeMyRequests(rows: NormalizedWorkforceRequestRow[]): {
  transfers: EmployeeTransferRow[];
  coverage: EmployeeCoverageRow[];
  trades: EmployeeTradeRow[];
} {
  const transfers: EmployeeTransferRow[] = [];
  const coverage: EmployeeCoverageRow[] = [];
  const trades: EmployeeTradeRow[] = [];

  for (const r of rows) {
    const d = detailObj(r);
    if (r.raw_table === "shift_task_transfer_requests") {
      const fromId = typeof d.from_employee_id === "string" ? d.from_employee_id : "";
      const toId = typeof d.to_employee_id === "string" ? d.to_employee_id : null;
      transfers.push({
        id: r.source_id,
        status: r.raw_status,
        request_mode: typeof d.request_mode === "string" ? d.request_mode : "",
        from_employee_id: fromId,
        to_employee_id: toId,
        from_name:
          r.from_employee_display_name?.trim() ||
          r.requester_display_name?.trim() ||
          "(unknown)",
        to_name: toId ? r.counterparty_display_name?.trim() ?? null : null,
        task_preview: r.context_summary?.trim() || "(task)",
        manager_approval_required: r.manager_approval_required,
      });
      continue;
    }
    if (r.raw_table === "shift_coverage_requests") {
      const reqBy = r.requester_employee_id ?? "";
      const hasClaimer =
        d.claimed_by_employee_id != null &&
        String(d.claimed_by_employee_id).length > 0;
      const claimedName = hasClaimer ? r.counterparty_display_name?.trim() ?? null : null;
      coverage.push({
        id: r.source_id,
        status: r.raw_status,
        request_type: typeof d.request_type === "string" ? d.request_type : "",
        reason: typeof d.reason === "string" ? d.reason : null,
        requested_by_name: r.requester_display_name?.trim() || "(unknown)",
        claimed_by_name: claimedName,
        manager_approval_required: r.manager_approval_required,
        requested_by_employee_id: reqBy,
      });
      continue;
    }
    if (r.raw_table === "shift_trade_offers") {
      const targetId = typeof d.target_employee_id === "string" ? d.target_employee_id : null;
      const acceptedId = typeof d.accepted_by_employee_id === "string" ? d.accepted_by_employee_id : null;
      trades.push({
        id: r.source_id,
        status: r.raw_status,
        reason: typeof d.reason === "string" ? d.reason : null,
        offering_name: r.requester_display_name?.trim() || "(unknown)",
        target_name: targetId ? r.counterparty_display_name?.trim() ?? null : null,
        target_employee_id: targetId,
        accepted_by_name: acceptedId ? r.counterparty_display_name?.trim() ?? null : null,
        manager_approval_required: r.manager_approval_required,
        offering_employee_id: r.requester_employee_id ?? "",
      });
    }
  }

  return { transfers, coverage, trades };
}
