import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RATE_LIMIT_PER_TOKEN = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

interface CreateTicketBody {
  token: string;
  request_type?: string | null;
  note: string;
  priority?: "low" | "normal" | "high";
  guest_email?: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = (await req.json()) as CreateTicketBody;
    const { token, request_type, note, priority = "normal", guest_email } = body;

    if (!token || typeof token !== "string") {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!note || typeof note !== "string" || note.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: "Note must be at least 5 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const validPriority = ["low", "normal", "high"].includes(priority) ? priority : "normal";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Resolve token to room + site + tenant
    const { data: tokenRow, error: tokenError } = await supabase
      .from("room_tokens")
      .select("id, room_id, room:rooms(id, room_label, site_id, site:sites(tenant_id))")
      .eq("token", token)
      .is("revoked_at", null)
      .single();

    if (tokenError || !tokenRow) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const room = tokenRow.room as { id: string; room_label: string; site_id: string; site: { tenant_id: string } };
    const tenant_id = room.site.tenant_id;
    const site_id = room.site_id;
    const room_id = room.id;
    const room_label_snapshot = room.room_label;

    // Rate limit: count recent tickets for this room
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count } = await supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("room_id", room_id)
      .gte("created_at", since);

    if ((count ?? 0) >= RATE_LIMIT_PER_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const guestEmail = typeof guest_email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest_email.trim()) ? guest_email.trim() : null;

    // Insert ticket
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .insert({
        tenant_id,
        site_id,
        room_id,
        room_label_snapshot,
        request_type: request_type ?? null,
        note: note.trim(),
        status: "new",
        priority: validPriority,
        created_via: "qr",
        guest_email: guestEmail,
      })
      .select("id")
      .single();

    if (ticketError) {
      console.error("ticket insert error", ticketError);
      return new Response(
        JSON.stringify({ error: "Failed to create ticket" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert ticket_event (created)
    await supabase.from("ticket_events").insert({
      ticket_id: ticket.id,
      actor_user_id: null,
      event_type: "created",
      payload: { note: note.trim(), request_type: request_type ?? null, priority: validPriority },
    });

    // Guest status token: 48h link so guest can check status at /t/status/[statusToken]
    const statusToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await supabase.from("guest_status_tokens").insert({
      ticket_id: ticket.id,
      token: statusToken,
      expires_at: expiresAt,
    });

    // Update last_scanned_at on token
    await supabase
      .from("room_tokens")
      .update({ last_scanned_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    // Trigger alerts asynchronously (invoke send-alerts or do inline later)
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-alerts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ site_id, ticket_id: ticket.id }),
      });
    } catch (_) {
      // Non-blocking; alerts can be retried
    }

    return new Response(
      JSON.stringify({ ticket_id: ticket.id, status_token: statusToken }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
