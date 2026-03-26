import type { RequestFeedItem } from "@/lib/helphub/requests/request-feed";

/** Tables supported by `approveRequestFromFeed` / `denyRequestFromFeed`. */
export const FEED_APPROVAL_SOURCE_TABLES = new Set([
  "shift_task_transfer_requests",
  "shift_coverage_requests",
  "shift_trade_offers",
]);

/** Rows shown on Manager Today with inline approve/deny (same gate as request detail panel). */
export function isManagerTodayApprovalActionable(row: RequestFeedItem): boolean {
  return (
    FEED_APPROVAL_SOURCE_TABLES.has(row.source_table) &&
    row.status === "pending_manager" &&
    row.manager_action_required === true
  );
}
