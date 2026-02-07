"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

function generateToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function AddLocationForm({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [floor, setFloor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .insert({
        site_id: siteId,
        room_label: trimmed,
        floor: floor.trim() || null,
        active: true,
      })
      .select("id")
      .single();
    if (roomErr) {
      setError(roomErr.message);
      setLoading(false);
      return;
    }
    const token = generateToken();
    const { error: tokenErr } = await supabase.from("room_tokens").insert({ room_id: room.id, token });
    if (tokenErr) {
      setError(`Room added but QR failed: ${tokenErr.message}. Use "Generate QR" below.`);
    }
    setLabel("");
    setFloor("");
    setLoading(false);
    router.refresh();
  }

  return (
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
  );
}
