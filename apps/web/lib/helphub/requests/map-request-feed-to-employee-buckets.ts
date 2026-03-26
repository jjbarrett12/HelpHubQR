import type { RequestFeedItem } from "@/lib/helphub/requests/request-feed";
import { describeRequestFeedStatusForEmployee } from "@/lib/helphub/requests/request-feed-labels";
import type {
  EmployeeCoverageRow,
  EmployeeTradeRow,
  EmployeeTransferRow,
} from "@/lib/helphub/requests/map-normalized-to-employee-requests";

/**
 * Maps canonical feed items into the existing three-list employee UI (`status` stays operational for mutations).
 */
export function mapRequestFeedToEmployeeBuckets(
  items: RequestFeedItem[],
  _employeeId: string,
  options?: { latestDecisionNoteBySourceId?: Record<string, string | undefined | null> }
): {
  transfers: EmployeeTransferRow[];
  coverage: EmployeeCoverageRow[];
  trades: EmployeeTradeRow[];
} {
  const noteMap = options?.latestDecisionNoteBySourceId ?? {};
  const transfers: EmployeeTransferRow[] = [];
  const coverage: EmployeeCoverageRow[] = [];
  const trades: EmployeeTradeRow[] = [];

  for (const r of items) {
    const decisionNote = noteMap[r.source_id]?.trim() || null;

    if (r.kind === "task_transfer") {
      const fromId = (r.requester.employee_id as string) || "";
      const toId = r.target_employee?.employee_id ?? null;
      const taskTitle = r.task?.title ?? "(task)";
      const requestMode =
        r.task?.request_mode ?? r.source_request_type ?? (toId ? "direct" : "open_offer");
      transfers.push({
        id: r.source_id,
        status: mapFeedStatusToRawTaskStatus(r.status),
        request_mode: requestMode,
        from_employee_id: fromId,
        to_employee_id: toId,
        from_name: r.requester.name?.trim() || "(unknown)",
        to_name: toId ? r.target_employee?.name?.trim() ?? null : null,
        task_preview: taskTitle,
        manager_approval_required: r.manager_action_required,
        feed_status: r.status,
        status_display_line: describeRequestFeedStatusForEmployee(r),
        latest_decision_note: decisionNote,
      });
      continue;
    }

    if (r.kind === "coverage" || r.kind === "open_shift_claim") {
      const requestType =
        r.kind === "open_shift_claim"
          ? "open_claim"
          : r.source_request_type === "direct_trade"
            ? "direct_trade"
            : r.source_request_type === "open_claim"
              ? "open_claim"
              : "direct_cover";
      coverage.push({
        id: r.source_id,
        status: mapFeedStatusToRawCoverageStatus(r.status),
        request_type: requestType,
        reason: r.reason,
        requested_by_name: r.requester.name?.trim() || "(unknown)",
        claimed_by_name: r.target_employee?.name?.trim() ?? null,
        manager_approval_required: r.manager_action_required,
        requested_by_employee_id: r.requester.employee_id,
        feed_status: r.status,
        status_display_line: describeRequestFeedStatusForEmployee(r),
        latest_decision_note: decisionNote,
      });
      continue;
    }

    if (r.kind === "swap") {
      trades.push({
        id: r.source_id,
        status: mapFeedStatusToRawTradeStatus(r.status),
        reason: r.reason,
        offering_name: r.requester.name?.trim() || "(unknown)",
        target_name: r.target_employee?.name?.trim() ?? null,
        target_employee_id: r.target_employee?.employee_id ?? null,
        accepted_by_name:
          r.target_employee && r.target_employee.employee_id !== r.requester.employee_id
            ? r.target_employee.name?.trim() ?? null
            : null,
        manager_approval_required: r.manager_action_required,
        offering_employee_id: r.requester.employee_id,
        feed_status: r.status,
        status_display_line: describeRequestFeedStatusForEmployee(r),
        latest_decision_note: decisionNote,
      });
    }
  }

  return { transfers, coverage, trades };
}

function mapFeedStatusToRawTaskStatus(s: RequestFeedItem["status"]): string {
  switch (s) {
    case "pending_manager":
    case "pending_employee":
      return "pending";
    case "executed":
    case "approved":
      return "approved";
    case "denied":
      return "denied";
    case "cancelled":
      return "cancelled";
    case "expired":
      return "expired";
    default:
      return "pending";
  }
}

function mapFeedStatusToRawCoverageStatus(s: RequestFeedItem["status"]): string {
  return mapFeedStatusToRawTaskStatus(s);
}

function mapFeedStatusToRawTradeStatus(s: RequestFeedItem["status"]): string {
  return mapFeedStatusToRawTaskStatus(s);
}
