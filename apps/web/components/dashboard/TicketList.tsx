"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { TicketCard } from "./TicketCard";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type TicketRow = {
  id: string;
  room_label_snapshot: string;
  request_type: string | null;
  note: string;
  status: string;
  priority: string;
  created_at: string;
  assigned_to: string | null;
};

export function TicketList({ siteId }: { siteId: string }) {
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") ?? "all";
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("tickets")
      .select(
        "id, room_label_snapshot, request_type, note, status, priority, created_at, assigned_to"
      )
      .eq("site_id", siteId)
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    query.then(({ data, error }) => {
      if (!error) setTickets((data as TicketRow[]) ?? []);
      setLoading(false);
    });

    const ch = supabase
      .channel(`tickets:${siteId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
          filter: `site_id=eq.${siteId}`,
        },
        () => {
          let q = supabase
            .from("tickets")
            .select(
              "id, room_label_snapshot, request_type, note, status, priority, created_at, assigned_to"
            )
            .eq("site_id", siteId)
            .order("created_at", { ascending: false });
          if (statusFilter !== "all") q = q.eq("status", statusFilter);
          q.then(({ data }) => setTickets((data as TicketRow[]) ?? []));
        }
      )
      .subscribe();
    setChannel(ch);

    return () => {
      supabase.removeChannel(ch);
    };
  }, [siteId, statusFilter]);

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 py-12 text-center">
        <p className="text-sm text-muted-foreground">Loading tickets…</p>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 py-12 px-4 text-center">
        <p className="text-muted-foreground font-medium">No tickets yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          When guests scan a room QR and submit a request, it will appear here in real time.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {tickets.map((t) => (
        <TicketCard key={t.id} ticket={t} />
      ))}
    </ul>
  );
}
