/** Must match public.ticket_event_types (DB is source of truth for FK). */

export const TICKET_EVENT_TYPE_CODES = [
  "created",
  "assigned",
  "unassigned",
  "status_changed",
  "priority_changed",
  "attachment_added",
  "comment_added",
  "resolved",
  "reopened",
  "cancelled",
] as const;

export type TicketEventTypeCode = (typeof TICKET_EVENT_TYPE_CODES)[number];

/** Stable references for `ticket_events` inserts (keeps writers aligned with the canonical list). */
export const TICKET_EVENT = Object.fromEntries(
  TICKET_EVENT_TYPE_CODES.map((code) => [code, code] as const)
) as Record<TicketEventTypeCode, TicketEventTypeCode>;

const SET = new Set<string>(TICKET_EVENT_TYPE_CODES);

export function isTicketEventTypeCode(value: string): value is TicketEventTypeCode {
  return SET.has(value);
}

/** Human-readable labels (keep aligned with migration seed). */
export const TICKET_EVENT_TYPE_LABELS: Record<TicketEventTypeCode, string> = {
  created: "Created",
  assigned: "Assigned",
  unassigned: "Unassigned",
  status_changed: "Status changed",
  priority_changed: "Priority changed",
  attachment_added: "Attachment added",
  comment_added: "Comment added",
  resolved: "Resolved",
  reopened: "Reopened",
  cancelled: "Cancelled",
};

export function ticketEventTypeLabel(code: string): string {
  return isTicketEventTypeCode(code) ? TICKET_EVENT_TYPE_LABELS[code] : code;
}

/** Map a status transition to the primary audit event (single event per change). */
export function ticketStatusTransitionEventType(
  previousStatus: string,
  nextStatus: string
): TicketEventTypeCode {
  if (nextStatus === "resolved") return "resolved";
  if (nextStatus === "cancelled") return "cancelled";
  if (
    (previousStatus === "resolved" || previousStatus === "cancelled") &&
    (nextStatus === "new" || nextStatus === "in_progress")
  ) {
    return "reopened";
  }
  return "status_changed";
}
