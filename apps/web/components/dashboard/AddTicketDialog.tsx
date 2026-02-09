"use client";

import { useState } from "react";
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
import { requestTypes } from "@/lib/validators";
import { createTicketForRoom } from "@/app/app/sites/actions";
import { Plus } from "lucide-react";

type Room = { id: string; room_label: string };

export function AddTicketDialog({
  siteId,
  siteName,
  rooms,
}: {
  siteId: string;
  siteName: string;
  rooms: Room[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [requestType, setRequestType] = useState<string>("");
  const [note, setNote] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      requestType || null,
      priority
    );
    setLoading(false);
    if (result.ok) {
      setOpen(false);
      setRoomId("");
      setRequestType("");
      setNote("");
      setPriority("normal");
      router.refresh();
    } else {
      setError(result.error);
    }
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
            <Select value={requestType} onValueChange={setRequestType}>
              <SelectTrigger id="add-ticket-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {requestTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
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
