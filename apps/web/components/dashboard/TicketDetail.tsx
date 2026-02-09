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

type Ticket = {
  id: string;
  room_label_snapshot: string;
  request_type: string | null;
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

  const supabase = createClient();

  async function handleClaim() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSubmitting(true);
    await supabase
      .from("tickets")
      .update({
        assigned_to: user.id,
        assigned_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);
    await supabase.from("ticket_events").insert({
      ticket_id: ticket.id,
      actor_user_id: user.id,
      event_type: "assigned",
      payload: { assigned_to: user.id },
    });
    setSubmitting(false);
    router.refresh();
  }

  async function handleStatusChange(newStatus: string) {
    setStatus(newStatus);
    const { data: { user } } = await supabase.auth.getUser();
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "resolved") {
      updates.resolved_at = new Date().toISOString();
    }
    await supabase.from("tickets").update(updates).eq("id", ticket.id);
    await supabase.from("ticket_events").insert({
      ticket_id: ticket.id,
      actor_user_id: user?.id ?? null,
      event_type: "status_changed",
      payload: { from: ticket.status, to: newStatus },
    });
    router.refresh();
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!internalNote.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("ticket_events").insert({
      ticket_id: ticket.id,
      actor_user_id: user?.id ?? null,
      event_type: "internal_note",
      payload: { note: internalNote.trim() },
    });
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
          {ticket.request_type && (
            <p className="text-sm text-muted-foreground">
              Type: {ticket.request_type}
            </p>
          )}
          <p className="text-sm">{ticket.note}</p>
          <p className="text-xs text-muted-foreground">
            Created {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })} via {ticket.created_via}
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            {!ticket.assigned_to && (
              <Button
                size="sm"
                onClick={handleClaim}
                disabled={submitting}
              >
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
              const label =
                ev.event_type === "created"
                  ? "Ticket created"
                  : ev.event_type === "assigned"
                    ? "Ticket claimed"
                    : ev.event_type === "status_changed"
                      ? `Status: ${(ev.payload?.from as string) ?? "?"} → ${(ev.payload?.to as string) ?? "?"}`
                      : ev.event_type === "internal_note"
                        ? "Internal note"
                        : ev.event_type;
              const noteBody = ev.event_type === "internal_note" ? (ev.payload?.note as string) : null;
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
