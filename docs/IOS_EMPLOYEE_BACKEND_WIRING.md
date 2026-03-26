# iOS employee backend wiring (Today + checklist execution)

The employee **Today** tab uses one read model and two write paths, matching the web contracts.

## File tree (Swift)

```
HelpHubQR/HelpHubQR/HelpHubQRApp.swift
HelpHubQR/HelpHubQR/App/EmployeeRootView.swift
HelpHubQR/HelpHubQR/Services/AppSession.swift
HelpHubQR/HelpHubQR/Services/TodayProviding.swift
HelpHubQR/HelpHubQR/Services/RemoteTodayService.swift
HelpHubQR/HelpHubQR/Services/RemoteProofUploadService.swift
HelpHubQR/HelpHubQR/Services/ChecklistMutating.swift
HelpHubQR/HelpHubQR/Services/ChecklistMutationError.swift
HelpHubQR/HelpHubQR/Services/RemoteChecklistMutationService.swift
HelpHubQR/HelpHubQR/Services/MockTodayService.swift
HelpHubQR/HelpHubQR/Services/MockChecklistMutationService.swift
HelpHubQR/HelpHubQR/Models/ChecklistTaskExecutionKind.swift
HelpHubQR/HelpHubQR/Models/ChecklistRun.swift
HelpHubQR/HelpHubQR/Models/ChecklistTask.swift
HelpHubQR/HelpHubQR/Models/EmployeeTodaySnapshot.swift
HelpHubQR/HelpHubQR/Models/TaskStatusEvent.swift
HelpHubQR/HelpHubQR/ViewModels/TodayTabViewModels.swift
HelpHubQR/HelpHubQR/ViewModels/TodayViewModel.swift
HelpHubQR/HelpHubQR/ViewModels/ChecklistViewModel.swift
HelpHubQR/HelpHubQR/ViewModels/TaskDetailViewModel.swift
HelpHubQR/HelpHubQR/Views/TodayView.swift
HelpHubQR/HelpHubQR/Views/ChecklistView.swift
HelpHubQR/HelpHubQR/Views/TaskDetailView.swift
HelpHubQR/HelpHubQR/Components/ChecklistTaskRowView.swift
HelpHubQR/HelpHubQR/Components/TaskCardView.swift
```

**Web (proof sign):** `apps/web/app/api/helphub/checklist-proof-upload/sign/route.ts`  
Add any **new** Swift files to the Xcode target (Build Phases → Compile Sources).

## Service layer

| Component | Role |
|-----------|------|
| **`AppSession`** | `webAppBaseURL`, `organizationId`, `accessToken`. If token is empty → **mock** Today + mutations. |
| **`RemoteTodayService`** | `GET {base}/api/employee/today?organizationId=&timeZone=` with `Authorization: Bearer`. Maps **sections** (with `sectionKey` / `sectionTitle`) when present; **`checklist.progress`**, **`nextIncomplete`**, **`shift_notes`**, **`focus.run.status`**. |
| **`RemoteChecklistMutationService`** | `POST` to `.../shift-checklist-run-item/mutate` or `.../shift-run-override-task/mutate` from **`ChecklistTask.executionKind`**. Actions: complete, reopen, set_note, set_proof, flag_problem, clear_problem, request_help, clear_help. |
| **`RemoteProofUploadService`** | `POST {base}/api/helphub/checklist-proof-upload/sign` → PUT image bytes → returns **`path`** for **`set_proof`**. |
| **`TodayTabViewModels`** | Builds remote vs mock; wires proof uploader when remote. |

## Environment (simulator / device)

- **`HELPHUB_ACCESS_TOKEN`** — non-empty → remote mode (Supabase access JWT).
- **`HELPHUB_WEB_BASE_URL`** — e.g. `http://localhost:3000` (no trailing slash).
- **`HELPHUB_ORG_ID`** — UUID for `organizationId` query param and proof-sign body.

**Server:** `UPLOAD_BUCKET` (default `proof`), service role key for sign + storage (same as staff upload route).

## Mock-only surfaces

- **Requests**, **Messages**, **Scan QR**, **Report issue** flows still use mocks or placeholders.
- **`MockTodayService` / `MockChecklistMutationService`** when no access token (previews, local demo). They apply **local optimistic** task patches then call no-op mutators.

## Shift notes vs announcements

- **Announcements** — bundle `announcements` (operational messages).
- **Shift briefing** — bundle `shiftNotes.items` from **`public.shift_notes`** (`employee_shift_id`, v4+ RPC, `source: shift_notes`). Managers add notes from **`/app/shift-ops`** (server action + Zod). **`POST` route** not required.

## Manual test checklist

1. **Remote Today** — Set token + base URL + org; open Today → loads without crash; pull to refresh.
2. **No shift** — Employee with no `focus.shift` → “No shift scheduled” card; checklist copy uses `noRunReason` when applicable.
3. **Next shift** — `focus.kind == upcoming_shift` → footnote; shift card shows “Next shift” when not active.
4. **Progress / next task** — Progress matches API `checklist.progress`; “Do this next” follows `nextIncomplete` when that id exists in the task list.
5. **Sections** — Checklist groups match API `sections` (`sectionKey` / `sectionTitle`).
6. **Complete / reopen** — Toggle and task detail actions; after success, bundle refreshes.
7. **Photo** — Pick image → sign → PUT → `set_proof` → refreshed `hasProof` / completion rules.
8. **Override row** — Extra task with `itemKind` override → mutations hit override mutate route (verify in proxy logs).
9. **Run closed** — When `focus.run.status` is `completed` or `expired` → toggles disabled; task detail shows locked copy.
10. **Errors** — Revoke token → 401 / sign-in copy; wrong org → 403 copy; mutate `RUN_CLOSED` / `NOT_ASSIGNED` / `REQUIRES_PHOTO` → user-visible messages.

## Known gaps

1. **`hasProblem` / help state** on tasks are not fully driven by the Today JSON; ribbons and “Clear problem” visibility may lag server truth until the bundle exposes escalation fields.
2. **Non-2xx mutate bodies** — iOS often maps failures to generic “network” unless status is 401; optional improvement: parse JSON `error` on 4xx.
3. **PhotosPicker → `Data`** — Some image types may fail `loadTransferable(Data.self)`; user message prompts another pick.
4. **`expected_updated_at`** — Optimistic concurrency not sent from the app yet.

## Backend assumptions

- Today success JSON matches **`EmployeeTodayBundle`** (`docs/EMPLOYEE_TODAY_CONTRACT.md`).
- Mutate endpoints return `{ ok: boolean, error?, message? }` for logical failures.
- Proof sign validates the same assignment rules as mutates; storage bucket allows employee PUT to signed URL.
