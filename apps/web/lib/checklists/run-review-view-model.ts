/** Normalized shape for shift run review UI (DB rows or mock). */

export type RunReviewOverrideSource = "template" | "manager_override" | "employee_request";

export interface RunReviewTaskView {
  id: string;
  checklistItemId: string;
  taskText: string;
  taskKeySnapshot: string | null;
  sectionTitle: string | null;
  durationEstimateMinutes: number | null;
  requiresPhoto: boolean;
  completed: boolean;
  completedAt: string | null;
  notes: string | null;
  proofPhotoStoragePath: string | null;
  overrideSource: RunReviewOverrideSource;
  overrideReason: string | null;
  suppressed: boolean;
  assignmentStatus: string;
  assignedEmployeeName: string | null;
  blockedReason: string | null;
  problemReason: string | null;
}

export interface RunReviewViewModel {
  runId: string;
  status: string;
  checklistName: string;
  templateId: string;
  shiftDate: string;
  shiftType: string;
  employeeName: string;
  roleName: string;
  stationName: string | null;
  sentAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  tasks: RunReviewTaskView[];
}

export function deriveRunTaskSignals(t: RunReviewTaskView): {
  missingProof: boolean;
  isBlocked: boolean;
  isProblem: boolean;
} {
  const missingProof =
    t.completed && t.requiresPhoto && !(t.proofPhotoStoragePath && t.proofPhotoStoragePath.trim());
  const isBlocked = Boolean(t.suppressed) || Boolean(t.blockedReason);
  const isProblem = Boolean(t.problemReason) || missingProof;
  return { missingProof, isBlocked, isProblem };
}
