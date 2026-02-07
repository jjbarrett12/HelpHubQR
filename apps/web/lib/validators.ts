import { z } from "zod";

export const createTicketBodySchema = z.object({
  token: z.string().min(1, "Token is required"),
  request_type: z.string().optional().nullable(),
  note: z.string().min(5, "Note must be at least 5 characters"),
  priority: z.enum(["low", "normal", "high"]).optional().default("normal"),
});

export type CreateTicketBody = z.infer<typeof createTicketBodySchema>;

export const requestTypes = [
  "Towels",
  "Trash removal",
  "Toiletries",
  "Cleaning",
  "Other",
] as const;
