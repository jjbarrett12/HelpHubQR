import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { ticketId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const ticketId = body.ticketId;
  if (!ticketId || typeof ticketId !== "string") {
    return NextResponse.json({ error: "ticketId required" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: profile } = await admin.from("profiles").select("tenant_id").eq("user_id", user.id).single();
  if (!profile?.tenant_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: ticket } = await admin
    .from("tickets")
    .select("id, tenant_id, guest_email, room_label_snapshot, status, site_id, site:sites(name)")
    .eq("id", ticketId)
    .single();

  if (!ticket || (ticket as { tenant_id: string }).tenant_id !== profile.tenant_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (ticket.status !== "resolved") {
    return NextResponse.json({ ok: true }); // no-op
  }
  const email = (ticket as { guest_email?: string | null }).guest_email;
  if (!email || typeof email !== "string") {
    return NextResponse.json({ ok: true });
  }

  const site = (ticket as { site?: { name: string } | { name: string }[] }).site;
  const siteName = Array.isArray(site) ? site[0]?.name : (site as { name: string } | null)?.name;
  const subject = "Your request is complete – " + (siteName ?? "HelpHub");
  const message = `Your housekeeping request for Room ${(ticket as { room_label_snapshot: string }).room_label_snapshot} has been completed. Thank you.`;
  const fromEmail = process.env.ALERT_FROM_EMAIL || "alerts@example.com";
  const fromName = "HelpHub";

  const resendKey = process.env.RESEND_API_KEY;
  const sendgridKey = process.env.SENDGRID_API_KEY;

  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [email],
        subject,
        text: message,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error", res.status, err);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }
  } else if (sendgridKey) {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendgridKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: fromEmail, name: fromName },
        subject,
        content: [{ type: "text/plain", value: message }],
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("SendGrid error", res.status, err);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }
  } else {
    return NextResponse.json({ ok: true }); // no provider configured
  }

  return NextResponse.json({ ok: true });
}
