"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import QRCode from "qrcode";
import { Download } from "lucide-react";
import { naturalCompare } from "@/lib/utils";

type RoomWithToken = {
  id: string;
  room_label: string;
  floor: string | null;
  active: boolean;
  room_tokens: { token: string }[] | { token: string } | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Avoid "Room Room" when room_label is "Room" or empty; show "Room 57" when room_label is "57". */
function formatRoomHeading(roomLabel: string): string {
  const t = (roomLabel ?? "").trim();
  if (!t) return "Room";
  if (t.toLowerCase() === "room") return "Room";
  if (/^room\s+/i.test(t)) return t;
  return "Room " + t;
}

/** Normalize room_tokens to an array (Supabase can return array or single object; RSC may alter shape). */
function getTokenList(room: RoomWithToken): { token: string }[] {
  const t = room.room_tokens;
  if (!t) return [];
  if (Array.isArray(t)) return t;
  if (typeof t === "object" && t !== null && "token" in t) return [t as { token: string }];
  return [];
}

/** Fetch image URL to data URL for reliable printing (avoids CORS/blank in print). */
async function imageUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function QrExportPanel({
  siteId,
  siteName,
  siteLogoUrl,
  rooms,
  baseUrl,
}: {
  siteId: string;
  siteName: string;
  siteLogoUrl: string | null;
  rooms: RoomWithToken[];
  baseUrl: string;
}) {
  const [generating, setGenerating] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportMode, setExportMode] = useState<"all" | "single">("single");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const printRef = useRef<HTMLDivElement>(null);

  const withTokens = rooms
    .map((r) => ({ ...r, tokenList: getTokenList(r) }))
    .filter((r) => r.tokenList.length > 0)
    .map((r) => ({ ...r, room_tokens: r.tokenList }))
    .sort((a, b) => naturalCompare(a.room_label ?? "", b.room_label ?? ""));

  // Auto-select the only room when there's exactly one with a token
  useEffect(() => {
    if (exportMode === "single" && withTokens.length === 1 && !selectedRoomId) {
      setSelectedRoomId(withTokens[0].id);
    }
    if (exportMode === "single" && selectedRoomId && !withTokens.some((r) => r.id === selectedRoomId)) {
      setSelectedRoomId(withTokens[0]?.id ?? "");
    }
  }, [exportMode, withTokens, selectedRoomId]);

  const roomsToExport =
    exportMode === "single" && selectedRoomId
      ? withTokens.filter((r) => r.id === selectedRoomId)
      : withTokens;

  async function handlePrintPdf() {
    if (roomsToExport.length === 0) return;
    setGenerating(true);
    setExportError(null);
    try {
      const logoDataUrl = siteLogoUrl ? await imageUrlToDataUrl(siteLogoUrl) : null;

      const cards = await Promise.all(
        roomsToExport.map(async (r) => {
          const url = `${baseUrl}/t/${r.room_tokens[0].token}`;
          const dataUrl = await QRCode.toDataURL(url, { width: 180, margin: 1 });
          return { room_label: r.room_label, url, dataUrl };
        })
      );

      const logoImg = logoDataUrl
        ? `<img src="${logoDataUrl}" alt="${siteName}" class="card-logo" />`
        : "";

      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        setExportError("Pop-up blocked. Allow pop-ups for this site and try again.");
        setGenerating(false);
        return;
      }
      printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Cards – ${siteName}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 16px; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; max-width: 800px; margin: 0 auto; }
            .card { border: 1px solid #ddd; padding: 20px; text-align: center; break-inside: avoid; }
            .card-logo { max-height: 48px; max-width: 160px; object-fit: contain; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto; }
            .card-site { font-size: 11px; color: #555; margin-bottom: 4px; }
            .card h2 { margin: 0 0 8px; font-size: 22px; }
            .card .qr-img { display: block; margin: 8px auto; }
            .card .instruction { font-size: 13px; color: #333; margin: 8px 0 4px; font-weight: 500; }
            .card .sub { font-size: 11px; color: #666; margin: 0; }
            @media print { .grid { gap: 16px; } }
          </style>
        </head>
        <body>
          <div class="grid">
            ${cards
              .map(
                (c) => `
              <div class="card">
                ${logoImg}
                ${siteName ? `<p class="card-site">${escapeHtml(siteName)}</p>` : ""}
                <h2>${escapeHtml(formatRoomHeading(c.room_label))}</h2>
                <img src="${c.dataUrl}" alt="QR for room ${c.room_label}" class="qr-img" width="180" height="180" />
                <p class="instruction">Scan to submit a cleaning request or review</p>
                <p class="sub">Scan when you need housekeeping or want to leave feedback.</p>
              </div>
            `
              )
              .join("")}
          </div>
        </body>
      </html>
    `);
      printWindow.document.close();

      const doPrint = () => {
        try {
          printWindow.focus();
          printWindow.print();
          printWindow.close();
        } catch (_) {
          setExportError("Print was cancelled or failed.");
        }
        setGenerating(false);
      };

      if (printWindow.document.readyState === "complete") {
        setTimeout(doPrint, 300);
      } else {
        printWindow.onload = () => setTimeout(doPrint, 100);
      }
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed.");
      setGenerating(false);
    }
  }

  const canExport =
    withTokens.length > 0 &&
    (exportMode === "all" || (exportMode === "single" && selectedRoomId));

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-medium">Export QR cards</h2>
        <p className="text-sm text-muted-foreground">
          To print one room: choose &quot;Single room&quot;, pick the room below, then click Print. To print all rooms with QR codes: choose &quot;All rooms&quot;.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div ref={printRef} className="hidden" />
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Export</Label>
            <Select
              value={exportMode}
              onValueChange={(v) => {
                setExportMode(v as "all" | "single");
                if (v === "all") setSelectedRoomId("");
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single room</SelectItem>
                <SelectItem value="all">All rooms ({withTokens.length})</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {exportMode === "single" && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Which room to print?</Label>
              <Select
                value={selectedRoomId}
                onValueChange={setSelectedRoomId}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Select a room…" />
                </SelectTrigger>
                <SelectContent>
                  {withTokens.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.room_label}
                      {r.floor ? ` (${r.floor})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <Button
          onClick={handlePrintPdf}
          disabled={!canExport || generating}
        >
          <Download className="h-4 w-4 mr-2" />
          {generating
            ? "Preparing…"
            : !canExport
              ? "Print / Save as PDF"
              : roomsToExport.length === 1
                ? `Print / Save as PDF (${roomsToExport[0].room_label})`
                : `Print / Save as PDF (${roomsToExport.length} rooms)`}
        </Button>
        {exportError && (
          <p className="text-sm text-destructive" role="alert">
            {exportError}
          </p>
        )}
        {withTokens.length === 0 && !exportError && (
          <p className="text-sm text-muted-foreground">
            Generate QR for at least one room from the list below, then choose it here.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
