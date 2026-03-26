# Shift operations platform migrations (2026-04-01)

## Migration file names

| File | Purpose |
|------|---------|
| `supabase/migrations/20260401000000_shift_operations_platform.sql` | Core operational tables + RLS + extend `shift_checklist_run_item_events` |
| `supabase/migrations/20260401001000_performance_daily_snapshots.sql` | `employee_performance_daily` + `location_performance_daily` (analytics only) |

## Table classification

**Execution / operational truth (work happens here or on existing run/run_item rows):**

- `shift_checklist_run_items` + `shift_checklist_runs` (existing)
- `shift_checklist_run_item_notes` (append-only history; current note text still on `shift_checklist_run_items.notes`)
- `shift_checklist_run_item_help_requests`, `shift_checklist_run_item_problems`
- `shift_logs`, `issues`
- `employee_announcements` + `employee_announcement_reads`

**Audit / system-generated (append or RPC-owned):**

- `shift_checklist_run_item_events` (existing; migration widens `event_type`; `payload` = API `event_payload`)

**Already present — do not duplicate writes without a product decision:**

- `shift_checklist_run_item_escalations` — `kind` `problem` | `help` (used by `hh_shift_checklist_run_item_mutate`)
- `operational_messages` — org operational broadcasts for Today/Messages RPCs

**Analytics snapshots (recomputable, advisory / scoreboard):**

- `employee_performance_daily`, `location_performance_daily`

## Assumptions about existing tables

- `organizations`, `locations`, `employees`, `employee_shifts`, `shift_checklist_runs`, `shift_checklist_run_items`, `qr_destinations`, `auth.users`
- Helpers: `hh_set_updated_at`, `hh_org_ids_for_user`, `hh_user_can_manage_org`, `hh_employee_id_for_user`

## Backfill (later jobs, not in SQL)

1. **`qr_issue_reports` → `issues`** — set `origin = 'qr'`, map `qr_code_id` → `qr_destination_id` / `location_id` via joins as needed.
2. **`employee_performance_daily` / `location_performance_daily`** — nightly aggregation from run items, workforce tables, `issues`, `shift_logs`, etc.
3. **Unify announcements** — choose `operational_messages` vs `employee_announcements` or sync between them.

## Recommended query indexes (Today, Requests, Messages, Manager Today)

Already created in migrations; extras to consider after load testing:

| Surface | Table | Index intent |
|---------|--------|----------------|
| Employee Today | `employee_announcements` | `(organization_id, expires_at)` + partial on `employee_id` / `location_id` |
| Employee Today | `shift_checklist_run_item_notes` | `(run_item_id, created_at DESC)` |
| Messages / reads | `employee_announcement_reads` | `(employee_id, read_at DESC)` |
| Requests / manager inbox | `issues` | `(organization_id, status, created_at DESC)` |
| Manager Today / ops | `shift_logs` | `(organization_id, location_id, created_at DESC)` |
| Run item drill-down | `shift_checklist_run_item_help_requests` / `problems` | `(run_item_id, created_at DESC)` |
| Scoreboard (future) | `employee_performance_daily` | `(organization_id, service_date DESC)` |
| Scoreboard (future) | `location_performance_daily` | `(organization_id, service_date DESC)` |

## `shift_checklist_run_item_events` change

The strict `CHECK` on `event_type` is replaced with length checks so new audit verbs do not require migrations. Existing RPC values remain valid. Column remains `payload` (documented as `event_payload` in APIs).
