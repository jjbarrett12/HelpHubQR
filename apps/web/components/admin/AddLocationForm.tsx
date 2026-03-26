"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRoomWithToken } from "@/app/app/admin/rooms/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

export function AddLocationForm({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [floor, setFloor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestUrl, setGuestUrl] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return;
    setError(null);
    setLoading(true);
    const result = await createRoomWithToken(siteId, trimmed, floor.trim() || null);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setGuestUrl(result.guestUrl);
    setLabel("");
    setFloor("");
    setLoading(false);
    router.refresh();
  }

  async function copyUrl() {
    if (!guestUrl) return;
    try {
      await navigator.clipboard.writeText(guestUrl);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="location-label" className="text-xs">Location name</Label>
          <Input
            id="location-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. 312, Pool, Gym, Lobby"
            className="w-48"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="location-floor" className="text-xs">Floor (optional)</Label>
          <Input
            id="location-floor"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            placeholder="1"
            className="w-20"
          />
        </div>
        <Button type="submit" size="sm" disabled={!label.trim() || loading}>
          <Plus className="h-4 w-4 mr-1" />
          {loading ? "Adding…" : "Add location"}
        </Button>
        {error && <p className="text-sm text-destructive w-full">{error}</p>}
      </form>
      <Dialog open={!!guestUrl} onOpenChange={(open) => !open && setGuestUrl(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Location added</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Save this guest link now (raw token is not kept in the database). Use Export QR to print a card.
          </p>
          <code className="text-xs break-all block rounded border bg-muted/50 p-2">{guestUrl}</code>
          <Button type="button" size="sm" onClick={copyUrl}>
            Copy link
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
