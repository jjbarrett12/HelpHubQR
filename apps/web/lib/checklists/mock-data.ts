/**
 * Typed mock fixtures for checklist UI demos and Storybook-style development.
 * `/app/checklists/runs/demo` renders this payload (no DB row required).
 *
 * TODO: Remove or gate behind env when production-only.
 */

export interface MockRunReviewTask {
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
  overrideSource: "template" | "manager_override" | "employee_request";
  overrideReason: string | null;
  suppressed: boolean;
  assignmentStatus: string;
  assignedEmployeeName: string | null;
  /** Operational flags for manager scan */
  blockedReason: string | null;
  problemReason: string | null;
}

export interface MockRunReviewDetail {
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
  tasks: MockRunReviewTask[];
}

export const MOCK_RUN_REVIEW_DETAIL: MockRunReviewDetail = {
  runId: "demo",
  status: "opened",
  checklistName: "Housekeeping · Mid · Tower A",
  templateId: "00000000-0000-0000-0000-000000000001",
  shiftDate: "2026-03-24",
  shiftType: "mid",
  employeeName: "Jordan Lee",
  roleName: "Housekeeping",
  stationName: "Tower A",
  sentAt: "2026-03-24T13:05:00Z",
  startedAt: "2026-03-24T13:12:00Z",
  completedAt: null,
  updatedAt: "2026-03-24T14:02:00Z",
  tasks: [
    {
      id: "t1",
      checklistItemId: "ci-1",
      taskText: "Strip and remake occupied rooms on 12–14",
      taskKeySnapshot: "room_makeup",
      sectionTitle: "Floors",
      durationEstimateMinutes: 45,
      requiresPhoto: false,
      completed: true,
      completedAt: "2026-03-24T13:40:00Z",
      notes: "Skipped 1208 DND",
      proofPhotoStoragePath: null,
      overrideSource: "template",
      overrideReason: null,
      suppressed: false,
      assignmentStatus: "assigned",
      assignedEmployeeName: "Jordan Lee",
      blockedReason: null,
      problemReason: null,
    },
    {
      id: "t2",
      checklistItemId: "ci-2",
      taskText: "Restock carts — linens",
      taskKeySnapshot: "linen_restock",
      sectionTitle: "Floors",
      durationEstimateMinutes: 15,
      requiresPhoto: true,
      completed: true,
      completedAt: "2026-03-24T13:55:00Z",
      notes: null,
      proofPhotoStoragePath: "org/demo/proof/t2.jpg",
      overrideSource: "template",
      overrideReason: null,
      suppressed: false,
      assignmentStatus: "assigned",
      assignedEmployeeName: "Jordan Lee",
      blockedReason: null,
      problemReason: null,
    },
    {
      id: "t3",
      checklistItemId: "ci-3",
      taskText: "Public restrooms — lobby level",
      taskKeySnapshot: "restrooms_public",
      sectionTitle: "Public areas",
      durationEstimateMinutes: 20,
      requiresPhoto: true,
      completed: false,
      completedAt: null,
      notes: "Waiting on maintenance lockout",
      proofPhotoStoragePath: null,
      overrideSource: "employee_request",
      overrideReason: "Men’s room closed — keys with maintenance",
      suppressed: false,
      assignmentStatus: "assigned",
      assignedEmployeeName: "Jordan Lee",
      blockedReason: "Area not accessible",
      problemReason: null,
    },
    {
      id: "t4",
      checklistItemId: "ci-4",
      taskText: "Dispose hazardous bag from 1410",
      taskKeySnapshot: "hazmat_disposal",
      sectionTitle: "Compliance",
      durationEstimateMinutes: 10,
      requiresPhoto: true,
      completed: true,
      completedAt: "2026-03-24T14:00:00Z",
      notes: "Photo required but not attached — override by lead",
      proofPhotoStoragePath: null,
      overrideSource: "manager_override",
      overrideReason: "Lead verified disposal on radio",
      suppressed: false,
      assignmentStatus: "assigned",
      assignedEmployeeName: "Jordan Lee",
      blockedReason: null,
      problemReason: "Missing proof while marked done",
    },
    {
      id: "t5",
      checklistItemId: "ci-5",
      taskText: "Night audit handoff note",
      taskKeySnapshot: "handoff_note",
      sectionTitle: "Close",
      durationEstimateMinutes: 5,
      requiresPhoto: false,
      completed: false,
      completedAt: null,
      notes: null,
      proofPhotoStoragePath: null,
      overrideSource: "template",
      overrideReason: null,
      suppressed: true,
      assignmentStatus: "assigned",
      assignedEmployeeName: "Jordan Lee",
      blockedReason: "Suppressed from run",
      problemReason: null,
    },
  ],
};
