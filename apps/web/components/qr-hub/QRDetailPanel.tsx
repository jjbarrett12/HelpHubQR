"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { QRHubDestination, QRHubDestinationType } from "./mock-data";
import { QR_HUB_TYPE_LABEL, MOCK_LOCATION_OPTIONS, hubTypeToDbType } from "./mock-data";
import { QRPreviewCard } from "./QRPreviewCard";
import { Download, Printer } from "lucide-react";

export function QRDetailPanel({
  destination,
  onUpdateLocal,
}: {
  destination: QRHubDestination | null;
  onUpdateLocal: (row: QRHubDestination) => void;
}) {
  const [name, setName] = useState("");
  const [zone, setZone] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState("");
  const [type, setType] = useState<QRHubDestinationType>("sop_instruction");
  const [locationId, setLocationId] = useState("loc-main");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!destination) return;
    setName(destination.name);
    setZone(destination.zoneOrStation);
    setDescription(destination.description);
    setTarget(destination.destinationTarget);
    setType(destination.type);
    setLocationId(destination.locationId);
    setIsActive(destination.isActive);
  }, [destination?.id]);

  if (!destination) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-8 text-center text-sm text-muted-foreground min-h-[320px] flex flex-col items-center justify-center">
        Select a row in the directory to edit details, preview the code, and download placeholders.
      </div>
    );
  }

  const types = Object.keys(QR_HUB_TYPE_LABEL) as QRHubDestinationType[];
  const locName = MOCK_LOCATION_OPTIONS.find((l) => l.id === locationId)?.name ?? destination.locationName;

  function save() {
    if (!destination) return;
    onUpdateLocal({
      ...destination,
      name: name.trim() || destination.name,
      zoneOrStation: zone.trim() || "—",
      description: description.trim() || "—",
      destinationTarget: target.trim() || "—",
      type,
      locationId,
      locationName: locName,
      isActive,
      dbTypeMapping: hubTypeToDbType(type),
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card/40 overflow-hidden flex flex-col lg:max-h-[min(85vh,720px)]">
      <div className="p-4 border-b border-border/60 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Destination</p>
          <h2 className="text-lg font-bold mt-0.5 break-words">{destination.name}</h2>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge variant="secondary">{QR_HUB_TYPE_LABEL[destination.type]}</Badge>
            <Badge variant="outline" className="text-[10px] font-mono">
              DB: {destination.dbTypeMapping}
            </Badge>
            {destination.isActive ? (
              <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">Active</Badge>
            ) : (
              <Badge variant="outline">Inactive</Badge>
            )}
          </div>
        </div>
        <QRPreviewCard slugPreview={destination.slugPreview} name={destination.name} className="shrink-0 scale-90 origin-top-right" />
      </div>

      <div className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0">
        <div className="space-y-1">
          <Label htmlFor="d-name">Name</Label>
          <Input id="d-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOCK_LOCATION_OPTIONS.filter((l) => l.id !== "all").map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-zone">Zone / station</Label>
            <Input id="d-zone" value={zone} onChange={(e) => setZone(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as QRHubDestinationType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {types.map((t) => (
                <SelectItem key={t} value={t}>
                  {QR_HUB_TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="d-desc">Description</Label>
          <Textarea id="d-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="d-target">Destination target</Label>
          <Input id="d-target" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>
        <dl className="grid grid-cols-2 gap-2 text-xs border-t border-border/50 pt-3">
          <div>
            <dt className="text-muted-foreground">Created</dt>
            <dd className="font-medium tabular-nums">{new Date(destination.createdAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Updated</dt>
            <dd className="font-medium tabular-nums">{new Date(destination.updatedAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Scans 24h</dt>
            <dd className="font-semibold tabular-nums">{destination.scansLast24h}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Scans 7d</dt>
            <dd className="font-semibold tabular-nums">{destination.scansLast7Days}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => window.alert("[Mock] Print sheet — TODO PDF template")}>
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Print
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => window.alert("[Mock] PNG download — TODO edge generate")}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Download PNG
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {/* TODO: updateQrDestination + optional zone column if added to schema; extend qr_destinations for hub-specific type label */}
        </p>
      </div>

      <div className="p-3 border-t border-border/60 bg-muted/20 flex justify-end gap-2">
        <Button type="button" size="sm" onClick={save}>
          Save changes (local)
        </Button>
      </div>
    </div>
  );
}
