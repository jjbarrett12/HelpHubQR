import type { RequestFeedItem, RequestFeedStatus } from "@/lib/helphub/requests/request-feed";

/**
 * Single source of truth for human-readable feed statuses (keep aligned with manager `REQUEST_STATUS_LABEL`).
 */
export const REQUEST_FEED_STATUS_LABEL: Record<RequestFeedStatus, string> = {
  pending_manager: "Needs manager",
  pending_employee: "Awaiting employee",
  approved: "Approved",
  executed: "Executed",
  denied: "Denied",
  cancelled: "Cancelled",
  expired: "Expired",
};

/** Manager-facing label (inbox / Today card badge). */
export function labelRequestFeedStatusForManager(status: RequestFeedStatus): string {
  return REQUEST_FEED_STATUS_LABEL[status] ?? status;
}

/**
 * Employee-facing one-liner: combines normalized status with who must act next.
 * Do not re-map to a second enum — always derive from `RequestFeedItem`.
 */
export function describeRequestFeedStatusForEmployee(row: RequestFeedItem): string {
  const base = REQUEST_FEED_STATUS_LABEL[row.status] ?? row.status;
  if (row.status === "pending_manager" && row.manager_action_required) {
    return "Waiting for manager approval";
  }
  if (row.status === "pending_employee" && row.employee_action_required) {
    return "Action needed from you or a teammate";
  }
  if (row.status === "approved") {
    return row.manager_action_required ? "Approved — finalizing" : "Approved";
  }
  if (row.status === "executed") {
    return "Completed";
  }
  return base;
}
