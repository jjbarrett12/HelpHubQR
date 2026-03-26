"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, UserPlus, MessageSquare } from "lucide-react";
import { formatRoomDisplay } from "@/lib/utils";
import { formatTicketDbError } from "@/lib/tickets/db-error";
import {
  TICKET_EVENT,
  ticketEventTypeLabel,
  ticketStatusTransitionEventType,
} from "@/lib/tickets/event-types";

type Ticket = {
  id: string;
  room_label_snapshot: string;
  site_name_snapshot: string | null;
  floor_snapshot: string | null;
  request_type_label_snapshot: string | null;
  note: string;
  status: string;
  priority: string;
  created_at: string;
  created_via: string;
  assigned_to: string | null;
  assigned_at: string | null;
  resolved_at: string | null;
  site_id: string;
  site: { name: string };
};

type Event = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  actor_user_id: string | null;
};

function timelineEventLabel(ev: Event): string {
  switch (ev.event_type) {
    case "created":
      return "Ticket created";
    case "assigned":
      return "Ticket claimed";
    case "comment_added":
      return "Comment";
    case "status_changed":
      return `Status: ${(ev.payload?.from as string) ?? "?"} → ${(ev.payload?.to as string) ?? "?"}`;
    case "resolved":
    case "cancelled":
    case "reopened":
      return ticketEventTypeLabel(ev.event_type);
    default:
      return ticketEventTypeLabel(ev.event_type);
  }
}

function timelineNoteBody(ev: Event): string | null {
  if (ev.event_type === "comment_added") {
    return (ev.payload?.note as string) ?? null;
  }
  return null;
}

export function TicketDetail({
  ticket,
  events,
}: {
  ticket: Ticket;
  events: Event[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState(ticket.status);
  const [internalNote, setInternalNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const supabase = createClient();

  async function handleClaim() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setMutationError(null);
    setSubmitting(true);
    const { error: updErr } = await supabase
      .from("tickets")
      .update({
        assigned_to: user.id,
        assigned_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);
    if (updErr) {
      setMutationError(formatTicketDbError(updErr.message));
      setSubmitting(false);
      return;
    }
    const { error: evErr } = await supabase.from("ticket_events").insert({
      ticket_id: ticket.id,
      actor_user_id: user.id,
      event_type: "assigned",
      payload: { assigned_to: user.id },
    });
    if (evErr) {
      setMutationError(formatTicketDbError(evErr.message));
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    router.refresh();
  }

  async function handleStatusChange(newStatus: string) {
    setMutationError(null);
    setStatus(newStatus);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "resolved") {
      updates.resolved_at = new Date().toISOString();
    }
    const { error: updErr } = await supabase.from("tickets").update(updates).eq("id", ticket.id);
    if (updErr) {
      setStatus(ticket.status);
      setMutationError(formatTicketDbError(updErr.message));
      return;
    }

    const eventType = ticketStatusTransitionEventType(ticket.status, newStatus);
    const { error: evErr } = await supabase.from("ticket_events").insert({
      ticket_id: ticket.id,
      actor_user_id: user?.id ?? null,
      event_type: eventType,
      payload: { from: ticket.status, to: newStatus },
    });
    if (evErr) {
      setMutationError(formatTicketDbError(evErr.message));
      return;
    }

    try {
      await fetch("/api/audit-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "ticket",
          entityId: ticket.id,
          action: "status_change",
          payload: { from: ticket.status, to: newStatus },
        }),
      });
    } catch (_) {
      // Non-blocking
    }
    if (newStatus === "resolved") {
      try {
        await fetch("/api/notify-guest-completed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId: ticket.id }),
        });
      } catch (_) {
        // Non-blocking
      }
    }
    router.refresh();
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!internalNote.trim()) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("ticket_events").insert({
      ticket_id: ticket.id,
      actor_user_id: user?.id ?? null,
      event_type: TICKET_EVENT.comment_added,
      payload: { note: internalNote.trim() },
    });
    if (error) {
      setMutationError(formatTicketDbError(error.message));
      return;
    }
    setInternalNote("");
    router.refresh();
  }

  const siteName = ticket.site?.name ?? "Queue";

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
        <a href={`/app/sites/${ticket.site_id}`}>
          <ArrowLeft className="h-4 w-4 mr-1 shrink-0" />
          Back to {siteName}
        </a>
      </Button>

      <Card className="border-card-border">
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap space-y-0">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {formatRoomDisplay(ticket.room_label_snapshot)}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{ticket.site?.name}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{ticket.status.replace("_", " ")}</Badge>
            {ticket.priority && ticket.priority !== "normal" && (
              <Badge variant="outline">Priority: {ticket.priority}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {mutationError && (
            <p
              className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2"
              role="alert"
            >
              {mutationError}
            </p>
          )}
          {ticket.request_type_label_snapshot && (
            <p className="text-sm text-muted-foreground">
              Type: {ticket.request_type_label_snapshot}
            </p>
          )}
          {(ticket.site_name_snapshot || ticket.floor_snapshot) && (
            <p className="text-xs text-muted-foreground space-x-2">
              {ticket.site_name_snapshot && (
                <span>Site (at submission): {ticket.site_name_snapshot}</span>
              )}
              {ticket.floor_snapshot != null && String(ticket.floor_snapshot).trim() !== "" && (
                <span>· Floor: {ticket.floor_snapshot}</span>
              )}
            </p>
          )}
          <p className="text-sm">{ticket.note}</p>
          <p className="text-xs text-muted-foreground">
            Created {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })} via{" "}
            {ticket.created_via}
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            {!ticket.assigned_to && (
              <Button size="sm" onClick={handleClaim} disabled={submitting}>
                <UserPlus className="h-4 w-4 mr-1" />
                Claim ticket
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Label className="text-sm">Status</Label>
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Internal note
          </h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddNote} className="space-y-2">
            <Textarea
              placeholder="Add a note for staff..."
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              rows={2}
            />
            <Button type="submit" size="sm" disabled={!internalNote.trim()}>
              Add note
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-card-border">
        <CardHeader>
          <h2 className="text-sm font-medium">Timeline</h2>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4 text-sm" role="list">
            {events.map((ev) => {
              const label = timelineEventLabel(ev);
              const noteBody = timelineNoteBody(ev);
              return (
                <li key={ev.id} className="flex gap-3">
                  <span className="text-muted-foreground shrink-0 text-xs mt-0.5">
                    {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true })}
                  </span>
                  <span>
                    <span className="font-medium text-foreground">{label}</span>
                    {noteBody && <span className="block text-muted-foreground mt-0.5">{noteBody}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
