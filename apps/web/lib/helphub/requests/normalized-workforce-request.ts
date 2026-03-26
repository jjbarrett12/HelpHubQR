import { z } from "zod";

/**
 * Composite feed id: `{raw_table}/{source_uuid}` (see view `hh_workforce_requests_normalized`).
 */
export type NormalizedWorkforceRequestId = string;

export const WORKFORCE_REQUEST_RAW_TABLES = [
  "shift_task_transfer_requests",
  "shift_coverage_requests",
  "shift_trade_offers",
] as const;

export type WorkforceRequestRawTable = (typeof WORKFORCE_REQUEST_RAW_TABLES)[number];

/** Product kinds surfaced in UI (aligned with manager mock `RequestKind` where possible). */
export type NormalizedWorkforceRequestKind =
  | "task_transfer"
  | "coverage"
  /** `shift_coverage_requests.request_type = direct_trade` (distinct from `shift_trade_offers` swap flow). */
  | "coverage_direct_trade"
  | "open_shift_pickup"
  | "shift_swap"
  /** Tables not yet unified — reserved for forward compatibility */
  | "schedule_change"
  | "availability_change"
  | "task_preference";

export type NormalizedProductStatus =
  | "pending_manager"
  | "pending_peer"
  | "approved"
  | "denied"
  | "cancelled"
  | "expired";

export type NormalizedRequestUrgency = "normal" | "soon" | "urgent";

export const normalizedWorkforceRequestRowSchema = z.object({
  id: z.string().min(1),
  source_id: z.string().uuid(),
  raw_table: z.enum(WORKFORCE_REQUEST_RAW_TABLES),
  kind: z.string(),
  raw_status: z.string(),
  product_status: z.string(),
  urgency: z.string(),
  organization_id: z.string().uuid(),
  requester_employee_id: z.string().uuid().nullable(),
  counterparty_employee_id: z.string().uuid().nullable(),
  requester_display_name: z.string().nullable(),
  counterparty_display_name: z.string().nullable(),
  /** Task transfer only: current assignee (`from_employee_id`); null for other sources. */
  from_employee_display_name: z.string().nullish(),
  manager_approval_required: z.boolean(),
  manager_action_required: z.boolean(),
  context_summary: z.string().nullable(),
  submitted_at: z.string(),
  updated_at: z.string(),
  expires_at: z.string().nullable(),
  related: z.any(),
  source_detail: z.any(),
  fairness_advisory: z.any().nullable(),
});

export type NormalizedWorkforceRequestRow = z.infer<typeof normalizedWorkforceRequestRowSchema>;

export function parseNormalizedWorkforceRequestRows(data: unknown): NormalizedWorkforceRequestRow[] {
  if (!Array.isArray(data)) return [];
  const out: NormalizedWorkforceRequestRow[] = [];
  for (const row of data) {
    const p = normalizedWorkforceRequestRowSchema.safeParse(row);
    if (p.success) out.push(p.data);
  }
  return out;
}

/** Split `shift_task_transfer_requests/{uuid}` → table + uuid. */
export function parseWorkforceRequestFeedId(feedId: string): {
  rawTable: WorkforceRequestRawTable;
  sourceId: string;
} | null {
  const idx = feedId.indexOf("/");
  if (idx <= 0 || idx === feedId.length - 1) return null;
  const rawTable = feedId.slice(0, idx);
  const sourceId = feedId.slice(idx + 1);
  if (!WORKFORCE_REQUEST_RAW_TABLES.includes(rawTable as WorkforceRequestRawTable)) return null;
  if (!/^[0-9a-f-]{36}$/i.test(sourceId)) return null;
  return { rawTable: rawTable as WorkforceRequestRawTable, sourceId };
}
