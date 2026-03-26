"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import QRCode from "qrcode";

type LocationWithQr = {
  id: string;
  type: string;
  identifier: string;
  qrId: string | null;
};

export function MvpQrExportPanel({
  propertyName,
  locations,
  baseUrl,
}: {
  propertyName: string;
  locations: LocationWithQr[];
  baseUrl: string;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const [dataUrls, setDataUrls] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);

  const withQr = locations.filter((l) => l.qrId);
  useEffect(() => {
    if (withQr.length === 0) return;
    setGenerating(true);
    const run = async () => {
      const next: Record<string, string> = {};
      for (const loc of withQr) {
        if (!loc.qrId) continue;
        const url = `${baseUrl}/q/${encodeURIComponent(loc.qrId)}`;
        try {
          next[loc.id] = await QRCode.toDataURL(url, { width: 200, margin: 1 });
        } catch {
          next[loc.id] = "";
        }
      }
      setDataUrls(next);
      setGenerating(false);
    };
    run();
  }, [withQr, baseUrl]);

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head><title>QR Codes - ${propertyName}</title>
      <style>
        body { font-family: system-ui; padding: 16px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
        .card { border: 1px solid #ccc; padding: 12px; text-align: center; break-inside: avoid; }
        .card img { display: block; margin: 0 auto 8px; }
        .label { font-weight: 600; }
        .url { font-size: 10px; word-break: break-all; color: #666; }
      </style></head><body>
      <h1>${propertyName} – QR codes</h1>
      <div class="grid">${withQr
        .map(
          (loc) =>
            `<div class="card">
              <img src="${dataUrls[loc.id] || ""}" alt="" width="200" height="200" />
              <div class="label">${loc.identifier}</div>
              <div class="url">${baseUrl}/q/${loc.qrId}</div>
            </div>`
        )
        .join("")}</div></body></html>`);
    win.document.close();
    win.print();
    win.close();
  };

  const handleCsv = () => {
    const rows = [
      ["identifier", "type", "qr_id", "url"],
      ...withQr.map((loc) => [
        loc.identifier,
        loc.type,
        loc.qrId ?? "",
        `${baseUrl}/q/${loc.qrId ?? ""}`,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `qr-codes-${propertyName.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (withQr.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No QR codes for this property. Add locations and generate QR codes first.</p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {withQr.length} location(s) with QR. Base URL: <code className="text-xs">{baseUrl}/q/[qrId]</code>
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleCsv} disabled={generating}>
          Download CSV
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint} disabled={generating || Object.keys(dataUrls).length < withQr.length}>
          {generating ? "Generating…" : "Print / PDF"}
        </Button>
      </div>
      <div ref={printRef} className="hidden" aria-hidden />
    </div>
  );
}
