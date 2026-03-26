import type { SupabaseClient } from "@supabase/supabase-js";
import { ledgerTaskKeyFromSnapshots, normalizeTaskKey } from "@/lib/helphub/fairness/task-key";
import type { TaxonomyRow } from "./suggestions";

const RUN_SAMPLE_CAP = 2500;
const IN_CHUNK = 400;

export type SimilarTextDifferentKeysCluster = {
  /** Normalized fingerprint from task wording. */
  textFingerprint: string;
  /** Distinct explicit keys (normalized) in this cluster. */
  keys: string[];
  /** Example line shown in UI. */
  sampleTaskText: string;
  itemCount: number;
};

export type TaskKeyManagerInsights = {
  uncategorizedChecklistItemCount: number;
  /** Explicit task_key set but no matching active taxonomy row. */
  checklistItemsKeyWithoutTaxonomyLabel: number;
  similarTextDifferentKeyClusters: SimilarTextDifferentKeysCluster[];
  /** preference_key counts for avoided / repeated undesirable signals. */
  topUndesirableTaskKeys: Array<{ key: string; count: number }>;
  /** Raw preference_key frequency in ledger (assignment-related rows). */
  mostCommonLedgerTaskKeys: Array<{ key: string; count: number }>;
  reassignmentEvents: { templateTask: number; overrideTask: number };
  lookbackDays: number;
};

function countMapTop(m: Map<string, number>, limit: number): Array<{ key: string; count: number }> {
  return [...m.entries()]
    .filter(([k]) => k.length > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

/**
 * Aggregates normalized task_key_snapshot counts from run items (sample of recent runs if very large).
 */
export async function aggregateRunSnapshotKeyCounts(
  supabase: SupabaseClient,
  organizationId: string
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const { data: runs, error: rErr } = await supabase
    .from("shift_checklist_runs")
    .select("id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(RUN_SAMPLE_CAP);
  if (rErr || !runs?.length) return out;

  const runIds = runs.map((r) => r.id as string);
  for (let i = 0; i < runIds.length; i += IN_CHUNK) {
    const chunk = runIds.slice(i, i + IN_CHUNK);
    const { data: rows, error } = await supabase
      .from("shift_checklist_run_items")
      .select("task_key_snapshot, task_text_snapshot")
      .in("shift_checklist_run_id", chunk);
    if (error) continue;
    for (const row of rows ?? []) {
      const r = row as { task_key_snapshot: string | null; task_text_snapshot: string | null };
      const k = ledgerTaskKeyFromSnapshots(r.task_key_snapshot, r.task_text_snapshot);
      if (!k || k === "unnamed_task") continue;
      out.set(k, (out.get(k) ?? 0) + 1);
    }
  }
  return out;
}

export async function fetchTaskKeyManagerInsights(
  supabase: SupabaseClient,
  organizationId: string,
  options?: { lookbackDays?: number }
): Promise<TaskKeyManagerInsights> {
  const lookbackDays = options?.lookbackDays ?? 30;
  const sinceIso = new Date(Date.now() - lookbackDays * 864e5).toISOString();

  const [{ data: taxRows }, { data: itemRows, error: itemErr }] = await Promise.all([
    supabase
      .from("task_taxonomy")
      .select("task_key, is_active")
      .eq("organization_id", organizationId),
    supabase
      .from("checklist_items")
      .select("task_text, task_key, checklists!inner(organization_id)")
      .eq("checklists.organization_id", organizationId),
  ]);

  if (itemErr) {
    return {
      uncategorizedChecklistItemCount: 0,
      checklistItemsKeyWithoutTaxonomyLabel: 0,
      similarTextDifferentKeyClusters: [],
      topUndesirableTaskKeys: [],
      mostCommonLedgerTaskKeys: [],
      reassignmentEvents: { templateTask: 0, overrideTask: 0 },
      lookbackDays,
    };
  }

  const activeTaxonomyNorm = new Set<string>();
  for (const t of taxRows ?? []) {
    const tr = t as { task_key: string; is_active: boolean | null };
    if (tr.is_active === false) continue;
    activeTaxonomyNorm.add(normalizeTaskKey(tr.task_key));
  }

  const items = (itemRows ?? []) as {
    task_text: string;
    task_key: string | null;
  }[];

  let uncategorized = 0;
  let keyWithoutTax = 0;
  for (const it of items) {
    if (!it.task_key?.trim()) uncategorized += 1;
    else if (!activeTaxonomyNorm.has(normalizeTaskKey(it.task_key))) keyWithoutTax += 1;
  }

  const byTextPrint = new Map<
    string,
    { keys: Set<string>; sample: string; itemCount: number }
  >();
  for (const it of items) {
    const fp = normalizeTaskKey(it.task_text);
    if (!fp || fp === "unnamed_task") continue;
    let g = byTextPrint.get(fp);
    if (!g) {
      g = { keys: new Set<string>(), sample: it.task_text, itemCount: 0 };
      byTextPrint.set(fp, g);
    }
    g.itemCount += 1;
    const ex = it.task_key?.trim();
    if (ex) g.keys.add(normalizeTaskKey(ex));
  }

  const similarClusters: SimilarTextDifferentKeysCluster[] = [];
  for (const [textFingerprint, g] of byTextPrint) {
    if (g.keys.size <= 1) continue;
    similarClusters.push({
      textFingerprint,
      keys: [...g.keys].sort(),
      sampleTaskText: g.sample,
      itemCount: g.itemCount,
    });
  }
  similarClusters.sort((a, b) => b.keys.length - a.keys.length || b.itemCount - a.itemCount);

  const { data: ledgerRows } = await supabase
    .from("fairness_assignment_ledger")
    .select("preference_key, event_type")
    .eq("organization_id", organizationId)
    .gte("created_at", sinceIso);

  const undesirable = new Map<string, number>();
  const commonKeys = new Map<string, number>();
  const undesirableTypes = new Set(["avoided_task_assigned", "undesirable_task_repeated"]);

  for (const row of ledgerRows ?? []) {
    const r = row as { preference_key: string | null; event_type: string };
    const pk = r.preference_key?.trim();
    if (!pk) continue;
    const nk = normalizeTaskKey(pk);
    commonKeys.set(nk, (commonKeys.get(nk) ?? 0) + 1);
    if (undesirableTypes.has(r.event_type)) {
      undesirable.set(nk, (undesirable.get(nk) ?? 0) + 1);
    }
  }

  const { data: wfRows } = await supabase
    .from("workforce_event_log")
    .select("event_type")
    .eq("organization_id", organizationId)
    .gte("created_at", sinceIso)
    .in("event_type", ["task_reassigned", "override_task_reassigned"]);

  let templateTask = 0;
  let overrideTask = 0;
  for (const row of wfRows ?? []) {
    const t = (row as { event_type: string }).event_type;
    if (t === "task_reassigned") templateTask += 1;
    else if (t === "override_task_reassigned") overrideTask += 1;
  }

  return {
    uncategorizedChecklistItemCount: uncategorized,
    checklistItemsKeyWithoutTaxonomyLabel: keyWithoutTax,
    similarTextDifferentKeyClusters: similarClusters.slice(0, 12),
    topUndesirableTaskKeys: countMapTop(undesirable, 8),
    mostCommonLedgerTaskKeys: countMapTop(commonKeys, 8),
    reassignmentEvents: { templateTask, overrideTask },
    lookbackDays,
  };
}

/** For taxonomy rows: checklist template usage + sampled run snapshot usage. */
export async function fetchTaxonomyUsageByKey(
  supabase: SupabaseClient,
  organizationId: string,
  taxonomy: TaxonomyRow[]
): Promise<Map<string, { checklistItems: number; runSnapshots: number }>> {
  const out = new Map<string, { checklistItems: number; runSnapshots: number }>();
  for (const t of taxonomy) {
    const nk = normalizeTaskKey(t.task_key);
    out.set(nk, { checklistItems: 0, runSnapshots: 0 });
  }

  const { data: cls } = await supabase.from("checklists").select("id").eq("organization_id", organizationId);
  const checklistIds = (cls ?? []).map((r) => r.id as string);
  if (checklistIds.length > 0) {
    const { data: items } = await supabase.from("checklist_items").select("task_key").in("checklist_id", checklistIds);
    for (const row of items ?? []) {
      const tk = (row as { task_key?: string | null }).task_key;
      if (!tk?.trim()) continue;
      const nk = normalizeTaskKey(tk);
      const cur = out.get(nk);
      if (cur) cur.checklistItems += 1;
    }
  }

  const runCounts = await aggregateRunSnapshotKeyCounts(supabase, organizationId);
  for (const [k, cnt] of runCounts) {
    const cur = out.get(k);
    if (cur) cur.runSnapshots += cnt;
  }

  return out;
}
