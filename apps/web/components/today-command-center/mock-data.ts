/**
 * Typed mock data for Manager Today Command Center.
 * TODO(realtime): Replace with Supabase queries + channel subscriptions (organization_id scoped).
 * See TODO markers in each type block for source tables / RPCs.
 */

import type { RequestFeedStatus } from "@/lib/helphub/requests/request-feed";

export type OpsSeverity = "normal" | "warning" | "problem";

// --- Staffing (employee_shifts, employees, locations, profiles) ---
export interface WorkingNowPerson {
  id: string;
  employeeId: string;
  displayName: string;
  roleLabel: string;
  locationName: string;
  shiftTypeLabel: string;
  /** Scheduled clock-in */
  startedAt: string;
  checklistProgress: { done: number; total: number };
  severity: OpsSeverity;
}

export interface NextUpShift {
  id: string;
  employeeShiftId: string;
  displayName: string;
  roleLabel: string;
  locationName: string;
  startsAt: string;
  shiftTypeLabel: string;
}

export interface AttendanceFlag {
  id: string;
  employeeShiftId: string;
  displayName: string;
  flagType: "late" | "no_show" | "unscheduled" | "early_leave";
  detail: string;
  since: string;
  severity: OpsSeverity;
}

// --- Execution (shift_checklist_runs, shift_checklist_run_items) ---
export interface ShiftChecklistProgress {
  id: string;
  employeeShiftId: string;
  runId: string;
  displayName: string;
  roleLabel: string;
  locationName: string;
  completedTasks: number;
  totalTasks: number;
  runStatus: "not_started" | "in_progress" | "completed";
  severity: OpsSeverity;
}

export interface OverdueTask {
  id: string;
  runItemId: string;
  runId: string;
  taskText: string;
  assigneeName: string;
  dueBy: string;
  minutesOver: number;
  severity: OpsSeverity;
}

export interface MissingPhotoTask {
  id: string;
  runItemId: string;
  runId: string;
  taskText: string;
  assigneeName: string;
  locationName: string;
  severity: OpsSeverity;
}

// --- Actions (approvals, open shifts, issues, fairness) ---
export type ApprovalKind =
  | "task_transfer"
  | "shift_coverage"
  | "shift_trade"
  | "open_shift_pickup";

export interface ApprovalInboxItem {
  id: string;
  kind: ApprovalKind;
  title: string;
  summary: string;
  requestedAt: string;
  severity: OpsSeverity;
  sourceTable: string;
  sourceId: string;
  feedStatus: RequestFeedStatus;
  requesterName: string;
  reason: string | null;
  latestDecisionNote: string | null;
}

export interface OpenShiftRow {
  id: string;
  employeeShiftId: string;
  roleLabel: string;
  locationName: string;
  windowLabel: string;
  claimCount: number;
  severity: OpsSeverity;
}

export interface OpsIssue {
  id: string;
  source: "qr" | "checklist" | "guest" | "internal";
  title: string;
  locationName: string;
  openedAt: string;
  severity: OpsSeverity;
}

export interface FairnessAlertRow {
  id: string;
  message: string;
  employeeName?: string;
  taskKeyLabel?: string;
  advisory: true;
  severity: OpsSeverity;
}

// --- Bottom row ---
export interface RosterTimelineBlock {
  id: string;
  employeeId: string;
  displayName: string;
  roleLabel: string;
  /** 0–24 hour fractional positions for UI (mock) */
  blocks: { startHour: number; endHour: number; label: string; tone: "work" | "break" | "off" }[];
}

export interface RecentlyCompletedShift {
  id: string;
  employeeShiftId: string;
  displayName: string;
  roleLabel: string;
  completedAt: string;
  runSummary: string;
}

export interface ManagerNote {
  id: string;
  authorLabel: string;
  body: string;
  createdAt: string;
}

export interface TodayCommandCenterMock {
  workingNow: WorkingNowPerson[];
  nextUp: NextUpShift[];
  attendanceFlags: AttendanceFlag[];
  checklistByShift: ShiftChecklistProgress[];
  overdueTasks: OverdueTask[];
  missingPhotos: MissingPhotoTask[];
  approvals: ApprovalInboxItem[];
  openShifts: OpenShiftRow[];
  issues: OpsIssue[];
  fairnessAlerts: FairnessAlertRow[];
  rosterTimeline: RosterTimelineBlock[];
  recentlyCompleted: RecentlyCompletedShift[];
  managerNotes: ManagerNote[];
}

export const MOCK_TODAY_COMMAND: TodayCommandCenterMock = {
  workingNow: [
    {
      id: "wn1",
      employeeId: "e1",
      displayName: "Jordan Lee",
      roleLabel: "Front desk",
      locationName: "Main lobby",
      shiftTypeLabel: "Open",
      startedAt: new Date().toISOString(),
      checklistProgress: { done: 7, total: 12 },
      severity: "normal",
    },
    {
      id: "wn2",
      employeeId: "e2",
      displayName: "Sam Rivera",
      roleLabel: "Housekeeping lead",
      locationName: "Tower A",
      shiftTypeLabel: "Mid",
      startedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      checklistProgress: { done: 3, total: 18 },
      severity: "warning",
    },
    {
      id: "wn3",
      employeeId: "e3",
      displayName: "Alex Kim",
      roleLabel: "Maintenance",
      locationName: "Basement / MEP",
      shiftTypeLabel: "Mid",
      startedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      checklistProgress: { done: 11, total: 11 },
      severity: "normal",
    },
  ],
  nextUp: [
    {
      id: "nu1",
      employeeShiftId: "sh1",
      displayName: "Casey Morgan",
      roleLabel: "Closer",
      locationName: "Main lobby",
      startsAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      shiftTypeLabel: "Close",
    },
    {
      id: "nu2",
      employeeShiftId: "sh2",
      displayName: "Riley Chen",
      roleLabel: "Runner",
      locationName: "Events hall",
      startsAt: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      shiftTypeLabel: "Custom",
    },
  ],
  attendanceFlags: [
    {
      id: "af1",
      employeeShiftId: "shx",
      displayName: "Pat Ng",
      flagType: "late",
      detail: "15+ min past scheduled start, no clock-in",
      since: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
      severity: "problem",
    },
    {
      id: "af2",
      employeeShiftId: "shy",
      displayName: "Drew Ortiz",
      flagType: "no_show",
      detail: "No response to coverage ping",
      since: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      severity: "problem",
    },
  ],
  checklistByShift: [
    {
      id: "cp1",
      employeeShiftId: "es1",
      runId: "run1",
      displayName: "Jordan Lee",
      roleLabel: "Front desk",
      locationName: "Main lobby",
      completedTasks: 7,
      totalTasks: 12,
      runStatus: "in_progress",
      severity: "normal",
    },
    {
      id: "cp2",
      employeeShiftId: "es2",
      runId: "run2",
      displayName: "Sam Rivera",
      roleLabel: "Housekeeping lead",
      locationName: "Tower A",
      completedTasks: 3,
      totalTasks: 18,
      runStatus: "in_progress",
      severity: "warning",
    },
    {
      id: "cp3",
      employeeShiftId: "es3",
      runId: "run3",
      displayName: "Alex Kim",
      roleLabel: "Maintenance",
      locationName: "Basement / MEP",
      completedTasks: 11,
      totalTasks: 11,
      runStatus: "completed",
      severity: "normal",
    },
  ],
  overdueTasks: [
    {
      id: "od1",
      runItemId: "ri1",
      runId: "run2",
      taskText: "Inspect fire exits — floor 3",
      assigneeName: "Sam Rivera",
      dueBy: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      minutesOver: 25,
      severity: "problem",
    },
    {
      id: "od2",
      runItemId: "ri2",
      runId: "run1",
      taskText: "Lobby safety walk",
      assigneeName: "Jordan Lee",
      dueBy: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      minutesOver: 8,
      severity: "warning",
    },
  ],
  missingPhotos: [
    {
      id: "mp1",
      runItemId: "ri9",
      runId: "run2",
      taskText: "Pool chemical log photo",
      assigneeName: "Sam Rivera",
      locationName: "Tower A",
      severity: "warning",
    },
  ],
  approvals: [
    {
      id: "shift_task_transfer_requests/00000000-0000-0000-0000-00000000a001",
      kind: "task_transfer",
      title: "Trash run — parking deck",
      summary: "Morgan · Trash run · Needs manager",
      requestedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      severity: "warning",
      sourceTable: "shift_task_transfer_requests",
      sourceId: "00000000-0000-0000-0000-00000000a001",
      feedStatus: "pending_manager",
      requesterName: "Morgan",
      reason: null,
      latestDecisionNote: null,
    },
    {
      id: "shift_coverage_requests/00000000-0000-0000-0000-00000000a002",
      kind: "shift_coverage",
      title: "Front desk gap 2–4pm",
      summary: "Chen · Front desk · Needs manager",
      requestedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      severity: "problem",
      sourceTable: "shift_coverage_requests",
      sourceId: "00000000-0000-0000-0000-00000000a002",
      feedStatus: "pending_manager",
      requesterName: "Chen",
      reason: null,
      latestDecisionNote: null,
    },
    {
      id: "shift_trade_offers/00000000-0000-0000-0000-00000000a003",
      kind: "shift_trade",
      title: "Shift trade",
      summary: "Alex · Shift trade · Needs manager",
      requestedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      severity: "normal",
      sourceTable: "shift_trade_offers",
      sourceId: "00000000-0000-0000-0000-00000000a003",
      feedStatus: "pending_manager",
      requesterName: "Alex",
      reason: null,
      latestDecisionNote: null,
    },
  ],
  openShifts: [
    {
      id: "os1",
      employeeShiftId: "os_es1",
      roleLabel: "Runner",
      locationName: "Events hall",
      windowLabel: "Today 4:00p – 11:00p",
      claimCount: 2,
      severity: "warning",
    },
  ],
  issues: [
    {
      id: "is1",
      source: "qr",
      title: "Broken QR — parking P2",
      locationName: "Parking P2",
      openedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      severity: "problem",
    },
    {
      id: "is2",
      source: "guest",
      title: "Noise complaint — room 412",
      locationName: "Tower A",
      openedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      severity: "warning",
    },
  ],
  fairnessAlerts: [
    {
      id: "fa1",
      message: "Avoided-task signal above team average",
      employeeName: "Sam Rivera",
      taskKeyLabel: "Trash / dock",
      advisory: true,
      severity: "warning",
    },
    {
      id: "fa2",
      message: "Repeat undesirable task this week",
      employeeName: "Jordan Lee",
      taskKeyLabel: "Restrooms deep clean",
      advisory: true,
      severity: "normal",
    },
  ],
  rosterTimeline: [
    {
      id: "rt1",
      employeeId: "e1",
      displayName: "Jordan Lee",
      roleLabel: "Front desk",
      blocks: [
        { startHour: 6, endHour: 10, label: "Open", tone: "work" },
        { startHour: 10, endHour: 10.5, label: "Break", tone: "break" },
        { startHour: 10.5, endHour: 14, label: "Open", tone: "work" },
      ],
    },
    {
      id: "rt2",
      employeeId: "e2",
      displayName: "Sam Rivera",
      roleLabel: "HK lead",
      blocks: [
        { startHour: 7, endHour: 15, label: "Mid", tone: "work" },
      ],
    },
    {
      id: "rt3",
      employeeId: "e3",
      displayName: "Alex Kim",
      roleLabel: "Maintenance",
      blocks: [
        { startHour: 8, endHour: 12, label: "Rounds", tone: "work" },
        { startHour: 12, endHour: 13, label: "Lunch", tone: "break" },
        { startHour: 13, endHour: 17, label: "Rounds", tone: "work" },
      ],
    },
  ],
  recentlyCompleted: [
    {
      id: "rc1",
      employeeShiftId: "es3",
      displayName: "Alex Kim",
      roleLabel: "Maintenance",
      completedAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
      runSummary: "11/11 tasks · Mid shift",
    },
    {
      id: "rc2",
      employeeShiftId: "es0",
      displayName: "Taylor Brooks",
      roleLabel: "Opener",
      completedAt: new Date(Date.now() - 52 * 60 * 1000).toISOString(),
      runSummary: "9/9 tasks · Open shift",
    },
  ],
  managerNotes: [
    {
      id: "mn1",
      authorLabel: "You",
      body: "Events sound check 6pm — keep runner on standby.",
      createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    },
  ],
};
