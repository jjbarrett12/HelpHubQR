# HelpHubQR — Screen ↔ Data contract audit

Build-focused mapping: reads, writes, realtime, model sketches, schema/RLS risks, UX failure modes.  
**Principles:** execution truth in **run** rows (`shift_checklist_runs`, `shift_checklist_run_items`, override tasks); templates are **definitions only**; **QR** resolves to destinations and does not own shift truth; **fairness** is advisory; employees get **least data** for their flows (prefer RPC/views scoped by `employee_id` + `organization_id`).

---

## Web — Today

**Route (current):** `/app` dashboard → `OrgTodayDashboard` when `resolveActiveOrganizationId` succeeds.

### 1. Purpose
Org-level **today** operational picture: scheduled shifts for calendar “today,” checklist run completion vs shifts, role rollups, recent run activity.

### 2. Required reads
- `organizations` (name)
- `employee_shifts` — filter `organization_id`, `shift_date` = org TZ “today”
- `shift_checklist_runs` — by `employee_shift_id` IN today’s shifts; fields: `id`, `status`, `employee_shift_id`, timestamps
- `shift_checklist_runs` — recent list (e.g. last 12) + join `employee_shifts` for `shift_date`
- `employees` (id, full_name) active; `staff_roles` (id, name) for labels

### 3. Required writes / mutations
None for core Today (read-only dashboard). Any “send run” / “nudge” actions belong on Schedule / Checklist runs flows.

### 4. Realtime needs
Optional: subscribe to `shift_checklist_runs` / `employee_shifts` for live status. Not required for MVP if refresh-on-nav is acceptable.

### 5. Suggested TypeScript shape
```ts
type TodayShiftRow = {
  shiftId: string;
  employeeId: string;
  staffRoleId: string;
  status: "scheduled" | "sent" | "in_progress" | "completed" | "missed";
};
type TodayRunRow = {
  runId: string;
  employeeShiftId: string;
  status: "pending" | "sent" | "opened" | "completed" | "expired";
  sentAt?: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
};
type TodaySummary = {
  orgId: string;
  orgName: string;
  date: string; // calendar date in org TZ
  shifts: TodayShiftRow[];
  runsByShiftId: Record<string, TodayRunRow | undefined>;
  completionPct: number;
  byRole: Record<string, { total: number; done: number }>;
  recentRuns: TodayRunRow[];
};
```

### 6. Missing backend gaps / schema risks
- **No run row** for a shift: UI treats as incomplete — clarify whether “run not created yet” vs “run pending creation job.”
- **Timezone:** `shift_date` vs `starts_at`/`ends_at` — dashboard uses `CRON_SCHEDULE_TZ`; inconsistent TZ → wrong “today.”
- **Dual product:** same `/app` entry can render non–HelpHub `CommandCenterDashboard` / `TenantSitesOverview` — data contracts differ; don’t mix queries.

### 7. RLS / tenancy
Expect **manager** scope: `hh_user_can_manage_org(auth.uid(), organization_id)` on org-scoped tables. No employee-level RLS assumed on this screen.

### 8. UX risks if contract is weak
Stale counts → managers chase wrong people; wrong “today” → false “all complete.”

---

## Web — Schedule

**Route (current):** `/app/schedule` (and related shift creation surfaces).

### 1. Purpose
Plan **employee_shifts** (who, when, where, role); enable run send / lifecycle hooks tied to shifts.

### 2. Required reads
- `employee_shifts` (+ joins: `employees`, `locations`, `staff_roles`)
- `organization_workforce_settings` (flags: open shift claims, trades, etc.)
- Optional: existing `shift_checklist_runs` for shift to show “run exists / status”

### 3. Required writes / mutations
- Insert/update/delete `employee_shifts` (within business rules)
- Toggle `employee_shifts.is_open_for_claim` (workforce migration)
- Trigger or enqueue **run creation** when shift is “ready” (app/Ege function — may not be a single table write today)

### 4. Realtime needs
Optional: new shifts / claim flags for coordination screens.

### 5. Suggested TypeScript shape
```ts
type ScheduleShift = {
  id: string;
  organizationId: string;
  employeeId: string;
  locationId: string | null;
  staffRoleId: string;
  shiftDate: string; // date
  shiftType: "open" | "mid" | "close" | "custom";
  startsAt?: string;
  endsAt?: string;
  status: string;
  isOpenForClaim: boolean;
  checklistRun?: { id: string; status: string } | null;
};
```

### 6. Missing backend gaps / schema risks
- **Unique slot** index on `(org, employee, shift_date, shift_type, location)` — edits must respect collisions.
- **Run creation** idempotency: one run per `employee_shift_id` (`UNIQUE` on `shift_checklist_runs.employee_shift_id`) — schedule changes vs existing runs need explicit policy (cancel/regenerate).

### 7. RLS / tenancy
Manager-only writes on `employee_shifts`; org isolation on all FKs.

### 8. UX risks if contract is weak
Shifts without runs → Today shows perpetual incomplete; duplicate runs → DB errors or wrong employee UX.

---

## Web — Checklists

**Routes (current):** `/app/checklists`, templates, import, `/app/checklist-runs`, `/app/checklists/runs/[id]`.

### 1. Purpose
**Templates:** `checklists` + `checklist_items` (and sections/duration/taxonomy fields). **Execution review:** `shift_checklist_runs` + `shift_checklist_run_items` + override rows `shift_run_override_tasks`.

### 2. Required reads
- Templates: `checklists`, `checklist_items` (incl. `section_title`, `duration_estimate_minutes`, `task_key` if taxonomy enabled)
- Runs: `shift_checklist_runs`, `shift_checklist_run_items` (incl. `task_text_snapshot`, `completed`, `proof_photo_storage_path`, assignment columns)
- Joins: `employee_shifts`, `employees`, `locations`, `staff_roles`
- Import: `imported_documents` / `imported_document_tasks` (per import migrations)

### 3. Required writes / mutations
- Template CRUD (manager)
- Run item: `completed`, `completed_at`, `notes`, `proof_photo_storage_path` (often **employee**-side or manager override)
- Override tasks: insert/update `shift_run_override_tasks`
- Optional: assignment updates on `shift_checklist_run_items` (workforce)

### 4. Realtime needs
Optional for run review: run status + item completions. High value for “manager watching floor.”

### 5. Suggested TypeScript shape
```ts
type ChecklistTemplate = { id: string; organizationId: string; staffRoleId: string; shiftType: string; name: string; items: ChecklistItemDef[] };
type ChecklistItemDef = { id: string; taskText: string; sortOrder: number; requiresPhoto: boolean; sectionTitle?: string | null };

type ShiftChecklistRun = {
  id: string;
  organizationId: string;
  employeeShiftId: string;
  checklistId: string;
  status: string;
  accessToken: string;
  items: RunItem[];
  overrideTasks: OverrideTask[];
};
type RunItem = {
  id: string;
  checklistItemId: string;
  taskTextSnapshot: string;
  completed: boolean;
  completedAt?: string;
  notes?: string;
  proofPhotoStoragePath?: string | null;
  assignedEmployeeId?: string | null;
  assignmentStatus: string;
  suppressed: boolean;
};
```

### 6. Missing backend gaps / schema risks
- **Truth split:** template `task_text` vs run `task_text_snapshot` — UI must not edit template when showing run execution.
- **Proof:** path only; signed URL generation must be server-side; weak contract if client expects public URLs.
- **Taxonomy:** `task_key` on items / ledger alignment — drift between template key and run snapshot.

### 7. RLS / tenancy
Managers: org-scoped. **Employees** (mobile/token): historically **token** on run — do not expose full org checklists over anon keys; use narrow RPC or server routes.

### 8. UX risks if contract is weak
Marking template instead of run → false compliance; photo proof broken → blocked completions.

---

## Web — Requests

**Route (current):** `/app/my-requests` (aggregates workforce request tables).

### 1. Purpose
Surface **employee-initiated** workforce flows: task transfers, coverage, shift trades; status for requester and counterparty.

### 2. Required reads
- `shift_task_transfer_requests` (+ nested `shift_checklist_run_items.task_text_snapshot`)
- `shift_coverage_requests`
- `shift_trade_offers`
- `employees` for name resolution
- `organization_workforce_settings` for approval flags

### 3. Required writes / mutations
- Create/update rows in the three request tables (via actions already in `lib/helphub/workforce/*`)
- Manager approve/deny (status transitions) — same tables

### 4. Realtime needs
Recommended: new/updated request status for “pending approval” UX.

### 5. Suggested TypeScript shape
```ts
type TransferRequest = {
  id: string;
  organizationId: string;
  status: string;
  requestMode: string;
  fromEmployeeId: string;
  toEmployeeId: string | null;
  requestedByEmployeeId?: string | null;
  managerApprovalRequired: boolean;
  taskSummary: string;
};
// Mirror DB columns for coverage + trade with union list item in UI
type MyRequestsFeed = { transfers: TransferRequest[]; coverage: CoverageRequest[]; trades: TradeOffer[] };
```

### 6. Missing backend gaps / schema risks
- **iOS mock** `StaffRequest` / `RequestKind` **does not yet map 1:1** to these three tables + open-shift claims — need a single **view** or **API** that normalizes `kind` + `status` for mobile.
- **Open shift pickup** may touch `employee_shifts` + approval — ensure same audit trail as web.

### 7. RLS / tenancy
Policies must restrict rows to participants + managers in org; never return other orgs’ requests.

### 8. UX risks if contract is weak
Wrong party sees PII; duplicate submits; “pending” forever with no notification.

---

## Web — QR Hub

**Routes (current):** `/app/qr-codes`, `/app/qr-destinations`, public resolve paths (server-side).

### 1. Purpose
**Bridge layer:** define `qr_destinations` (type + optional `target_checklist_id` + `content` JSONB), materialize `qr_codes` (slug), collect `qr_issue_reports`.

### 2. Required reads
- `qr_destinations`, `qr_codes`, `locations`
- Issues list: `qr_issue_reports` + join `qr_codes`

### 3. Required writes / mutations
- CRUD destinations/codes (manager)
- Public **issue report** insert (today often **server route** with validation, not direct anon RLS — follow existing pattern)

### 4. Realtime needs
Low for hub config; optional for incoming issue stream in ops center.

### 5. Suggested TypeScript shape
```ts
type QrDestination = {
  id: string;
  organizationId: string;
  locationId?: string | null;
  name: string;
  type: "checklist" | "training" | "sop" | "issue_report" | "announcement" | "help";
  targetChecklistId?: string | null;
  content: Record<string, unknown>;
  isActive: boolean;
};
type QrCode = { id: string; slug: string; label: string; qrDestinationId: string; organizationId: string };
```

### 6. Missing backend gaps / schema risks
- **`content` JSONB** is a schema escape hatch — document per-`type` contract or apps will fork silently.
- **Resolve pipeline:** slug → code → destination → **action** (open run vs static URL) must be server-owned; weak link breaks guest/employee flows.

### 7. RLS / tenancy
Managers manage destinations/codes; public writes only where explicitly allowed (issue reports).

### 8. UX risks if contract is weak
Wrong destination type → broken deep link; issue reports without `qr_code_id` context → unactionable.

---

## Web — Team

**Interpretation:** roster + workforce ops — `/app/employees`, role/location admin, `/app/shift-ops`, `/app/my-shifts` (employee-linked).

### 1. Purpose
Maintain **employees**, role assignments, optional `auth_user_id` link; coordinate assignments, trades, coverage from manager POV.

### 2. Required reads
- `employees`, `employee_role_assignments`, `staff_roles`, `locations`
- Shift ops: `shift_checklist_run_items` assignment fields, `organization_workforce_settings`
- `employees.auth_user_id` for “my” surfaces

### 3. Required writes / mutations
- Employee CRUD, link `auth_user_id`
- Workforce actions: reassign run items, approve requests (see Requests), trades RPC e.g. `hh_atomic_swap_shift_employees`

### 4. Realtime needs
Optional for shift-ops floor board.

### 5. Suggested TypeScript shape
```ts
type Employee = {
  id: string;
  organizationId: string;
  fullName: string;
  locationId?: string | null;
  authUserId?: string | null;
  isActive: boolean;
  roles: { staffRoleId: string; isPrimary: boolean }[];
};
```

### 6. Missing backend gaps / schema risks
- **Unlinked employees** → no `/app/my-requests` or employee app identity — product must surface “link account” as first-class state.
- **Unique** `(organization_id, auth_user_id)` when set — conflict on reassignment.

### 7. RLS / tenancy
Managers manage org employees; employees should only read **self** + peers where policy allows (narrow views).

### 8. UX risks if contract is weak
Managers edit roster but app still uses stale cache; wrong `auth_user_id` → user sees another employee’s requests.

---

## Web — Fairness

**Route (current):** `/app/fairness`.

### 1. Purpose
**Advisory only:** settings (`organization_fairness_settings`), ledger (`fairness_assignment_ledger`), task taxonomy labels — warn managers; **not** authorization for assignments.

### 2. Required reads
- `organization_fairness_settings`
- `fairness_assignment_ledger` (aggregates / drill-down)
- `task_taxonomy` / checklist item keys for labels

### 3. Required writes / mutations
- Update org fairness settings (manager)
- Ledger inserts typically **service role / server** on assignment events — not arbitrary client writes

### 4. Realtime needs
None required.

### 5. Suggested TypeScript shape
```ts
type FairnessSettings = { organizationId: string; lookbackDays: number; enableWarnings: boolean /* + weight fields per migration */ };
type FairnessLedgerEvent = { id: string; employeeId: string; eventType: string; fairnessCategory: string; createdAt: string; shiftChecklistRunItemId?: string | null; shiftRunOverrideTaskId?: string | null; metadata?: Record<string, unknown> };
```

### 6. Missing backend gaps / schema risks
- **Gaming:** if ledger misses events, dashboard lies — contract is “best effort analytics,” not payroll.
- **Override vs template** source columns must stay consistent with run review.

### 7. RLS / tenancy
Manager read on ledger/settings; employees should **not** see org-wide fairness unless explicitly product-required.

### 8. UX risks if contract is weak
Managers treat fairness as **mandatory rotation** — legal/HR expectation mismatch; fix with copy + product positioning.

---

## Web — Issues

**Route (current):** HelpHub **QR issue reports** → `/app/qr-issues` (not legacy property `tickets` unless that product is in scope for same nav).

### 1. Purpose
Triage **guest/public** submissions tied to a **qr_code**: `qr_issue_reports` (message, contact, created_at).

### 2. Required reads
- `qr_issue_reports` filtered by `organization_id`
- Join `qr_codes` (label, slug)

### 3. Required writes / mutations
- Optional manager status workflow — **not in base migration**; today insert-only from public path. If you add triage, new columns or `issue_status` table.

### 4. Realtime needs
Optional for new reports.

### 5. Suggested TypeScript shape
```ts
type QrIssueReport = {
  id: string;
  organizationId: string;
  qrCodeId: string;
  message: string;
  contact?: string | null;
  createdAt: string;
  qrLabel?: string;
  qrSlug?: string;
};
```

### 6. Missing backend gaps / schema risks
- No **assignment** / **resolved** state in core schema → ops teams track externally or duplicate tools.
- Separate **property tickets** (`tickets`, `ticket_events`) exist elsewhere in monorepo — **do not conflate** with HelpHub QR issues without explicit merge.

### 7. RLS / tenancy
Org-scoped manager read; public insert via controlled server path.

### 8. UX risks if contract is weak
Flooding/spam; no SLA fields → false urgency display.

---

## iOS — Today

**Screen (current):** `TodayView` + `TodayViewModel` / `EmployeeTodaySnapshot`.

### 1. Purpose
Employee **immediate execution context**: greeting, **current shift summary**, checklist **progress**, next task, quick actions, shift notes.

### 2. Required reads
- **Single bundle** (prefer one RPC or edge function): `employee_shifts` (today or next), `shift_checklist_runs` (status, id), **run items** for that run (snapshot text, completed, requires_photo, section, flags), announcements (source TBD — may be `qr_destinations` content, separate `announcements` table, or org setting JSON)
- `employees` row for display name (or JWT claims)

### 3. Required writes / mutations
None on Today itself; actions navigate to flows that mutate.

### 4. Realtime needs
Optional: run status + item completions for live progress bar.

### 5. Suggested Swift shape
```swift
struct EmployeeTodaySnapshot: Equatable {
  var employeeFirstName: String
  var checklistRun: ChecklistRun  // contains Shift + [ChecklistTask]
  var announcements: [ShiftAnnouncement]
}
// Align ChecklistTask ids with shift_checklist_run_items.id (not checklist_items.id) for mutations
```

### 6. Missing backend gaps / schema risks
- iOS uses **mock** announcements — **no first-class table** wired.
- **Next incomplete task** ordering must match server rule (sort_order + sections).

### 7. RLS / tenancy
Employee session → only runs/items **assigned to them** or run **scoped by token**; never full org checklist list.

### 8. UX risks if contract is weak
Wrong run loaded → completing items fails RLS or writes to wrong shift.

---

## iOS — Checklist

**Screen (current):** `ChecklistView` + `ChecklistViewModel`.

### 1. Purpose
Sectioned list of **run items**; toggle complete; navigate to detail; reflect blocked/problem/help flags.

### 2. Required reads
Same run payload as Today (full item list): `shift_checklist_run_items` (+ override tasks if merged into list in API).

### 3. Required writes / mutations
- PATCH run item: `completed`, `completed_at`, optional `notes`
- Optional: `proof_photo_storage_path` after upload

### 4. Realtime needs
Same as Today if multi-device.

### 5. Suggested Swift shape
Align with `ChecklistTask` in app: `id` = **run item id**; `sectionKey`/`sectionTitle` from snapshot or template; `isBlocked`/`hasProblem` map from `assignment_status` / custom flags or separate columns.

### 6. Missing backend gaps / schema risks
- **Blocked** / **problem** may be **client-only** today — need columns or status enum extensions for server truth.
- **Suppressed** items: server should filter or flag; iOS must not show completed work that manager suppressed without UX explanation.

### 7. RLS / tenancy
Writes limited to **assigned employee** or token-scoped run.

### 8. UX risks if contract is weak
Optimistic UI out of sync → duplicate toggles; photo required but no upload pipeline.

---

## iOS — Task Detail

**Screen (current):** `TaskDetailView` + `TaskDetailViewModel`.

### 1. Purpose
Single **run item** truth: description, proof, notes, help, problem flag, activity history.

### 2. Required reads
- One `shift_checklist_run_item` (+ proof path); optional history from `ticket_events`-like table **if** you add run_item_audit — **not in base schema**; may derive from notes + completion only.

### 3. Required writes / mutations
- Complete / uncomplete
- Append note (merge into `notes` or child table)
- Upload proof → Storage → set `proof_photo_storage_path`
- **Request help** / **flag problem** → insert into workforce/escalation table **or** reuse `shift_task_transfer_requests` / new `run_item_escalations` — **gap** if only client-local today

### 4. Realtime needs
Low.

### 5. Suggested Swift shape
```swift
struct ChecklistTask: Identifiable { let id: UUID /* run item */; ...; var statusHistory: [TaskStatusEvent] }
```
Map `TaskStatusEvent` from server audit table when it exists.

### 6. Missing backend gaps / schema risks
- **Status history** in iOS is largely local mock — **no durable audit** for employee actions except completion timestamps.
- Help/problem buttons need **backend sinks** or they are placebo.

### 7. RLS / tenancy
Same as Checklist.

### 8. UX risks if contract is weak
“Request help” with no backend → trust loss.

---

## iOS — Requests

**Screen (current):** `RequestsHomeView` + wizards; `StaffRequest` / `OpenShift` mocks.

### 1. Purpose
Guided **swap, coverage, pickup, transfer, availability, preferences** — mirror web `my-requests` + open shift policy.

### 2. Required reads
- Normalized feed: union of `shift_task_transfer_requests`, `shift_coverage_requests`, `shift_trade_offers` + **open shifts** query (`employee_shifts.is_open_for_claim` + role/location filters)
- `organization_workforce_settings`

### 3. Required writes / mutations
- Insert/update request rows per flow; respect `manager_approval_required_*`
- Pickup: claim flow may insert shift assignment + pending approval row — **must match web RPCs**

### 4. Realtime needs
Recommended for request status.

### 5. Suggested Swift shape
```swift
enum RequestKind { case swapShift, coverage, pickupShift, transferTask, availabilityUpdate, taskPreferences }
struct StaffRequest: Identifiable { var kind: RequestKind; var status: RequestStatus; var summary: String; var submittedAt: Date }
struct OpenShift: Identifiable { var id: UUID; var title: String; var timeRange: String; var locationName: String }
```
Add `serverId` + `rawTable` for debugging.

### 6. Missing backend gaps / schema risks
- **Availability** and **task preferences** iOS payloads (`AvailabilitySubmitPayload`, `TaskPreferencesSubmitPayload`) need **tables or RPCs** — may map to `employee_task_preferences` / fairness prefs migrations; **verify** column mapping.
- **Single “pending” enum** on client vs multiple DB status strings → normalize in API.

### 7. RLS / tenancy
Employee sees only own + counterparty rows; managers see org.

### 8. UX risks if contract is weak
Submit succeeds in UI but fails server → show explicit error + retry; open shift list stale → double booking.

---

## iOS — Messages

**Screen (current):** `MessagesView` + `MessagesViewModel` (mock `InboxMessage`).

### 1. Purpose
Operational comms: manager broadcasts, engineering notes, delivery failures — **not** a full chat product.

### 2. Required reads
- **No dedicated HelpHub inbox table** in reviewed migrations — candidates: derive from `message_deliveries` (per run/employee), future `announcements`, or external integration.

### 3. Required writes / mutations
Usually none for employee (read-only); optional “ack” if product adds.

### 4. Realtime needs
High value if implemented: `postgres_changes` on announcements or deliveries.

### 5. Suggested Swift shape
```swift
struct InboxMessage: Identifiable { let id: UUID; var title: String; var preview: String; var sentAt: Date; var isUnread: Bool }
```

### 6. Missing backend gaps / schema risks
**Entire channel is undefined** for HelpHub employee app — highest disconnect risk.

### 7. RLS / tenancy
Scoped to `employee_id` / org; never cross-tenant.

### 8. UX risks if contract is weak
Fake inbox erodes trust — ship read-only feed from real query or hide tab.

---

## iOS — More

**Screen (current):** `MoreView` — account, sign out, dev deep link hints.

### 1. Purpose
Session, employee id display, future settings.

### 2. Required reads
- `AppSession` (auth user, `employees.id` via `auth_user_id`)

### 3. Required writes / mutations
- Sign out (auth)
- Optional: notification preferences — **no table** assumed

### 4. Realtime needs
None.

### 5. Suggested Swift shape
```swift
struct AppSession: ObservableObject { var isAuthenticated: Bool; var currentUserDisplayName: String?; var employeeId: UUID? }
```

### 6. Missing backend gaps / schema risks
Profile photo / settings if added later.

### 7. RLS / tenancy
Self only.

### 8. UX risks if contract is weak
`employeeId` nil → rest of app must gate gracefully.

---

## iOS — Report Issue

**Screen (current):** `ReportIssueView` (local mock) + Today quick action; web has **QR issue** path.

### 1. Purpose
File issue **in context** (property/area) — may map to `qr_issue_reports` **if** scanned QR, or generic **org issue** table (not standard in HelpHub base).

### 2. Required reads
- Optional: list of categories from config

### 3. Required writes / mutations
- Insert `qr_issue_reports` when `qr_code_id` known
- Else: **need** `organization_issues` or link to external ticketing — **gap** for “generic” report from app without QR

### 4. Realtime needs
None.

### 5. Suggested Swift shape
```swift
struct IssueReportDraft { var category: String; var description: String; var qrCodeId: UUID?; var locationId: UUID? }
```

### 6. Missing backend gaps / schema risks
**Orphan reports** without `qr_code_id` — product decision required.

### 7. RLS / tenancy
Insert allowed for authenticated employee in org; public path separate.

### 8. UX risks if contract is weak
User believes issue reached manager; it never persisted.

---

## iOS — Shift Details

**Screen (current):** `ShiftDetailsView` from `Shift` / `WorkShiftSummary`.

### 1. Purpose
Read-only **shift context** (window, role, location, station).

### 2. Required reads
- `employee_shifts` + joins `staff_roles`, `locations`, optional run summary

### 3. Required writes / mutations
None.

### 4. Realtime needs
Optional if shift cancelled mid-day.

### 5. Suggested Swift shape
```swift
struct Shift: Identifiable { let id: UUID; var shiftTypeLabel: String; var roleName: String; var locationName: String; var zoneOrStation: String?; var timeWindow: String; var dateLabel: String; var isActiveNow: Bool }
```

### 6. Missing backend gaps / schema risks
**“Active now”** requires reliable `starts_at`/`ends_at` or server-computed status; date-only `shift_date` is insufficient for precise UX.

### 7. RLS / tenancy
Employee sees **own** shifts only (or published open shifts).

### 8. UX risks if contract is weak
Wrong timezone strings → missed shift.

---

## Cross-cutting: employee minimum data

| Need | Tables / source |
|------|------------------|
| Identity | `auth.users` + `employees.auth_user_id` |
| Today’s work | `shift_checklist_runs` + `shift_checklist_run_items` for **my** run |
| Requests | Scoped queries on workforce request tables |
| QR resolve | Server resolves slug → destination (no full org dump) |

Prefer **one Edge Function / RPC** per screen family: `employee_today_bundle`, `employee_requests_feed`, `employee_run_item_mutate` with server-side checks.

---

## Summary: highest-risk contract gaps

1. **iOS Messages** — no backing query defined.  
2. **iOS Report Issue** — generic path without `qr_code_id` undefined.  
3. **Task detail** “help/problem/history” — mostly local; needs durable tables or RPCs.  
4. **StaffRequest** mobile model vs **three** web tables + open shifts — normalize.  
5. **Announcements** on Today — no canonical store.  
6. **Fairness** — keep strictly advisory in UI copy and permissions.  
7. **QR** — treat as router; execution still on **run** tables.

---

*Generated as a product-engineering contract pass; align with latest migrations under `supabase/migrations/` when implementing.*
