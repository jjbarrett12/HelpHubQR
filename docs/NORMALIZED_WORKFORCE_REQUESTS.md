# Normalized workforce requests feed

Single product-facing read contract over **multiple operational tables**, with **visible provenance** (`raw_table`, `source_id`, `raw_status`, `source_detail`). This is a **normalized view + TypeScript mappers**, not a replacement for raw rows or audit history.

---

## 1. File tree

```
supabase/migrations/
  20260331230000_workforce_requests_normalized_view.sql
    → creates public.hh_workforce_requests_normalized (security_invoker)
  20260429170000_hh_workforce_requests_normalized_fix_and_rpc.sql
    → fixes UNION column mismatch, refines coverage kinds, adds RPC

apps/web/lib/helphub/requests/
  normalized-workforce-request.ts          # Zod schema, feed id parser, kind/status/urgency types
  fetch-normalized-workforce-requests.ts # .from('hh_workforce_requests_normalized')
  fetch-pending-manager-approvals.ts      # .rpc('hh_workforce_requests_pending_manager_json')
  filter-normalized-for-employee.ts       # manager+employee: scope “My requests” to one employee
  map-normalized-to-employee-requests.ts  # → EmployeeMyRequestsClient buckets (raw_status for mutations)
  map-normalized-to-manager-detail.ts     # → ManagerRequestDetail (/app/requests)
  map-normalized-to-approval-inbox.ts     # → ApprovalInboxItem (Today card)
  load-manager-requests-inbox.ts          # server: manager inbox page

apps/web/app/app/(helphub)/my-requests/page.tsx     # employee Requests (web)
apps/web/app/app/requests/page.tsx                  # manager Requests & approvals
apps/web/app/app/today/page.tsx                     # merges live approvals into Command Center

apps/web/components/helphub/workforce/EmployeeMyRequestsClient.tsx
apps/web/components/manager-requests/RequestsManagerClient.tsx
apps/web/components/today-command-center/ApprovalsInboxCard.tsx

HelpHubQR/HelpHubQR/…                               # iOS: still legacy providers; wire same view/RPC later
```

---

## 2. SQL layer

| Object | Role |
|--------|------|
| **`hh_workforce_requests_normalized`** | `UNION ALL` of `shift_task_transfer_requests`, `shift_coverage_requests`, `shift_trade_offers`. `security_invoker = true` so **each branch uses its table RLS**. |
| **`hh_workforce_requests_pending_manager_json(org, limit)`** | Returns **jsonb array** of normalized rows with `manager_action_required = true`, ordered by `updated_at` desc. **SECURITY INVOKER** — same RLS as the view. |

**Composite feed id:** `{raw_table}/{source_uuid}` (e.g. `shift_task_transfer_requests/8b1c…`). Mutations should continue to use **`source_id`** (UUID) + known table, not the composite string alone.

**Extension points (no tables yet):**

- Add a new CTE branch to the view + grant SELECT (same column list).
- Or expose a second view and union in application code until the SQL union is updated.
- Reserved TS kinds: `schedule_change`, `availability_change`, `task_preference`.

---

## 3. Normalized TypeScript types

Defined in `apps/web/lib/helphub/requests/normalized-workforce-request.ts`:

- **`NormalizedWorkforceRequestRow`** — Zod-validated row from PostgREST / RPC JSON.
- **`NormalizedWorkforceRequestKind`** — `task_transfer`, `coverage`, `coverage_direct_trade`, `open_shift_pickup`, `shift_swap`, plus reserved forward kinds.
- **`NormalizedProductStatus`** — `pending_manager`, `pending_peer`, `approved`, `denied`, `cancelled`, `expired`.
- **`NormalizedRequestUrgency`** — `normal`, `soon`, `urgent` (from `expires_at` heuristics where present).

Provenance fields:

- `raw_table`, `source_id`, `raw_status`
- `source_detail` (jsonb — table-specific keys like `request_type`, `from_employee_id`, …)
- `related` (jsonb — FK hints for UI deep links)

---

## 4. Status mapping rules (product_status)

| Source | raw_status → product_status (summary) |
|--------|--------------------------------------|
| **Task transfer** | `approved`/`denied`/`cancelled`/`expired` map 1:1; `declined` → `denied`; `accepted` → `pending_manager` if `manager_approval_required` else `approved`; `pending` → `pending_peer` or `pending_manager` from mode + flags. |
| **Coverage** | Same terminal states; `claimed` → `pending_manager` if manager approval else `approved`; `pending` → `pending_peer`. |
| **Shift trade (`shift_trade_offers`)** | `accepted` → `pending_manager` or `approved`; `pending` → `pending_peer`. |

**`manager_action_required`:** `true` iff `product_status = 'pending_manager'` (derived consistently in SQL).

**`kind` (coverage row):**

- `open_claim` → `open_shift_pickup`
- `direct_trade` → `coverage_direct_trade` (still `shift_coverage_requests`; distinct from `shift_swap` on `shift_trade_offers`)
- `direct_cover` → `coverage`

---

## 5. Example payloads

### Employee-facing (one normalized row, task transfer)

```json
{
  "id": "shift_task_transfer_requests/8b1c2d3e-…",
  "source_id": "8b1c2d3e-…",
  "raw_table": "shift_task_transfer_requests",
  "kind": "task_transfer",
  "raw_status": "pending",
  "product_status": "pending_peer",
  "urgency": "soon",
  "organization_id": "…",
  "requester_employee_id": "…",
  "counterparty_employee_id": "…",
  "requester_display_name": "Jordan Lee",
  "counterparty_display_name": "Sam Rivera",
  "from_employee_display_name": "Jordan Lee",
  "manager_approval_required": true,
  "manager_action_required": false,
  "context_summary": "Restock cart — lobby",
  "submitted_at": "2026-03-24T14:12:00.000Z",
  "updated_at": "2026-03-24T14:12:00.000Z",
  "expires_at": "2026-03-24T22:00:00.000Z",
  "related": { "shift_checklist_run_id": "…", "shift_checklist_run_item_id": "…" },
  "source_detail": { "request_mode": "direct", "from_employee_id": "…", "to_employee_id": "…", "reason": "Leaving early" },
  "fairness_advisory": null
}
```

### Manager-facing (pending approval slice, coverage claim)

```json
{
  "id": "shift_coverage_requests/a1b2c3d4-…",
  "raw_table": "shift_coverage_requests",
  "kind": "open_shift_pickup",
  "raw_status": "claimed",
  "product_status": "pending_manager",
  "manager_action_required": true,
  "urgency": "normal",
  "context_summary": "2026-03-25 · open · open_claim",
  "source_detail": { "request_type": "open_claim", "reason": null, "claimed_by_employee_id": "…", "target_employee_id": null }
}
```

---

## 6. Wiring notes

### `/app/requests` (manager)

- Server: `loadManagerRequestsInbox` → `fetchNormalizedWorkforceRequests` → `mapNormalizedRowToManagerDetail`.
- RLS: managers see org-wide rows permitted by policies on underlying tables.

### `/app/my-requests` (employee web)

- Server: `fetchNormalizedWorkforceRequests` then **`filterNormalizedRowsForEmployee`** (managers who are also employees would otherwise see the whole org).
- `splitNormalizedRowsForEmployeeMyRequests` maps into the existing three lists; **mutations still use raw table + `source_id`** via existing server actions.

### Manager Today — Approvals card

- Server: `fetchPendingManagerApprovalsForToday` → RPC `hh_workforce_requests_pending_manager_json` → `mapNormalizedRowToApprovalInboxItem`.
- `today/page.tsx` replaces `data.approvals` when the RPC returns any rows; shows `approvalsFeedError` if the RPC is missing (migration not applied).

### iOS Requests tab

- **Target contract:** same rows as `NormalizedWorkforceRequestRow` (REST: `hh_workforce_requests_normalized` with user JWT, or RPC + parse JSON).
- **Today:** `EmployeeMyRequestsClient`-style UI can consume either the composite feed or three buckets from a small mapping layer mirroring `map-normalized-to-employee-requests.ts`.
- Keep displaying **`raw_table` / `raw_status` in debug or support surfaces** if useful.

---

## 7. RLS / tenancy

- View uses **`security_invoker`**: no bypass; effective access is the **intersection** of policies on each contributing table.
- **Organization** is always `organization_id` on the row; queries should still `.eq('organization_id', activeOrgId)` when using a service/session that could span orgs.
- **RPC** is `SECURITY INVOKER`: runs as the logged-in user, not definer.

---

## 8. Source-table inconsistencies / follow-ups

1. **Two “trade” paths:** `shift_coverage_requests.request_type = 'direct_trade'` vs `shift_trade_offers`. The feed exposes **`coverage_direct_trade`** vs **`shift_swap`** to keep provenance obvious.
2. **`shift_trade_offers` has no `expires_at`:** normalized `urgency` is always `normal` for that branch unless you add a column or derive from shift start.
3. **Task transfer `pending` + `manager_approval_required`:** product mapper can show `pending_manager` even when peer action is still needed — worth revisiting product copy vs SQL if confusing in the field.
4. **Naming:** DB uses `shift_trade_offers`; product language uses “swap/trade” interchangeably — keep types explicit (`shift_swap` kind).
5. **Schedule / availability:** no tables wired yet; `RequestKind` and TS kinds reserve labels for a future union branch.

---

## Consistency principle

Optimize for **one enum each** of product status, urgency, and manager-action flag across sources, while **never dropping** `raw_table` / `raw_status` / `source_detail` so support and engineers can trace any row in seconds.
