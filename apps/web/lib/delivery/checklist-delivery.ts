import type { SupabaseClient } from "@supabase/supabase-js";
import { createChecklistRunFromShift } from "@/lib/helphub/shift-checklist";
import type { ShiftType } from "@/lib/helphub/types";
import {
  buildChecklistEmailContent,
  buildChecklistSmsBody,
  firstNameFromFullName,
  resolveChecklistLink,
} from "./checklist-messages";
import { markRunSentIfNeeded } from "./mark-run-sent";
import { sendEmail } from "./send-email";
import { sendSMS } from "./send-sms";

const PENDING_STALE_MS = 15 * 60 * 1000;

export type OrgDeliverySettings = {
  send_sms: boolean;
  send_email: boolean;
  sms_from_number: string | null;
  reply_to_email: string | null;
  default_send_offset_minutes: number;
};

function logDelivery(event: string, payload: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      event: `checklist_delivery.${event}`,
      ts: new Date().toISOString(),
      ...payload,
    })
  );
}

export async function fetchOrCreateDeliverySettings(
  supabase: SupabaseClient,
  organizationId: string
): Promise<OrgDeliverySettings> {
  const { data: row } = await supabase
    .from("organization_delivery_settings")
    .select("send_sms, send_email, sms_from_number, reply_to_email, default_send_offset_minutes")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (row) {
    return row as OrgDeliverySettings;
  }

  const { error: insErr } = await supabase.from("organization_delivery_settings").insert({
    organization_id: organizationId,
  });
  if (insErr) {
    throw new Error(insErr.message);
  }

  const { data: created, error: fetchErr } = await supabase
    .from("organization_delivery_settings")
    .select("send_sms, send_email, sms_from_number, reply_to_email, default_send_offset_minutes")
    .eq("organization_id", organizationId)
    .single();

  if (fetchErr || !created) {
    throw new Error(fetchErr?.message ?? "Failed to load delivery settings");
  }
  return created as OrgDeliverySettings;
}

function normalizeDeliveryDestination(raw: string): string {
  return raw.trim();
}

async function hasSuccessfulDelivery(
  supabase: SupabaseClient,
  runId: string,
  channel: "sms" | "email",
  destination: string
): Promise<boolean> {
  const d = normalizeDeliveryDestination(destination);
  if (!d) return false;
  const { data } = await supabase
    .from("message_deliveries")
    .select("id")
    .eq("shift_checklist_run_id", runId)
    .eq("channel", channel)
    .eq("destination", d)
    .in("status", ["sent", "delivered"])
    .limit(1)
    .maybeSingle();
  return !!data?.id;
}

async function hasRecentPendingDelivery(
  supabase: SupabaseClient,
  runId: string,
  channel: "sms" | "email",
  destination: string
): Promise<boolean> {
  const d = normalizeDeliveryDestination(destination);
  if (!d) return false;
  const since = new Date(Date.now() - PENDING_STALE_MS).toISOString();
  const { data } = await supabase
    .from("message_deliveries")
    .select("id")
    .eq("shift_checklist_run_id", runId)
    .eq("channel", channel)
    .eq("destination", d)
    .eq("status", "pending")
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();
  return !!data?.id;
}

function defaultFromEmail(): string {
  return (process.env.CHECKLIST_FROM_EMAIL ?? process.env.ALERT_FROM_EMAIL ?? "").trim();
}

function defaultSmsFrom(settings: OrgDeliverySettings): string {
  return (settings.sms_from_number ?? process.env.TWILIO_FROM_NUMBER ?? "").trim();
}

async function deliverOneChannel(
  supabase: SupabaseClient,
  args: {
    organizationId: string;
    runId: string;
    employeeId: string;
    channel: "sms" | "email";
    destination: string;
    deliveryTrigger: "cron" | "manual";
    resend: boolean;
    firstName: string;
    shiftType: string;
    accessToken: string;
    settings: OrgDeliverySettings;
  }
): Promise<{ outcome: "sent" | "skipped" | "failed"; reason?: string }> {
  const { resend, runId, channel } = args;

  if (!resend) {
    if (await hasSuccessfulDelivery(supabase, runId, channel, args.destination)) {
      logDelivery("skip_idempotent", { runId, channel, reason: "already_sent" });
      return { outcome: "skipped", reason: "already_sent" };
    }
    if (await hasRecentPendingDelivery(supabase, runId, channel, args.destination)) {
      logDelivery("skip_idempotent", { runId, channel, reason: "pending_in_flight" });
      return { outcome: "skipped", reason: "pending_in_flight" };
    }
  }

  const baseKey =
    args.deliveryTrigger === "cron"
      ? `cron:${runId}:${channel}:${args.employeeId}`
      : `manual:${runId}:${channel}:${args.employeeId}`;
  const idempotencyKey = resend ? `${baseKey}:resend:${Date.now()}` : baseKey;

  const destNorm = normalizeDeliveryDestination(args.destination);
  const { data: inserted, error: insErr } = await supabase
    .from("message_deliveries")
    .insert({
      organization_id: args.organizationId,
      shift_checklist_run_id: args.runId,
      employee_id: args.employeeId,
      channel: args.channel,
      destination: destNorm,
      status: "pending",
      delivery_trigger: args.deliveryTrigger,
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();

  let deliveryId: string | null = (inserted?.id as string | undefined) ?? null;

  if (insErr?.code === "23505" && !resend) {
    const { data: existing } = await supabase
      .from("message_deliveries")
      .select("id, status, created_at")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (!existing) {
      logDelivery("insert_failed", { runId, channel, error: insErr.message });
      return { outcome: "failed", reason: insErr.message };
    }
    if (existing.status === "sent" || existing.status === "delivered") {
      logDelivery("skip_idempotent", { runId, channel, reason: "idempotency_race" });
      return { outcome: "skipped", reason: "already_sent" };
    }
    if (existing.status === "pending") {
      const created = new Date((existing.created_at as string) ?? 0).getTime();
      const age = Date.now() - created;
      if (age < PENDING_STALE_MS) {
        return { outcome: "skipped", reason: "pending_in_flight" };
      }
      const resetAt = new Date().toISOString();
      await supabase
        .from("message_deliveries")
        .update({ status: "pending", error_message: null, updated_at: resetAt })
        .eq("id", existing.id as string);
      deliveryId = existing.id as string;
    } else if (existing.status === "failed") {
      const retryAt = new Date().toISOString();
      await supabase
        .from("message_deliveries")
        .update({ status: "pending", error_message: null, updated_at: retryAt })
        .eq("id", existing.id as string);
      deliveryId = existing.id as string;
    } else {
      return { outcome: "skipped", reason: "pending_in_flight" };
    }
  } else if (insErr || !deliveryId) {
    logDelivery("insert_failed", { runId, channel, error: insErr?.message });
    return { outcome: "failed", reason: insErr?.message ?? "insert_failed" };
  }
  const link = resolveChecklistLink(args.accessToken);
  const now = new Date().toISOString();

  if (channel === "sms") {
    const from = defaultSmsFrom(args.settings);
    const body = buildChecklistSmsBody({
      firstName: args.firstName,
      shiftType: args.shiftType,
      link,
    });
    const result = await sendSMS({ to: destNorm, body, from });
    if (!result.ok) {
      await supabase
        .from("message_deliveries")
        .update({ status: "failed", error_message: result.error, updated_at: now })
        .eq("id", deliveryId);
      logDelivery("sms_failed", { runId, channel, error: result.error });
      return { outcome: "failed", reason: result.error };
    }
    await supabase
      .from("message_deliveries")
      .update({
        status: "sent",
        sent_at: now,
        delivered_at: now,
        provider: result.provider,
        provider_message_id: result.providerMessageId,
        updated_at: now,
      })
      .eq("id", deliveryId);
    logDelivery("sms_sent", { runId, channel, providerMessageId: result.providerMessageId });
    await markRunSentIfNeeded(supabase, runId);
    return { outcome: "sent" };
  }

  const { subject, text, html } = buildChecklistEmailContent({
    firstName: args.firstName,
    shiftType: args.shiftType,
    link,
  });

  const fromEmail = defaultFromEmail();
  const result = await sendEmail({
    to: destNorm,
    subject,
    text,
    html,
    fromEmail,
    fromName: "HelpHubQR",
    replyTo: args.settings.reply_to_email,
  });

  if (!result.ok) {
    await supabase
      .from("message_deliveries")
      .update({ status: "failed", error_message: result.error, updated_at: now })
      .eq("id", deliveryId);
    logDelivery("email_failed", { runId, channel, error: result.error });
    return { outcome: "failed", reason: result.error };
  }

  await supabase
    .from("message_deliveries")
    .update({
      status: "sent",
      sent_at: now,
      delivered_at: now,
      provider: result.provider,
      provider_message_id: result.providerMessageId,
      updated_at: now,
    })
    .eq("id", deliveryId);
  logDelivery("email_sent", { runId, channel, providerMessageId: result.providerMessageId });
  await markRunSentIfNeeded(supabase, runId);
  return { outcome: "sent" };
}

export type ChannelResult = {
  channel: "sms" | "email";
  outcome: "sent" | "skipped" | "failed";
  reason?: string;
};

export async function deliverChecklistRunNotifications(
  supabase: SupabaseClient,
  organizationId: string,
  runId: string,
  options: { resend: boolean; deliveryTrigger: "manual" | "cron" }
): Promise<{ results: ChannelResult[] }> {
  const settings = await fetchOrCreateDeliverySettings(supabase, organizationId);

  const { data: run, error: runErr } = await supabase
    .from("shift_checklist_runs")
    .select("id, access_token, employee_shift_id")
    .eq("id", runId)
    .eq("organization_id", organizationId)
    .single();
  if (runErr || !run) {
    throw new Error("Checklist run not found");
  }

  const { data: shift, error: shErr } = await supabase
    .from("employee_shifts")
    .select("employee_id, shift_type")
    .eq("id", run.employee_shift_id as string)
    .single();
  if (shErr || !shift) {
    throw new Error("Shift not found for run");
  }

  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .select("id, full_name, phone, email")
    .eq("id", shift.employee_id as string)
    .single();
  if (empErr || !emp) {
    throw new Error("Employee not found");
  }

  const firstName = firstNameFromFullName((emp.full_name as string) ?? "");
  const shiftType = shift.shift_type as string;
  const accessToken = run.access_token as string;
  const employeeId = emp.id as string;

  const phone = ((emp.phone as string | null) ?? "").trim();
  const email = ((emp.email as string | null) ?? "").trim();

  const results: ChannelResult[] = [];

  if (settings.send_sms) {
    if (!phone) {
      results.push({ channel: "sms", outcome: "skipped", reason: "no_phone_on_file" });
      logDelivery("skip_no_destination", { runId, channel: "sms", reason: "no_phone" });
    } else {
      const r = await deliverOneChannel(supabase, {
        organizationId,
        runId,
        employeeId,
        channel: "sms",
        destination: phone,
        deliveryTrigger: options.deliveryTrigger,
        resend: options.resend,
        firstName,
        shiftType,
        accessToken,
        settings,
      });
      results.push({ channel: "sms", outcome: r.outcome, reason: r.reason });
    }
  } else {
    results.push({ channel: "sms", outcome: "skipped", reason: "sms_disabled_in_org_settings" });
  }

  if (settings.send_email) {
    if (!email) {
      results.push({ channel: "email", outcome: "skipped", reason: "no_email_on_file" });
      logDelivery("skip_no_destination", { runId, channel: "email", reason: "no_email" });
    } else {
      const r = await deliverOneChannel(supabase, {
        organizationId,
        runId,
        employeeId,
        channel: "email",
        destination: email,
        deliveryTrigger: options.deliveryTrigger,
        resend: options.resend,
        firstName,
        shiftType,
        accessToken,
        settings,
      });
      results.push({ channel: "email", outcome: r.outcome, reason: r.reason });
    }
  } else {
    results.push({ channel: "email", outcome: "skipped", reason: "email_disabled_in_org_settings" });
  }

  return { results };
}

export async function ensureRunForShift(
  admin: SupabaseClient,
  shift: {
    id: string;
    organization_id: string;
    location_id: string | null;
    staff_role_id: string;
    shift_type: ShiftType;
    employee_id: string;
  }
): Promise<{ runId: string; accessToken: string } | null> {
  try {
    return await createChecklistRunFromShift(admin, shift, { markSent: false });
  } catch {
    return null;
  }
}
