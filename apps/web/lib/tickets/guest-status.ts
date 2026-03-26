import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Reuse an unexpired guest status token for the ticket, or mint a new one. */
export async function ensureGuestStatusTokenForTicket(
  admin: SupabaseClient,
  ticketId: string
): Promise<{ status_token: string }> {
  const nowIso = new Date().toISOString();
  const { data: row } = await admin
    .from("guest_status_tokens")
    .select("token")
    .eq("ticket_id", ticketId)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (row?.token) return { status_token: row.token };

  const statusToken = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const { error } = await admin.from("guest_status_tokens").insert({
    ticket_id: ticketId,
    token: statusToken,
    expires_at: expiresAt,
  });
  if (error) throw new Error(error.message);
  return { status_token: statusToken };
}
