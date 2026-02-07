"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";

function generateToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function RoomCsvUploader({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const headerParts = lines[0]?.split(/[,;\t]/).map((p) => p.trim().toLowerCase()) ?? [];
    const roomCol = headerParts.findIndex((h) => h === "room" || h === "room_label");
    const floorCol = headerParts.findIndex((h) => h === "floor");
    const roomLabelCol = roomCol >= 0 ? roomCol : 0;
    const rows = lines.slice(1).map((line) => {
      const parts = line.split(/[,;\t]/).map((p) => p.trim());
      return {
        room_label: parts[roomLabelCol] ?? parts[0] ?? "",
        floor: floorCol >= 0 ? (parts[floorCol] ?? null) : null,
      };
    }).filter((r) => r.room_label);

    const supabase = createClient();
    const toInsert = rows.map((r) => ({
      site_id: siteId,
      room_label: r.room_label,
      floor: r.floor || null,
      active: true,
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from("rooms")
      .insert(toInsert)
      .select("id");

    if (insertErr) {
      setError(insertErr.message);
      setLoading(false);
      return;
    }

    // Generate one token per room
    for (const room of inserted ?? []) {
      const token = generateToken();
      await supabase.from("room_tokens").insert({
        room_id: room.id,
        token,
      });
    }

    setLoading(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Label>Import rooms from CSV</Label>
      <p className="text-sm text-muted-foreground">
        CSV with header row: <code>room</code> or <code>room_label</code>; optional <code>floor</code>. One room per row.
      </p>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFile}
          className="hidden"
          id="csv-upload"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {loading ? "Importing…" : "Choose CSV"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
