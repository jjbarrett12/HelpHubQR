# iOS Today bundle: source of truth and refetch

The employee **Today** screen must treat `hh_employee_today_bundle` (via `RemoteTodayService` / `TodayViewModel.load()`) as the only authoritative state.

## When the app refetches the bundle

1. **After every successful checklist / override mutation** — `ChecklistViewModel.performMutation` calls `today.load()` when not using local mock mutations (`RemoteChecklistMutationService`).
2. **When the app returns to the foreground** — `TodayTabContainer` observes `scenePhase` and runs `load()` on `.active` so data is fresh after backgrounding.
3. **After Realtime `postgres_changes` signals** — `EmployeeOperationalRealtimeCoordinator` ignores row payloads and only schedules a debounced `onRefresh` → `TodayViewModel.load()`.

Realtime subscription setup retries `subscribeWithError()` up to three times with backoff before giving up.

## What not to do

- Do not merge Realtime payloads into the checklist model as authoritative updates; they may be partial or reordered.
- Do not skip `load()` after a successful mutation assuming the client already reflects the server.
