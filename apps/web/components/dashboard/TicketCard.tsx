"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TicketRow } from "./TicketList";
import { formatDistanceToNow } from "date-fns";
import { formatRoomDisplay } from "@/lib/utils";

function formatDate(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new: "default",
  in_progress: "secondary",
  resolved: "outline",
  cancelled: "destructive",
};

export function TicketCard({ ticket }: { ticket: TicketRow }) {
  return (
    <Link href={`/app/tickets/${ticket.id}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg">
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer border-card-border border-l-4 border-l-accent-border/40 shadow-sm h-full">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <span className="font-medium">{formatRoomDisplay(ticket.room_label_snapshot)}</span>
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant[ticket.status] ?? "outline"}>
              {ticket.status.replace("_", " ")}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDate(ticket.created_at)}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {ticket.request_type && (
            <p className="text-sm text-muted-foreground">{ticket.request_type}</p>
          )}
          <p className="text-sm line-clamp-2">{ticket.note}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
