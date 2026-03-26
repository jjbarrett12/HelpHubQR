"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { formatTicketInsertError } from "@/lib/tickets/db-error";
import { resolveTicketRequestType } from "@/lib/tickets/resolve-request-type";
import { TICKET_EVENT } from "@/lib/tickets/event-types";
import { isArchivedRecord } from "@/lib/tenant/archive";

export type CreateTicketResult =
  | { ok: true; ticketId: string }
  | { ok: false; error: string };

export async function createTicketForRoom(
  siteId: string,
  roomId: string,
  note: string,
  requestTypeCode: string | null,
  priority: "low" | "normal" | "high",
  clientRequestId?: string | null
): Promise<CreateTicketResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const trimmed = note.trim();
  if (trimmed.length < 5) return { ok: false, error: "Note must be at least 5 characters" };

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, room_label, site_id, floor, archived_at, site:sites(tenant_id, name, archived_at)")
    .eq("id", roomId)
    .eq("site_id", siteId)
    .single();

  if (roomError || !room) return { ok: false, error: "Room not found or access denied" };
  if (isArchivedRecord(room)) {
    return { ok: false, error: "This location is archived and cannot receive new tickets." };
  }

  const siteRow = room.site as
    | { tenant_id: string; name: string; archived_at?: string | null }[]
    | { tenant_id: string; name: string; archived_at?: string | null }
    | null;
  const site = Array.isArray(siteRow) ? siteRow[0] ?? null : siteRow;
  if (!site) return { ok: false, error: "Site not found" };
  if (isArchivedRecord(site)) {
    return { ok: false, error: "This customer is archived and cannot receive new tickets." };
  }

  const tenantId = site.tenant_id;
  const resolvedRt = await resolveTicketRequestType(supabase, tenantId, requestTypeCode);

  const cr = clientRequestId?.trim() || null;
  if (cr) {
    const { data: existing } = await supabase
      .from("tickets")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("client_request_id", cr)
      .maybeSingle();
    if (existing?.id) return { ok: true, ticketId: existing.id };
  }

  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .insert({
      tenant_id: tenantId,
      site_id: siteId,
      room_id: roomId,
      room_label_snapshot: room.room_label,
      request_type_id: resolvedRt?.id ?? null,
      request_type_label_snapshot: resolvedRt?.label ?? null,
      site_name_snapshot: site.name,
      floor_snapshot: room.floor ?? null,
      note: trimmed,
      status: "new",
      priority: priority ?? "normal",
      created_via: "staff",
      client_request_id: cr,
    })
    .select("id")
    .single();

  if (ticketError?.code === "23505" && cr) {
    const { data: raced } = await supabase
      .from("tickets")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("client_request_id", cr)
      .maybeSingle();
    if (raced?.id) return { ok: true, ticketId: raced.id };
  }

  if (ticketError || !ticket) {
    return {
      ok: false,
      error: formatTicketInsertError(ticketError?.message, { code: ticketError?.code ?? null }),
    };
  }

  await supabase.from("ticket_events").insert({
    ticket_id: ticket.id,
    actor_user_id: user.id,
    event_type: TICKET_EVENT.created,
    payload: {
      note: trimmed,
      request_type_code: resolvedRt?.code ?? null,
      priority: priority ?? "normal",
      source: "staff",
    },
  });

  revalidatePath(`/app/sites/${siteId}`);
  revalidatePath("/app");
  return { ok: true, ticketId: ticket.id };
}
