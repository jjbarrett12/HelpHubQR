import { getBestTaskKeySuggestion, type TaxonomyRow } from "./suggestions";

/** Deterministic suggested keys per checklist item id (for editors and server previews). */
export function getTaskKeySuggestionsForChecklist(
  items: { id: string; task_text: string }[],
  taxonomy: TaxonomyRow[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const it of items) {
    out[it.id] = getBestTaskKeySuggestion(it.task_text, taxonomy);
  }
  return out;
}
