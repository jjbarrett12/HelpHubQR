"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TICKET_REQUEST_TYPE_OPTIONS } from "@/lib/tickets/request-types-catalog";

const NO_REQUEST_TYPE = "__none__";
import { createTicketForRoom } from "@/app/app/sites/actions";
import { Plus } from "lucide-react";

type Room = { id: string; room_label: string };

export function AddTicketDialog({
  siteId,
  siteName,
  rooms,
  disabled = false,
  disabledReason,
}: {
  siteId: string;
  siteName: string;
  rooms: Room[];
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [requestTypeCode, setRequestTypeCode] = useState<string>("");
  const [note, setNote] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRequestIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (open) {
      clientRequestIdRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!roomId) {
      setError("Please select a room.");
      return;
    }
    const trimmed = note.trim();
    if (trimmed.length < 5) {
      setError("Note must be at least 5 characters.");
      return;
    }
    setLoading(true);
    const result = await createTicketForRoom(
      siteId,
      roomId,
      trimmed,
      requestTypeCode.trim() || null,
      priority,
      clientRequestIdRef.current
    );
    setLoading(false);
    if (result.ok) {
      setOpen(false);
      setRoomId("");
      setRequestTypeCode("");
      setNote("");
      setPriority("normal");
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  if (disabled) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled
        title={disabledReason}
      >
        <Plus className="h-4 w-4" />
        Add ticket (e.g. call-in)
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add ticket (e.g. call-in)
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add ticket — {siteName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Use this when a guest calls or stops by the desk instead of using the QR code.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="add-ticket-room">Room</Label>
            <Select value={roomId} onValueChange={setRoomId} required>
              <SelectTrigger id="add-ticket-room">
                <SelectValue placeholder="Select room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.room_label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-ticket-type">Request type (optional)</Label>
            <Select
              value={requestTypeCode || NO_REQUEST_TYPE}
              onValueChange={(v) => setRequestTypeCode(v === NO_REQUEST_TYPE ? "" : v)}
            >
              <SelectTrigger id="add-ticket-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_REQUEST_TYPE}>No preference</SelectItem>
                {TICKET_REQUEST_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.code} value={opt.code}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-ticket-note">Details (required)</Label>
            <Textarea
              id="add-ticket-note"
              placeholder="e.g. Guest called for extra towels and trash pickup"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              required
              minLength={5}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-ticket-priority">Priority</Label>
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as "low" | "normal" | "high")}
            >
              <SelectTrigger id="add-ticket-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating…" : "Create ticket"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
