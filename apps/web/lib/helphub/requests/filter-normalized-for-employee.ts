import type { NormalizedWorkforceRequestRow } from "@/lib/helphub/requests/normalized-workforce-request";

/**
 * Whether this normalized row concerns the given employee (for "My requests" when the user is also a manager
 * and RLS would otherwise return the whole org).
 */
export function normalizedRowInvolvesEmployee(
  row: NormalizedWorkforceRequestRow,
  employeeId: string
): boolean {
  if (row.requester_employee_id === employeeId || row.counterparty_employee_id === employeeId) {
    return true;
  }
  const d =
    row.source_detail && typeof row.source_detail === "object"
      ? (row.source_detail as Record<string, unknown>)
      : {};
  if (row.raw_table === "shift_task_transfer_requests" && d.from_employee_id === employeeId) {
    return true;
  }
  return false;
}

export function filterNormalizedRowsForEmployee(
  rows: NormalizedWorkforceRequestRow[],
  employeeId: string
): NormalizedWorkforceRequestRow[] {
  return rows.filter((r) => normalizedRowInvolvesEmployee(r, employeeId));
}
