/** Global MVP catalog codes — matches seeded public.ticket_request_types (tenant_id IS NULL). */

export const TICKET_REQUEST_TYPE_CODES = [
  "towels",
  "trash_removal",
  "toiletries",
  "cleaning",
  "other",
] as const;

export type TicketRequestTypeCode = (typeof TICKET_REQUEST_TYPE_CODES)[number];

export const TICKET_REQUEST_TYPE_OPTIONS: { code: TicketRequestTypeCode; label: string }[] = [
  { code: "towels", label: "Towels" },
  { code: "trash_removal", label: "Trash removal" },
  { code: "toiletries", label: "Toiletries" },
  { code: "cleaning", label: "Cleaning" },
  { code: "other", label: "Other" },
];

const CODE_SET = new Set<string>(TICKET_REQUEST_TYPE_CODES);

export function isTicketRequestTypeCode(value: string): value is TicketRequestTypeCode {
  return CODE_SET.has(value);
}
