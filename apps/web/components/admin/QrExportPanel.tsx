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
import { prepareQrPrintUrls } from "@/app/app/admin/rooms/actions";

export type RoomForQrExport = {
  id: string;
  room_label: string;
  floor: string | null;
  active: boolean;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatRoomHeading(roomLabel: string): string {
  const t = (roomLabel ?? "").trim();
  return t || "—";
}

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
  siteArchived = false,
}: {
  siteId: string;
  siteName: string;
  siteLogoUrl: string | null;
  rooms: RoomForQrExport[];
  siteArchived?: boolean;
}) {
  const [generating, setGenerating] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportMode, setExportMode] = useState<"all" | "single">("single");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [reissueLinks, setReissueLinks] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const sortedRooms = [...rooms].sort((a, b) => naturalCompare(a.room_label ?? "", b.room_label ?? ""));

  useEffect(() => {
    if (exportMode === "single" && sortedRooms.length === 1 && !selectedRoomId) {
      setSelectedRoomId(sortedRooms[0].id);
    }
    if (exportMode === "single" && selectedRoomId && !sortedRooms.some((r) => r.id === selectedRoomId)) {
      setSelectedRoomId(sortedRooms[0]?.id ?? "");
    }
  }, [exportMode, sortedRooms, selectedRoomId]);

  const roomIdsToPrint =
    exportMode === "single" && selectedRoomId
      ? [selectedRoomId]
      : sortedRooms.map((r) => r.id);

  async function handlePrintPdf() {
    if (roomIdsToPrint.length === 0) return;
    setGenerating(true);
    setExportError(null);
    try {
      const prep = await prepareQrPrintUrls(siteId, roomIdsToPrint, { reissue: reissueLinks });
      if (!prep.ok) {
        setExportError(prep.error);
        setGenerating(false);
        return;
      }

      const urlByRoomId = new Map(prep.cards.map((c) => [c.roomId, c.url]));
      const logoDataUrl = siteLogoUrl ? await imageUrlToDataUrl(siteLogoUrl) : null;

      const cards = await Promise.all(
        prep.cards.map(async (c) => {
          const url = urlByRoomId.get(c.roomId) ?? c.url;
          const dataUrl = await QRCode.toDataURL(url, { width: 180, margin: 1 });
          return { room_label: c.room_label, url, dataUrl };
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
    !siteArchived &&
    sortedRooms.length > 0 &&
    (exportMode === "all" || (exportMode === "single" && selectedRoomId));

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-medium">Export QR cards</h2>
        <p className="text-sm text-muted-foreground">
          Choose a room or all rooms, then print. Links are stored as secure hashes only—printing issues new /t/… links when
          &quot;Issue new secure links&quot; is on (recommended). Previous printed codes for affected rooms will stop working.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div ref={printRef} className="hidden" />
        {siteArchived && (
          <p className="text-sm text-amber-800 dark:text-amber-400 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
            This customer is archived. Exporting new QR cards is disabled.
          </p>
        )}
        <label className={`flex items-start gap-2 text-sm ${siteArchived ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
          <input
            type="checkbox"
            className="mt-1"
            checked={reissueLinks}
            disabled={siteArchived}
            onChange={(e) => setReissueLinks(e.target.checked)}
          />
          <span>
            <span className="font-medium">Issue new secure links</span>
            <span className="text-muted-foreground block text-xs mt-0.5">
              Required to generate QR images. Revokes the current token for each printed room and mints a replacement.
            </span>
          </span>
        </label>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Export</Label>
            <Select
              value={exportMode}
              disabled={siteArchived}
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
                <SelectItem value="all">All rooms ({sortedRooms.length})</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {exportMode === "single" && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Which room to print?</Label>
              <Select value={selectedRoomId} onValueChange={setSelectedRoomId} disabled={siteArchived}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Select a room…" />
                </SelectTrigger>
                <SelectContent>
                  {sortedRooms.map((r) => (
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
        <Button onClick={handlePrintPdf} disabled={siteArchived || !canExport || generating}>
          <Download className="h-4 w-4 mr-2" />
          {generating
            ? "Preparing…"
            : !canExport
              ? "Print / Save as PDF"
              : roomIdsToPrint.length === 1
                ? `Print / Save as PDF (${sortedRooms.find((r) => r.id === roomIdsToPrint[0])?.room_label ?? "room"})`
                : `Print / Save as PDF (${roomIdsToPrint.length} rooms)`}
        </Button>
        {exportError && (
          <p className="text-sm text-destructive" role="alert">
            {exportError}
          </p>
        )}
        {sortedRooms.length === 0 && !exportError && (
          <p className="text-sm text-muted-foreground">Add at least one location to print QR cards.</p>
        )}
      </CardContent>
    </Card>
  );
}
