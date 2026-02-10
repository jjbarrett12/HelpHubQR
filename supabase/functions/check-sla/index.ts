import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = new Date().toISOString();
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, property_id, location_id, request_type_id, created_at, sla_minutes")
      .in("status", ["open", "assigned", "in_progress"]);

    if (!tasks || tasks.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, overdue_count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const overdue: typeof tasks = [];
    for (const t of tasks) {
      const due = new Date(t.created_at).getTime() + (t.sla_minutes || 0) * 60 * 1000;
      if (due < Date.now()) overdue.push(t);
    }

    if (overdue.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, overdue_count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const locationIds = [...new Set(overdue.map((t) => t.location_id))];
    const requestTypeIds = [...new Set(overdue.map((t) => t.request_type_id))];
    const propertyIds = [...new Set(overdue.map((t) => t.property_id))];

    const { data: locations } = await supabase
      .from("locations")
      .select("id, identifier")
      .in("id", locationIds);
    const { data: requestTypes } = await supabase
      .from("request_types")
      .select("id, label")
      .in("id", requestTypeIds);
    const { data: properties } = await supabase
      .from("properties")
      .select("id, name")
      .in("id", propertyIds);

    const locMap = new Map((locations ?? []).map((l) => [l.id, l.identifier]));
    const rtMap = new Map((requestTypes ?? []).map((r) => [r.id, r.label]));
    const propMap = new Map((properties ?? []).map((p) => [p.id, p.name]));

    const dashboardUrl = process.env.DASHBOARD_URL || process.env.SUPABASE_URL?.replace(".supabase.co", "") || "https://helphubqr.com";
    const baseUrl = dashboardUrl.startsWith("http") ? dashboardUrl : `https://${dashboardUrl}`;
    const supervisorPath = "/app/supervisor";

    const byProperty = new Map<string, typeof overdue>();
    for (const t of overdue) {
      if (!byProperty.has(t.property_id)) byProperty.set(t.property_id, []);
      byProperty.get(t.property_id)!.push(t);
    }

    for (const [propertyId, list] of byProperty) {
      const { data: rules } = await supabase
        .from("property_alert_rules")
        .select("channel, target")
        .eq("property_id", propertyId)
        .eq("enabled", true);

      const propName = propMap.get(propertyId) ?? "Property";
      const lines = list.map((t) => {
        const loc = locMap.get(t.location_id) ?? "?";
        const label = rtMap.get(t.request_type_id) ?? "Task";
        const due = new Date(t.created_at).getTime() + (t.sla_minutes || 0) * 60 * 1000;
        return `- ${loc}: ${label} (due ${new Date(due).toLocaleString()})`;
      });
      const message = `[${propName}] ${list.length} overdue task(s):\n${lines.join("\n")}\n\nView: ${baseUrl}${supervisorPath}`;
      const subject = `HelpHub: ${list.length} overdue task(s) – ${propName}`;
      const fromEmail = Deno.env.get("ALERT_FROM_EMAIL") || "alerts@example.com";
      const fromName = "HelpHub";

      for (const rule of rules ?? []) {
        if (rule.channel === "email" && rule.target) {
          const resendKey = Deno.env.get("RESEND_API_KEY");
          const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
          if (resendKey) {
            try {
              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${resendKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: `${fromName} <${fromEmail}>`,
                  to: [rule.target],
                  subject,
                  text: message,
                  html: `<p>${message.replace(/\n/g, "<br/>")}</p><p><a href="${baseUrl}${supervisorPath}">Open supervisor dashboard</a></p>`,
                }),
              });
            } catch (e) {
              console.error("Resend error", e);
            }
          } else if (sendgridKey) {
            try {
              await fetch("https://api.sendgrid.com/v3/mail/send", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${sendgridKey}`,
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
                  Authorization: `Basic ${authHeader}`,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  To: rule.target,
                  From: from,
                  Body: message.slice(0, 1600),
                }),
              });
            } catch (e) {
              console.error("Twilio error", e);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, overdue_count: overdue.length }),
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
