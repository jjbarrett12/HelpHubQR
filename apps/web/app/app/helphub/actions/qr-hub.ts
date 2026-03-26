"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/helphub/require-org";
import type { QrDestinationContent } from "@/lib/qr/types";
import { parseQrDestinationType } from "@/lib/qr/types";
import { generateQrSlug } from "@/lib/qr/slug";

function buildContentFromForm(formData: FormData, type: string): QrDestinationContent {
  const title = String(formData.get("content_title") ?? "").trim() || undefined;
  const body = String(formData.get("content_body") ?? "").trim() || undefined;
  const videoUrl = String(formData.get("content_videoUrl") ?? "").trim() || undefined;
  const itemsRaw = String(formData.get("content_items") ?? "").trim();
  const phone = String(formData.get("content_phone") ?? "").trim() || undefined;
  const email = String(formData.get("content_email") ?? "").trim() || undefined;
  const prompt = String(formData.get("content_prompt") ?? "").trim() || undefined;

  const items = itemsRaw
    ? itemsRaw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  const base: QrDestinationContent = {};
  if (title) base.title = title;
  if (body) base.body = body;
  if (videoUrl) base.videoUrl = videoUrl;
  if (phone) base.phone = phone;
  if (email) base.email = email;
  if (prompt) base.prompt = prompt;
  if (items && items.length > 0) base.items = items;

  if (type === "training" || type === "sop" || type === "help" || type === "issue_report" || type === "announcement") {
    return base;
  }
  return {};
}

export async function createQrDestination(formData: FormData) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const name = String(formData.get("name") ?? "").trim();
  const type = parseQrDestinationType(String(formData.get("type") ?? ""));
  const locationIdRaw = String(formData.get("location_id") ?? "").trim();
  const locationId = locationIdRaw || null;
  const checklistIdRaw = String(formData.get("target_checklist_id") ?? "").trim();
  const targetChecklistId = checklistIdRaw || null;
  const isActive = String(formData.get("is_active") ?? "true") !== "false";

  if (!name) return { error: "Name is required" };
  if (!type) return { error: "Type is required" };

  if (type === "checklist") {
    if (!targetChecklistId) return { error: "Choose a checklist template for this destination" };
    const { data: cl } = await supabase
      .from("checklists")
      .select("id")
      .eq("id", targetChecklistId)
      .eq("organization_id", orgId)
      .single();
    if (!cl) return { error: "Checklist not found" };
  }

  const content = buildContentFromForm(formData, type);
  const contentJson =
    type === "checklist" ? null : Object.keys(content).length > 0 ? content : null;

  const ins = await supabase.from("qr_destinations").insert({
    organization_id: orgId,
    location_id: locationId,
    name,
    type,
    target_checklist_id: type === "checklist" ? targetChecklistId : null,
    content: contentJson,
    is_active: isActive,
  });
  if (ins.error) return { error: ins.error.message };

  revalidatePath("/app/qr-destinations");
  revalidatePath("/app/qr-codes");
  return { ok: true };
}

export async function updateQrDestination(formData: FormData) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const type = parseQrDestinationType(String(formData.get("type") ?? ""));
  const locationIdRaw = String(formData.get("location_id") ?? "").trim();
  const locationId = locationIdRaw || null;
  const checklistIdRaw = String(formData.get("target_checklist_id") ?? "").trim();
  const targetChecklistId = checklistIdRaw || null;
  const isActive = String(formData.get("is_active") ?? "true") !== "false";

  if (!id) return { error: "Missing id" };
  if (!name) return { error: "Name is required" };
  if (!type) return { error: "Type is required" };

  if (type === "checklist") {
    if (!targetChecklistId) return { error: "Choose a checklist template" };
    const { data: cl } = await supabase
      .from("checklists")
      .select("id")
      .eq("id", targetChecklistId)
      .eq("organization_id", orgId)
      .single();
    if (!cl) return { error: "Checklist not found" };
  }

  const content = buildContentFromForm(formData, type);
  const contentJson =
    type === "checklist" ? null : Object.keys(content).length > 0 ? content : null;

  const up = await supabase
    .from("qr_destinations")
    .update({
      name,
      type,
      location_id: locationId,
      target_checklist_id: type === "checklist" ? targetChecklistId : null,
      content: contentJson,
      is_active: isActive,
    })
    .eq("id", id)
    .eq("organization_id", orgId);
  if (up.error) return { error: up.error.message };

  revalidatePath("/app/qr-destinations");
  revalidatePath("/app/qr-codes");
  revalidatePath(`/app/qr-destinations/${id}/edit`);
  revalidatePath("/app/qr-hub");
  return { ok: true };
}

export async function deleteQrDestination(id: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const d = await supabase.from("qr_destinations").delete().eq("id", id).eq("organization_id", orgId);
  if (d.error) return { error: d.error.message };
  revalidatePath("/app/qr-destinations");
  revalidatePath("/app/qr-codes");
  revalidatePath("/app/qr-hub");
  return { ok: true };
}

export async function deleteQrDestinationForm(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await deleteQrDestination(id);
}

export async function createQrCode(formData: FormData) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const destinationId = String(formData.get("qr_destination_id") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const locationIdRaw = String(formData.get("location_id") ?? "").trim();
  const locationId = locationIdRaw || null;

  if (!destinationId) return { error: "Destination is required" };
  if (!label) return { error: "Label is required" };

  const { data: dest } = await supabase
    .from("qr_destinations")
    .select("id")
    .eq("id", destinationId)
    .eq("organization_id", orgId)
    .single();
  if (!dest) return { error: "Destination not found" };

  let lastError: string | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const slug = generateQrSlug();
    const ins = await supabase.from("qr_codes").insert({
      organization_id: orgId,
      qr_destination_id: destinationId,
      location_id: locationId,
      slug,
      label,
    });
    if (!ins.error) {
      revalidatePath("/app/qr-codes");
      revalidatePath("/app/qr-hub");
      return { ok: true, slug };
    }
    lastError = ins.error.message;
    const code = (ins.error as { code?: string }).code;
    const isDup =
      code === "23505" ||
      ins.error.message.toLowerCase().includes("duplicate") ||
      ins.error.message.toLowerCase().includes("unique");
    if (!isDup) {
      return { error: ins.error.message };
    }
  }
  return { error: lastError ?? "Could not allocate a unique QR link" };
}

export async function deleteQrCode(id: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const d = await supabase.from("qr_codes").delete().eq("id", id).eq("organization_id", orgId);
  if (d.error) return { error: d.error.message };
  revalidatePath("/app/qr-codes");
  revalidatePath("/app/qr-hub");
  return { ok: true };
}

export async function deleteQrCodeForm(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await deleteQrCode(id);
}
