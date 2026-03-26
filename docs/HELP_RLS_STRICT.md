# Strict operational RLS (`20260401100000_helphub_rls_strict_operational.sql`)

## 1. Migration file

| File | Purpose |
|------|---------|
| [`supabase/migrations/20260401100000_helphub_rls_strict_operational.sql`](../supabase/migrations/20260401100000_helphub_rls_strict_operational.sql) | Helper functions + replace policies on operational + workforce tables |

Apply **after** `20260401000000_shift_operations_platform.sql` and `20260401001000_performance_daily_snapshots.sql` (and baseline HelpHub migrations).

## 2. Helper functions (new)

| Function | Meaning |
|----------|---------|
| `hh_is_org_member(user_id, org_id)` | Active `organization_members` row (any role). |
| `hh_is_org_manager(user_id, org_id)` | Wrapper over `hh_user_can_manage_org` (`owner` / `manager` / `admin`). |
| `hh_current_employee_id(org_id)` | `employees.id` for `auth.uid()` in that org. |
| `hh_is_employee_self(employee_id, org_id)` | Current user’s employee row matches. |
| `hh_user_can_access_run_item(org_id, run_item_id)` | Manager **or** shift owner **or** `assigned_employee_id` on the run item (aligned with execution RPC). |
| `hh_user_can_access_override_task(org_id, override_task_id)` | Manager **or** shift owner **or** override `assigned_employee_id` (aligned with `hh_shift_run_override_task_mutate`; see `20260427160000_shift_run_override_task_mutate.sql`). |
| `hh_employee_can_read_announcement(announcement_id)` | Non-manager visibility for `employee_announcements` (targeting + active window). |

All are `STABLE` + `SECURITY DEFINER` + `search_path = public`. `GRANT EXECUTE … TO authenticated`.

## 3. Policy summary (least privilege)

| Table | Employee | Manager |
|-------|----------|---------|
| `employee_announcements` | Targeted + active window only | Full CRUD |
| `employee_announcement_reads` | `SELECT` own rows; `INSERT` own employee_id + visible announcement | `SELECT`/`DELETE` org |
| `shift_checklist_run_item_notes` | `SELECT`/`INSERT` only if `hh_user_can_access_run_item` | Full read; insert optional via same rule (manager passes) |
| `shift_checklist_run_item_events` | `SELECT` only if access to run item | Full read |
| `shift_run_override_task_events` | `SELECT` only if `hh_user_can_access_override_task` (or manager) | Full read |
| `shift_run_override_task_escalations` | `SELECT` if access to override task (or manager) | `ALL` via `hh_user_can_manage_org` |
| `shift_checklist_run_item_help_requests` | Party + accessible run item | Full read/update |
| `shift_checklist_run_item_problems` | Reporter + accessible run item | Full read/update |
| `shift_logs` | Own `created_by`, own `employee_id`, or own `shift_id` | Full CRUD |
| `issues` | Reporter, assignee, or shift owner for `shift_id` | Full CRUD |
| `employee_performance_daily` | Own `employee_id` row only | Full CRUD |
| `location_performance_daily` | **No access** | Full CRUD |
| `shift_*_requests` / `shift_trade_offers` | Party columns only (unchanged intent) | Full |

**`shift_checklist_run_item_events`:** authenticated still has **no** `INSERT`/`UPDATE`/`DELETE` (rely on `hh_shift_checklist_run_item_mutate` + `service_role`).

**`shift_run_override_task_events`:** same pattern — **no** client `INSERT`; use **`hh_shift_run_override_task_mutate`**.

## 4. Assumptions (membership / profile)

- **`organization_members`:** `user_id`, `organization_id`, `role`, `is_active`.
- **Manager roles:** `owner`, `manager`, `admin` (same as `hh_user_can_manage_org`). There is **no** separate `supervisor` role in schema; treat as `manager` if added later.
- **`employees`:** `auth_user_id` links mobile user; `location_id` used for `shift_logs` insert and location-targeted announcements.

## 5. Warnings / edge cases

1. **`shift_checklist_runs` / `shift_checklist_run_items`** RLS is **unchanged** in this migration; many deployments still allow **any org member** to `SELECT` all run items. That is **broader** than this migration’s notes/events rules. Tightening run-item `SELECT` to `hh_user_can_access_run_item` is a **follow-up** migration to avoid breaking manager dashboards until verified.
2. **Employees with `location_id` NULL** cannot insert **`shift_logs`** as non-managers (location match fails). Fix data or use manager/service path.
3. **`issues` UPDATE** allows assignee/reporter to update rows; **column-level** restrictions (e.g. only manager sets `assigned_to`) are **not** enforced by RLS — use **RPC** or **trigger**.
4. **Open-shift pickup:** no separate table; **`shift_coverage_requests`** (`open_claim`) visibility is still **party-only**. Employees who are **not** yet a party **cannot** see pending open claims via RLS. Product options: **`SECURITY DEFINER` RPC** listing claimable shifts, or a narrow policy with `is_open_for_claim` + role/location rules (complex).
5. **Schedule change requests:** **no table** in repo; nothing to migrate.
6. **`service_role`** bypasses RLS — batch jobs and trusted servers should use it for backfills and aggregates.
7. **Multi-org users:** `hh_current_employee_id(org_id)` is **per org**; always pass the row’s `organization_id`.

## 6. Recommended server-only write paths

| Concern | Why | Pattern |
|---------|-----|---------|
| Run-item audit events | Tamper resistance | Keep **`hh_shift_checklist_run_item_mutate`**; no client insert on `shift_checklist_run_item_events`. |
| Override-task audit events | Tamper resistance | **`hh_shift_run_override_task_mutate`**; no client insert on `shift_run_override_task_events`. |
| Help **assignment** / problem **triage** | Prevents privilege escalation in `UPDATE` | Next.js **server action** + `service_role` or new **`SECURITY DEFINER` RPC** with explicit checks. |
| `employee_performance_daily` / `location_performance_daily` | Snapshot integrity | **Scheduled job** with `service_role` only; managers **read** via RLS. |
| Open-shift discovery | RLS too tight for eligible peers | **`hh_open_shift_claim_candidates(org_id)`** RPC (future). |
| `issues` from public QR | Anonymous / unauthenticated | **Route handler** inserts with **service_role**; set `origin='qr'` and optional `reported_by` null (employees cannot insert with null `reported_by`). |

## 7. Operational vs analytics

- **Operational truth:** run items, run item notes, help/problems, issues, shift logs, announcements.
- **Analytics snapshots:** `employee_performance_daily` (employee sees **self** only), `location_performance_daily` (**manager-only** read).
