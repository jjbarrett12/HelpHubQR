import type { EmployeeShiftStatus, ShiftChecklistRunStatus } from "./types";

export function runStatusAfterOpen(current: ShiftChecklistRunStatus): ShiftChecklistRunStatus {
  if (current === "completed" || current === "expired") return current;
  if (current === "pending") return "opened";
  if (current === "sent") return "opened";
  return current;
}

export function runStatusAfterSend(current: ShiftChecklistRunStatus): ShiftChecklistRunStatus {
  if (current === "completed" || current === "expired") return current;
  if (current === "opened") return current;
  return "sent";
}

export function shiftStatusForRunProgress(
  runStatus: ShiftChecklistRunStatus,
  allItemsDone: boolean
): EmployeeShiftStatus | null {
  if (runStatus === "completed" || allItemsDone) return "completed";
  if (runStatus === "opened") return "in_progress";
  if (runStatus === "sent") return "sent";
  return null;
}
