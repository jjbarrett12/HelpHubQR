import type { SupabaseClient } from "@supabase/supabase-js";

export type RequestFeedDecisionNoteRow = {
  related_request_id: string;
  created_at: string;
  decision: string;
  notes: string;
};

/**
 * Latest `request_feed_decision_note` per workforce source row (`related_request_id` = `source_id`).
 */
export async function fetchLatestRequestFeedDecisionNotesBySourceIds(
  supabase: SupabaseClient,
  organizationId: string,
  sourceIds: string[]
): Promise<Record<string, RequestFeedDecisionNoteRow>> {
  const unique = [...new Set(sourceIds.filter(Boolean))];
  if (unique.length === 0) return {};

  const { data, error } = await supabase
    .from("workforce_event_log")
    .select("related_request_id, payload, created_at")
    .eq("organization_id", organizationId)
    .eq("event_type", "request_feed_decision_note")
    .in("related_request_id", unique)
    .order("created_at", { ascending: false });

  if (error || !data) return {};

  const out: Record<string, RequestFeedDecisionNoteRow> = {};
  for (const row of data) {
    const rid = row.related_request_id as string | null;
    if (!rid || out[rid]) continue;
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const decision = typeof payload.decision === "string" ? payload.decision : "";
    const notes = typeof payload.notes === "string" ? payload.notes : "";
    out[rid] = {
      related_request_id: rid,
      created_at: row.created_at as string,
      decision,
      notes,
    };
  }
  return out;
}

/**
 * All decision notes for manager detail history (newest first).
 */
/** All decision notes for many sources (newest first per row block in result arrays). */
export async function fetchAllRequestFeedDecisionNotesBySourceIds(
  supabase: SupabaseClient,
  organizationId: string,
  sourceIds: string[]
): Promise<Record<string, RequestFeedDecisionNoteRow[]>> {
  const unique = [...new Set(sourceIds.filter(Boolean))];
  if (unique.length === 0) return {};

  const { data, error } = await supabase
    .from("workforce_event_log")
    .select("related_request_id, payload, created_at")
    .eq("organization_id", organizationId)
    .eq("event_type", "request_feed_decision_note")
    .in("related_request_id", unique)
    .order("created_at", { ascending: false });

  if (error || !data) return {};

  const by: Record<string, RequestFeedDecisionNoteRow[]> = {};
  for (const row of data) {
    const rid = row.related_request_id as string | null;
    if (!rid) continue;
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const entry: RequestFeedDecisionNoteRow = {
      related_request_id: rid,
      created_at: row.created_at as string,
      decision: typeof payload.decision === "string" ? payload.decision : "",
      notes: typeof payload.notes === "string" ? payload.notes : "",
    };
    if (!by[rid]) by[rid] = [];
    by[rid].push(entry);
  }
  return by;
}

export async function fetchRequestFeedDecisionNotesHistory(
  supabase: SupabaseClient,
  organizationId: string,
  sourceId: string
): Promise<RequestFeedDecisionNoteRow[]> {
  const { data, error } = await supabase
    .from("workforce_event_log")
    .select("related_request_id, payload, created_at")
    .eq("organization_id", organizationId)
    .eq("event_type", "request_feed_decision_note")
    .eq("related_request_id", sourceId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    return {
      related_request_id: row.related_request_id as string,
      created_at: row.created_at as string,
      decision: typeof payload.decision === "string" ? payload.decision : "",
      notes: typeof payload.notes === "string" ? payload.notes : "",
    };
  });
}
