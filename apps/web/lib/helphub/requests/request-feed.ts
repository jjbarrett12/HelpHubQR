import { z } from "zod";

/** Product-facing request kinds (normalized read layer). */
export const REQUEST_FEED_KINDS = [
  "coverage",
  "swap",
  "open_shift_claim",
  "task_transfer",
  "schedule_change",
] as const;

export type RequestFeedKind = (typeof REQUEST_FEED_KINDS)[number];

export const REQUEST_FEED_STATUSES = [
  "pending_manager",
  "pending_employee",
  "approved",
  "executed",
  "denied",
  "cancelled",
  "expired",
] as const;

export type RequestFeedStatus = (typeof REQUEST_FEED_STATUSES)[number];

export const REQUEST_FEED_URGENCY = ["low", "normal", "high"] as const;

export type RequestFeedUrgency = (typeof REQUEST_FEED_URGENCY)[number];

export const requestFeedPartySchema = z.object({
  employee_id: z.string().uuid(),
  name: z.string().nullable(),
});

export type RequestFeedParty = z.infer<typeof requestFeedPartySchema>;

export const requestFeedShiftSchema = z.object({
  employee_shift_id: z.string().uuid(),
  role: z.string().nullable(),
  location_name: z.string().nullable(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
});

export type RequestFeedShift = z.infer<typeof requestFeedShiftSchema>;

export const requestFeedTaskSchema = z.object({
  run_item_id: z.string().uuid(),
  title: z.string(),
  request_mode: z.string().optional(),
});

export type RequestFeedTask = z.infer<typeof requestFeedTaskSchema>;

/** One row from `hh_employee_requests_feed` / `hh_manager_requests_feed` / `hh_request_feed`. */
export const requestFeedItemSchema = z.object({
  id: z.string().min(1),
  organization_id: z.string().uuid(),
  kind: z.enum(REQUEST_FEED_KINDS),
  status: z.enum(REQUEST_FEED_STATUSES),
  urgency: z.enum(REQUEST_FEED_URGENCY),
  created_at: z.string(),
  updated_at: z.string(),
  shift_date: z.string().nullable(),
  requester: requestFeedPartySchema,
  target_employee: requestFeedPartySchema.nullable(),
  shift: requestFeedShiftSchema.nullable(),
  task: requestFeedTaskSchema.nullable(),
  reason: z.string().nullable(),
  manager_action_required: z.boolean(),
  employee_action_required: z.boolean(),
  source_table: z.string().min(1),
  source_id: z.string().uuid(),
  /** `shift_task_transfer_requests.request_mode` or `shift_coverage_requests.request_type`; null for swaps. */
  source_request_type: z.string().nullable(),
  /** What the system applies on manager approval (read-model contract; handlers use source_table/source_id). */
  action_payload: z.record(z.unknown()).default({}),
});

export type RequestFeedItem = z.infer<typeof requestFeedItemSchema>;

/** Example `action_payload` shapes per feed `kind` (documentation / tests). */
export const REQUEST_FEED_ACTION_PAYLOAD_EXAMPLES = {
  task_transfer: {
    version: 1,
    kind: "task_transfer",
    op: "update_shift_checklist_run_items_assigned_employee",
    shift_checklist_run_item_id: "00000000-0000-0000-0000-000000000001",
    run_id: "00000000-0000-0000-0000-000000000002",
    from_employee_id: "00000000-0000-0000-0000-000000000003",
    to_employee_id: "00000000-0000-0000-0000-000000000004",
    manager_approval_required: true,
  },
  coverage: {
    version: 1,
    kind: "coverage",
    op: "reassign_employee_shift",
    employee_shift_id: "00000000-0000-0000-0000-000000000010",
    from_employee_id: "00000000-0000-0000-0000-000000000011",
    to_employee_id: "00000000-0000-0000-0000-000000000012",
    request_type: "direct_cover",
    manager_approval_required: true,
  },
  open_shift_claim: {
    version: 1,
    kind: "open_shift_claim",
    op: "reassign_employee_shift",
    employee_shift_id: "00000000-0000-0000-0000-000000000020",
    from_employee_id: "00000000-0000-0000-0000-000000000021",
    to_employee_id: "00000000-0000-0000-0000-000000000022",
    request_type: "open_claim",
    manager_approval_required: true,
  },
  swap: {
    version: 1,
    kind: "swap",
    op: "swap_employee_shifts",
    trade_id: "00000000-0000-0000-0000-000000000030",
    offered_shift_id: "00000000-0000-0000-0000-000000000031",
    requested_shift_id: "00000000-0000-0000-0000-000000000032",
    offering_employee_id: "00000000-0000-0000-0000-000000000033",
    counterparty_employee_id: "00000000-0000-0000-0000-000000000034",
    manager_approval_required: true,
  },
} as const;

export function parseRequestFeedJson(data: unknown): RequestFeedItem[] {
  if (data == null) return [];
  const raw = typeof data === "string" ? (JSON.parse(data) as unknown) : data;
  if (!Array.isArray(raw)) return [];
  const out: RequestFeedItem[] = [];
  for (const row of raw) {
    const p = requestFeedItemSchema.safeParse(row);
    if (p.success) out.push(p.data);
  }
  return out;
}

/** `source_table` + `source_id` for mutations (existing server actions). */
export function requestFeedMutationRef(item: RequestFeedItem): { table: string; id: string } {
  return { table: item.source_table, id: item.source_id };
}
