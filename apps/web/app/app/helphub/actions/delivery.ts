"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/helphub/require-org";
import {
  deliverChecklistRunNotifications,
  fetchOrCreateDeliverySettings,
} from "@/lib/delivery/checklist-delivery";

export async function sendChecklistDeliveries(runId: string, resend: boolean) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const { data: run, error } = await supabase
    .from("shift_checklist_runs")
    .select("id")
    .eq("id", runId)
    .eq("organization_id", orgId)
    .single();
  if (error || !run) return { error: "Checklist run not found" };

  try {
    const { results } = await deliverChecklistRunNotifications(supabase, orgId, runId, {
      resend,
      deliveryTrigger: "manual",
    });
    revalidatePath("/app/checklist-runs");
    revalidatePath("/app/schedule");
    revalidatePath("/app/dashboard");
    return { ok: true as const, results };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Send failed" };
  }
}

export async function updateOrganizationDeliverySettings(formData: FormData) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const sendSms = formData.has("send_sms");
  const sendEmail = formData.has("send_email");
  const smsFrom = String(formData.get("sms_from_number") ?? "").trim() || null;
  const replyTo = String(formData.get("reply_to_email") ?? "").trim() || null;
  const offsetRaw = String(formData.get("default_send_offset_minutes") ?? "0").trim();
  const defaultSendOffsetMinutes = Math.min(24 * 60, Math.max(0, parseInt(offsetRaw, 10) || 0));

  await fetchOrCreateDeliverySettings(supabase, orgId);

  const up = await supabase
    .from("organization_delivery_settings")
    .update({
      send_sms: sendSms,
      send_email: sendEmail,
      sms_from_number: smsFrom,
      reply_to_email: replyTo,
      default_send_offset_minutes: defaultSendOffsetMinutes,
    })
    .eq("organization_id", orgId);

  if (up.error) return { error: up.error.message };
  revalidatePath("/app/delivery-settings");
  return { ok: true as const };
}
