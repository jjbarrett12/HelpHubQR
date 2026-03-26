# Request feed contract (`hh_request_feed`)

Product-facing normalized read model for workforce requests. **No physical merge of tables** — one view + two RPCs over existing operational tables. **`source_table` + `source_id`** are always returned for traceability and mutations.

---

## Canonical row shape

| Field | Type | Notes |
|--------|------|--------|
| `id` | text | Stable composite: `{source_table}/{source_id}` |
| `organization_id` | uuid | |
| `kind` | enum | `coverage`, `swap`, `open_shift_claim`, `task_transfer`, `schedule_change` (latter reserved; no rows yet) |
| `status` | enum | `pending_manager`, `pending_employee`, `approved` (reserved), `executed`, `denied`, `cancelled`, `expired` |
| `urgency` | enum | `low`, `normal`, `high` — from **shift date** (see below) |
| `created_at`, `updated_at` | timestamptz | |
| `shift_date` | date nullable | Primary shift context (`employee_shifts.shift_date`) |
| `requester` | `{ employee_id, name }` | |
| `target_employee` | nullable | Counterparty / claimer / target when known |
| `shift` | nullable object | `employee_shift_id`, `role`, `location_name`, `start_time`, `end_time` |
| `task` | nullable object | `run_item_id`, `title`, `request_mode` (task transfers only) |
| `reason` | text nullable | |
| `manager_action_required` | boolean | `true` iff `status = pending_manager` |
| `employee_action_required` | boolean | `true` iff `status = pending_employee` |
| `source_table` | text | e.g. `shift_task_transfer_requests` |
| `source_id` | uuid | PK for mutations |
| `source_request_type` | text nullable | Task: `request_mode`; coverage: `request_type`; swaps: null |

---

## SQL objects

| Object | Purpose |
|--------|---------|
| `hh_request_urgency_from_shift_date(date)` | Maps shift **date** to `low` / `normal` / `high` (see rules below). |
| `hh_request_feed` | **View**, `security_invoker = true`. UNION of task transfer, coverage, trade rows + `involves_employees` (internal, not returned by RPCs). |
| `hh_employee_requests_feed(p_employee_id, p_limit)` | **JSON array** of rows for one employee. Caller must be **`employees.auth_user_id = auth.uid()`** for that `p_employee_id`; else `[]`. |
| `hh_manager_requests_feed(p_organization_id, p_include_historical, p_limit)` | **JSON array**. Default **`p_include_historical = false`**: only `manager_action_required` rows. **`true`**: all visible rows in org (still **RLS**). |

Migrations: `20260429180000_hh_request_feeds.sql` (base), `20260429200000_hh_request_feed_action_payload_executed.sql` (`action_payload`, `executed`, RPC columns).

---

## Status normalization (raw → contract)

| Raw patterns | `status` |
|--------------|----------|
| Operational row `approved` (mutation already applied in DB) | `executed` |
| Terminal denied / declined | `denied` |
| cancelled | `cancelled` |
| expired | `expired` |
| Awaiting org manager sign-off | `pending_manager` |
| Awaiting employee / peer action (accept, claim, respond) | `pending_employee` |

`manager_action_required` / `employee_action_required` are `true` only for `pending_manager` / `pending_employee`; both are `false` for `executed` and other terminals.

`approved` remains in the TypeScript enum for forward compatibility (e.g. future “approved but not yet applied” states); the current read model maps completed approvals to **`executed`**.

---

## Urgency (shift proximity)

Uses **`shift_date - CURRENT_DATE`** (server calendar date):

| Condition | `urgency` |
|-----------|-----------|
| `shift_date` null | `normal` |
| Shift in the past | `low` |
| 0–1 days until shift | `high` |
| 2–3 days until shift | `normal` |
| 4+ days until shift | `low` |

*Note: uses DB `CURRENT_DATE`, not property IANA TZ. Align with app timezone later if needed.*

---

## TypeScript

- **Schema & types:** `apps/web/lib/helphub/requests/request-feed.ts` (`RequestFeedItem`, Zod `parseRequestFeedJson`).
- **Fetch:** `apps/web/lib/helphub/requests/fetch-request-feeds.ts` (`fetchEmployeeRequestFeed`, `fetchManagerRequestFeed`).
- **Mappers:**  
  - `map-request-feed-to-employee-buckets.ts` → existing `EmployeeMyRequestsClient` props.  
  - `map-request-feed-to-manager-detail.ts` → manager inbox.  
  - `map-request-feed-to-approval-inbox.ts` → Today approvals card.

---

## Example: employee RPC row (`task_transfer`)

```json
{
  "id": "shift_task_transfer_requests/8b1c2d3e-1111-2222-3333-444455556666",
  "organization_id": "00000000-0000-0000-0000-000000000001",
  "kind": "task_transfer",
  "status": "pending_employee",
  "urgency": "high",
  "created_at": "2026-03-24T15:00:00.000Z",
  "updated_at": "2026-03-24T15:00:00.000Z",
  "shift_date": "2026-03-25",
  "requester": { "employee_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "name": "Jordan Lee" },
  "target_employee": { "employee_id": "bbbbbbbb-cccc-dddd-eeee-ffffffffffff", "name": "Sam Rivera" },
  "shift": {
    "employee_shift_id": "cccccccc-dddd-eeee-ffff-000000000001",
    "role": "Housekeeping",
    "location_name": "Main",
    "start_time": "2026-03-25T13:00:00.000Z",
    "end_time": "2026-03-25T21:00:00.000Z"
  },
  "task": {
    "run_item_id": "dddddddd-eeee-ffff-0000-111111111111",
    "title": "Restock lobby cart",
    "request_mode": "direct"
  },
  "reason": "Leaving early",
  "manager_action_required": false,
  "employee_action_required": true,
  "source_table": "shift_task_transfer_requests",
  "source_id": "8b1c2d3e-1111-2222-3333-444455556666",
  "source_request_type": "direct",
  "action_payload": {
    "version": 1,
    "kind": "task_transfer",
    "op": "update_shift_checklist_run_items_assigned_employee",
    "shift_checklist_run_item_id": "dddddddd-eeee-ffff-0000-111111111111",
    "run_id": "…",
    "from_employee_id": "…",
    "to_employee_id": "…",
    "manager_approval_required": true
  }
}
```

## Example: manager RPC row (`open_shift_claim`, pending manager)

```json
{
  "id": "shift_coverage_requests/a1b2c3d4-5555-6666-7777-888899990000",
  "organization_id": "00000000-0000-0000-0000-000000000001",
  "kind": "open_shift_claim",
  "status": "pending_manager",
  "urgency": "normal",
  "created_at": "2026-03-22T10:00:00.000Z",
  "updated_at": "2026-03-23T08:00:00.000Z",
  "shift_date": "2026-03-26",
  "requester": { "employee_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "name": "Jordan Lee" },
  "target_employee": { "employee_id": "eeeeeeee-ffff-0000-1111-222222222222", "name": "Alex Kim" },
  "shift": {
    "employee_shift_id": "ffffffff-0000-1111-2222-333333333333",
    "role": "Front desk",
    "location_name": "Lobby",
    "start_time": "2026-03-26T14:00:00.000Z",
    "end_time": "2026-03-26T22:00:00.000Z"
  },
  "task": null,
  "reason": null,
  "manager_action_required": true,
  "employee_action_required": false,
  "source_table": "shift_coverage_requests",
  "source_id": "a1b2c3d4-5555-6666-7777-888899990000",
  "source_request_type": "open_claim",
  "action_payload": {
    "version": 1,
    "kind": "open_shift_claim",
    "op": "reassign_employee_shift",
    "employee_shift_id": "ffffffff-0000-1111-2222-333333333333",
    "from_employee_id": "…",
    "to_employee_id": "…",
    "request_type": "open_claim",
    "manager_approval_required": true
  }
}
```

---

## Wiring

| Surface | Mechanism |
|---------|-----------|
| **Employee** `/app/my-requests` | `fetchEmployeeRequestFeed` → `mapRequestFeedToEmployeeBuckets` → `EmployeeMyRequestsClient` (mutations still use `source_id` + existing actions). |
| **Manager** `/app/requests` | `loadManagerRequestsInbox` → `fetchManagerRequestFeed(..., { includeHistorical: true })` → `mapRequestFeedItemToManagerDetail`. **Approve/Deny:** `approveRequestFromFeed` / `denyRequestFromFeed` (`apps/web/app/app/helphub/actions/workforce.ts`) dispatch on `source_table` to existing workforce mutations + `workforce_event_log`; optional decision notes → `request_feed_decision_note`. |
| **Today Command Center** approvals | `fetchManagerRequestFeed(..., { includeHistorical: false })` → `mapRequestFeedItemToApprovalInboxItem`. Deep links to `/app/requests` / `/app/shift-ops` (same RPC payload as manager inbox). |
| **iOS Requests** | Call `hh_employee_requests_feed` with the logged-in user’s `employee.id` (same auth link as web). Parse JSON to the same fields as `RequestFeedItem` (including `action_payload` for display). Manager approvals on mobile should call the same Supabase-backed patterns as web (either Edge Functions that invoke the same logic, or direct table updates gated by RLS — **not** duplicating business rules client-side). |

---

## Future: single `help_requests` table

Keep **`source_table` + `source_id`** on any unified row so historical `workforce_event_log` and operational tables stay traceable. A migration path: (1) backfill `help_requests` from the three source tables, (2) dual-write new submissions to both for a release, (3) point `hh_request_feed` at `help_requests` with a `legacy_source_*` mirror, (4) retire dual-write when confident. **`action_payload`** can become the persisted contract on that table while the read model stays a thin projection.

---

## RLS & tenancy

- **`hh_request_feed`** uses **`security_invoker`**: each underlying table’s **SELECT** policies apply. Employees see only rows they participate in; managers with org manage rights see broader sets per existing policies.
- **`hh_employee_requests_feed`** additionally requires **`employees.auth_user_id = auth.uid()`** for `p_employee_id` (prevents arbitrary ID enumeration).
- **`hh_manager_requests_feed`** does not elevate privileges; non-managers may see a **subset** of org rows consistent with RLS.

---

## Source inconsistencies / follow-ups

1. **`shift_trade_offers`** urgency always uses **offered** shift’s `shift_date`, not the requested swap shift — document if product needs both.
2. **Task transfer** `pending` resolution is heuristic (peer vs manager first). Align with product copy and `workforce_event_log` if disputes arise.
3. **`CURRENT_DATE`** vs property timezone for urgency — may skew near midnight.
4. **`schedule_change`**: no source table yet; add a UNION branch when modeled.
5. Legacy **`hh_workforce_requests_normalized`** view remains for older tooling; new UI should prefer **`hh_request_feed`** + RPCs.

---

## Related

- Older doc: `docs/NORMALIZED_WORKFORCE_REQUESTS.md` (previous normalized view naming `pending_peer` / `product_status`).
