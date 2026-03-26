import type { SupabaseClient } from "@supabase/supabase-js";
import type { TodayCommandCenterMock } from "@/components/today-command-center/mock-data";
import { MOCK_TODAY_COMMAND } from "@/components/today-command-center/mock-data";

export type TodaySnapshotResult = {
  data: TodayCommandCenterMock;
  /** live = all sections from DB; partial = some sections still defaulted */
  source: "live" | "partial" | "mock";
};

/**
 * Single loader for /app/today. Replace MOCK merge with real queries.
 *
 * TODO: Implement per section:
 * - workingNow, nextUp, attendanceFlags → employee_shifts + employees + locations (+ time rules)
 * - checklistByShift, overdueTasks, missingPhotos → shift_checklist_runs, shift_checklist_run_items, checklist_items
 * - approvals → task_transfer_requests, shift_coverage_requests, shift_task_transfer_requests / trades / open claims
 * - openShifts → employee_shifts open_for_claim + claim counts
 * - issues → qr_issue_reports (+ future issues table)
 * - fairnessAlerts → fairness_assignment_ledger aggregates (advisory only)
 * - rosterTimeline → build segments from shifts (and breaks if modeled)
 * - recentlyCompleted → runs completed today
 * - managerNotes → new table manager_shift_notes (org_id, shift_date, author, body) or reuse audit log
 *
 * Operational Realtime: `OperationalOrgRealtimeRefresh` on the Today Command Center client triggers `router.refresh()` (see docs/HELP_OPERATIONAL_REALTIME.md).
 */
export async function loadTodayCommandCenterSnapshot(
  _supabase: SupabaseClient,
  _organizationId: string
): Promise<TodaySnapshotResult> {
  return { data: MOCK_TODAY_COMMAND, source: "mock" };
}
