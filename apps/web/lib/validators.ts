import { z } from "zod";
import { TICKET_REQUEST_TYPE_CODES } from "@/lib/tickets/request-types-catalog";

export const createTicketBodySchema = z.object({
  token: z.string().min(1, "Token is required"),
  request_type_code: z.enum(TICKET_REQUEST_TYPE_CODES).optional().nullable(),
  note: z.string().min(5, "Note must be at least 5 characters"),
  priority: z.enum(["low", "normal", "high"]).optional().default("normal"),
});

export type CreateTicketBody = z.infer<typeof createTicketBodySchema>;

/** @deprecated Use TICKET_REQUEST_TYPE_OPTIONS from @/lib/tickets/request-types-catalog */
export const requestTypes = ["Towels", "Trash removal", "Toiletries", "Cleaning", "Other"] as const;
