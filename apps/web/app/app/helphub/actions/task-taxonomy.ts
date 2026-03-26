"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext, userCanManageOrganization } from "@/lib/helphub/require-org";
import {
  fetchTaskKeyManagerInsights,
  fetchTaxonomyUsageByKey,
  getBestTaskKeySuggestion,
  normalizeTaskKey,
  type TaxonomyRow,
} from "@/lib/helphub/task-taxonomy";
import { getTaskKeySuggestionsForChecklist as buildTaskKeySuggestionMap } from "@/lib/helphub/task-taxonomy/checklist-keys";

export async function listTaskTaxonomy(options?: { includeInactive?: boolean }) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  let q = supabase
    .from("task_taxonomy")
    .select("id, task_key, display_label, description, is_active, created_at, updated_at")
    .eq("organization_id", orgId)
    .order("display_label", { ascending: true });
  if (!options?.includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q;
  if (error) return { error: error.message };
  return { rows: data ?? [] };
}

export async function listTaskTaxonomyWithUsageCounts() {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;

  const can = await userCanManageOrganization(supabase, user.id, orgId);
  if (!can) return { error: "Managers only" };

  const { data: taxRows, error: tErr } = await supabase
    .from("task_taxonomy")
    .select("id, task_key, display_label, description, is_active, created_at, updated_at")
    .eq("organization_id", orgId)
    .order("display_label", { ascending: true });
  if (tErr) return { error: tErr.message };

  const { data: cls, error: cErr } = await supabase.from("checklists").select("id").eq("organization_id", orgId);
  if (cErr) return { error: cErr.message };
  const checklistIds = (cls ?? []).map((r) => r.id as string);
  const { data: items, error: iErr } =
    checklistIds.length === 0
      ? { data: [] as { task_key?: string | null }[], error: null }
      : await supabase.from("checklist_items").select("task_key").in("checklist_id", checklistIds);
  if (iErr) return { error: iErr.message };

  const counts = new Map<string, number>();
  for (const row of items ?? []) {
    const tk = (row as { task_key?: string | null }).task_key;
    if (!tk?.trim()) continue;
    const nk = normalizeTaskKey(tk);
    counts.set(nk, (counts.get(nk) ?? 0) + 1);
  }

  const rows = (taxRows ?? []).map((r) => {
    const task_key = r.task_key as string;
    return {
      ...r,
      checklist_item_count: counts.get(normalizeTaskKey(task_key)) ?? 0,
    };
  });

  return { rows };
}

export async function createTaskTaxonomyEntry(input: {
  taskKeyRaw: string;
  displayLabel: string;
  description?: string | null;
}) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;

  const can = await userCanManageOrganization(supabase, user.id, orgId);
  if (!can) return { error: "Managers only" };

  const task_key = normalizeTaskKey(input.taskKeyRaw);
  const display_label = input.displayLabel.trim();
  if (!task_key || task_key === "unnamed_task") return { error: "Task key is required" };
  if (!display_label) return { error: "Display label is required" };

  const { error } = await supabase.from("task_taxonomy").insert({
    organization_id: orgId,
    task_key,
    display_label,
    description: input.description?.trim() || null,
    is_active: true,
  });
  if (error) return { error: error.message };
  revalidatePath("/app/task-taxonomy");
  revalidatePath("/app/checklists");
  return { ok: true };
}

export async function updateTaskTaxonomyEntry(
  id: string,
  patch: {
    displayLabel?: string;
    description?: string | null;
    taskKeyRaw?: string;
    isActive?: boolean;
  }
) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;

  const can = await userCanManageOrganization(supabase, user.id, orgId);
  if (!can) return { error: "Managers only" };

  const { data: row } = await supabase
    .from("task_taxonomy")
    .select("id, task_key")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!row) return { error: "Not found" };
  const currentKeyNorm = normalizeTaskKey((row as { task_key: string }).task_key);

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.displayLabel !== undefined) {
    const d = patch.displayLabel.trim();
    if (!d) return { error: "Display label required" };
    updates.display_label = d;
  }
  if (patch.description !== undefined) updates.description = patch.description?.trim() || null;
  if (patch.taskKeyRaw !== undefined) {
    const tk = normalizeTaskKey(patch.taskKeyRaw);
    if (!tk || tk === "unnamed_task") return { error: "Invalid task key" };
    if (tk !== currentKeyNorm) {
      const { data: prefHit } = await supabase
        .from("employee_task_preferences")
        .select("id")
        .eq("organization_id", orgId)
        .eq("preference_key", currentKeyNorm)
        .limit(1)
        .maybeSingle();
      if (prefHit) {
        return {
          error:
            "Cannot change this task key while employee preferences still reference the old key. Update preferences first or add a new taxonomy entry.",
        };
      }
      const { data: cls } = await supabase.from("checklists").select("id").eq("organization_id", orgId);
      const checklistIds = (cls ?? []).map((r) => r.id as string);
      if (checklistIds.length > 0) {
        const { data: items } = await supabase.from("checklist_items").select("task_key").in("checklist_id", checklistIds);
        const inUse = (items ?? []).some(
          (it) => (it as { task_key?: string | null }).task_key?.trim() && normalizeTaskKey((it as { task_key: string }).task_key) === currentKeyNorm
        );
        if (inUse) {
          return {
            error:
              "Cannot change this task key while checklist lines still use it. Update those task keys or add a new taxonomy entry instead.",
          };
        }
      }
    }
    updates.task_key = tk;
  }
  if (patch.isActive !== undefined) updates.is_active = patch.isActive;

  const { error } = await supabase.from("task_taxonomy").update(updates).eq("id", id).eq("organization_id", orgId);
  if (error) return { error: error.message };
  revalidatePath("/app/task-taxonomy");
  revalidatePath("/app/checklists");
  return { ok: true };
}

export async function archiveTaskTaxonomyEntry(id: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;

  const can = await userCanManageOrganization(supabase, user.id, orgId);
  if (!can) return { error: "Managers only" };

  const { error } = await supabase
    .from("task_taxonomy")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) return { error: error.message };
  revalidatePath("/app/task-taxonomy");
  return { ok: true };
}

export async function suggestTaskKey(taskText: string): Promise<{ key: string } | { error: string }> {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const { data: tax } = await supabase
    .from("task_taxonomy")
    .select("task_key, display_label, is_active")
    .eq("organization_id", orgId)
    .eq("is_active", true);

  const key = getBestTaskKeySuggestion(taskText, (tax ?? []) as TaxonomyRow[]);
  return { key };
}

export async function updateChecklistItemTaskKey(itemId: string, taskKeyRaw: string | null) {
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

  const trimmed = taskKeyRaw?.trim() ?? "";
  const task_key = trimmed ? normalizeTaskKey(trimmed) : null;

  const { error } = await supabase.from("checklist_items").update({ task_key }).eq("id", itemId);
  if (error) return { error: error.message };
  revalidatePath(`/app/checklists/templates/${item.checklist_id}`);
  revalidatePath(`/app/checklists/${item.checklist_id}`);
  return { ok: true };
}

export async function bulkApplySuggestedTaskKeysToChecklist(
  checklistId: string,
  mode: "empty_only" | "all" = "empty_only"
) {
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

  const { data: tax } = await supabase
    .from("task_taxonomy")
    .select("task_key, display_label, is_active")
    .eq("organization_id", orgId)
    .eq("is_active", true);

  const taxonomy = (tax ?? []) as TaxonomyRow[];

  const { data: items, error: iErr } = await supabase
    .from("checklist_items")
    .select("id, task_text, task_key")
    .eq("checklist_id", checklistId);
  if (iErr) return { error: iErr.message };

  let updated = 0;
  for (const it of items ?? []) {
    const row = it as { id: string; task_text: string; task_key: string | null };
    if (mode === "empty_only" && row.task_key?.trim()) continue;
    const suggested = getBestTaskKeySuggestion(row.task_text, taxonomy);
    if (!suggested || suggested === "unnamed_task") continue;
    const { error } = await supabase.from("checklist_items").update({ task_key: suggested }).eq("id", row.id);
    if (error) return { error: error.message };
    updated += 1;
  }

  revalidatePath(`/app/checklists/templates/${checklistId}`);
  revalidatePath(`/app/checklists/${checklistId}`);
  return { ok: true, updated };
}

/** Create a taxonomy row from task wording (manager import / cleanup). Keys are normalized. */
export async function createTaxonomyKeyFromTask(input: {
  taskText: string;
  displayLabel?: string | null;
  taskKeyRaw?: string | null;
  description?: string | null;
}) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;

  const can = await userCanManageOrganization(supabase, user.id, orgId);
  if (!can) return { error: "Managers only" };

  const text = input.taskText.trim();
  if (!text) return { error: "Task text is required" };

  const { data: taxRows } = await supabase
    .from("task_taxonomy")
    .select("task_key, display_label, is_active")
    .eq("organization_id", orgId)
    .eq("is_active", true);
  const taxonomy = (taxRows ?? []) as TaxonomyRow[];

  const rawKey = input.taskKeyRaw?.trim() || getBestTaskKeySuggestion(text, taxonomy);
  const task_key = normalizeTaskKey(rawKey);
  if (!task_key || task_key === "unnamed_task") return { error: "Could not derive task key" };

  const display_label = (input.displayLabel?.trim() || text).slice(0, 200);
  if (!display_label) return { error: "Display label required" };

  const { error } = await supabase.from("task_taxonomy").insert({
    organization_id: orgId,
    task_key,
    display_label,
    description: input.description?.trim() || null,
    is_active: true,
  });
  if (error) return { error: error.message };
  revalidatePath("/app/task-taxonomy");
  revalidatePath("/app/checklists");
  return { ok: true, task_key };
}

/** Manager-facing summary: uncategorized counts, clusters, ledger hints (see `fetchTaskKeyManagerInsights`). */
export async function getUncategorizedTaskSummary() {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const insights = await fetchTaskKeyManagerInsights(ctx.supabase, ctx.orgId);
  return { insights };
}

/** Suggested normalized keys per checklist item id (deterministic; uses active taxonomy). */
export async function getTaskKeySuggestionsForChecklist(checklistId: string) {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId } = ctx;

  const { data: cl } = await supabase
    .from("checklists")
    .select("id")
    .eq("id", checklistId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!cl) return { error: "Checklist not found" };

  const [{ data: items }, { data: tax }] = await Promise.all([
    supabase.from("checklist_items").select("id, task_text").eq("checklist_id", checklistId),
    supabase
      .from("task_taxonomy")
      .select("task_key, display_label, is_active")
      .eq("organization_id", orgId)
      .eq("is_active", true),
  ]);

  const suggestions = buildTaskKeySuggestionMap(
    (items ?? []) as { id: string; task_text: string }[],
    (tax ?? []) as TaxonomyRow[]
  );
  return { suggestions };
}

/** Checklist + sampled run snapshot counts per taxonomy key (normalized). */
export async function getTaskTaxonomyUsage() {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, orgId, user } = ctx;

  const can = await userCanManageOrganization(supabase, user.id, orgId);
  if (!can) return { error: "Managers only" };

  const { data: taxRows, error: tErr } = await supabase
    .from("task_taxonomy")
    .select("task_key, display_label, is_active")
    .eq("organization_id", orgId)
    .order("display_label", { ascending: true });
  if (tErr) return { error: tErr.message };

  const usage = await fetchTaxonomyUsageByKey(supabase, orgId, (taxRows ?? []) as TaxonomyRow[]);
  const rows = (taxRows ?? []).map((r) => {
    const tr = r as { task_key: string; display_label: string; is_active: boolean | null };
    const nk = normalizeTaskKey(tr.task_key);
    const u = usage.get(nk);
    return {
      task_key: tr.task_key,
      display_label: tr.display_label,
      is_active: tr.is_active !== false,
      checklist_item_count: u?.checklistItems ?? 0,
      run_snapshot_count: u?.runSnapshots ?? 0,
    };
  });
  return { rows };
}

export async function renameTaxonomyKeyLabel(id: string, displayLabel: string) {
  return updateTaskTaxonomyEntry(id, { displayLabel });
}

export async function archiveTaxonomyKey(id: string) {
  return archiveTaskTaxonomyEntry(id);
}
