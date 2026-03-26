import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ManagerRequestDetail } from "@/components/manager-requests/mock-data";
import { fetchManagerRequestFeed } from "@/lib/helphub/requests/fetch-request-feeds";
import { mapRequestFeedItemToManagerDetail } from "@/lib/helphub/requests/map-request-feed-to-manager-detail";
import { fetchAllRequestFeedDecisionNotesBySourceIds } from "@/lib/helphub/requests/fetch-request-feed-decision-notes";

export async function loadManagerRequestsInbox(
  supabase: SupabaseClient,
  organizationId: string,
  options?: { includeHistorical?: boolean }
): Promise<{ requests: ManagerRequestDetail[]; error?: string }> {
  const { items, error } = await fetchManagerRequestFeed(supabase, organizationId, {
    includeHistorical: options?.includeHistorical ?? false,
    limit: 200,
  });
  if (error) {
    return { requests: [], error };
  }

  const notesBySource = await fetchAllRequestFeedDecisionNotesBySourceIds(
    supabase,
    organizationId,
    items.map((i) => i.source_id)
  );

  const requests = items.map((row) => {
    const base = mapRequestFeedItemToManagerDetail(row);
    const noteRows = notesBySource[row.source_id] ?? [];
    const extras = noteRows.map((n, i) => ({
      id: `decision-${row.source_id}-${i}`,
      at: n.created_at,
      actor: "Manager decision",
      summary: [n.decision ? `${n.decision}` : null, n.notes?.trim() ? n.notes.trim() : null]
        .filter(Boolean)
        .join(": "),
    }));
    const history = [...extras, ...base.history].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
    );
    return { ...base, history };
  });

  return { requests };
}
