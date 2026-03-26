"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRoomsBulkWithTokens } from "@/app/app/admin/rooms/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Layers } from "lucide-react";

const MAX_RANGE = 500;

type ParsedQuickAdd =
  | { kind: "prefixRange"; prefix: string; from: number; to: number }
  | { kind: "rangeOnly"; from: number; to: number };

/**
 * Parse Quick add input:
 * - "Room 1-Room 120" or "Room 1 - Room 120" → prefix "Room ", from 1, to 120 (labels: Room 1, Room 2, ... Room 120)
 * - "122" → from 1, to 122 (use separate Prefix field for labels)
 * - "1-122" / "1 - 122" → from 1, to 122 (use separate Prefix field)
 */
function parseQuickAddInput(input: string): ParsedQuickAdd | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // "Room 1-Room 120" or "Room 1 - Room 120" (prefix + number + dash + prefix + number)
  const prefixRangeMatch = trimmed.match(
    /^(\D*?)(\d+)\s*[-–—]\s*(\D*?)(\d+)\s*$/i
  );
  if (prefixRangeMatch) {
    const prefix1 = prefixRangeMatch[1].trimEnd();
    const from = parseInt(prefixRangeMatch[2], 10);
    const to = parseInt(prefixRangeMatch[4], 10);
    if (from < 1 || to < 1 || from > to) return null;
    // Use the first prefix (e.g. "Room " from "Room 1"); ensure space before number if user wrote "Room 1"
    const prefix = prefix1 ? (prefix1.endsWith(" ") ? prefix1 : prefix1 + " ") : "";
    return { kind: "prefixRange", prefix, from, to };
  }

  // "122" → 1-122
  const singleMatch = trimmed.match(/^(\d+)$/);
  if (singleMatch) {
    const to = parseInt(singleMatch[1], 10);
    if (to < 1) return null;
    return { kind: "rangeOnly", from: 1, to };
  }

  // "1-122" or "1 - 122" (numbers only)
  const rangeMatch = trimmed.replace(/\s*[-–—]\s*/g, "-").match(/^(\d+)\s*-\s*(\d+)\s*$/);
  if (rangeMatch) {
    const from = parseInt(rangeMatch[1], 10);
    const to = parseInt(rangeMatch[2], 10);
    if (from < 1 || to < 1 || from > to) return null;
    return { kind: "rangeOnly", from, to };
  }

  return null;
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
  const [linkDump, setLinkDump] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let from: number;
    let to: number;
    let labelPrefix: string;
    if (quickRange.trim()) {
      const parsed = parseQuickAddInput(quickRange);
      if (!parsed) {
        setError('Enter a number (e.g. 122), range (e.g. 1-122), or "Room 1-Room 120".');
        return;
      }
      from = parsed.from;
      to = parsed.to;
      labelPrefix = parsed.kind === "prefixRange" ? parsed.prefix : (prefix.trim() ? (prefix.trim().endsWith(" ") ? prefix.trim() : prefix.trim() + " ") : "");
    } else {
      from = parseInt(fromNum, 10);
      to = parseInt(toNum, 10);
      if (Number.isNaN(from) || Number.isNaN(to) || from < 1 || to < 1 || from > to) {
        setError("Enter valid numbers (From ≤ To, min 1).");
        return;
      }
      labelPrefix = prefix.trim() ? (prefix.trim().endsWith(" ") ? prefix.trim() : prefix.trim() + " ") : "";
    }
    const count = to - from + 1;
    if (count > MAX_RANGE || count < 1) {
      setError(`Maximum ${MAX_RANGE} rooms at once. You asked for ${count}.`);
      return;
    }
    setError(null);
    setMessage(null);
    setLoading(true);
    const roomLabels = Array.from({ length: count }, (_, i) => {
      const n = from + i;
      return labelPrefix + n;
    });
    const rows = roomLabels.map((room_label) => ({ room_label, floor: null as string | null }));
    const result = await createRoomsBulkWithTokens(siteId, rows);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    const createdCount = result.created.length;
    setMessage(
      `Created ${createdCount} locations with QR codes (${roomLabels[0]}–${roomLabels[roomLabels.length - 1]}). Use Export QR to print, or copy links from the dialog.`
    );
    setLinkDump(result.created.map((c) => `${c.room_label}\t${c.guestUrl}`).join("\n"));
    setQuickRange("");
    setFromNum("");
    setToNum("");
    setLoading(false);
    router.refresh();
  }

  const parsedFromQuick = quickRange.trim() ? parseQuickAddInput(quickRange) : null;
  const displayFrom = parsedFromQuick ? parsedFromQuick.from : parseInt(fromNum, 10);
  const displayTo = parsedFromQuick ? parsedFromQuick.to : parseInt(toNum, 10);
  const displayCount =
    parsedFromQuick
      ? parsedFromQuick.to - parsedFromQuick.from + 1
      : (Number.isNaN(displayFrom) || Number.isNaN(displayTo) || displayFrom > displayTo)
        ? 0
        : displayTo - displayFrom + 1;
  const canSubmit = loading === false && (quickRange.trim() !== "" || (fromNum !== "" && toNum !== ""));

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
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 p-4 rounded-lg border border-card-border bg-card/50">
      <div className="space-y-1">
        <Label htmlFor="quick-range" className="text-xs">Quick add: just the count or range</Label>
        <Input
          id="quick-range"
          type="text"
          value={quickRange}
          onChange={(e) => { setQuickRange(e.target.value); setError(null); }}
          placeholder='Room 1-Room 120 or 122'
          className="w-48"
          title="Type Room 1-Room 120 to create Room 1…Room 120, or 122 for 1–122 (use Prefix for label)"
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
    <Dialog open={!!linkDump} onOpenChange={(open) => !open && setLinkDump(null)}>
      <DialogContent className="sm:max-w-2xl max-h-[85dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Guest links (one-time)</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground shrink-0">
          Tab-separated: room label, then URL. Raw tokens are not stored—copy now if you need a spreadsheet backup.
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
