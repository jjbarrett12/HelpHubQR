import type { ApprovalInboxItem, ApprovalKind, OpsSeverity } from "@/components/today-command-center/mock-data";
import type { RequestFeedItem } from "@/lib/helphub/requests/request-feed";
import { labelRequestFeedStatusForManager } from "@/lib/helphub/requests/request-feed-labels";

function toApprovalKind(kind: RequestFeedItem["kind"]): ApprovalKind {
  switch (kind) {
    case "task_transfer":
      return "task_transfer";
    case "open_shift_claim":
      return "open_shift_pickup";
    case "swap":
      return "shift_trade";
    case "coverage":
    default:
      return "shift_coverage";
  }
}

function urgencyToSeverity(u: RequestFeedItem["urgency"]): OpsSeverity {
  if (u === "high") return "problem";
  if (u === "normal") return "warning";
  return "normal";
}

function titleForRow(kind: ApprovalKind, row: RequestFeedItem): string {
  if (kind === "task_transfer") return row.task?.title?.trim() || "Task transfer";
  if (kind === "open_shift_pickup") return "Open shift pickup";
  if (kind === "shift_trade") return "Shift trade";
  return "Coverage";
}

/** Compact summary for Today card (no internal ids in primary line). */
function buildApprovalSummary(row: RequestFeedItem, kind: ApprovalKind): string {
  const who = row.requester.name?.trim() || "Employee";
  const statusLine = labelRequestFeedStatusForManager(row.status);
  const ctx =
    kind === "task_transfer"
      ? row.task?.title?.trim() || "Task"
      : row.shift?.role?.trim() || row.shift_date?.trim() || "Shift";
  const parts = [`${who} · ${ctx}`, statusLine];
  if (row.reason?.trim()) parts.push(`“${row.reason.trim().slice(0, 80)}${row.reason.length > 80 ? "…" : ""}”`);
  return parts.join(" · ");
}

export function mapRequestFeedItemToApprovalInboxItem(row: RequestFeedItem): ApprovalInboxItem {
  const kind = toApprovalKind(row.kind);
  return {
    id: row.id,
    kind,
    title: titleForRow(kind, row),
    summary: buildApprovalSummary(row, kind),
    requestedAt: row.created_at,
    severity: urgencyToSeverity(row.urgency),
    sourceTable: row.source_table,
    sourceId: row.source_id,
    feedStatus: row.status,
    requesterName: row.requester.name?.trim() || "Unknown",
    reason: row.reason,
    latestDecisionNote: null,
  };
}
