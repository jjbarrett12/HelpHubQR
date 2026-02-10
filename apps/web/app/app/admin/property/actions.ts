"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { revalidatePath } from "next/cache";

async function getPropertyId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createServiceRoleClient();
  const { data } = await admin.from("supervisor_profiles").select("property_id").eq("user_id", user.id).single();
  return data?.property_id ?? null;
}

export async function updateProperty(formData: FormData) {
  const propertyId = await getPropertyId();
  if (!propertyId) return { error: "Unauthorized" };
  const name = formData.get("name") as string | null;
  const timezone = formData.get("timezone") as string | null;
  const logoUrl = formData.get("logo_url") as string | null;
  const primaryColor = formData.get("primary_color") as string | null;
  const supportPhone = formData.get("support_phone") as string | null;
  const admin = createServiceRoleClient();
  const { data: prop } = await admin.from("properties").select("branding").eq("id", propertyId).single();
  const branding = (prop?.branding as Record<string, unknown>) ?? {};
  if (logoUrl !== null) branding.logo_url = logoUrl || null;
  if (primaryColor !== null) branding.primary_color = primaryColor || null;
  if (supportPhone !== null) branding.support_phone = supportPhone || null;
  const { error } = await admin
    .from("properties")
    .update({
      ...(name != null && name !== "" ? { name } : {}),
      ...(timezone != null && timezone !== "" ? { timezone } : {}),
      branding,
    })
    .eq("id", propertyId);
  if (error) return { error: error.message };
  revalidatePath("/app/admin/property");
  return {};
}

export async function updateRequestType(formData: FormData) {
  const propertyId = await getPropertyId();
  if (!propertyId) return { error: "Unauthorized" };
  const id = formData.get("id") as string | null;
  if (!id) return { error: "Missing id" };
  const label = formData.get("label") as string | null;
  const defaultSlaMinutes = formData.get("default_sla_minutes");
  const isActive = formData.get("is_active");
  const admin = createServiceRoleClient();
  const updates: Record<string, unknown> = {};
  if (label != null) updates.label = label;
  if (defaultSlaMinutes != null) {
    const n = parseInt(String(defaultSlaMinutes), 10);
    if (!isNaN(n)) updates.default_sla_minutes = n;
  }
  if (isActive !== undefined && isActive !== null) updates.is_active = isActive === "on" || isActive === "true" || isActive === "1";
  if (Object.keys(updates).length === 0) return {};
  const { error } = await admin.from("request_types").update(updates).eq("id", id).eq("property_id", propertyId);
  if (error) return { error: error.message };
  revalidatePath("/app/admin/property");
  return {};
}

export async function addPropertyAlertRule(formData: FormData) {
  const propertyId = await getPropertyId();
  if (!propertyId) return { error: "Unauthorized" };
  const channel = formData.get("channel") as string | null;
  const target = formData.get("target") as string | null;
  if (!channel || !target?.trim()) return { error: "Channel and target required" };
  if (channel !== "email" && channel !== "sms") return { error: "Channel must be email or sms" };
  const admin = createServiceRoleClient();
  const { error } = await admin.from("property_alert_rules").insert({
    property_id: propertyId,
    channel,
    target: target.trim(),
    enabled: true,
  });
  if (error) return { error: error.message };
  revalidatePath("/app/admin/property");
  return {};
}

export async function deletePropertyAlertRule(formData: FormData) {
  const ruleId = formData.get("ruleId") as string | null;
  if (!ruleId) return { error: "Missing ruleId" };
  const propertyId = await getPropertyId();
  if (!propertyId) return { error: "Unauthorized" };
  const admin = createServiceRoleClient();
  const { error } = await admin.from("property_alert_rules").delete().eq("id", ruleId).eq("property_id", propertyId);
  if (error) return { error: error.message };
  revalidatePath("/app/admin/property");
  return {};
}
