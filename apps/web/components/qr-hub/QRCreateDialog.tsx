"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

export function QRCreateDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (row: QRHubDestination) => void;
}) {
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState("loc-main");
  const [zone, setZone] = useState("");
  const [type, setType] = useState<QRHubDestinationType>("sop_instruction");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState("");
  const [isActive, setIsActive] = useState(true);

  const types = Object.keys(QR_HUB_TYPE_LABEL) as QRHubDestinationType[];
  const locName = MOCK_LOCATION_OPTIONS.find((l) => l.id === locationId)?.name ?? "—";

  function reset() {
    setName("");
    setLocationId("loc-main");
    setZone("");
    setType("sop_instruction");
    setDescription("");
    setTarget("");
    setIsActive(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const id = `qd-new-${Date.now()}`;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24) || "destination";
    const now = new Date().toISOString();
    onCreate({
      id,
      name: name.trim(),
      locationId,
      locationName: locName,
      zoneOrStation: zone.trim() || "—",
      type,
      description: description.trim() || "—",
      destinationTarget: target.trim() || "—",
      isActive,
      slugPreview: `${slug}-${Math.random().toString(36).slice(2, 6)}`,
      scansLast7Days: 0,
      scansLast24h: 0,
      createdAt: now,
      updatedAt: now,
      dbTypeMapping: hubTypeToDbType(type),
    });
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create QR destination</DialogTitle>
          <p className="text-sm text-muted-foreground font-normal">
            Defines what a scan resolves to. Physical codes are issued separately from{" "}
            <span className="font-medium text-foreground">QR codes</span>.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="qr-name">Name</Label>
            <Input id="qr-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Lobby cart SOP" />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
              <Label htmlFor="qr-zone">Zone / station</Label>
              <Input id="qr-zone" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="e.g. Lobby · Cart A" />
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
            <Label htmlFor="qr-desc">Description</Label>
            <Textarea id="qr-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="qr-target">Destination target</Label>
            <Input
              id="qr-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="URL, path, or internal ref"
            />
            <p className="text-[10px] text-muted-foreground">
              Maps into <code className="text-[10px]">content</code> JSON or <code className="text-[10px]">target_checklist_id</code> in DB.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
          <p className="text-[10px] text-muted-foreground">
            {/* TODO: call createQrDestination with mapped fields + revalidate /app/qr-hub */}
            Saves locally in mock mode only.
          </p>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
