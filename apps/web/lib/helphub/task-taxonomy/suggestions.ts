import { normalizeTaskKey } from "@/lib/helphub/fairness/task-key";

export type TaxonomyRow = {
  task_key: string;
  display_label: string;
  is_active?: boolean | null;
};

/** Effective ledger / preference key: explicit normalized key, else normalized task text. */
export function resolveCanonicalTaskKey(
  explicitTaskKey: string | null | undefined,
  taskText: string | null | undefined
): string {
  const ex = explicitTaskKey?.trim();
  if (ex) return normalizeTaskKey(ex);
  return normalizeTaskKey(taskText ?? "");
}

function taxonomyMatchScore(nText: string, taskKeyNorm: string, labelNorm: string): number {
  if (!nText || nText === "unnamed_task") return 0;
  if (taskKeyNorm && taskKeyNorm === nText) return 1000;
  if (labelNorm && labelNorm === nText) return 950;

  const textTokens = new Set(nText.split("_").filter((x) => x.length >= 3));
  let score = 0;
  if (taskKeyNorm.length >= 4) {
    if (nText.includes(taskKeyNorm) || taskKeyNorm.includes(nText)) score += 80;
    for (const w of taskKeyNorm.split("_")) {
      if (w.length >= 3 && textTokens.has(w)) score += 12;
    }
  }
  if (labelNorm.length >= 3) {
    if (nText.includes(labelNorm) || labelNorm.includes(nText)) score += 50;
    for (const w of labelNorm.split("_")) {
      if (w.length >= 3 && textTokens.has(w)) score += 8;
    }
  }
  if (score > 0) score += Math.min(taskKeyNorm.length, 40);
  return score;
}

/**
 * Deterministic suggestion: strongest taxonomy match (exact → label → token / substring overlap), else normalize(task text).
 */
export function getBestTaskKeySuggestion(taskText: string, taxonomy: TaxonomyRow[]): string {
  const active = taxonomy.filter((t) => t.is_active !== false);
  const nText = normalizeTaskKey(taskText);
  if (!nText || nText === "unnamed_task") return nText;

  let best: { key: string; score: number } | null = null;
  for (const t of active) {
    const nk = normalizeTaskKey(t.task_key);
    const nl = normalizeTaskKey(t.display_label);
    const s = taxonomyMatchScore(nText, nk, nl);
    if (s > 0 && (!best || s > best.score || (s === best.score && nk.localeCompare(best.key) < 0))) {
      best = { key: nk, score: s };
    }
  }
  if (best && best.score >= 8) return best.key;

  return nText;
}

export function taxonomyLabelForKey(taskKey: string, taxonomy: TaxonomyRow[]): string | null {
  const nk = normalizeTaskKey(taskKey);
  const active = taxonomy.find((t) => normalizeTaskKey(t.task_key) === nk && t.is_active !== false);
  if (active) return active.display_label;
  const archived = taxonomy.find((t) => normalizeTaskKey(t.task_key) === nk);
  return archived?.display_label ?? null;
}

export function getTaskKeyDisplayLabel(taskKey: string, taxonomy: TaxonomyRow[]): string {
  return taxonomyLabelForKey(taskKey, taxonomy) ?? taskKey;
}

export { normalizeTaskKey } from "@/lib/helphub/fairness/task-key";
