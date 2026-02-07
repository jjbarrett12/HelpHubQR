"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Layers } from "lucide-react";

const MAX_RANGE = 500;

/** Parse "1-122" or "1 - 122" or "Room 1-122" into [from, to] or null. */
function parseRangeInput(input: string): [number, number] | null {
  const trimmed = input.trim().replace(/\s*[-–—]\s*/g, "-");
  const match = trimmed.match(/^(?:\D*)?(\d+)\s*-\s*(\d+)\s*$/);
  if (!match) return null;
  const from = parseInt(match[1], 10);
  const to = parseInt(match[2], 10);
  if (from < 1 || to < 1 || from > to) return null;
  return [from, to];
}

function generateToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function AddRoomRangeForm({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [quickRange, setQuickRange] = useState("");
  const [fromNum, setFromNum] = useState("");
  const [toNum, setToNum] = useState("");
  const [prefix, setPrefix] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let from: number;
    let to: number;
    if (quickRange.trim()) {
      const parsed = parseRangeInput(quickRange);
      if (!parsed) {
        setError('Enter a range like "1-122" (two numbers with a hyphen).');
        return;
      }
      [from, to] = parsed;
    } else {
      from = parseInt(fromNum, 10);
      to = parseInt(toNum, 10);
      if (Number.isNaN(from) || Number.isNaN(to) || from < 1 || to < 1 || from > to) {
        setError("Enter valid numbers (From ≤ To, min 1).");
        return;
      }
    }
    const count = to - from + 1;
    if (count > MAX_RANGE || count < 1) {
      setError(`Maximum ${MAX_RANGE} rooms at once. You asked for ${count}.`);
      return;
    }
    setError(null);
    setMessage(null);
    setLoading(true);
    const supabase = createClient();
    const roomLabels = Array.from({ length: count }, (_, i) => {
      const n = from + i;
      return (prefix.trim() ? prefix.trim() : "") + n;
    });
    const { data: rooms, error: roomErr } = await supabase
      .from("rooms")
      .insert(
        roomLabels.map((room_label) => ({
          site_id: siteId,
          room_label,
          floor: null,
          active: true,
        }))
      )
      .select("id");
    if (roomErr) {
      setError(roomErr.message);
      setLoading(false);
      return;
    }
    const ids = rooms ?? [];
    for (let i = 0; i < ids.length; i++) {
      const token = generateToken();
      await supabase.from("room_tokens").insert({ room_id: ids[i].id, token });
    }
    const createdCount = ids.length;
    setMessage(`Created ${createdCount} locations with QR codes (${roomLabels[0]}–${roomLabels[roomLabels.length - 1]}). You can now print the QR for room 57 (or any room) from Export QR.`);
    setQuickRange("");
    setFromNum("");
    setToNum("");
    setLoading(false);
    router.refresh();
  }

  const parsedFromQuick = quickRange.trim() ? parseRangeInput(quickRange) : null;
  const [displayFrom, displayTo] = parsedFromQuick ?? [parseInt(fromNum, 10), parseInt(toNum, 10)];
  const displayCount =
    parsedFromQuick
      ? parsedFromQuick[1] - parsedFromQuick[0] + 1
      : (Number.isNaN(displayFrom) || Number.isNaN(displayTo) || displayFrom > displayTo)
        ? 0
        : displayTo - displayFrom + 1;
  const canSubmit = loading === false && (quickRange.trim() !== "" || (fromNum !== "" && toNum !== ""));

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 p-4 rounded-lg border border-card-border bg-card/50">
      <div className="space-y-1">
        <Label htmlFor="quick-range" className="text-xs">Quick range (e.g. 1-122)</Label>
        <Input
          id="quick-range"
          type="text"
          value={quickRange}
          onChange={(e) => { setQuickRange(e.target.value); setError(null); }}
          placeholder="1-122"
          className="w-32"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="range-from" className="text-xs">From</Label>
        <Input
          id="range-from"
          type="number"
          min={1}
          value={fromNum}
          onChange={(e) => { setFromNum(e.target.value); setQuickRange(""); setError(null); }}
          placeholder="1"
          className="w-24"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="range-to" className="text-xs">To</Label>
        <Input
          id="range-to"
          type="number"
          min={1}
          value={toNum}
          onChange={(e) => { setToNum(e.target.value); setQuickRange(""); setError(null); }}
          placeholder="122"
          className="w-24"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="range-prefix" className="text-xs">Prefix (optional)</Label>
        <Input
          id="range-prefix"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          placeholder='e.g. "Room " or leave blank'
          className="w-40"
        />
      </div>
      <Button type="submit" size="sm" disabled={!canSubmit}>
        <Layers className="h-4 w-4 mr-1" />
        {loading ? "Creating…" : displayCount ? `Create ${displayCount} rooms with QR codes` : "Add range"}
      </Button>
      {error && <p className="text-sm text-destructive w-full">{error}</p>}
      {message && <p className="text-sm text-green-600 dark:text-green-400 w-full">{message}</p>}
    </form>
  );
}
