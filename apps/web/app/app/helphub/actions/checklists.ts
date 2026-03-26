"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/helphub/require-org";
import type { ShiftType } from "@/lib/helphub/types";
import { normalizeTaskKey } from "@/lib/helphub/fairness/task-key";

const SHIFT_TYPES: ShiftType[] = ["open", "mid", "close", "custom"];

function parseShiftType(raw: string): ShiftType | null {
  return SHIFT_TYPES.includes(raw as ShiftType) ? (raw as ShiftType) : null;
}

export async function upsertChecklist(formData: FormData) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const staffRoleId = String(formData.get("staff_role_id") ?? "").trim();
  const shiftType = parseShiftType(String(formData.get("shift_type") ?? ""));
  const locationIdRaw = String(formData.get("location_id") ?? "").trim();
  const locationId = locationIdRaw ? locationIdRaw : null;
  const isActive = String(formData.get("is_active") ?? "true") !== "false";

  if (!name) return { error: "Name is required" };
  if (!staffRoleId) return { error: "Role is required" };
  if (!shiftType) return { error: "Shift type is required" };

  if (id) {
    const u = await supabase
      .from("checklists")
      .update({
        name,
        description,
        staff_role_id: staffRoleId,
        shift_type: shiftType,
        location_id: locationId,
        is_active: isActive,
      })
      .eq("id", id)
      .eq("organization_id", orgId);
    if (u.error) return { error: u.error.message };
  } else {
    const i = await supabase.from("checklists").insert({
      organization_id: orgId,
      name,
      description,
      staff_role_id: staffRoleId,
      shift_type: shiftType,
      location_id: locationId,
      is_active: isActive,
    });
    if (i.error) return { error: i.error.message };
  }

  revalidatePath("/app/checklists");
  if (id) {
    revalidatePath(`/app/checklists/templates/${id}`);
    revalidatePath(`/app/checklists/${id}`);
  }
  return { ok: true };
}

export async function addChecklistItem(formData: FormData) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const checklistId = String(formData.get("checklist_id") ?? "").trim();
  const taskText = String(formData.get("task_text") ?? "").trim();
  if (!checklistId || !taskText) return { error: "Task is required" };

  const { data: cl } = await supabase
    .from("checklists")
    .select("id")
    .eq("id", checklistId)
    .eq("organization_id", orgId)
    .single();
  if (!cl) return { error: "Checklist not found" };

  const { data: maxRow } = await supabase
    .from("checklist_items")
    .select("sort_order")
    .eq("checklist_id", checklistId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  const taskKeyRaw = String(formData.get("task_key") ?? "").trim();
  const task_key = taskKeyRaw ? normalizeTaskKey(taskKeyRaw) : null;

  const sectionTitleRaw = String(formData.get("section_title") ?? "").trim();
  const section_title = sectionTitleRaw || null;
  const durRaw = String(formData.get("duration_estimate_minutes") ?? "").trim();
  const duration_estimate_minutes = durRaw ? parseInt(durRaw, 10) : null;
  const durationOk =
    duration_estimate_minutes != null && !Number.isNaN(duration_estimate_minutes) && duration_estimate_minutes >= 0
      ? duration_estimate_minutes
      : null;

  const ins = await supabase.from("checklist_items").insert({
    checklist_id: checklistId,
    task_text: taskText,
    task_key,
    sort_order: nextOrder,
    requires_photo: String(formData.get("requires_photo") ?? "") === "true",
    section_title,
    duration_estimate_minutes: durationOk,
  });
  if (ins.error) return { error: ins.error.message };
  revalidatePath(`/app/checklists/templates/${checklistId}`);
  revalidatePath(`/app/checklists/${checklistId}`);
  revalidatePath("/app/checklists");
  return { ok: true };
}

export async function updateChecklistItem(formData: FormData) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const itemId = String(formData.get("id") ?? "").trim();
  const taskText = String(formData.get("task_text") ?? "").trim();
  if (!itemId || !taskText) return { error: "Task is required" };

  const { data: item } = await supabase.from("checklist_items").select("checklist_id").eq("id", itemId).single();
  if (!item) return { error: "Item not found" };
  const { data: cl } = await supabase
    .from("checklists")
    .select("id")
    .eq("id", item.checklist_id as string)
    .eq("organization_id", orgId)
    .single();
  if (!cl) return { error: "Not allowed" };

  const taskKeyRaw = String(formData.get("task_key") ?? "").trim();
  const task_key = taskKeyRaw ? normalizeTaskKey(taskKeyRaw) : null;

  const sectionTitleRaw = String(formData.get("section_title") ?? "").trim();
  const section_title = sectionTitleRaw || null;
  const durRaw = String(formData.get("duration_estimate_minutes") ?? "").trim();
  const duration_estimate_minutes = durRaw ? parseInt(durRaw, 10) : null;
  const durationOk =
    duration_estimate_minutes != null && !Number.isNaN(duration_estimate_minutes) && duration_estimate_minutes >= 0
      ? duration_estimate_minutes
      : null;

  const u = await supabase
    .from("checklist_items")
    .update({
      task_text: taskText,
      task_key,
      requires_photo: String(formData.get("requires_photo") ?? "") === "true",
      section_title,
      duration_estimate_minutes: durationOk,
    })
    .eq("id", itemId);
  if (u.error) return { error: u.error.message };
  revalidatePath(`/app/checklists/templates/${item.checklist_id}`);
  revalidatePath(`/app/checklists/${item.checklist_id}`);
  return { ok: true };
}

export async function deleteChecklistItem(itemId: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const { data: item } = await supabase.from("checklist_items").select("checklist_id").eq("id", itemId).single();
  if (!item) return { error: "Item not found" };
  const { data: cl } = await supabase
    .from("checklists")
    .select("id")
    .eq("id", item.checklist_id as string)
    .eq("organization_id", orgId)
    .single();
  if (!cl) return { error: "Not allowed" };

  const d = await supabase.from("checklist_items").delete().eq("id", itemId);
  if (d.error) return { error: d.error.message };
  revalidatePath(`/app/checklists/templates/${item.checklist_id}`);
  revalidatePath(`/app/checklists/${item.checklist_id}`);
  return { ok: true };
}

export async function reorderChecklistItems(checklistId: string, orderedItemIds: string[]) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const { data: cl } = await supabase
    .from("checklists")
    .select("id")
    .eq("id", checklistId)
    .eq("organization_id", orgId)
    .single();
  if (!cl) return { error: "Checklist not found" };

  for (let i = 0; i < orderedItemIds.length; i += 1) {
    const id = orderedItemIds[i];
    const u = await supabase.from("checklist_items").update({ sort_order: i }).eq("id", id).eq("checklist_id", checklistId);
    if (u.error) return { error: u.error.message };
  }
  revalidatePath(`/app/checklists/templates/${checklistId}`);
  revalidatePath(`/app/checklists/${checklistId}`);
  return { ok: true };
}

export async function deleteChecklist(id: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const d = await supabase.from("checklists").delete().eq("id", id).eq("organization_id", orgId);
  if (d.error) return { error: d.error.message };
  revalidatePath("/app/checklists");
  return { ok: true };
}

export async function deleteChecklistForm(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing id" };
  return deleteChecklist(id);
}

/** Form `action` compatibility (must return void). */
export async function upsertChecklistFormAction(formData: FormData): Promise<void> {
  await upsertChecklist(formData);
}

export async function deleteChecklistFormAction(formData: FormData): Promise<void> {
  await deleteChecklistForm(formData);
}

