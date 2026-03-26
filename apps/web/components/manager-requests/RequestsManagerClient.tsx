"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RequestsSummaryBar } from "./RequestsSummaryBar";
import { RequestsFilterBar, type InboxStatusFilter } from "./RequestsFilterBar";
import { RequestInboxList } from "./RequestInboxList";
import { RequestDetailPanel } from "./RequestDetailPanel";
import type { ManagerRequestDetail, RequestKind, RequestUrgency } from "./mock-data";
import { Button } from "@/components/ui/button";
import { approveRequestFromFeed, denyRequestFromFeed } from "@/app/app/helphub/actions/workforce";

function matchesSearch(r: ManagerRequestDetail, q: string): boolean {
  if (!q.trim()) return true;
  const n = q.toLowerCase();
  return (
    r.title.toLowerCase().includes(n) ||
    r.employeeName.toLowerCase().includes(n) ||
    r.contextLine.toLowerCase().includes(n) ||
    (r.reason?.toLowerCase().includes(n) ?? false) ||
    r.impactSummary.toLowerCase().includes(n)
  );
}

export function RequestsManagerClient({
  organizationLabel,
  requests,
  loadError,
  isManagerRole,
}: {
  organizationLabel: string;
  requests: ManagerRequestDetail[];
  loadError?: string;
  /** When false, RLS may return only rows the user participates in (same feed shape). */
  isManagerRole: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<RequestKind | "all">("all");
  const [statusFilter, setStatusFilter] = useState<InboxStatusFilter>("all_open");
  const [urgencyFilter, setUrgencyFilter] = useState<"all" | RequestUrgency>("all");
  const [search, setSearch] = useState("");

  const defaultSelect = useMemo(() => {
    const action = requests.find((r) => r.needsManagerAction && r.status === "pending_manager");
    return action?.id ?? requests[0]?.id ?? null;
  }, [requests]);

  useEffect(() => {
    if (selectedId === null && defaultSelect) setSelectedId(defaultSelect);
  }, [defaultSelect, selectedId]);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (kindFilter !== "all" && r.kind !== kindFilter) return false;
      if (urgencyFilter !== "all" && r.urgency !== urgencyFilter) return false;
      if (statusFilter === "all_open") {
        if (
          r.status !== "pending_manager" &&
          r.status !== "pending_peer" &&
          r.status !== "pending_employee"
        )
          return false;
      } else if (statusFilter !== "all") {
        if (r.status !== statusFilter) return false;
      }
      if (!matchesSearch(r, search)) return false;
      return true;
    });
  }, [requests, kindFilter, urgencyFilter, statusFilter, search]);

  useEffect(() => {
    if (selectedId && !filtered.some((r) => r.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId]);

  const detail = useMemo(() => {
    if (!selectedId) return null;
    return requests.find((r) => r.id === selectedId) ?? null;
  }, [requests, selectedId]);

  const router = useRouter();
  const [decisionPending, startDecision] = useTransition();
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [mockFeedback, setMockFeedback] = useState<string | null>(null);

  const runApprove = useCallback(
    (notes: string) => {
      const d = detail;
      if (!d?.sourceTable || !d?.sourceId) return;
      setDecisionError(null);
      startDecision(async () => {
        const res = await approveRequestFromFeed({
          sourceTable: d.sourceTable,
          sourceId: d.sourceId,
          notes: notes.trim() || undefined,
        });
        if ("error" in res && res.error) {
          setDecisionError(res.error);
          return;
        }
        router.refresh();
      });
    },
    [detail, router]
  );

  const runDeny = useCallback(
    (notes: string) => {
      const d = detail;
      if (!d?.sourceTable || !d?.sourceId) return;
      setDecisionError(null);
      startDecision(async () => {
        const res = await denyRequestFromFeed({
          sourceTable: d.sourceTable,
          sourceId: d.sourceId,
          notes: notes.trim() || undefined,
        });
        if ("error" in res && res.error) {
          setDecisionError(res.error);
          return;
        }
        router.refresh();
      });
    },
    [detail, router]
  );

  const onPlaceholderAction = useCallback(
    (action: string, notes: string) => {
      if (!selectedId) return;
      const tail = notes.trim() ? ` · Notes: ${notes.slice(0, 80)}${notes.length > 80 ? "…" : ""}` : "";
      setMockFeedback(`[Mock] ${action} on request ${selectedId}${tail}`);
      window.setTimeout(() => setMockFeedback(null), 4000);
    },
    [selectedId]
  );

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-border/60 bg-[var(--app-bg)]/90 backdrop-blur-md px-4 py-4 md:px-6 lg:px-8">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Operations</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Requests & approvals</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              One inbox for workforce asks — {organizationLabel}. Data from{" "}
              <code className="text-xs">hh_manager_requests_feed</code> (historical) /{" "}
              <code className="text-xs">hh_request_feed</code>.
              {!isManagerRole ? (
                <span className="block mt-1 text-amber-700 dark:text-amber-400">
                  Your account is not owner/manager/admin — you only see requests you participate in (same as RLS on
                  source tables).
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/shift-ops">Shift operations</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/app/my-requests">Employee view</Link>
            </Button>
          </div>
        </div>
      </header>

      {loadError ? (
        <div className="mx-4 md:mx-6 mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-foreground">
          Could not load requests: {loadError}. Apply latest Supabase migrations if the normalized view is missing.
        </div>
      ) : null}

      {mockFeedback ? (
        <div className="mx-4 md:mx-6 mt-3 rounded-md border border-border/60 bg-muted/50 px-3 py-2 text-xs text-foreground">
          {mockFeedback}
        </div>
      ) : null}

      <RequestsSummaryBar requests={requests} onFilterKind={setKindFilter} activeKind={kindFilter} />

      <RequestsFilterBar
        search={search}
        onSearch={setSearch}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        urgencyFilter={urgencyFilter}
        onUrgencyFilter={setUrgencyFilter}
        kindFilter={kindFilter}
        onClearKind={() => setKindFilter("all")}
      />

      <div className="flex-1 grid gap-4 p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:gap-6 lg:items-start">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing <span className="font-medium text-foreground tabular-nums">{filtered.length}</span> of{" "}
              <span className="tabular-nums">{requests.length}</span>
            </span>
          </div>
          <RequestInboxList requests={filtered} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <div className="min-w-0 lg:sticky lg:top-4">
          <RequestDetailPanel
            detail={detail}
            decisionPending={decisionPending}
            canDecideAsManager={isManagerRole}
            onApprove={runApprove}
            onDeny={runDeny}
            onPlaceholderAction={onPlaceholderAction}
          />
        </div>
      </div>
    </div>
  );
}
