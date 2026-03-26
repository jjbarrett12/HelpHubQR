"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

/**
 * Channel naming: `helphub:org:{organizationId}:{scope}`
 * — scope distinguishes multiple listeners in the same tab if needed.
 *
 * Subscribes only to operational tables; payloads are not applied to React state.
 * On any matching postgres_change → debounced `router.refresh()` to re-run server components.
 */
export function OperationalOrgRealtimeRefresh({
  organizationId,
  scope,
}: {
  organizationId: string;
  scope: "manager-dashboard" | "command-center";
}) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured() || !organizationId) return;

    const supabase = createClient();
    const topic = `helphub:org:${organizationId}:${scope}`;

    const scheduleRefresh = (_payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        router.refresh();
      }, 400);
    };

    const orgFilter = `organization_id=eq.${organizationId}`;

    const channel = supabase
      .channel(topic)
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_checklist_runs", filter: orgFilter }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_run_override_tasks", filter: orgFilter }, scheduleRefresh)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shift_checklist_run_item_escalations", filter: orgFilter },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shift_run_override_task_escalations", filter: orgFilter },
        scheduleRefresh
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_notes", filter: orgFilter }, scheduleRefresh)
      // No organization_id on row — RLS limits to rows the user may SELECT (org members / managers).
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_checklist_run_items" }, scheduleRefresh);

    channel.subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [organizationId, scope, router]);

  return null;
}
