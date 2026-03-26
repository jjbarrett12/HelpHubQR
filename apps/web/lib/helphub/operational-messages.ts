import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const OPERATIONAL_MESSAGE_CATEGORIES = [
  "manager_broadcast",
  "shift_note",
  "reminder",
  "approval_update",
  "checklist_nudge",
  "system",
] as const;

export type OperationalMessageCategory = (typeof OPERATIONAL_MESSAGE_CATEGORIES)[number];

export const OPERATIONAL_MESSAGE_AUDIENCES = ["all_employees", "specific_employees"] as const;
export type OperationalMessageAudience = (typeof OPERATIONAL_MESSAGE_AUDIENCES)[number];

export type CreateOperationalMessageParams = {
  title: string;
  body: string;
  category: OperationalMessageCategory;
  audience: OperationalMessageAudience;
  /** Required when audience is specific_employees */
  employeeIds?: string[];
  pinned?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  related?: Record<string, unknown>;
};

const inboxItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  category: z.string(),
  audience: z.string(),
  pinned: z.boolean(),
  created_at: z.string(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
  read: z.boolean(),
  read_at: z.string().nullable(),
  related: z.any().optional(),
});

export type OperationalInboxItem = z.infer<typeof inboxItemSchema>;

export type OperationalInboxResult =
  | { ok: true; items: OperationalInboxItem[] }
  | { ok: false; error: string };

export async function fetchOperationalMessagesInbox(
  supabase: SupabaseClient,
  organizationId: string,
  limit = 50
): Promise<OperationalInboxResult> {
  const { data, error } = await supabase.rpc("hh_operational_messages_inbox", {
    p_organization_id: organizationId,
    p_limit: limit,
  });
  if (error) return { ok: false, error: error.message };
  const p = data as { ok?: boolean; error?: string; items?: unknown };
  if (!p?.ok) return { ok: false, error: String(p?.error ?? "INBOX_ERROR") };
  const items: OperationalInboxItem[] = [];
  if (Array.isArray(p.items)) {
    for (const row of p.items) {
      const r = inboxItemSchema.safeParse(row);
      if (r.success) items.push(r.data);
    }
  }
  return { ok: true, items };
}

export type MarkReadResult = { ok: true } | { ok: false; error: string };

export async function markOperationalMessageRead(
  supabase: SupabaseClient,
  organizationId: string,
  messageId: string
): Promise<MarkReadResult> {
  const { data, error } = await supabase.rpc("hh_operational_message_mark_read", {
    p_organization_id: organizationId,
    p_message_id: messageId,
  });
  if (error) return { ok: false, error: error.message };
  const p = data as { ok?: boolean; error?: string };
  if (!p?.ok) return { ok: false, error: String(p?.error ?? "MARK_READ_ERROR") };
  return { ok: true };
}

export type CreateOperationalMessageResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function createOperationalMessage(
  supabase: SupabaseClient,
  organizationId: string,
  params: CreateOperationalMessageParams
): Promise<CreateOperationalMessageResult> {
  const { data, error } = await supabase.rpc("hh_operational_message_create", {
    p_organization_id: organizationId,
    p_title: params.title,
    p_body: params.body,
    p_category: params.category,
    p_audience: params.audience,
    p_employee_ids: params.audience === "specific_employees" ? params.employeeIds ?? [] : [],
    p_pinned: params.pinned ?? false,
    p_starts_at: params.startsAt ?? null,
    p_ends_at: params.endsAt ?? null,
    p_related: params.related ?? {},
  });
  if (error) return { ok: false, error: error.message };
  const p = data as { ok?: boolean; error?: string; id?: string };
  if (!p?.ok || !p.id) return { ok: false, error: String(p?.error ?? "CREATE_ERROR") };
  return { ok: true, id: p.id };
}
