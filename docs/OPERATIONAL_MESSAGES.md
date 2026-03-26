# Operational messages (not chat)

One-way, org-scoped **operational communication**: broadcasts, targeted notices, reminders, approval outcomes, checklist nudges. This is **not** a conversation system and **not** email.

## Recommended schema (implemented)

| Table | Role |
|--------|------|
| `operational_messages` | Title, body, `category`, `audience` (`all_employees` \| `specific_employees`), optional `starts_at` / `ends_at`, `pinned`, `related` jsonb for deep links. |
| `operational_message_recipients` | Required when `audience = specific_employees`: `(message_id, employee_id)`. |
| `operational_message_reads` | Read receipt per employee: `(message_id, employee_id, read_at)`. |

## SQL migration

- `supabase/migrations/20260331240000_operational_messages.sql` — tables, RLS, RPCs, and **`hh_employee_today_bundle`** updated to attach up to **5** visible messages (pinned + recent) under `announcements.items`.

## RLS summary

- **`operational_messages` SELECT:** org member and (manager sees all **or** linked employee sees rows in audience + active time window).
- **INSERT/UPDATE/DELETE messages:** managers only (`hh_user_can_manage_org`).
- **`operational_message_recipients`:** managers only.
- **`operational_message_reads`:** employees **cannot** insert directly; use RPC `hh_operational_message_mark_read` (SECURITY DEFINER). SELECT: own rows or manager.

## Server-side contract (RPCs)

| RPC | Who | Purpose |
|-----|-----|---------|
| `hh_operational_message_create(...)` | Manager | Create message; `p_employee_ids` required for `specific_employees`. |
| `hh_operational_messages_inbox(p_organization_id, p_limit)` | Authenticated org member | Manager: all messages (no read flags). Employee: visible messages + `read` / `read_at`. |
| `hh_operational_message_mark_read(p_organization_id, p_message_id)` | Linked employee | Upsert read receipt. |

**Web:** `createOperationalMessageAction` in `app/app/helphub/actions/operational-messages.ts`; helpers in `lib/helphub/operational-messages.ts`.

## Typed models (web)

- `EmployeeTodayAnnouncement` + bundle `announcements.source === 'operational_messages'` in `lib/helphub/employee-today/types.ts`.
- `CreateOperationalMessageParams`, `OperationalInboxItem`, `fetchOperationalMessagesInbox`, `markOperationalMessageRead`, `createOperationalMessage` in `lib/helphub/operational-messages.ts`.

## Example: iOS Today notes

Use the existing **Today bundle** RPC (single round-trip):

```swift
let res = try await supabase.rpc(
  "hh_employee_today_bundle",
  params: ["p_organization_id": orgId, "p_time_zone": TimeZone.current.identifier]
)
// Parse JSON: announcements.items (max 5), announcements.source == "operational_messages"
// Each item: id, title, body, category, pinned, read, read_at, effectiveFrom, effectiveTo, created_at
```

After the user opens a note, optionally call:

```swift
try await supabase.rpc(
  "hh_operational_message_mark_read",
  params: ["p_organization_id": orgId, "p_message_id": messageId]
)
```

## Example: iOS Messages inbox

Dedicated list (higher limit, same visibility rules):

```swift
let res = try await supabase.rpc(
  "hh_operational_messages_inbox",
  params: ["p_organization_id": orgId, "p_limit": 100]
)
// items[].read == false → unread badge
```

Alternative: PostgREST `from("operational_messages").select("*")` works for employees/managers under RLS, but you must join reads yourself; **prefer the inbox RPC** for consistent `read` / `read_at`.

## Should the Messages tab stay hidden until populated?

**Recommendation:** Keep the tab **visible** with an **empty state** (“No operational notices”) rather than hiding it. Hiding tabs causes churn when the first broadcast goes out and avoids training users where messages live. If product strongly wants minimal chrome, hide until `inbox.items.count > 0` **or** a remote flag — but default to **empty state** for predictability.

## Categories (product vocabulary)

- `manager_broadcast` — org-wide or targeted directive.
- `shift_note` — context for a shift.
- `reminder` — time-bound reminder.
- `approval_update` — outcome of a request (paired with `related` ids).
- `checklist_nudge` — execution hint.
- `system` — automated / pipeline (future).

## Related JSON (`related` column)

Opaque jsonb for clients, e.g. `{ "shift_checklist_run_item_id": "...", "request_type": "task_transfer" }`. No server validation in v1.
