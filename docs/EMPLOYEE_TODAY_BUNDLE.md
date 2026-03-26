# Employee Today bundle — backend contract

**Canonical spec (file tree, RLS, example JSON, timezone):** [`EMPLOYEE_TODAY_CONTRACT.md`](./EMPLOYEE_TODAY_CONTRACT.md).

Single read model for the iOS (and web) employee **Today** screen. Execution truth: `employee_shifts`, `shift_checklist_runs`, **`shift_checklist_run_items`**, **`shift_run_override_tasks`**. Template **`itemsFlat[].id`** when `item_kind = run_item` is the **`hh_shift_checklist_run_item_mutate`** key; **`item_kind = override`** uses **`shift_run_override_tasks.id`** (separate writes when implemented).

---

## 1. File tree

```
supabase/migrations/20260331240000_operational_messages.sql        # bundle + operational_messages
supabase/migrations/20260424120000_employee_today_bundle_v2.sql    # v2 item filter + shift_notes + bundleVersion 2
supabase/migrations/20260427150000_employee_today_bundle_v3_overrides.sql  # v3 overrides + item_kind + bundleVersion 3
supabase/migrations/20260428120000_shift_notes_and_employee_today_bundle_v4.sql  # v4 shift_notes table + bundle shiftNotes from DB
supabase/migrations/20260429140000_shift_notes_employee_shift_id_forward.sql    # forward: employee_shift_id column + nullable created_by
apps/web/lib/helphub/employee-today/types.ts                        # Canonical TS contract (camelCase)
apps/web/lib/helphub/employee-today/map-rpc-response.ts             # RPC JSON → types
apps/web/lib/helphub/employee-today/fetch-employee-today-bundle.ts  # supabase.rpc wrapper
apps/web/lib/helphub/employee-today/index.ts
apps/web/lib/supabase/route-handler-client.ts                       # Bearer or cookie for /api/employee/today
apps/web/app/api/employee/today/route.ts                            # GET JSON for mobile / web
docs/EMPLOYEE_TODAY_CONTRACT.md                                     # authoritative contract
docs/IOS_EMPLOYEE_TODAY_INTEGRATION.md                              # TodayViewModel wiring
docs/EMPLOYEE_TODAY_BUNDLE.md                                       # This doc
```

---

## 2. Postgres RPC

- **Name:** `public.hh_employee_today_bundle(p_organization_id uuid, p_time_zone text default 'America/Denver')`
- **Returns:** `jsonb`
- **Security:** `SECURITY DEFINER` — **must** keep internal filters: active org member + `employees.auth_user_id = auth.uid()`.
- **Grants:** `authenticated`, `service_role` — **not** `anon`.

### Timezone

- **`p_time_zone`:** IANA name (e.g. `America/Denver`).
- **Calendar date:** `v_cal := (now() AT TIME ZONE p_time_zone)::date`
- **Shift selection:** Prefer `employee_shifts.shift_date = v_cal` (today’s shift). If none, earliest `shift_date > v_cal`.
- **Contract:** `shift_date` in DB is a **calendar date**; it must be produced in the **same zone** when shifts are created (align with `CRON_SCHEDULE_TZ` / org setting).

### Focus shift / run

- **No row** for employee today → try **upcoming** shift.
- **Run:** `shift_checklist_runs` by `employee_shift_id` (0..1).
- **No run:** `checklist.no_run_reason` = `run_not_created` | `no_focus_shift`.

### Announcements

- Wired to **`operational_messages`** (see `docs/OPERATIONAL_MESSAGES.md`): up to **5** items in `announcements.items`, `source: "operational_messages"`, `todo: null`, with `read` / `read_at` per employee.

### Run item scope (v2)

- Template run items included only if **`assigned_employee_id` IS NULL** (whole shift) **or** **equals** the authenticated employee.

### Override tasks (v3)

- **`shift_run_override_tasks`** for the same run, same assignment filter, **`status <> 'suppressed'`** for listing and progress.
- Appended to **`items_flat`** after template rows; optional section **`section_key` `__override__`**, title **Extra tasks**.
- Each JSON row includes **`item_kind`**: `run_item` | `override`.
- **`checklist.progress`** counts template + override rows; **`next_incomplete`** prefers an incomplete template item, else first **`active`** override.

### Shift notes (placeholder)

- Top-level **`shiftNotes`**: `items` usually empty; `todo` describes how to wire `employee_shifts` or message category later.

---

## 3. TypeScript types

See `apps/web/lib/helphub/employee-today/types.ts` — exported `EmployeeTodayBundle`, `EmployeeTodayRunItem`, etc.

---

## 4. Mapping layer

`mapEmployeeTodayRpcToBundle(raw, organizationId)` in `map-rpc-response.ts` converts RPC **snake_case** JSON to **camelCase** `EmployeeTodayBundle`.

---

## 5. RLS & employee access

| Layer | Behavior |
|--------|-----------|
| **Table RLS** | Today, `employee_shifts` / `shift_checklist_runs` allow **any org member** to SELECT broad rows — **too wide** for “minimum data” as a policy goal. |
| **RPC** | Enforces **only** the linked employee’s shifts/runs/items for the given `p_organization_id`. Response does not include other employees’ schedules. |
| **Recommendation** | Keep using this RPC (or equivalent Edge Function) for employee clients; optionally tighten RLS later with `auth_user_id` join policies. |
| **Mutations** | Item updates should use `shift_checklist_run_items.id` with policies or RPCs that verify `employee_shifts.employee_id` matches linked employee (separate migration). |

---

## 6. iOS / Swift shape (mirror)

```swift
struct EmployeeTodayBundleDTO: Decodable {
  let ok: Bool
  let source: SourceMeta?
  let employee: EmployeeDTO?
  let focus: FocusDTO?
  let checklist: ChecklistDTO?
  let announcements: AnnouncementsDTO?
  let error: String?
}

struct EmployeeTodayRunItemDTO: Decodable {
  let id: UUID
  let itemKind: String?           // "run_item" | "override"
  let checklistItemId: UUID?      // nil for overrides
  let sortOrder: Int
  let sectionTitle: String?
  let title: String
  let isCompleted: Bool
  let requiresPhoto: Bool
  let hasProof: Bool
  let isBlocked: Bool
  let isSuppressed: Bool
  let assignmentStatus: String
}
```

Decode **camelCase** from `GET /api/employee/today`. For **direct Supabase RPC**, decode **snake_case** from raw JSON or add a small CodingKeys mapper.

---

## 7. Example JSON (success, camelCase — API route)

```json
{
  "ok": true,
  "source": {
    "bundleVersion": 2,
    "rpc": "hh_employee_today_bundle",
    "computedAt": "2026-03-31T18:22:00.123Z",
    "organizationId": "11111111-1111-1111-1111-111111111111",
    "employeeId": "22222222-2222-2222-2222-222222222222",
    "timeZone": "America/Denver",
    "calendarDate": "2026-03-31",
    "focusEmployeeShiftId": "33333333-3333-3333-3333-333333333333",
    "focusRunId": "44444444-4444-4444-4444-444444444444"
  },
  "employee": {
    "id": "22222222-2222-2222-2222-222222222222",
    "organizationId": "11111111-1111-1111-1111-111111111111",
    "firstName": "Jordan",
    "fullName": "Jordan Lee",
    "locationId": "55555555-5555-5555-5555-555555555555"
  },
  "focus": {
    "kind": "today_shift",
    "isActiveNow": true,
    "shift": {
      "id": "33333333-3333-3333-3333-333333333333",
      "shiftDate": "2026-03-31",
      "shiftType": "open",
      "status": "scheduled",
      "startsAt": "2026-03-31T13:00:00.000Z",
      "endsAt": "2026-03-31T21:00:00.000Z",
      "locationId": "55555555-5555-5555-5555-555555555555",
      "staffRoleId": "66666666-6666-6666-6666-666666666666",
      "locationName": "Main building",
      "roleName": "Housekeeping"
    },
    "run": {
      "id": "44444444-4444-4444-4444-444444444444",
      "status": "opened",
      "checklistId": "77777777-7777-7777-7777-777777777777",
      "templateName": "Daily opening",
      "startedAt": "2026-03-31T13:05:00.000Z",
      "completedAt": null,
      "sentAt": "2026-03-31T12:55:00.000Z"
    }
  },
  "checklist": {
    "runId": "44444444-4444-4444-4444-444444444444",
    "templateName": "Daily opening",
    "progress": { "completed": 1, "total": 4, "ratio": 0.25 },
    "sections": [
      {
        "sectionKey": "opening",
        "sectionTitle": "Opening",
        "sectionSort": 0,
        "items": [
          {
            "id": "88888888-8888-8888-8888-888888888801",
            "itemKind": "run_item",
            "checklistItemId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "sortOrder": 0,
            "sectionTitle": "Opening",
            "title": "Unlock cart",
            "isCompleted": true,
            "completedAt": "2026-03-31T13:10:00.000Z",
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
    "itemsFlat": [],
    "nextIncompleteTaskId": "88888888-8888-8888-8888-888888888802",
    "nextIncompleteOverrideTaskId": null,
    "nextIncomplete": { "kind": "run_item", "id": "88888888-8888-8888-8888-888888888802" },
    "noRunReason": null
  },
  "announcements": {
    "items": [],
    "source": "operational_messages",
    "todo": null
  },
  "shiftNotes": {
    "items": [],
    "source": "none",
    "todo": null
  }
}
```

`itemsFlat` populated in real responses (omitted above for brevity).

---

## 8. Client usage

- **Web (server component / action):** `fetchEmployeeTodayBundle(supabase, { organizationId, timeZone })`.
- **iOS:** `GET /api/employee/today` with session cookie **or** Supabase Swift `.rpc("hh_employee_today_bundle", …)` with user JWT.

---

## 9. Follow-ups

- [x] Employee-scoped mutations: **`hh_shift_run_override_task_mutate`** — see `docs/SHIFT_RUN_OVERRIDE_TASK_MUTATIONS.md`.
- [ ] Employee-scoped **UPDATE** RPC or RLS on `shift_checklist_run_items` keyed off `auth_user_id`.
- [ ] Signed URL helper for `has_proof` (storage path on run item).
- [x] Announcements: `operational_messages` + bundle section (`docs/OPERATIONAL_MESSAGES.md`).
- [ ] Optional: exclude `is_suppressed` items from employee bundle entirely.
