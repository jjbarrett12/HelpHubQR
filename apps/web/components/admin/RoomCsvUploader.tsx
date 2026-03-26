"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createRoomsBulkWithTokens } from "@/app/app/admin/rooms/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload } from "lucide-react";

export function RoomCsvUploader({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [linkDump, setLinkDump] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const headerParts = lines[0]?.split(/[,;\t]/).map((p) => p.trim().toLowerCase()) ?? [];
    const roomCol = headerParts.findIndex((h) => h === "room" || h === "room_label");
    const floorCol = headerParts.findIndex((h) => h === "floor");
    const roomLabelCol = roomCol >= 0 ? roomCol : 0;
    const rows = lines
      .slice(1)
      .map((line) => {
        const parts = line.split(/[,;\t]/).map((p) => p.trim());
        return {
          room_label: parts[roomLabelCol] ?? parts[0] ?? "",
          floor: floorCol >= 0 ? (parts[floorCol] ?? null) : null,
        };
      })
      .filter((r) => r.room_label);

    const result = await createRoomsBulkWithTokens(siteId, rows);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setMessage(`Imported ${result.created.length} rooms with guest links.`);
    setLinkDump(result.created.map((c) => `${c.room_label}\t${c.guestUrl}`).join("\n"));
    setLoading(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  async function copyLinks() {
    if (!linkDump) return;
    try {
      await navigator.clipboard.writeText(linkDump);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
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
            size="sm"
            disabled={loading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            {loading ? "Importing…" : "Choose CSV file"}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-green-600 dark:text-green-400">{message}</p>}
      </div>
      <Dialog open={!!linkDump} onOpenChange={(open) => !open && setLinkDump(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Guest links (one-time)</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground shrink-0">
            Tab-separated: room label, then URL. Copy now if you need a backup; raw tokens are not stored in the database.
          </p>
          <pre className="text-xs overflow-auto flex-1 min-h-0 rounded border bg-muted/50 p-2 max-h-[50dvh] whitespace-pre-wrap break-all">
            {linkDump}
          </pre>
          <Button type="button" size="sm" className="shrink-0" onClick={copyLinks}>
            Copy all
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
