"use client";

import { RequestInboxRow } from "./RequestInboxRow";
import type { ManagerRequestListItem } from "./mock-data";

export function RequestInboxList({
  requests,
  selectedId,
  onSelect,
}: {
  requests: ManagerRequestListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 py-16 px-4 text-center">
        <p className="text-sm font-medium text-foreground">Nothing matches</p>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
          Widen filters or clear search. When Supabase is wired, new items appear here as employees submit.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2" role="list">
      {requests.map((r) => (
        <li key={r.id}>
          <RequestInboxRow request={r} selected={selectedId === r.id} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  );
}
