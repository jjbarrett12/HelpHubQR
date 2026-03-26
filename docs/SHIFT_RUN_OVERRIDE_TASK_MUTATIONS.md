# Shift run override task mutations

Execution writes for **`shift_run_override_tasks`** (one-off tasks attached to a **`shift_checklist_runs`** row). **Do not** send these ids to **`hh_shift_checklist_run_item_mutate`**.

Parallel to [SHIFT_CHECKLIST_RUN_ITEM_MUTATIONS.md](./SHIFT_CHECKLIST_RUN_ITEM_MUTATIONS.md): same auth gates, assignment rules, run-closed guard, optimistic-lock field, and action names where applicable.

---

## 1. File tree

```
supabase/migrations/20260427150000_employee_today_bundle_v3_overrides.sql   # proof_photo_storage_path on overrides (IF NOT EXISTS)
supabase/migrations/20260427160000_shift_run_override_task_mutate.sql       # events, escalations, RPC, RLS, hh_user_can_access_override_task
apps/web/lib/helphub/shift-run-override-task-mutate.ts
apps/web/lib/helphub/shift-run-override-task-contract.ts
apps/web/lib/validation/schemas.ts                                          # shiftRunOverrideTaskMutateBodySchema
apps/web/app/api/helphub/shift-run-override-task/mutate/route.ts
apps/web/app/app/helphub/actions/shift-run-override-task.ts
docs/SHIFT_RUN_OVERRIDE_TASK_MUTATIONS.md                                   # This doc
```

---

## 2. Postgres

| Object | Role |
|--------|------|
| **`hh_shift_run_override_task_mutate(p_organization_id, p_override_task_id, p_action, p_payload)`** | **SECURITY DEFINER** employee mutations |
| **`shift_run_override_task_events`** | Append-only audit (`event_type` same vocabulary as run-item events) |
| **`shift_run_override_task_escalations`** | Open **problem** / **help** rows (parallel to `shift_checklist_run_item_escalations`) |
| **`hh_user_can_access_override_task(org, override_task_id)`** | RLS helper: manager OR shift owner OR override assignee |

**Actions:** `complete`, `reopen`, `set_proof`, `set_note`, `flag_problem`, `request_help`, `clear_problem`, `clear_help`

**Run closed:** If `shift_checklist_runs.status` ∈ (`completed`, `expired`) → `ok: false`, `error: RUN_CLOSED`, `run_status`.

**Assignment:** If `assigned_employee_id` is set → must equal caller’s `employees.id`. If null → **`employee_shifts.employee_id`** (shift owner) must equal caller.

**Suppressed:** `status = 'suppressed'` → `OVERRIDE_SUPPRESSED` (no writes).

**Complete:** If `requires_photo` and `proof_photo_storage_path` empty → `REQUIRES_PHOTO`. Idempotent if already `status = 'completed'`.

**Reopen:** Sets `status = 'active'`, clears `completed_at`. Idempotent if already active.

**Escalations:** `flag_problem` / `request_help` supersede prior open row of same `kind` for this override task; `clear_*` resolves only rows **`created_by_employee_id` = actor** (same as run-item RPC).

---

## 3. Audit / event model

| `event_type` | When |
|--------------|------|
| `completed` | Successful complete |
| `reopened` | Reopen |
| `proof_set` | `set_proof` |
| `note_set` | `set_note` |
| `problem_flagged` | New problem escalation |
| `help_requested` | New help escalation |
| `problem_cleared` | Employee cleared their open problem |
| `help_cleared` | Employee cleared their open help |

Payload mirrors run-item patterns (e.g. `escalation_id` on flag/request, `storage_path` on proof).

---

## 4. TypeScript

- **`ShiftRunOverrideTaskMutateResult`** — `parseShiftRunOverrideTaskMutateResult(raw)`
- **`mutateShiftRunOverrideTask(supabase, { organizationId, overrideTaskId, action, payload })`**
- Body schema: **`shiftRunOverrideTaskMutateBodySchema`** — `overrideTaskId`, `action`, optional `payload` (`expected_updated_at`, `storage_path`, `note`, `message`)

Success shape (RPC / JSON): `ok`, `idempotent`, `action`, **`override_task`** (row as object), `event_id`, `escalation_id`.

---

## 5. RLS / tenancy

- **Events:** `SELECT` for managers or **`hh_user_can_access_override_task`**; **no** `INSERT`/`UPDATE`/`DELETE` for `authenticated` (RPC / `service_role` only).
- **Escalations:** `SELECT` same as events; **`ALL`** for **`hh_user_can_manage_org`** (manager resolution).
- **Override rows:** Existing manager write policies unchanged; employees mutate execution fields **only** through this RPC.

---

## 6. iOS routing (`item_kind`)

| `itemKind` | Mutate RPC / API |
|------------|------------------|
| `run_item` | `hh_shift_checklist_run_item_mutate` / `POST .../shift-checklist-run-item/mutate` |
| `override` | `hh_shift_run_override_task_mutate` / `POST .../shift-run-override-task/mutate` |

**TaskDetailView / ChecklistViewModel:** Branch on `itemKind` before calling mutate. Same `action` + `payload` field names where applicable (`note`, `message`, `storage_path`, `expected_updated_at`).

After success, refresh **`hh_employee_today_bundle`** (or invalidate local snapshot).

---

## 7. Example payloads

**Complete (no photo required)**

```json
POST /api/helphub/shift-run-override-task/mutate
{ "overrideTaskId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "action": "complete" }
```

**Set note**

```json
{ "overrideTaskId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "action": "set_note", "payload": { "note": "Used spare linens from cart B." } }
```

**Flag problem**

```json
{ "overrideTaskId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "action": "flag_problem", "payload": { "message": "Locked closet" } }
```

**Optimistic lock**

```json
{ "overrideTaskId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "action": "complete", "payload": { "expected_updated_at": "2026-03-24T18:00:01.123Z" } }
```

---

## 8. Error codes (representative)

| `error` | Meaning |
|---------|---------|
| `NOT_AUTHENTICATED` | No `auth.uid()` |
| `NOT_ORG_MEMBER` | Not active member of `p_organization_id` |
| `EMPLOYEE_NOT_LINKED` | No `employees` row for user in org |
| `OVERRIDE_TASK_NOT_FOUND` | Bad id / wrong org |
| `RUN_NOT_FOUND` / `SHIFT_NOT_FOUND` | Broken FK chain |
| `RUN_CLOSED` | Run completed or expired |
| `OVERRIDE_SUPPRESSED` | Row suppressed |
| `NOT_ASSIGNED` | Not shift owner and not assignee |
| `VERSION_CONFLICT` | `expected_updated_at` ≠ `updated_at` |
| `REQUIRES_PHOTO` | Complete blocked until proof path set |
| `MISSING_STORAGE_PATH` | `set_proof` without `storage_path` |
| `MISSING_NOTE` | `set_note` without `note` key |
| `NOTE_TOO_LONG` / `MESSAGE_TOO_LONG` | &gt; 2000 chars |
| `INVALID_ACTION` | Unknown `p_action` |

---

## 9. Read model

**Today bundle** (`hh_employee_today_bundle`) exposes overrides with `item_kind: "override"` and `has_proof` from **`proof_photo_storage_path`**.

Optional: `select` from **`shift_run_override_task_escalations`** where `status = 'open'` to badge problem/help per override id.
