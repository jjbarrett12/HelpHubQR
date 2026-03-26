/**
 * Employee Today — canonical read model for execution (shift + run + run items).
 * @see docs/EMPLOYEE_TODAY_CONTRACT.md
 */
export type {
  EmployeeTodayAnnouncement,
  EmployeeTodayAnnouncements,
  EmployeeTodayBundle,
  EmployeeTodayBundleFailure,
  EmployeeTodayBundleSuccess,
  EmployeeTodayChecklist,
  EmployeeTodayEmployee,
  EmployeeTodayErrorCode,
  EmployeeTodayFocus,
  EmployeeTodayFocusKind,
  EmployeeTodayNextIncomplete,
  EmployeeTodayProgress,
  EmployeeTodayRunItem,
  EmployeeTodayRunSummary,
  EmployeeTodaySection,
  EmployeeTodayShift,
  EmployeeTodayShiftNoteItem,
  EmployeeTodayShiftNotes,
  EmployeeTodaySourceMeta,
} from "./types";
export { fetchEmployeeTodayBundle, type FetchEmployeeTodayParams } from "./fetch-employee-today-bundle";
export { mapEmployeeTodayRpcToBundle } from "./map-rpc-response";
