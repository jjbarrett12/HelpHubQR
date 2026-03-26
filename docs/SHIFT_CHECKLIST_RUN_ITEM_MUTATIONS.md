# Shift checklist run item execution (shared web / iOS contract)

Operational truth for “did this line item get done, with what proof, notes, and escalations?” lives on **`shift_checklist_run_items`** plus **`shift_checklist_run_item_events`** (append-only audit; optional alias name in product docs: *run item events*) and **`shift_checklist_run_item_escalations`** (problem / help). **Checklist templates** (`checklists`, `checklist_items`) are not updated during execution.

## File tree

```
supabase/migrations/20260331210000_shift_checklist_run_item_execution.sql   # events + escalations + RPC (baseline)
supabase/migrations/20260427100000_shift_checklist_run_item_mutate_run_closed.sql  # RUN_CLOSED guard + idempotent set_proof
apps/web/lib/helphub/shift-checklist-run-item-mutate.ts    # types + parse + mutateShiftChecklistRunItem()
apps/web/lib/helphub/shift-checklist-run-item-contract.ts  # re-exports for API consumers
apps/web/lib/validation/schemas.ts                         # shiftChecklistRunItemMutateBodySchema
apps/web/app/app/helphub/actions/shift-checklist-run-item.ts # mutateShiftChecklistRunItemAction (Server Action)
apps/web/app/api/helphub/shift-checklist-run-item/mutate/route.ts  # POST, cookie session
```

## SQL migrations

| Migration | Role |
|---------|------|
| `20260331210000_shift_checklist_run_item_execution.sql` | Creates **`shift_checklist_run_item_events`** (audit), **`shift_checklist_run_item_escalations`**, baseline **`hh_shift_checklist_run_item_mutate`**. |
| `20260401000000_shift_operations_platform.sql` | Relaxes `event_type` check on events (still only RPC inserts known types). |
| `20260427100000_shift_checklist_run_item_mutate_run_closed.sql` | RPC: **`RUN_CLOSED`** when `shift_checklist_runs.status` ∈ (`completed`, `expired`); **`RUN_NOT_FOUND`** if run row missing; **idempotent `set_proof`** when `storage_path` unchanged. |

No separate `shift_run_item_events` table: use **`shift_checklist_run_item_events`** as the audit log.

## RPC contract

**Function:** `public.hh_shift_checklist_run_item_mutate(p_organization_id uuid, p_run_item_id uuid, p_action text, p_payload jsonb default '{}')`  
**Returns:** `jsonb` — parse as success vs failure (see TypeScript `parseShiftChecklistRunItemMutateResult`).

| `p_action` | `p_payload` keys | Behavior |
|------------|------------------|----------|
| `complete` | Optional `expected_updated_at` (ISO timestamptz string) | Sets `completed`, `completed_at`. If template `requires_photo` and path empty → `REQUIRES_PHOTO`. |
| `reopen` | Optional `expected_updated_at` | Clears completion. |
| `set_proof` | `storage_path` (required) | Sets `proof_photo_storage_path`. |
| `set_note` | `note` (required key; empty string clears `notes`) | Updates `notes`; max length 2000 when non-empty. |
| `flag_problem` | Optional `message` | Supersedes prior open `problem` escalation; inserts new open row + event. |
| `request_help` | Optional `message` | Same for `help` kind. |
| `clear_problem` | — | Resolves open `problem` escalation **created by this employee** only. |
| `clear_help` | — | Same for `help`. |

**Success shape (conceptual):** `{ ok: true, idempotent, action, run_item, event_id, escalation_id }`  
**Failure shape:** `{ ok: false, error: '<CODE>', current_updated_at?: ..., run_status?: ... }`  
- `VERSION_CONFLICT` → `current_updated_at`  
- `RUN_CLOSED` → `run_status` (`completed` \| `expired`)

Always pass **`shift_checklist_run_items.id`** as `p_run_item_id`, never `checklist_items.id`.

### Error codes (logical)

| Code | When |
|------|------|
| `NOT_AUTHENTICATED` | `auth.uid()` is null (RPC) |
| `INVALID_ACTION` | Unknown `p_action` |
| `NOT_ORG_MEMBER` | User not active `organization_members` for `p_organization_id` |
| `EMPLOYEE_NOT_LINKED` | No `employees` row with `auth_user_id = auth.uid()` in org |
| `RUN_ITEM_NOT_FOUND` | No run item for that id in org |
| `RUN_NOT_FOUND` | Run row missing (integrity) |
| `RUN_CLOSED` | `shift_checklist_runs.status` is `completed` or `expired` |
| `SHIFT_NOT_FOUND` | `employee_shifts` row missing for run |
| `ITEM_SUPPRESSED` | `shift_checklist_run_items.suppressed` |
| `NOT_ASSIGNED` | Item assignee or shift owner does not match actor employee |
| `ASSIGNMENT_DECLINED` | `assignment_status = declined` and action is `complete` or `set_proof` |
| `VERSION_CONFLICT` | `expected_updated_at` ≠ current `updated_at` |
| `REQUIRES_PHOTO` | Template requires photo and path empty on `complete` |
| `MISSING_STORAGE_PATH` | `set_proof` without `storage_path` |
| `MISSING_NOTE` | `set_note` without `note` key |
| `NOTE_TOO_LONG` / `MESSAGE_TOO_LONG` | Over 2000 chars |

**Transport (HTTP route only):** `401` `NOT_AUTHENTICATED`, `400` `NO_ORGANIZATION` / `INVALID_JSON` / `INVALID_BODY`, `403` `EMPLOYEE_NOT_LINKED`. The RPC result is still returned as JSON `200` for business failures like `NOT_ASSIGNED`.

## Server actions / HTTP

- **Server Action:** `mutateShiftChecklistRunItemAction` — validates body with `shiftChecklistRunItemMutateBodySchema`, uses `requireEmployeeContext()` (Supabase user + org), then RPC. **No service role** — RLS applies to any reads; writes go through **SECURITY DEFINER** RPC.
- **POST** `/api/helphub/shift-checklist-run-item/mutate` — cookie session + **active organization** from `resolveActiveOrganizationId`; same RPC. **No service role**.

Typed request (Zod): `runItemId`, `action`, optional `payload` with `expected_updated_at`, `storage_path`, `note`, `message`.

### TypeScript types

- Request: `ShiftChecklistRunItemMutateBody` (`lib/validation/schemas.ts`)
- Response: `ShiftChecklistRunItemMutateResult` (`lib/helphub/shift-checklist-run-item-mutate.ts`)
- Barrel: `lib/helphub/shift-checklist-run-item-contract.ts`
- Path constant: `SHIFT_CHECKLIST_RUN_ITEM_MUTATE_POST_PATH`

## RLS and tenancy

- Caller must be **`authenticated`**, active **`organization_members`** for `p_organization_id`, and have an **`employees`** row with `auth_user_id = auth.uid()` in that org.
- **Assignment:** if `shift_checklist_run_items.assigned_employee_id` is set, it must equal the actor’s `employees.id`; otherwise the shift owner (`employee_shifts.employee_id` for the run’s `employee_shift_id`) must match.
- **Suppressed** items: rejected (`ITEM_SUPPRESSED`). **`assignment_status = declined`:** blocks `complete` and `set_proof` (`ASSIGNMENT_DECLINED`).
- **`shift_checklist_run_item_events`:** `SELECT` for org members; **`INSERT`/`UPDATE`/`DELETE` revoked** from `authenticated` — only the definer RPC writes events.
- **`shift_checklist_run_item_escalations`:** `SELECT` for org members; managers (`hh_user_can_manage_org`) may **`ALL`** for dashboards / resolution workflows; employees create/update open rows **through the RPC** (bypasses RLS), not via direct client writes.

## Idempotency and conflicts

- **`complete`** when already completed → `ok: true`, `idempotent: true` (no new event).
- **`reopen`** when already open → same.
- **`clear_problem` / `clear_help`** when no matching open escalation → `idempotent: true` (no new event).
- **`flag_problem` / `request_help`** always append a new escalation after marking prior open row `superseded` (new operational signal).
- **Optimistic concurrency:** send `payload.expected_updated_at` equal to the last known `shift_checklist_run_items.updated_at`. Mismatch → `VERSION_CONFLICT` and `current_updated_at` for refresh/retry.

## Example: web (Server Action)

```tsx
import { mutateShiftChecklistRunItemAction } from "@/app/app/helphub/actions/shift-checklist-run-item";

const res = await mutateShiftChecklistRunItemAction({
  runItemId: task.id,
  action: "complete",
  payload: { expected_updated_at: task.updated_at },
});
if (!res.ok && res.error === "VERSION_CONFLICT") {
  // refetch run item; optionally retry with res.current_updated_at
}
if (!res.ok && res.error === "RUN_CLOSED") {
  // e.g. res.run_status === "completed" | "expired"
}
```

Flow for photo-required tasks: `set_proof` → `complete` (or upload then single `set_proof` before complete).

## Example: web (fetch, same-origin session)

```ts
import {
  SHIFT_CHECKLIST_RUN_ITEM_MUTATE_POST_PATH,
  type ShiftChecklistRunItemMutateBody,
} from "@/lib/helphub/shift-checklist-run-item-contract";

const body: ShiftChecklistRunItemMutateBody = {
  runItemId: "...",
  action: "set_note",
  payload: { note: "Lobby cleared" },
};

const res = await fetch(SHIFT_CHECKLIST_RUN_ITEM_MUTATE_POST_PATH, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

if (res.status === 401) { /* not logged in */ }
const json = await res.json();
// json matches ShiftChecklistRunItemMutateResult
```

## Example: iOS (Supabase Swift)

Use the logged-in user’s JWT on the Supabase client:

```swift
let payload: [String: Any] = [
  "storage_path": path
]
try await supabase.rpc(
  "hh_shift_checklist_run_item_mutate",
  params: [
    "p_organization_id": orgId,
    "p_run_item_id": runItemId,
    "p_action": "set_proof",
    "p_payload": AnyJSON.object(payload)
  ]
)
```

Decode the returned `JSON` / `AnyJSON` as a struct mirroring `ShiftChecklistRunItemMutateResult`.

### iOS: HTTPS + session cookie (WKWebView / shared cookie store)

If the employee session is a browser cookie against the Next app, use the same **POST** path and JSON body as web `fetch`, with `URLSession` configured to send cookies for your app domain.

### iOS: Supabase Swift (direct RPC)

Use the logged-in user’s JWT on the Supabase client (no service role on device):

```swift
let payload: [String: Any] = [
  "storage_path": path
]
try await supabase.rpc(
  "hh_shift_checklist_run_item_mutate",
  params: [
    "p_organization_id": orgId,
    "p_run_item_id": runItemId,
    "p_action": "set_proof",
    "p_payload": AnyJSON.object(payload)
  ]
)
```

**Read models:** continue using `hh_employee_today_bundle` (includes template run items + `shift_run_override_tasks` in v3; each row has `item_kind`). Only **`item_kind = run_item`** ids are valid for **this** mutate RPC; overrides use **`hh_shift_run_override_task_mutate`** — see [SHIFT_RUN_OVERRIDE_TASK_MUTATIONS.md](./SHIFT_RUN_OVERRIDE_TASK_MUTATIONS.md). Optionally `select` from `shift_checklist_run_item_escalations` where `status = 'open'` to show badges for problem/help without client-only state.

## Service role

Use **`service_role`** only for trusted backend jobs (e.g. admin repair scripts). Normal employee execution uses **`authenticated`** + RPC so `auth.uid()` drives assignment checks.
