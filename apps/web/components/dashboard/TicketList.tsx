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
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
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

  if (tickets.length === 0) {
    return (
      <div className="text-muted-foreground text-center py-12">
        No tickets yet. New requests will appear here in real time.
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
