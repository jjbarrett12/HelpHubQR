# HelpHub operational Realtime

Operational shift execution data is broadcast over **Supabase Realtime** (`postgres_changes`) so managers and employees see updates without manual refresh. **Payloads are not merged into UI state** — each event is a signal to **reload the canonical read model** (web: server components via `router.refresh()`; iOS: `TodayViewModel.load()` / Employee Today bundle).

## Tables in `supabase_realtime` publication

Migration: `supabase/migrations/20260429160000_helphub_operational_realtime.sql`

| Table | Purpose (examples) |
|-------|---------------------|
| `shift_checklist_run_items` | Run item completed / reopened, proof, notes |
| `shift_run_override_tasks` | Override completed / reopened, new override row |
| `shift_checklist_run_item_escalations` | Problem / help on run items |
| `shift_run_override_task_escalations` | Problem / help on overrides |
| `shift_notes` | Shift briefing lines |
| `shift_checklist_runs` | Run closed / expired / status |

RLS still applies: clients only receive changes for rows they could `SELECT`.

## Channel naming

| Role | Topic pattern | Filters (high level) |
|------|----------------|----------------------|
| **Manager (web)** | `helphub:org:{organizationId}:manager-dashboard` or `helphub:org:{organizationId}:command-center` | `organization_id=eq.{org}` on tables that have it; `shift_checklist_run_items` unfiltered (RLS narrows) |
| **Employee (iOS)** | `helphub:org:{organizationId}:shift:{employeeShiftId}:employee` | `employee_shift_id` on runs + notes; `shift_checklist_run_id` / `run_id` on items, overrides, escalations when a run exists |

Private channel names are arbitrary; **security is RLS + JWT**, not the topic string.

## Web implementation

- **Component:** `apps/web/components/helphub/OperationalOrgRealtimeRefresh.tsx`
- **Usage:** Rendered inside `OrgTodayDashboard` (app dashboard for org members) and `TodayCommandCenter` (`/app/today`).
- **Behavior:** Debounced (~400ms) `router.refresh()` on any matching `postgres_changes` event.
- **Env:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (same as rest of the app).

## iOS implementation

- **Type:** `EmployeeOperationalRealtimeCoordinator` (`HelpHubQR/Services/EmployeeOperationalRealtimeCoordinator.swift`)
- **Wiring:** `TodayTabViewModels` attaches the coordinator when **all** are set: remote Today API (`HELPHUB_ACCESS_TOKEN`), `HELPHUB_SUPABASE_URL`, `HELPHUB_SUPABASE_ANON_KEY`.
- **Bundle fields:** `EmployeeTodaySnapshot.bundleOrganizationId` and `serverChecklistRunId` (from API `source.organizationId` and `checklist.runId`) drive filters. If there is no run yet, only run + note listeners are active until `load()` returns a run id.
- **Behavior:** Debounced (~350ms) `load()` on events; **no** parsing of row payloads for UI.

**Dependency:** Swift package [supabase-swift](https://github.com/supabase/supabase-swift) (product **Supabase**), linked from the Xcode project.

## Event filtering summary

- **Managers:** Prefer `organization_id=eq.{org}` on `shift_checklist_runs`, `shift_run_override_tasks`, both escalation tables, and `shift_notes`. Subscribe to all `shift_checklist_run_items` changes visible under RLS so completion/proof updates refresh KPIs that depend on items.
- **Employees:** Narrow to `employee_shift_id` and the current `shift_checklist_run_id` / `run_id` so co-workers’ runs in the same org do not trigger refreshes.

## What not to realtime

Do not add unrelated tables (catalogs, users, tickets unless explicitly operational). Keep Realtime as a **cheap invalidation** path, not a second source of truth.
