/**
 * Maps Postgres trigger exceptions (HH_TICKET_* / HH_ROOMS_*) from Supabase/PostgREST
 * to short user-facing strings. Raw messages must never be logged to clients verbatim if they contain secrets.
 */

const MAP: Record<string, string> = {
  HH_TICKET_SCOPE_NULL: "This ticket is missing site or room information. Refresh the page and try again.",
  HH_TICKET_SITE_NOT_FOUND: "That site could not be found. Check that you are working in the correct account.",
  HH_TICKET_SITE_TENANT_MISMATCH: "The site does not belong to this account. Refresh and try again.",
  HH_TICKET_ROOM_NOT_FOUND: "That room could not be found. It may have been removed.",
  HH_TICKET_ROOM_SITE_MISMATCH: "That room does not belong to the selected site.",
  HH_TICKET_ROOM_TENANT_MISMATCH: "That room does not belong to this account.",
  HH_TICKET_ASSIGNEE_INVALID:
    "Only active team members in this account can be assigned. Ask an admin to invite you or restore your access.",
  HH_ROOMS_SITE_NOT_FOUND: "That site does not exist. Choose a valid site for this room.",
};

export function isKnownTicketIntegrityMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  return /HH_(TICKET|ROOMS)_/.test(message);
}

export function formatTicketDbError(message: string | null | undefined): string {
  if (!message) return "Something went wrong. Please try again.";
  for (const [code, friendly] of Object.entries(MAP)) {
    if (message.includes(code)) return friendly;
  }
  return "Could not save changes. Please refresh and try again.";
}

/** Insert/update path: duplicate idempotency key or other constraint violations. */
export function formatTicketInsertError(
  message: string | null | undefined,
  options?: { code?: string | null }
): string {
  const code = options?.code;
  if (
    code === "23505" &&
    message &&
    (message.includes("tickets_tenant_client_request") || message.includes("tickets_tenant_client_request_uidx"))
  ) {
    return "This request was already submitted.";
  }
  return formatTicketDbError(message);
}
