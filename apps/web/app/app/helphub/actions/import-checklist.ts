"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { z } from "zod";
import { requireOrgContext } from "@/lib/helphub/require-org";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { processImportDocument } from "@/lib/import/process-import-document";
import { normalizeTaskKey } from "@/lib/helphub/fairness/task-key";
import type { ShiftType } from "@/lib/helphub/types";

const BUCKET = "checklist-imports";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

function safeBaseName(name: string): string {
  const trimmed = name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^\.+/, "").slice(0, 120);
  return trimmed || "image.jpg";
}

export async function uploadAndProcessChecklistImport(formData: FormData): Promise<
  { ok: true; documentId: string } | { error: string }
> {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;

  const file = formData.get("file");
  if (!file || typeof file === "string" || !("arrayBuffer" in file)) {
    return { error: "Choose an image file to upload." };
  }

  const f = file as File;
  if (f.size > MAX_BYTES) {
    return { error: "File is too large (max 10 MB)." };
  }
  const mime = f.type || "image/jpeg";
  if (!ALLOWED.has(mime)) {
    return { error: "Use JPEG, PNG, or WebP only." };
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Storage not configured" };
  }

  const documentId = randomUUID();
  const path = `${orgId}/${documentId}/${safeBaseName(f.name)}`;

  const buffer = Buffer.from(await f.arrayBuffer());
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: mime,
    upsert: false,
  });
  if (upErr) {
    return { error: upErr.message };
  }

  const { error: insErr } = await supabase.from("imported_documents").insert({
    id: documentId,
    organization_id: orgId,
    uploaded_by_user_id: user.id,
    storage_path: path,
    original_filename: f.name,
    mime_type: mime,
    status: "uploaded",
  });

  if (insErr) {
    await admin.storage.from(BUCKET).remove([path]);
    return { error: insErr.message };
  }

  await processImportDocument(supabase, documentId, orgId);
  revalidatePath(`/app/checklists/import/${documentId}`);
  revalidatePath("/app/checklists/import");
  return { ok: true, documentId };
}

export async function runChecklistImportProcessing(
  documentId: string,
  options?: { force?: boolean }
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const res = await processImportDocument(supabase, documentId, orgId, { force: options?.force });
  if (!res.ok) return { error: res.error };
  revalidatePath(`/app/checklists/import/${documentId}`);
  return { ok: true };
}

export async function updateImportReviewMeta(
  documentId: string,
  checklistName: string,
  shiftType: string | null
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const name = checklistName.trim();
  if (!name) return { error: "Name is required" };

  const st = shiftType && ["open", "mid", "close", "custom"].includes(shiftType) ? shiftType : null;

  const { error } = await supabase
    .from("imported_documents")
    .update({ review_checklist_name: name, review_shift_type: st })
    .eq("id", documentId)
    .eq("organization_id", orgId);

  if (error) return { error: error.message };
  revalidatePath(`/app/checklists/import/${documentId}`);
  return { ok: true };
}

const replaceTasksSchema = z
  .array(
    z.object({
      task_text: z.string().min(1).max(2000),
      is_selected: z.boolean(),
      task_key: z.string().max(500).optional().nullable(),
    })
  )
  .max(500);

export async function replaceImportTasks(
  documentId: string,
  tasks: z.infer<typeof replaceTasksSchema>
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const parsed = replaceTasksSchema.safeParse(tasks);
  if (!parsed.success) return { error: "Invalid tasks payload" };

  const { data: doc } = await supabase
    .from("imported_documents")
    .select("id, status")
    .eq("id", documentId)
    .eq("organization_id", orgId)
    .single();
  if (!doc || doc.status !== "review") {
    return { error: "Import is not editable in this state." };
  }

  const { error: delErr } = await supabase.from("imported_document_tasks").delete().eq("imported_document_id", documentId);
  if (delErr) return { error: delErr.message };

  if (parsed.data.length === 0) {
    revalidatePath(`/app/checklists/import/${documentId}`);
    return { ok: true };
  }

  const rows = parsed.data.map((t, i) => ({
    imported_document_id: documentId,
    task_text: t.task_text,
    task_key: t.task_key?.trim() ? normalizeTaskKey(t.task_key) : null,
    sort_order: i,
    is_selected: t.is_selected,
  }));

  const { error: insErr } = await supabase.from("imported_document_tasks").insert(rows);
  if (insErr) return { error: insErr.message };
  revalidatePath(`/app/checklists/import/${documentId}`);
  return { ok: true };
}

const SHIFT_TYPES: ShiftType[] = ["open", "mid", "close", "custom"];

export async function commitImportToChecklist(formData: FormData): Promise<
  { ok: true; checklistId: string } | { error: string }
> {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const documentId = String(formData.get("document_id") ?? "").trim();
  const staffRoleId = String(formData.get("staff_role_id") ?? "").trim();
  const shiftRaw = String(formData.get("shift_type") ?? "").trim();
  const name = String(formData.get("checklist_name") ?? "").trim();
  const locationIdRaw = String(formData.get("location_id") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!documentId || !staffRoleId || !name) {
    return { error: "Checklist name and role are required." };
  }

  const shiftType = SHIFT_TYPES.includes(shiftRaw as ShiftType) ? (shiftRaw as ShiftType) : null;
  if (!shiftType) return { error: "Pick a shift type." };

  const { data: doc } = await supabase
    .from("imported_documents")
    .select("id, status")
    .eq("id", documentId)
    .eq("organization_id", orgId)
    .single();
  if (!doc || doc.status !== "review") {
    return { error: "This import cannot be saved (wrong status)." };
  }

  const { data: tasks, error: taskErr } = await supabase
    .from("imported_document_tasks")
    .select("task_text, task_key, sort_order, is_selected")
    .eq("imported_document_id", documentId)
    .order("sort_order", { ascending: true });
  if (taskErr) return { error: taskErr.message };

  const selected = (tasks ?? []).filter((t) => t.is_selected);
  if (selected.length === 0) {
    return { error: "Select at least one task." };
  }

  const locationId = locationIdRaw ? locationIdRaw : null;

  const { data: checklist, error: clErr } = await supabase
    .from("checklists")
    .insert({
      organization_id: orgId,
      staff_role_id: staffRoleId,
      shift_type: shiftType,
      location_id: locationId,
      name,
      description,
      is_active: true,
    })
    .select("id")
    .single();
  if (clErr || !checklist) return { error: clErr?.message ?? "Failed to create checklist" };

  const checklistId = checklist.id as string;
  const items = selected.map((t, i) => {
    const row = t as { task_text: string; task_key?: string | null };
    const tk = row.task_key?.trim() ? normalizeTaskKey(row.task_key) : null;
    return {
      checklist_id: checklistId,
      task_text: row.task_text,
      task_key: tk,
      sort_order: i,
      requires_photo: false,
    };
  });

  const { error: itemsErr } = await supabase.from("checklist_items").insert(items);
  if (itemsErr) {
    await supabase.from("checklists").delete().eq("id", checklistId);
    return { error: itemsErr.message };
  }

  const { error: doneErr } = await supabase
    .from("imported_documents")
    .update({ status: "completed" })
    .eq("id", documentId)
    .eq("organization_id", orgId);
  if (doneErr) return { error: doneErr.message };

  revalidatePath("/app/checklists");
  revalidatePath(`/app/checklists/import/${documentId}`);
  revalidatePath(`/app/checklists/templates/${checklistId}`);
  revalidatePath(`/app/checklists/${checklistId}`);
  return { ok: true, checklistId };
}

export async function getImportSourceSignedUrl(
  documentId: string
): Promise<{ url: string } | { error: string }> {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const { data: doc } = await supabase
    .from("imported_documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("organization_id", orgId)
    .single();
  if (!doc) return { error: "Not found" };

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Storage not configured" };
  }

  const { data: signed, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path as string, 600);

  if (error || !signed?.signedUrl) return { error: error?.message ?? "Could not sign URL" };
  return { url: signed.signedUrl };
}
