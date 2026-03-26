import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { getBestTaskKeySuggestion, type TaxonomyRow } from "@/lib/helphub/task-taxonomy";
import { runOcrOnImage } from "./ocr/run";
import { OcrUnavailableError } from "./ocr/types";
import { normalizeChecklistFromOcrText } from "./normalize-checklist-from-text";

type ProcessOptions = {
  /** Re-run pipeline from storage even if already in review/completed. */
  force?: boolean;
};

export async function processImportDocument(
  supabase: SupabaseClient,
  documentId: string,
  organizationId: string,
  options?: ProcessOptions
): Promise<{ ok: true } | { ok: false; error: string }> {
  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Service role not configured" };
  }

  const { data: doc, error: fetchErr } = await supabase
    .from("imported_documents")
    .select("id, organization_id, status, storage_path, mime_type")
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .single();

  if (fetchErr || !doc) {
    return { ok: false, error: "Import record not found" };
  }

  const status = doc.status as string;

  if (status === "processing") {
    return { ok: false, error: "This import is already processing. Wait or retry later." };
  }

  if (options?.force) {
    await supabase.from("imported_document_tasks").delete().eq("imported_document_id", documentId);
    const { error: resetErr } = await supabase
      .from("imported_documents")
      .update({
        status: "uploaded",
        ocr_text: null,
        ai_result: null,
        error_message: null,
        ocr_confidence: null,
        ai_confidence: null,
        review_checklist_name: null,
        review_shift_type: null,
      })
      .eq("id", documentId);
    if (resetErr) return { ok: false, error: resetErr.message };
  } else if (status === "review" || status === "completed") {
    return { ok: false, error: "Import already processed. Use reprocess to run again." };
  }

  const { error: procErr } = await supabase
    .from("imported_documents")
    .update({ status: "processing", error_message: null })
    .eq("id", documentId);
  if (procErr) {
    return { ok: false, error: procErr.message };
  }

  try {
    const { data: file, error: dlErr } = await admin.storage.from("checklist-imports").download(doc.storage_path);
    if (dlErr || !file) {
      throw new Error(dlErr?.message ?? "Failed to download source file");
    }
    const buffer = Buffer.from(await file.arrayBuffer());

    const mimeType = (doc.mime_type as string) || "image/jpeg";
    const ocr = await runOcrOnImage(buffer, mimeType);

    const normalized = await normalizeChecklistFromOcrText(ocr.text);

    const { error: delTasksErr } = await supabase
      .from("imported_document_tasks")
      .delete()
      .eq("imported_document_id", documentId);
    if (delTasksErr) throw new Error(delTasksErr.message);

    const { data: taxRows } = await supabase
      .from("task_taxonomy")
      .select("task_key, display_label, is_active")
      .eq("organization_id", organizationId)
      .eq("is_active", true);
    const taxonomy = (taxRows ?? []) as TaxonomyRow[];

    const rows = normalized.tasks.map((t, i) => ({
      imported_document_id: documentId,
      task_text: t.task_text,
      task_key: getBestTaskKeySuggestion(t.task_text, taxonomy),
      sort_order: i,
      is_selected: true,
    }));

    const { error: insTasksErr } = await supabase.from("imported_document_tasks").insert(rows);
    if (insTasksErr) throw new Error(insTasksErr.message);

    const aiPayload = {
      ...normalized,
      notes: normalized.notes ?? null,
    };

    const { error: upDocErr } = await supabase
      .from("imported_documents")
      .update({
        status: "review",
        ocr_text: ocr.text,
        ai_result: aiPayload,
        ocr_confidence: ocr.confidence,
        ai_confidence: normalized.parse_confidence ?? null,
        review_checklist_name: normalized.checklist_name,
        review_shift_type: normalized.shift_type ?? null,
        error_message: null,
      })
      .eq("id", documentId);

    if (upDocErr) throw new Error(upDocErr.message);

    return { ok: true };
  } catch (e) {
    const message =
      e instanceof OcrUnavailableError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Import processing failed";

    await supabase
      .from("imported_documents")
      .update({ status: "failed", error_message: message })
      .eq("id", documentId);

    return { ok: false, error: message };
  }
}
