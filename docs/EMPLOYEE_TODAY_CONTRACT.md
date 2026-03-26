# Employee Today — canonical backend contract

Single **server-owned** read model for the employee **Today** screen: minimum data to execute the assigned checklist run. **Execution truth** is `shift_checklist_runs` + `shift_checklist_run_items` (mutable task id = **`shift_checklist_run_items.id`**). Templates (`checklists` / `checklist_items`) are definition-only and appear only as resolved fields (e.g. `template_name`, `checklist_item_id` on items).

---

## 1. File tree

```
supabase/migrations/20260331203000_employee_today_bundle_rpc.sql       # original RPC (superseded)
supabase/migrations/20260331240000_operational_messages.sql            # bundle + operational_messages
supabase/migrations/20260424120000_employee_today_bundle_v2.sql        # v2: item scope + shift_notes + bundleVersion 2
supabase/migrations/20260427150000_employee_today_bundle_v3_overrides.sql  # v3: shift_run_override_tasks + item_kind + next_incomplete
supabase/migrations/20260428120000_shift_notes_and_employee_today_bundle_v4.sql  # v4: public.shift_notes + real shift_notes in bundle
supabase/migrations/20260429140000_shift_notes_employee_shift_id_forward.sql  # forward: employee_shift_id + nullable created_by + RPC refresh
apps/web/lib/helphub/employee-today/types.ts                           # camelCase response types
apps/web/lib/helphub/employee-today/map-rpc-response.ts               # snake_case RPC → types
apps/web/lib/helphub/employee-today/fetch-employee-today-bundle.ts    # server wrapper (Supabase RPC)
apps/web/lib/helphub/employee-today/index.ts                           # barrel exports
apps/web/lib/supabase/route-handler-client.ts                          # Bearer or cookie Supabase client
apps/web/app/api/employee/today/route.ts                               # GET JSON (camelCase) for web + iOS
apps/web/app/api/helphub/shift-run-override-task/mutate/route.ts       # POST override execution (parallel to run-item mutate)
apps/web/lib/helphub/shift-run-override-task-mutate.ts
docs/SHIFT_RUN_OVERRIDE_TASK_MUTATIONS.md                              # override-task RPC + audit
docs/EMPLOYEE_TODAY_BUNDLE.md                                          # narrative / iOS DTO notes
docs/IOS_EMPLOYEE_TODAY_INTEGRATION.md                                 # TodayViewModel + RemoteTodayService
docs/OPERATIONAL_MESSAGES.md                                           # announcements source
HelpHubQR/HelpHubQR/Services/RemoteTodayService.swift                  # iOS: GET /api/employee/today → snapshot
```

**Canonical contract:** `EmployeeTodayBundle` (TypeScript) = JSON from **`GET /api/employee/today`** = logical shape after mapping **`hh_employee_today_bundle`** (RPC returns snake_case).

---

## 2. Implementation

| Layer | Responsibility |
|--------|----------------|
| **Postgres** | `hh_employee_today_bundle(p_organization_id uuid, p_time_zone text)` — SECURITY DEFINER; **calendar today** = `(now() AT TIME ZONE p_time_zone)::date` vs `employee_shifts.shift_date`; focus shift = today’s non-terminal shift else earliest future; **one** run for that shift; **v2+** run items where `assigned_employee_id` is null or caller’s `employees.id`; **v3+** also `shift_run_override_tasks` (same assignment rule) merged into **`items_flat`** after template rows, optional section **`__override__`** / title “Extra tasks”; each row has **`item_kind`** `run_item` \| `override`. Progress counts **both**. **`next_incomplete`** prefers first incomplete template run item, else first active override. **v4+** loads **`shift_notes`** from **`public.shift_notes`** where **`employee_shift_id`** is the focus **`employee_shifts.id`** and **`visible_to_employee`**, chronological. `source.bundle_version` **4** after v4 migration. |
| **TypeScript** | `fetchEmployeeTodayBundle` → `mapEmployeeTodayRpcToBundle`. |
| **HTTP** | `GET /api/employee/today?organizationId=&timeZone=` — optional query org (else active org from session); **`Authorization: Bearer`** supported for native apps. |

**Timezone:** `p_time_zone` must be an **IANA** name (e.g. `America/Denver`). **“Today”** = `(now() AT TIME ZONE p_time_zone)::date` compared to `employee_shifts.shift_date`. Align app UI with the same zone you pass (device zone is typical).

---

## 3. TypeScript response types

Defined in `apps/web/lib/helphub/employee-today/types.ts`:

- **`EmployeeTodayBundle`** — `EmployeeTodayBundleSuccess | EmployeeTodayBundleFailure`
- **`EmployeeTodayEmployee`** — id, org, firstName, fullName, locationId
- **`EmployeeTodayFocus`** — `kind`: `today_shift` | `upcoming_shift` | `none`; `isActiveNow`; `shift`; `run` (summary)
- **`EmployeeTodayChecklist`** — `runId`, `templateName`, `progress`, `sections`, `itemsFlat`, `nextIncompleteTaskId` (template run items only), `nextIncompleteOverrideTaskId`, **`nextIncomplete`** (`run_item` \| `override` + id), `noRunReason`
- **`EmployeeTodayRunItem`** — **`itemKind`** `run_item` \| `override`; **`id`** = `shift_checklist_run_items.id` or `shift_run_override_tasks.id`; **`run_item`** → **`hh_shift_checklist_run_item_mutate`**; **`override`** → **`hh_shift_run_override_task_mutate`** (`docs/SHIFT_RUN_OVERRIDE_TASK_MUTATIONS.md`). `checklistItemId` = template link, **null** on overrides.
- **`EmployeeTodayAnnouncements`** — `items`, `source` (`operational_messages` when migrated), `todo` (null when wired)
- **`EmployeeTodayShiftNotes`** — `items` (manager-authored lines), `source` (`shift_notes` when wired), `todo` (null when wired) — per-**`employee_shifts`** briefing; not org-wide broadcasts (`docs/OPERATIONAL_MESSAGES.md`)

---

## 4. Mapping layer

`mapEmployeeTodayRpcToBundle(raw, organizationId)` in `map-rpc-response.ts`:

- RPC **`source`** → `EmployeeTodaySourceMeta` (bundleVersion, rpc, computedAt, organizationId, employeeId, **timeZone**, **calendarDate**, focusEmployeeShiftId, focusRunId)
- **`focus` / `checklist` / `announcements`** — snake_case → camelCase; invalid payloads → `INVALID_RESPONSE`

---

## 5. Shift notes vs announcements

| Topic | Status |
|--------|--------|
| **Operational broadcasts / reminders** | Implemented: `operational_messages` → `announcements` in bundle (`docs/OPERATIONAL_MESSAGES.md`). |
| **Per-shift manager briefing** | Implemented (**v4**): table **`public.shift_notes`** (`organization_id`, **`employee_shift_id` → `employee_shifts.id`**, `note`, **`created_by`** nullable / `ON DELETE SET NULL`, `created_at`, **`visible_to_employee`**). Managers insert via RLS + server action; bundle **`shiftNotes.items`** lists employee-visible rows for the focus shift in **chronological** order. Manager UI: **`/app/shift-ops`** → “Shift briefing / notes” on each shift card. |
| **Task-level execution notes** | Already on each run item: `EmployeeTodayRunItem.notes` ← `shift_checklist_run_items.notes`. |

**RPC item shape (snake_case in raw JSON):** each element has `id`, `title` (fixed label `"Shift briefing"`), `body` (note text), `created_at`, optional `author_label` (manager display from `user_profiles` / `auth.users`).

---

## 6. RLS and employee access

- The RPC runs as **SECURITY DEFINER** but **only** returns data after:
  - `auth.uid()` is an active **organization_member** of `p_organization_id`
  - Same user is linked to **one** active `employees` row (`auth_user_id`) in that org
- Queries are scoped to **`employee_shifts.employee_id = that employee`** and **`shift_checklist_runs` for that shift only** — **no org-wide** shift or run lists.
- **Run items (v2):** only rows where `assigned_employee_id IS NULL` (legacy / whole-shift) **or** `assigned_employee_id = v_employee_id`, so pooled assignments do not leak other employees’ tasks into the payload.
- Underlying tables keep their normal **RLS** for direct PostgREST access; the bundle path does not expose extra rows beyond the RPC logic.
- **`shift_notes`:** employees may **SELECT** only rows whose **`employee_shift_id`** is a shift assigned to them and **`visible_to_employee`** is true; **owner/manager/admin** may read/insert for their org (see migrations `20260428120000_*` and `20260429140000_*`). The RPC reads notes with definer rights but only for the caller’s focus **`v_shift.id`**.
- **Do not** rely on clients to filter: trust the RPC for “minimum data.”

---

## 7. Example JSON payload (success, camelCase)

Shape matches `GET /api/employee/today` after mapping. Values are illustrative.

```json
{
  "ok": true,
  "source": {
    "bundleVersion": 4,
    "rpc": "hh_employee_today_bundle",
    "computedAt": "2026-03-24T15:00:00.000Z",
    "organizationId": "11111111-1111-1111-1111-111111111111",
    "employeeId": "22222222-2222-2222-2222-222222222222",
    "timeZone": "America/Denver",
    "calendarDate": "2026-03-24",
    "focusEmployeeShiftId": "33333333-3333-3333-3333-333333333333",
    "focusRunId": "44444444-4444-4444-4444-444444444444"
  },
  "employee": {
    "id": "22222222-2222-2222-2222-222222222222",
    "organizationId": "11111111-1111-1111-1111-111111111111",
    "firstName": "Alex",
    "fullName": "Alex Kim",
    "locationId": "55555555-5555-5555-5555-555555555555"
  },
  "focus": {
    "kind": "today_shift",
    "isActiveNow": true,
    "shift": {
      "id": "33333333-3333-3333-3333-333333333333",
      "shiftDate": "2026-03-24",
      "shiftType": "open",
      "status": "sent",
      "startsAt": "2026-03-24T13:00:00.000Z",
      "endsAt": "2026-03-24T21:00:00.000Z",
      "locationId": "55555555-5555-5555-5555-555555555555",
      "staffRoleId": "66666666-6666-6666-6666-666666666666",
      "locationName": "Main",
      "roleName": "Housekeeping"
    },
    "run": {
      "id": "44444444-4444-4444-4444-444444444444",
      "status": "sent",
      "checklistId": "77777777-7777-7777-7777-777777777777",
      "templateName": "AM Guest rooms",
      "startedAt": null,
      "completedAt": null,
      "sentAt": "2026-03-24T13:05:00.000Z"
    }
  },
  "checklist": {
    "runId": "44444444-4444-4444-4444-444444444444",
    "templateName": "AM Guest rooms",
    "progress": { "completed": 2, "total": 8, "ratio": 0.25 },
    "sections": [
      {
        "sectionKey": "default",
        "sectionTitle": "Guest rooms",
        "sectionSort": 0,
        "items": [
          {
            "id": "88888888-8888-8888-8888-888888888801",
            "itemKind": "run_item",
            "checklistItemId": "99999999-9999-9999-9999-999999999999",
            "sortOrder": 0,
            "sectionTitle": "Guest rooms",
            "title": "Strip and remake bed",
            "isCompleted": false,
            "completedAt": null,
            "requiresPhoto": false,
            "hasProof": false,
            "notes": null,
            "isSuppressed": false,
            "isBlocked": false,
            "assignmentStatus": "assigned"
          }
        ]
      }
    ],
    "itemsFlat": [
      {
        "id": "88888888-8888-8888-8888-888888888801",
        "itemKind": "run_item",
        "checklistItemId": "99999999-9999-9999-9999-999999999999",
        "sortOrder": 0,
        "sectionTitle": "Guest rooms",
        "title": "Strip and remake bed",
        "isCompleted": false,
        "completedAt": null,
        "requiresPhoto": false,
        "hasProof": false,
        "notes": null,
        "isSuppressed": false,
        "isBlocked": false,
        "assignmentStatus": "assigned"
      }
    ],
    "nextIncompleteTaskId": "88888888-8888-8888-8888-888888888801",
    "nextIncompleteOverrideTaskId": null,
    "nextIncomplete": { "kind": "run_item", "id": "88888888-8888-8888-8888-888888888801" },
    "noRunReason": null
  },
  "announcements": {
    "items": [],
    "source": "operational_messages",
    "todo": null
  },
  "shiftNotes": {
    "items": [
      {
        "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "title": "Shift briefing",
        "body": "Pool deck closed until noon — use service elevator for linen carts.",
        "authorLabel": "Jordan Lee",
        "createdAt": "2026-03-24T12:30:00.000Z"
      }
    ],
    "source": "shift_notes",
    "todo": null
  }
}
```

**iOS:** Prefer `supabase.rpc("hh_employee_today_bundle", …)` and map snake_case → your models, **or** `GET /api/employee/today` with Bearer token and decode camelCase as above.

---

## What we intentionally omit

- Other employees’ shifts or runs
- Full template definitions / all checklist items in the org
- Historical runs (only the focus shift’s single run)
- Org-wide checklist **templates** (only resolved `templateName` + per-row `checklistItemId` on `run_item` rows)

This keeps the payload bounded for on-duty execution.
