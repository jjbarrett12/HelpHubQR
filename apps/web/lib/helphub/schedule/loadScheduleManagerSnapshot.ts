/**
 * Server loader for `/app/schedule` (manager planning view).
 *
 * Replace `buildMockWeek` in the client with data from this loader:
 *
 * - **Week range:** query `employee_shifts` where `shift_date` between week start/end and `organization_id = $org`.
 * - **Rows (tracks):** distinct `(staff_role_id, location_id)` from those shifts, or from org config tables.
 * - **Open / unassigned:** shifts with `employee_id` null or `status` / flags you define; join `employees` for names.
 * - **Alerts:** derived rules (gaps, overlaps) or a `staffing_alerts` table if you add one.
 * - **Shift detail:** `employee_shifts` row + employee + availability/prefs tables + audit/subrequest tables.
 * - **Mutations:** map UI actions to updates on `employee_shifts`, insert into coverage/swap request tables, and messaging.
 */

import type { ScheduleWeekMock } from "@/components/schedule-manager/mock-data";
import { buildMockWeek } from "@/components/schedule-manager/mock-data";

export async function loadScheduleManagerSnapshot(_args: {
  organizationId: string;
  weekStartsOnMonday: string;
}): Promise<ScheduleWeekMock> {
  // TODO: implement Supabase queries and map into ScheduleWeekMock (or a shared DTO).
  return buildMockWeek(_args.weekStartsOnMonday);
}
