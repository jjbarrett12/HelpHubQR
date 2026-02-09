import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendAlertsBody {
  site_id: string;
  ticket_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SendAlertsBody;
    const { site_id, ticket_id } = body;
    if (!site_id || !ticket_id) {
      return new Response(
        JSON.stringify({ error: "site_id and ticket_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: ticket } = await supabase
      .from("tickets")
      .select("room_label_snapshot, request_type, note, priority")
      .eq("id", ticket_id)
      .single();

    const { data: site } = await supabase
      .from("sites")
      .select("name")
      .eq("id", site_id)
      .single();

    if (!ticket || !site) {
      return new Response(
        JSON.stringify({ error: "Ticket or site not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dashboardUrl = process.env.DASHBOARD_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.example.com"; // Set DASHBOARD_URL in Edge Function secrets to your production domain
    const viewPath = `/app/tickets/${ticket_id}`;
    const viewUrl = dashboardUrl.startsWith("http") ? `${dashboardUrl}${viewPath}` : `https://${dashboardUrl}${viewPath}`;
    const shortNote = ticket.note?.slice(0, 80) || "";
    const message = `[${site.name}] Room ${ticket.room_label_snapshot}: ${ticket.request_type || "Request"} – ${shortNote}. View: ${viewUrl}`;
    const subject = `Housekeeping: ${site.name} – Room ${ticket.room_label_snapshot}`;
    const fromEmail = Deno.env.get("ALERT_FROM_EMAIL") || "alerts@example.com";
    const fromName = "HelpHub";

    const { data: rules } = await supabase
      .from("alert_rules")
      .select("channel, target")
      .eq("site_id", site_id)
      .eq("enabled", true);

    for (const rule of rules ?? []) {
      if (rule.channel === "email" && rule.target) {
        const resendKey = Deno.env.get("RESEND_API_KEY");
        const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
        if (resendKey) {
          try {
            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${resendKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: `${fromName} <${fromEmail}>`,
                to: [rule.target],
                subject,
                text: message,
                html: `<p>${message.replace(/\n/g, "<br/>")}</p><p><a href="${viewUrl}">View in dashboard</a></p>`,
              }),
            });
            if (!res.ok) {
              const err = await res.text();
              console.error("Resend error", res.status, err);
            }
          } catch (e) {
            console.error("Resend error", e);
          }
        } else if (sendgridKey) {
          try {
            await fetch("https://api.sendgrid.com/v3/mail/send", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${sendgridKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                personalizations: [{ to: [{ email: rule.target }] }],
                from: { email: fromEmail, name: fromName },
                subject,
                content: [{ type: "text/plain", value: message }],
              }),
            });
          } catch (e) {
            console.error("SendGrid error", e);
          }
        }
      }
      if (rule.channel === "sms" && rule.target) {
        const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const auth = Deno.env.get("TWILIO_AUTH_TOKEN");
        const from = Deno.env.get("TWILIO_FROM");
        if (sid && auth && from) {
          try {
            const authHeader = btoa(`${sid}:${auth}`);
            await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
              method: "POST",
              headers: {
                "Authorization": `Basic ${authHeader}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                To: rule.target,
                From: from,
                Body: message,
              }),
            });
          } catch (e) {
            console.error("Twilio error", e);
          }
        }
      }
    }

    // Push notifications: send to all registered devices for this site
    const { data: pushSubs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("site_id", site_id);

    if (pushSubs && pushSubs.length > 0) {
      const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
      const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
      if (vapidPublic && vapidPrivate) {
        try {
          const webpush = await import("npm:web-push");
          webpush.default.setVapidDetails(`mailto:${fromEmail}`, vapidPublic, vapidPrivate);
          const pushTitle = `Room ${ticket.room_label_snapshot} – ${ticket.request_type || "Request"}`;
          const pushBody = shortNote || "New housekeeping request";
          for (const sub of pushSubs) {
            try {
              await webpush.default.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                JSON.stringify({
                  title: pushTitle,
                  body: pushBody,
                  url: viewUrl,
                  tag: `ticket-${ticket_id}`,
                }),
                { TTL: 60 }
              );
            } catch (e) {
              if (e && typeof e === "object" && "statusCode" in e && (e as { statusCode: number }).statusCode === 410) {
                await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
              }
              console.error("Push send error", e);
            }
          }
        } catch (e) {
          console.error("Web push init error", e);
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
