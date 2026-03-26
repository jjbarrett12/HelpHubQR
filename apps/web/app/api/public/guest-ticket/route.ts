import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitKey } from "@/lib/rateLimit";
import { checkGuestRateLimitDistributed } from "@/lib/rateLimitDistributed";
import { hashRoomToken } from "@/lib/room-token/hash";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { formatTicketInsertError, isKnownTicketIntegrityMessage } from "@/lib/tickets/db-error";
import { ensureGuestStatusTokenForTicket } from "@/lib/tickets/guest-status";
import { resolveTicketRequestType } from "@/lib/tickets/resolve-request-type";
import { TICKET_EVENT } from "@/lib/tickets/event-types";

const bodySchema = z.object({
  token: z.string().min(1).max(256),
  note: z.string().min(5).max(8000),
  /** Preferred: catalog code (e.g. towels). */
  request_type_code: z.string().max(64).nullable().optional(),
  /** Legacy: label or code string from older clients. */
  request_type: z.string().max(120).nullable().optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
  guest_email: z.string().max(320).nullable().optional(),
  client_request_id: z.string().max(128).nullable().optional(),
});

type ResolvePayload = {
  ok?: boolean;
  code?: string;
  tenant_id?: string;
  site_id?: string;
  room_id?: string;
  room_label?: string;
};

async function jsonSuccessForTicket(
  supabase: ReturnType<typeof createServiceRoleClient>,
  ticketId: string,
  extra: { deduped?: boolean } = {}
) {
  try {
    const { status_token } = await ensureGuestStatusTokenForTicket(supabase, ticketId);
    return NextResponse.json({ status_token, ticket_id: ticketId, ...extra });
  } catch {
    return NextResponse.json({ error: "Could not complete request." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const {
    token,
    note,
    request_type_code,
    request_type: legacyRequestType,
    priority = "normal",
    guest_email,
    client_request_id: rawClientId,
  } = parsed.data;
  const client_request_id = rawClientId?.trim() || null;
  const requestTypeInput = request_type_code?.trim() || legacyRequestType?.trim() || null;

  const trimmedEmail = guest_email?.trim() ?? "";
  const emailParsed = trimmedEmail ? z.string().email().safeParse(trimmedEmail) : null;
  if (trimmedEmail && !emailParsed?.success) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }
  const email = emailParsed?.success ? emailParsed.data : null;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const tokenKey = hashRoomToken(token).slice(0, 32);
  const guestRl = await checkGuestRateLimitDistributed(rateLimitKey(tokenKey, null, ip));
  if (!guestRl.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again in a few minutes." }, { status: 429 });
  }

  let supabase: ReturnType<typeof createServiceRoleClient>;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  const { data: resolved, error: rpcErr } = await supabase.rpc("hh_room_token_resolve_guest", {
    p_raw_token: token,
  });

  if (rpcErr) {
    return NextResponse.json({ error: "Could not submit request." }, { status: 400 });
  }

  const payload = resolved as ResolvePayload | null;
  if (!payload || payload.ok !== true) {
    if (payload?.code === "archived") {
      return NextResponse.json(
        {
          error:
            "This room link is no longer active. Please contact the front desk for a current QR code.",
        },
        { status: 410 }
      );
    }
    return NextResponse.json({ error: "Invalid or expired room link." }, { status: 401 });
  }

  const tenant_id = payload.tenant_id;
  const site_id = payload.site_id;
  const room_id = payload.room_id;
  const room_label = payload.room_label;
  if (!tenant_id || !site_id || !room_id || room_label == null) {
    return NextResponse.json({ error: "Could not submit request." }, { status: 400 });
  }

  const [{ data: siteRow }, { data: roomRow }, resolvedRt] = await Promise.all([
    supabase.from("sites").select("name").eq("id", site_id).single(),
    supabase.from("rooms").select("floor").eq("id", room_id).single(),
    resolveTicketRequestType(supabase, tenant_id, requestTypeInput),
  ]);

  if (client_request_id) {
    const { data: existing } = await supabase
      .from("tickets")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("client_request_id", client_request_id)
      .maybeSingle();
    if (existing?.id) {
      return jsonSuccessForTicket(supabase, existing.id, { deduped: true });
    }
  }

  const { data: ticket, error: tErr } = await supabase
    .from("tickets")
    .insert({
      tenant_id,
      site_id,
      room_id,
      room_label_snapshot: room_label,
      request_type_id: resolvedRt?.id ?? null,
      request_type_label_snapshot: resolvedRt?.label ?? null,
      site_name_snapshot: siteRow?.name ?? null,
      floor_snapshot: roomRow?.floor ?? null,
      note: note.trim(),
      status: "new",
      priority,
      guest_email: email,
      created_via: "guest",
      client_request_id: client_request_id || null,
    })
    .select("id")
    .single();

  if (tErr?.code === "23505" && client_request_id) {
    const { data: raced } = await supabase
      .from("tickets")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("client_request_id", client_request_id)
      .maybeSingle();
    if (raced?.id) {
      return jsonSuccessForTicket(supabase, raced.id, { deduped: true });
    }
  }

  if (tErr || !ticket) {
    const msg = formatTicketInsertError(tErr?.message, { code: tErr?.code ?? null });
    const clientDup =
      tErr?.code === "23505" &&
      (tErr.message?.includes("tickets_tenant_client_request") ?? false);
    const status =
      isKnownTicketIntegrityMessage(tErr?.message) || clientDup ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  const { error: createdEvErr } = await supabase.from("ticket_events").insert({
    ticket_id: ticket.id,
    actor_user_id: null,
    event_type: TICKET_EVENT.created,
    payload: {
      source: "guest",
      priority,
      request_type_code: resolvedRt?.code ?? null,
    },
  });
  if (createdEvErr) {
    console.error("[guest-ticket] ticket_event_insert_failed", {
      ticket_id: ticket.id,
      code: createdEvErr.code,
      message: createdEvErr.message,
    });
    await supabase.from("tickets").delete().eq("id", ticket.id);
    return NextResponse.json(
      {
        error: formatTicketInsertError(createdEvErr.message, {
          code: createdEvErr.code ?? null,
        }),
      },
      { status: 500 }
    );
  }

  return jsonSuccessForTicket(supabase, ticket.id, { deduped: false });
}
