/**
 * Typed mock data for manager Schedule screen.
 * TODO: Replace with Supabase — employee_shifts, employees, staff_roles, locations,
 * shift_coverage_requests, shift_trades, task_transfer_requests, fairness_assignment_ledger summaries.
 */

export type ShiftType = "open" | "mid" | "close" | "custom";

/** Visual / operational status for blocks (not identical to DB status enum). */
export type ShiftBlockVisualStatus =
  | "assigned"
  | "unassigned"
  | "open_claim"
  | "active_now"
  | "completed"
  | "conflict"
  | "late_start";

export interface ScheduleShiftMock {
  id: string;
  employeeShiftId: string;
  date: string;
  /** Row key — role + location track */
  rowId: string;
  employeeId: string | null;
  employeeName: string | null;
  roleId: string;
  roleName: string;
  locationId: string | null;
  locationName: string;
  shiftType: ShiftType;
  visualStatus: ShiftBlockVisualStatus;
  /** Display window */
  label: string;
  timeWindow: string;
  isOpenForClaim: boolean;
}

export interface OpenShiftRowMock {
  id: string;
  employeeShiftId: string;
  roleName: string;
  locationName: string;
  date: string;
  windowLabel: string;
  claimsPending: number;
  severity: "normal" | "warning" | "problem";
}

export interface UnassignedShiftMock {
  id: string;
  employeeShiftId: string;
  date: string;
  roleName: string;
  locationName: string;
  shiftType: ShiftType;
  reason: string;
}

export interface StaffingAlertMock {
  id: string;
  severity: "warning" | "problem";
  title: string;
  detail: string;
  relatedShiftId?: string;
}

export interface CoverageHistoryLineMock {
  id: string;
  at: string;
  summary: string;
  actor: string;
}

export interface SwapHistoryLineMock {
  id: string;
  at: string;
  summary: string;
  status: "pending" | "approved" | "denied";
}

export interface FairnessAdvisorLineMock {
  id: string;
  text: string;
  advisory: true;
}

export interface EmployeeFitSummaryMock {
  employeeId: string;
  displayName: string;
  roleName: string;
  availabilityNote: string;
  preferenceSummary: string;
  lastWorkedSameRole: string | null;
  hoursThisWeek: number;
}

export interface ShiftDetailMock {
  shiftId: string;
  employeeShiftId: string;
  headline: string;
  subhead: string;
  statusLabel: string;
  visualStatus: ShiftBlockVisualStatus;
  coverageHistory: CoverageHistoryLineMock[];
  swapHistory: SwapHistoryLineMock[];
  fairnessLines: FairnessAdvisorLineMock[];
  employeeFit: EmployeeFitSummaryMock | null;
}

export interface ScheduleGridRowMock {
  id: string;
  roleId: string;
  roleName: string;
  locationId: string;
  locationName: string;
}

export interface ScheduleWeekMock {
  weekStartsOn: string;
  days: { date: string; weekdayShort: string; dayNum: number }[];
  rows: ScheduleGridRowMock[];
  shifts: ScheduleShiftMock[];
  openShifts: OpenShiftRowMock[];
  unassigned: UnassignedShiftMock[];
  alerts: StaffingAlertMock[];
  shiftDetails: Record<string, ShiftDetailMock>;
}

function addDays(isoDate: string, delta: number): string {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Build a reference week from a Monday yyyy-MM-dd */
export function buildMockWeek(weekMonday: string): ScheduleWeekMock {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekMonday, i);
    const wd = new Date(date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" });
    const dayNum = parseInt(date.slice(8, 10), 10);
    return { date, weekdayShort: wd, dayNum };
  });

  const rows: ScheduleGridRowMock[] = [
    { id: "r1", roleId: "role1", roleName: "Front desk", locationId: "loc1", locationName: "Main lobby" },
    { id: "r2", roleId: "role2", roleName: "Housekeeping", locationId: "loc2", locationName: "Tower A" },
    { id: "r3", roleId: "role3", roleName: "Maintenance", locationId: "loc3", locationName: "Basement" },
    { id: "r4", roleId: "role4", roleName: "Events", locationId: "loc4", locationName: "Ballroom" },
  ];

  const mon = days[0].date;
  const tue = days[1].date;
  const wed = days[2].date;
  const thu = days[3].date;
  const fri = days[4].date;

  const shifts: ScheduleShiftMock[] = [
    {
      id: "s1",
      employeeShiftId: "es-s1",
      date: mon,
      rowId: "r1",
      employeeId: "e1",
      employeeName: "Jordan Lee",
      roleId: "role1",
      roleName: "Front desk",
      locationId: "loc1",
      locationName: "Main lobby",
      shiftType: "open",
      visualStatus: "completed",
      label: "Open",
      timeWindow: "6:00a – 2:00p",
      isOpenForClaim: false,
    },
    {
      id: "s2",
      employeeShiftId: "es-s2",
      date: mon,
      rowId: "r1",
      employeeId: "e2",
      employeeName: "Sam Rivera",
      roleId: "role1",
      roleName: "Front desk",
      locationId: "loc1",
      locationName: "Main lobby",
      shiftType: "mid",
      visualStatus: "active_now",
      label: "Mid",
      timeWindow: "2:00p – 10:00p",
      isOpenForClaim: false,
    },
    {
      id: "s3",
      employeeShiftId: "es-s3",
      date: tue,
      rowId: "r1",
      employeeId: null,
      employeeName: null,
      roleId: "role1",
      roleName: "Front desk",
      locationId: "loc1",
      locationName: "Main lobby",
      shiftType: "open",
      visualStatus: "unassigned",
      label: "Open · unassigned",
      timeWindow: "6:00a – 2:00p",
      isOpenForClaim: false,
    },
    {
      id: "s4",
      employeeShiftId: "es-s4",
      date: wed,
      rowId: "r1",
      employeeId: "e3",
      employeeName: "Alex Kim",
      roleId: "role1",
      roleName: "Front desk",
      locationId: "loc1",
      locationName: "Main lobby",
      shiftType: "close",
      visualStatus: "open_claim",
      label: "Close · open claim",
      timeWindow: "4:00p – 12:00a",
      isOpenForClaim: true,
    },
    {
      id: "s5",
      employeeShiftId: "es-s5",
      date: mon,
      rowId: "r2",
      employeeId: "e4",
      employeeName: "Riley Chen",
      roleId: "role2",
      roleName: "Housekeeping",
      locationId: "loc2",
      locationName: "Tower A",
      shiftType: "mid",
      visualStatus: "late_start",
      label: "Mid",
      timeWindow: "8:00a – 4:00p",
      isOpenForClaim: false,
    },
    {
      id: "s6",
      employeeShiftId: "es-s6",
      date: thu,
      rowId: "r2",
      employeeId: "e4",
      employeeName: "Riley Chen",
      roleId: "role2",
      roleName: "Housekeeping",
      locationId: "loc2",
      locationName: "Tower A",
      shiftType: "mid",
      visualStatus: "conflict",
      label: "Double-book risk",
      timeWindow: "8:00a – 4:00p",
      isOpenForClaim: false,
    },
    {
      id: "s7",
      employeeShiftId: "es-s7",
      date: fri,
      rowId: "r3",
      employeeId: "e5",
      employeeName: "Taylor Brooks",
      roleId: "role3",
      roleName: "Maintenance",
      locationId: "loc3",
      locationName: "Basement",
      shiftType: "custom",
      visualStatus: "assigned",
      label: "Rounds",
      timeWindow: "7:00a – 3:00p",
      isOpenForClaim: false,
    },
  ];

  const openShifts: OpenShiftRowMock[] = [
    {
      id: "os1",
      employeeShiftId: "es-s4",
      roleName: "Front desk",
      locationName: "Main lobby",
      date: wed,
      windowLabel: "Close 4p–12a",
      claimsPending: 2,
      severity: "warning",
    },
    {
      id: "os2",
      employeeShiftId: "es-os2",
      roleName: "Events",
      locationName: "Ballroom",
      date: fri,
      windowLabel: "Setup 10a–6p",
      claimsPending: 0,
      severity: "problem",
    },
  ];

  const unassigned: UnassignedShiftMock[] = [
    {
      id: "u1",
      employeeShiftId: "es-s3",
      date: tue,
      roleName: "Front desk",
      locationName: "Main lobby",
      shiftType: "open",
      reason: "No assignee after auto-fill",
    },
  ];

  const alerts: StaffingAlertMock[] = [
    {
      id: "a1",
      severity: "problem",
      title: "Coverage gap",
      detail: "Front desk Tue 6a–2p has no assignee.",
      relatedShiftId: "s3",
    },
    {
      id: "a2",
      severity: "warning",
      title: "Possible double booking",
      detail: "Riley Chen overlaps Thu HK mid with events hold.",
      relatedShiftId: "s6",
    },
  ];

  const shiftDetails: Record<string, ShiftDetailMock> = {
    s2: {
      shiftId: "s2",
      employeeShiftId: "es-s2",
      headline: "Sam Rivera · Front desk",
      subhead: "Main lobby · Mid · Mon",
      statusLabel: "Active now",
      visualStatus: "active_now",
      coverageHistory: [
        { id: "c1", at: addDays(mon, -1) + "T18:00:00Z", summary: "Shift created from template", actor: "System" },
      ],
      swapHistory: [{ id: "w1", at: mon + "T09:00:00Z", summary: "No pending swaps", status: "approved" }],
      fairnessLines: [
        { id: "f1", text: "Mid shifts this week: 3/5 vs team avg 2.1 (advisory)", advisory: true },
      ],
      employeeFit: {
        employeeId: "e2",
        displayName: "Sam Rivera",
        roleName: "Housekeeping cross-train",
        availabilityNote: "Listed available Mon–Thu evenings",
        preferenceSummary: "Prefers mid · Avoids close (preference only)",
        lastWorkedSameRole: "Sun (open)",
        hoursThisWeek: 18,
      },
    },
    s3: {
      shiftId: "s3",
      employeeShiftId: "es-s3",
      headline: "Unassigned · Front desk",
      subhead: "Main lobby · Open · Tue",
      statusLabel: "Needs assignee",
      visualStatus: "unassigned",
      coverageHistory: [],
      swapHistory: [],
      fairnessLines: [{ id: "f2", text: "Assign to balance open-shift pickups across team (advisory)", advisory: true }],
      employeeFit: null,
    },
  };

  // Default detail template for any shift
  for (const sh of shifts) {
    if (!shiftDetails[sh.id]) {
      shiftDetails[sh.id] = {
        shiftId: sh.id,
        employeeShiftId: sh.employeeShiftId,
        headline: sh.employeeName ? `${sh.employeeName} · ${sh.roleName}` : `Unassigned · ${sh.roleName}`,
        subhead: `${sh.locationName} · ${sh.label} · ${sh.date}`,
        statusLabel: sh.visualStatus.replace(/_/g, " "),
        visualStatus: sh.visualStatus,
        coverageHistory: [
          { id: "cx", at: sh.date + "T08:00:00Z", summary: "Shift published", actor: "Manager" },
        ],
        swapHistory: [],
        fairnessLines: [{ id: "fx", text: "No fairness flags for this slot in mock data.", advisory: true }],
        employeeFit: sh.employeeId
          ? {
              employeeId: sh.employeeId,
              displayName: sh.employeeName ?? "—",
              roleName: sh.roleName,
              availabilityNote: "TODO: load employee_availability / schedule prefs",
              preferenceSummary: "TODO: employee_task_preferences + taxonomy labels",
              lastWorkedSameRole: "TODO: last shift same role",
              hoursThisWeek: 0,
            }
          : null,
      };
    }
  }

  return {
    weekStartsOn: weekMonday,
    days,
    rows,
    shifts,
    openShifts,
    unassigned,
    alerts,
    shiftDetails,
  };
}
