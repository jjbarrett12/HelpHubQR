/**
 * Typed mock data for manager Requests & Approvals inbox.
 * Live data: `hh_manager_requests_feed` + `map-request-feed-to-manager-detail` (see docs/REQUEST_FEED_CONTRACT.md).
 */

export type RequestKind =
  | "shift_swap"
  | "coverage"
  | "open_shift_pickup"
  | "task_transfer"
  | "schedule_change"
  | "availability_change";

export type RequestUrgency = "normal" | "soon" | "urgent";

export type RequestStatus =
  | "pending_manager"
  | "pending_peer"
  | "pending_employee"
  | "approved"
  | "executed"
  | "denied"
  | "cancelled"
  | "expired";

export interface ManagerRequestListItem {
  id: string;
  kind: RequestKind;
  /** Short label for the row */
  title: string;
  employeeName: string;
  employeeId: string;
  /** Shift / task / date one-liner */
  contextLine: string;
  reason: string | null;
  submittedAt: string;
  status: RequestStatus;
  urgency: RequestUrgency;
  /** Operational impact hint for triage */
  impactSummary: string;
  needsManagerAction: boolean;
  /** Traceability + approve/deny dispatch */
  sourceTable: string;
  sourceId: string;
}

export interface HistoryEntryMock {
  id: string;
  at: string;
  actor: string;
  summary: string;
}

export interface AffectedPartyMock {
  id: string;
  role: string;
  name: string;
  note?: string;
}

export interface ManagerRequestDetail extends ManagerRequestListItem {
  fullContext: string;
  affectedParties: AffectedPartyMock[];
  proposedCounterparty: {
    name: string;
    employeeId: string;
    relationship: string;
  } | null;
  history: HistoryEntryMock[];
  fairnessAdvisory: string[];
  /** Human-readable provenance */
  sourceTableHint: string;
  /** Normalized feed payload describing the approval mutation */
  actionPayload: Record<string, unknown>;
}

export const REQUEST_KIND_LABEL: Record<RequestKind, string> = {
  shift_swap: "Shift swap",
  coverage: "Coverage",
  open_shift_pickup: "Open shift pickup",
  task_transfer: "Task transfer",
  schedule_change: "Schedule change",
  availability_change: "Availability change",
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  pending_manager: "Needs manager",
  pending_peer: "Awaiting peer",
  pending_employee: "Awaiting employee",
  approved: "Approved",
  executed: "Executed",
  denied: "Denied",
  cancelled: "Cancelled",
  expired: "Expired",
};

export const MOCK_MANAGER_REQUESTS: ManagerRequestDetail[] = [
  {
    id: "req-1",
    kind: "open_shift_pickup",
    title: "Claim open front desk · Tue open",
    employeeName: "Sam Rivera",
    employeeId: "e-sam",
    contextLine: "Tue Mar 25 · Open · Main lobby",
    reason: "Want extra hours; certified on desk.",
    submittedAt: "2026-03-24T09:12:00Z",
    status: "pending_manager",
    urgency: "soon",
    impactSummary: "Fills uncovered 6a–2p slot",
    needsManagerAction: true,
    sourceTable: "shift_coverage_requests",
    sourceId: "00000000-0000-0000-0000-000000000001",
    actionPayload: {},
    fullContext:
      "Employee requests to pick up an open shift posted for Front desk / Open / Main lobby on Tue Mar 25. Slot is currently unassigned after call-out.",
    affectedParties: [
      { id: "a1", role: "Requester", name: "Sam Rivera", note: "Primary role: HK cross-trained desk" },
      { id: "a2", role: "Team", name: "Front desk roster", note: "Coverage gap if denied" },
    ],
    proposedCounterparty: null,
    history: [
      { id: "h1", at: "2026-03-24T09:12:00Z", actor: "Sam Rivera", summary: "Submitted pickup request" },
      { id: "h2", at: "2026-03-24T09:14:00Z", actor: "System", summary: "Flagged manager approval required" },
    ],
    fairnessAdvisory: [
      "Sam has picked up 2 open shifts this week vs team avg 0.6 (advisory only).",
    ],
    sourceTableHint: "shift_coverage_requests + employee_shifts.is_open_for_claim",
  },
  {
    id: "req-2",
    kind: "shift_swap",
    title: "Swap Thu mid with Jordan",
    employeeName: "Alex Kim",
    employeeId: "e-alex",
    contextLine: "Thu Mar 27 mid ↔ Jordan Lee mid",
    reason: "Medical appointment Thu PM; Jordan agreed.",
    submittedAt: "2026-03-24T08:40:00Z",
    status: "pending_manager",
    urgency: "urgent",
    impactSummary: "Same role; both mids — low skill mismatch",
    needsManagerAction: true,
    sourceTable: "shift_trade_offers",
    sourceId: "00000000-0000-0000-0000-000000000002",
    actionPayload: {},
    fullContext:
      "Proposed 1:1 swap of two Housekeeping mid shifts on Thu Mar 27. Peer acceptance recorded in app; manager sign-off still required by policy.",
    affectedParties: [
      { id: "a1", role: "Offering", name: "Alex Kim" },
      { id: "a2", role: "Counterparty", name: "Jordan Lee", note: "Accepted in app" },
    ],
    proposedCounterparty: {
      name: "Jordan Lee",
      employeeId: "e-jordan",
      relationship: "Accepts Alex’s Thu mid; gives Thu mid back (1:1)",
    },
    history: [
      { id: "h1", at: "2026-03-24T08:35:00Z", actor: "Alex Kim", summary: "Opened swap request" },
      { id: "h2", at: "2026-03-24T08:38:00Z", actor: "Jordan Lee", summary: "Accepted swap terms" },
    ],
    fairnessAdvisory: ["No consecutive late-shift penalty pattern detected for either party (advisory)."],
    sourceTableHint: "shift_trade_offers",
  },
  {
    id: "req-3",
    kind: "coverage",
    title: "Coverage for lobby restrooms",
    employeeName: "Riley Chen",
    employeeId: "e-riley",
    contextLine: "Run #4821 · Today · Public area task block",
    reason: "Short-staffed; need backup for restroom check cycle.",
    submittedAt: "2026-03-24T07:55:00Z",
    status: "pending_manager",
    urgency: "urgent",
    impactSummary: "Guest-facing area · SLA risk if not staffed",
    needsManagerAction: true,
    sourceTable: "shift_coverage_requests",
    sourceId: "00000000-0000-0000-0000-000000000003",
    actionPayload: {},
    fullContext:
      "Employee is asking for a coverage assist on an active shift run: recurring public restroom checks during peak hours. No named volunteer yet.",
    affectedParties: [
      { id: "a1", role: "Requester", name: "Riley Chen" },
      { id: "a2", role: "Run", name: "Shift checklist run #4821" },
    ],
    proposedCounterparty: null,
    history: [{ id: "h1", at: "2026-03-24T07:55:00Z", actor: "Riley Chen", summary: "Coverage request filed" }],
    fairnessAdvisory: [],
    sourceTableHint: "shift_coverage_requests",
  },
  {
    id: "req-4",
    kind: "task_transfer",
    title: "Transfer hazmat bag task",
    employeeName: "Taylor Brooks",
    employeeId: "e-taylor",
    contextLine: "Task on run #4810 · Compliance line",
    reason: "Not certified for hazmat this quarter — needs reassignment.",
    submittedAt: "2026-03-23T18:20:00Z",
    status: "pending_manager",
    urgency: "normal",
    impactSummary: "Compliance task must stay assigned",
    needsManagerAction: true,
    sourceTable: "shift_task_transfer_requests",
    sourceId: "00000000-0000-0000-0000-000000000004",
    actionPayload: {},
    fullContext:
      "Task transfer off active run: hazmat disposal line item. Requester is not certified; proposes reassignment to Maintenance lead pool.",
    affectedParties: [
      { id: "a1", role: "From", name: "Taylor Brooks" },
      { id: "a2", role: "Proposed to", name: "Morgan Patel", note: "Has cert · same property" },
    ],
    proposedCounterparty: {
      name: "Morgan Patel",
      employeeId: "e-morgan",
      relationship: "Suggested assignee (direct transfer)",
    },
    history: [
      { id: "h1", at: "2026-03-23T18:20:00Z", actor: "Taylor Brooks", summary: "Requested transfer" },
      { id: "h2", at: "2026-03-23T18:22:00Z", actor: "System", summary: "Routed to manager queue" },
    ],
    fairnessAdvisory: ["Morgan carried 3 compliance-heavy tasks last week (advisory)."],
    sourceTableHint: "shift_task_transfer_requests",
  },
  {
    id: "req-5",
    kind: "schedule_change",
    title: "Drop Sat close (family)",
    employeeName: "Jordan Lee",
    employeeId: "e-jordan",
    contextLine: "Sat Mar 29 · Close · Tower A",
    reason: "Family emergency travel — cannot work close.",
    submittedAt: "2026-03-23T14:00:00Z",
    status: "pending_peer",
    urgency: "normal",
    impactSummary: "Needs replacement or open shift",
    needsManagerAction: false,
    sourceTable: "schedule_change_requests",
    sourceId: "00000000-0000-0000-0000-000000000005",
    actionPayload: {},
    fullContext:
      "Employee asks to drop a scheduled close shift. No replacement identified yet; may convert to open shift after peer window.",
    affectedParties: [{ id: "a1", role: "Requester", name: "Jordan Lee" }],
    proposedCounterparty: null,
    history: [{ id: "h1", at: "2026-03-23T14:00:00Z", actor: "Jordan Lee", summary: "Schedule change submitted" }],
    fairnessAdvisory: [],
    sourceTableHint: "TODO: schedule_change_requests table",
  },
  {
    id: "req-6",
    kind: "availability_change",
    title: "Unavailable Wed evenings (class)",
    employeeName: "Casey Ng",
    employeeId: "e-casey",
    contextLine: "Effective Apr 1 · recurring Wed 4p–12a",
    reason: "Night class Apr–Jun; can work other evenings.",
    submittedAt: "2026-03-22T11:30:00Z",
    status: "pending_manager",
    urgency: "normal",
    impactSummary: "Affects auto-scheduling weights",
    needsManagerAction: true,
    sourceTable: "employee_availability",
    sourceId: "00000000-0000-0000-0000-000000000006",
    actionPayload: {},
    fullContext:
      "Standing availability update: block Wed 4p–12a starting Apr 1. Does not change existing published shifts until planner rebalance.",
    affectedParties: [{ id: "a1", role: "Employee", name: "Casey Ng" }],
    proposedCounterparty: null,
    history: [{ id: "h1", at: "2026-03-22T11:30:00Z", actor: "Casey Ng", summary: "Availability change submitted" }],
    fairnessAdvisory: ["Wed closes historically lean — verify roster (advisory)."],
    sourceTableHint: "TODO: employee_availability or preference store",
  },
  {
    id: "req-7",
    kind: "coverage",
    title: "Offer to cover Fri open",
    employeeName: "Riley Chen",
    employeeId: "e-riley",
    contextLine: "Fri Mar 28 · Open · volunteered",
    reason: "Team asked in group chat — formalizing here.",
    submittedAt: "2026-03-21T16:00:00Z",
    status: "approved",
    urgency: "normal",
    impactSummary: "Adds voluntary coverage",
    needsManagerAction: false,
    sourceTable: "shift_coverage_requests",
    sourceId: "00000000-0000-0000-0000-000000000007",
    actionPayload: {},
    fullContext: "Voluntary coverage offer for Fri open shift; already approved in mock data.",
    affectedParties: [{ id: "a1", role: "Volunteer", name: "Riley Chen" }],
    proposedCounterparty: null,
    history: [
      { id: "h1", at: "2026-03-21T16:00:00Z", actor: "Riley Chen", summary: "Offer submitted" },
      { id: "h2", at: "2026-03-21T16:45:00Z", actor: "Manager (mock)", summary: "Approved" },
    ],
    fairnessAdvisory: [],
    sourceTableHint: "shift_coverage_requests",
  },
  {
    id: "req-8",
    kind: "task_transfer",
    title: "Declined: Ballroom setup",
    employeeName: "Alex Kim",
    employeeId: "e-alex",
    contextLine: "Run #4802 · Events",
    reason: "—",
    submittedAt: "2026-03-20T10:00:00Z",
    status: "denied",
    urgency: "normal",
    impactSummary: "No impact — denied",
    needsManagerAction: false,
    sourceTable: "shift_task_transfer_requests",
    sourceId: "00000000-0000-0000-0000-000000000008",
    actionPayload: {},
    fullContext: "Transfer request denied; task stayed with original assignee per manager decision.",
    affectedParties: [{ id: "a1", role: "Requester", name: "Alex Kim" }],
    proposedCounterparty: null,
    history: [
      { id: "h1", at: "2026-03-20T10:00:00Z", actor: "Alex Kim", summary: "Requested transfer" },
      { id: "h2", at: "2026-03-20T11:00:00Z", actor: "Manager (mock)", summary: "Denied — event needs primary HK" },
    ],
    fairnessAdvisory: [],
    sourceTableHint: "shift_task_transfer_requests",
  },
];

export function getRequestDetailById(id: string): ManagerRequestDetail | undefined {
  return MOCK_MANAGER_REQUESTS.find((r) => r.id === id);
}
