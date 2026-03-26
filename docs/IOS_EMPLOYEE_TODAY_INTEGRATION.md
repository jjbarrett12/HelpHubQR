# iOS Employee Today — integration with backend bundle

`TodayViewModel` loads `EmployeeTodaySnapshot` via `TodayProviding`. Today the default is `MockTodayService`; production should use **`RemoteTodayService`** (or Supabase Swift `.rpc`) against the same contract as web.

## Canonical backend

| Path | Use |
|------|-----|
| **RPC** | `hh_employee_today_bundle(p_organization_id, p_time_zone)` — returns **snake_case** JSON keys. |
| **HTTP** | `GET /api/employee/today?organizationId=<uuid>&timeZone=America%2FDenver` — **camelCase** JSON, `Authorization: Bearer <access_token>`. |

Both enforce: org member + `employees.auth_user_id = auth.uid()`, and only that employee’s focus shift/run/items (see `docs/EMPLOYEE_TODAY_CONTRACT.md`).

## Timezone

Pass the **same IANA zone** the org uses for `employee_shifts.shift_date` (typically device `TimeZone.current.identifier`). **“Today”** in the RPC = `(now() AT TIME ZONE p_time_zone)::date` compared to `shift_date`.

## Mapping → `EmployeeTodaySnapshot`

| Bundle field | Swift model |
|--------------|-------------|
| `employee.firstName` | `EmployeeTodaySnapshot.employeeFirstName` |
| `focus.shift` | `Shift` — map `shiftType` → `shiftTypeLabel`, `locationName`, `roleName`, `isActiveNow` ← `focus.isActiveNow`, format `startsAt`/`endsAt` into `timeWindow` / `dateLabel` |
| `focus.run` + `checklist.runId` | `ChecklistRun.id` = **`checklist.runId`** (execution instance) |
| `checklist.templateName` | `ChecklistRun.templateName` |
| `checklist.itemsFlat[]` | `ChecklistRun.tasks` — map each row; **`itemKind`** `run_item` → mutate **`hh_shift_checklist_run_item_mutate`** / `POST .../shift-checklist-run-item/mutate` with **`id`**. **`override`** → **`hh_shift_run_override_task_mutate`** / `POST .../shift-run-override-task/mutate` with **`overrideTaskId` = `id`**. `RemoteTodayService` maps overrides to `sectionKey` `extra_tasks`. |
| `checklist.nextIncompleteTaskId` | First incomplete **template** run item only |
| `checklist.nextIncompleteOverrideTaskId` | First incomplete override (`status` = `active`) |
| `checklist.nextIncomplete` | Preferred single cursor: `{ kind, id }` — same precedence as server (run item before override) |
| `checklist.progress` | `completed`/`total`/`ratio` — should match recomputing from `tasks` if you only map items |
| `announcements.items` | `ShiftAnnouncement[]` — `pinned`, `title`, `body` |
| `shiftNotes` | Manager briefing lines for the focus shift (`items[]` with `title`, `body`, `createdAt`, optional `authorLabel`); **`source`** `shift_notes` when populated (v4+ RPC). Empty when no visible notes. |

### `ChecklistTask` from a run item

- `id` ← `itemsFlat[].id` (UUID)
- `sectionKey` ← slug from `sectionTitle` or `"default"`
- `sectionTitle`, `title`, `isCompleted`, `requiresPhoto`, `sortOrder`, `isBlocked`
- `hasProblem` ← `false` until API exposes problems
- `proofs` ← `hasProof == true` can show a single placeholder `TaskProof` or `[]` until signed URLs exist
- `notes` ← if `notes` string non-empty, one `TaskNote`; else `[]`
- `statusHistory` ← `[]` or minimal `.created` until events API exists
- `detail` ← `nil`

## `TodayViewModel` wiring

```swift
// After you have Supabase session + org id:
let service = RemoteTodayService(
    baseURL: URL(string: "https://<your-web-app>")!,
    organizationId: orgUUIDString,
    timeZone: TimeZone.current.identifier,
    accessTokenProvider: { await supabase.auth.session?.accessToken }
)
let viewModel = TodayViewModel(service: service)
```

Add **`RemoteTodayService.swift`** to the Xcode target (file lives under `HelpHubQR/Services/` in repo).

## Mutations (separate from this read model)

Completing a row: **`itemKind == run_item`** → **`hh_shift_checklist_run_item_mutate`** (or `POST .../shift-checklist-run-item/mutate`). **`itemKind == override`** → **`hh_shift_run_override_task_mutate`** (or `POST .../shift-run-override-task/mutate`). Same action names (`complete`, `set_note`, `flag_problem`, …) where supported. Then refresh the Today bundle.

## Bundle version

`source.bundleVersion` is **4** after migrations `20260428120000_shift_notes_and_employee_today_bundle_v4.sql` (+ optional `20260429140000_shift_notes_employee_shift_id_forward.sql`) — adds real **`shift_notes`** from **`public.shift_notes`**. **3** = v3 overrides only. **2** = v2 RPC only. Clients should log `bundleVersion` for debugging.
