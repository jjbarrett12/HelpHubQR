import type { ApprovalInboxItem, ApprovalKind, OpsSeverity } from "@/components/today-command-center/mock-data";
import type { NormalizedWorkforceRequestRow } from "@/lib/helphub/requests/normalized-workforce-request";
import type { RequestFeedStatus } from "@/lib/helphub/requests/request-feed";

function toApprovalKind(kind: string): ApprovalKind {
  switch (kind) {
    case "task_transfer":
      return "task_transfer";
    case "open_shift_pickup":
      return "open_shift_pickup";
    case "shift_swap":
      return "shift_trade";
    case "coverage_direct_trade":
    case "coverage":
      return "shift_coverage";
    default:
      return "shift_coverage";
  }
}

function urgencyToSeverity(u: string): OpsSeverity {
  if (u === "urgent") return "problem";
  if (u === "soon") return "warning";
  return "normal";
}

/** Legacy normalized view uses `product_status`; align to feed status vocabulary for shared UI types. */
function normalizedProductStatusToFeedStatus(productStatus: string): RequestFeedStatus {
  switch (productStatus) {
    case "pending_manager":
      return "pending_manager";
    case "pending_peer":
      return "pending_employee";
    case "approved":
      return "approved";
    case "denied":
      return "denied";
    case "cancelled":
      return "cancelled";
    case "expired":
      return "expired";
    default:
      return "pending_manager";
  }
}

/**
 * Compact row for Manager Today "Approvals inbox" card (still carries provenance in summary).
 */
export function mapNormalizedRowToApprovalInboxItem(row: NormalizedWorkforceRequestRow): ApprovalInboxItem {
  const kind = toApprovalKind(row.kind);
  const title =
    kind === "task_transfer"
      ? `Task transfer`
      : kind === "open_shift_pickup"
        ? "Open shift pickup"
        : kind === "shift_trade"
          ? "Shift trade"
          : row.kind === "coverage_direct_trade"
            ? "Coverage (direct trade)"
            : "Coverage";

  const summary = [
    row.context_summary?.trim() || "—",
    `Source: ${row.raw_table} · ${row.raw_status} · ${row.id}`,
  ].join(" · ");

  return {
    id: row.id,
    kind,
    title,
    summary,
    requestedAt: row.submitted_at,
    severity: urgencyToSeverity(row.urgency),
    sourceTable: row.raw_table,
    sourceId: row.source_id,
    feedStatus: normalizedProductStatusToFeedStatus(row.product_status),
    requesterName: row.requester_display_name?.trim() || "Unknown",
    reason: null,
    latestDecisionNote: null,
  };
}
