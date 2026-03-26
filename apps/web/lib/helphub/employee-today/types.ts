/**
 * Canonical client contract for HelpHub employee "Today" (camelCase).
 * Source: Postgres RPC `hh_employee_today_bundle` + map-rpc-response.
 * @see docs/EMPLOYEE_TODAY_CONTRACT.md
 */

export type EmployeeTodayErrorCode =
  | "NOT_AUTHENTICATED"
  | "NOT_ORG_MEMBER"
  | "EMPLOYEE_NOT_LINKED"
  | "NO_ORGANIZATION"
  | "RPC_ERROR"
  | "INVALID_RESPONSE";

export type EmployeeTodayFocusKind = "today_shift" | "upcoming_shift" | "none";

export type EmployeeTodaySourceMeta = {
  /** Incremented when RPC payload shape changes (v4 = real `shift_notes` from `public.shift_notes`). */
  bundleVersion: number;
  rpc: string;
  computedAt?: string;
  organizationId: string;
  employeeId?: string;
  timeZone: string;
  calendarDate: string;
  focusEmployeeShiftId: string | null;
  focusRunId: string | null;
};

export type EmployeeTodayEmployee = {
  id: string;
  organizationId: string;
  firstName: string;
  fullName: string;
  locationId: string | null;
};

export type EmployeeTodayShift = {
  id: string;
  shiftDate: string;
  shiftType: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  locationId: string | null;
  staffRoleId: string;
  locationName: string | null;
  roleName: string | null;
};

export type EmployeeTodayRunSummary = {
  id: string;
  status: string;
  checklistId: string;
  templateName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  sentAt: string | null;
};

/** Row from template run items or shift_run_override_tasks (discriminate with itemKind). */
export type EmployeeTodayRunItem = {
  id: string;
  /** `run_item`: `hh_shift_checklist_run_item_mutate`. `override`: `hh_shift_run_override_task_mutate` (same actions minus template-only fields). */
  itemKind: "run_item" | "override";
  /** Template link; null for override rows. */
  checklistItemId: string | null;
  sortOrder: number;
  sectionTitle: string | null;
  title: string;
  isCompleted: boolean;
  completedAt: string | null;
  requiresPhoto: boolean;
  hasProof: boolean;
  notes: string | null;
  isSuppressed: boolean;
  isBlocked: boolean;
  assignmentStatus: string;
};

export type EmployeeTodaySection = {
  sectionKey: string;
  sectionTitle: string;
  sectionSort: number;
  items: EmployeeTodayRunItem[];
};

export type EmployeeTodayProgress = {
  completed: number;
  total: number;
  ratio: number;
};

/** First incomplete executable row: run items take precedence over overrides (same as RPC next_incomplete). */
export type EmployeeTodayNextIncomplete =
  | { kind: "run_item"; id: string }
  | { kind: "override"; id: string };

export type EmployeeTodayChecklist = {
  runId: string | null;
  templateName: string | null;
  progress: EmployeeTodayProgress;
  sections: EmployeeTodaySection[];
  /** Same tasks as sections: template rows then override rows (for simple lists). */
  itemsFlat: EmployeeTodayRunItem[];
  /** First incomplete `shift_checklist_run_items.id` (excludes overrides). */
  nextIncompleteTaskId: string | null;
  /** First incomplete `shift_run_override_tasks.id` (status = active). */
  nextIncompleteOverrideTaskId: string | null;
  /** Prefer for “next task” UI; aligns with RPC `next_incomplete`. */
  nextIncomplete: EmployeeTodayNextIncomplete | null;
  noRunReason: "run_not_created" | "no_focus_shift" | null;
};

export type EmployeeTodayAnnouncements = {
  items: EmployeeTodayAnnouncement[];
  /** `operational_messages` when wired; legacy `none` if old RPC. */
  source: "none" | "operational_messages" | string;
  /** Null when backend is wired; optional dev note when not. */
  todo: string | null;
};

/** Per-shift briefing lines from `public.shift_notes` (RPC maps `note` → `body`). Not org-wide broadcasts. */
export type EmployeeTodayShiftNoteItem = {
  id: string;
  title: string;
  body: string;
  authorLabel?: string | null;
  createdAt?: string | null;
};

export type EmployeeTodayShiftNotes = {
  items: EmployeeTodayShiftNoteItem[];
  /** `shift_notes` when populated from DB; legacy `none` if old RPC. */
  source: "none" | "shift_notes" | string;
  todo: string | null;
};

/** Operational notice (not chat). From `operational_messages` + read receipt. */
export type EmployeeTodayAnnouncement = {
  id: string;
  title: string;
  body: string;
  pinned?: boolean;
  category?: string;
  read?: boolean;
  readAt?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  createdAt?: string | null;
};

export type EmployeeTodayFocus = {
  kind: EmployeeTodayFocusKind;
  isActiveNow: boolean;
  shift: EmployeeTodayShift | null;
  run: EmployeeTodayRunSummary | null;
};

export type EmployeeTodayBundleSuccess = {
  ok: true;
  source: EmployeeTodaySourceMeta;
  employee: EmployeeTodayEmployee;
  focus: EmployeeTodayFocus;
  checklist: EmployeeTodayChecklist;
  announcements: EmployeeTodayAnnouncements;
  /** Distinct from org-wide `announcements`: shift-specific notes (placeholder until DB). */
  shiftNotes: EmployeeTodayShiftNotes;
};

export type EmployeeTodayBundleFailure = {
  ok: false;
  error: EmployeeTodayErrorCode;
  message?: string;
  source?: Partial<EmployeeTodaySourceMeta>;
};

export type EmployeeTodayBundle = EmployeeTodayBundleSuccess | EmployeeTodayBundleFailure;
