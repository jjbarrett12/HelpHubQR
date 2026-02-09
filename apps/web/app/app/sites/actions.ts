"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type CreateTicketResult =
  | { ok: true; ticketId: string }
  | { ok: false; error: string };

export async function createTicketForRoom(
  siteId: string,
  roomId: string,
  note: string,
  requestType: string | null,
  priority: "low" | "normal" | "high"
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
    .select("id, room_label, site_id, site:sites(tenant_id)")
    .eq("id", roomId)
    .eq("site_id", siteId)
    .single();

  if (roomError || !room) return { ok: false, error: "Room not found or access denied" };

  const siteRow = room.site as { tenant_id: string }[] | { tenant_id: string } | null;
  const site = Array.isArray(siteRow) ? siteRow[0] ?? null : siteRow;
  if (!site) return { ok: false, error: "Site not found" };

  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .insert({
      tenant_id: site.tenant_id,
      site_id: siteId,
      room_id: roomId,
      room_label_snapshot: room.room_label,
      request_type: requestType || null,
      note: trimmed,
      status: "new",
      priority: priority ?? "normal",
      created_via: "staff",
    })
    .select("id")
    .single();

  if (ticketError) return { ok: false, error: ticketError.message };

  await supabase.from("ticket_events").insert({
    ticket_id: ticket.id,
    actor_user_id: user.id,
    event_type: "created",
    payload: {
      note: trimmed,
      request_type: requestType ?? null,
      priority: priority ?? "normal",
      source: "staff",
    },
  });

  revalidatePath(`/app/sites/${siteId}`);
  revalidatePath("/app");
  return { ok: true, ticketId: ticket.id };
}
