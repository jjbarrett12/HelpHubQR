/**
 * Deterministic normalization for task text → preference / ledger keys.
 * Keep in sync with SQL public.hh_normalize_task_key().
 *
 * Note: materially different wording still produces different keys; managers can set an explicit
 * task_key on checklist items to align prefs and ledger with intent.
 */
export function normalizeTaskKey(raw: string | null | undefined): string {
  const s = (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s.length > 0 ? s : "unnamed_task";
}

/** Prefer explicit snapshot key (normalized); otherwise normalize task text. */
export function ledgerTaskKeyFromSnapshots(
  taskKeySnapshot: string | null | undefined,
  taskTextSnapshot: string | null | undefined
): string {
  if (typeof taskKeySnapshot === "string" && taskKeySnapshot.trim().length > 0) {
    return normalizeTaskKey(taskKeySnapshot.trim());
  }
  return normalizeTaskKey(taskTextSnapshot ?? undefined);
}
