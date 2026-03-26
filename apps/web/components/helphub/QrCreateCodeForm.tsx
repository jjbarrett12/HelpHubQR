"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { createQrCode } from "@/app/app/helphub/actions/qr-hub";

export function QrCreateCodeForm({
  destinations,
  locations,
}: {
  destinations: { id: string; name: string; type: string }[];
  locations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="rounded-xl border border-border/60 bg-card/30 p-5 space-y-4 max-w-xl"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setMsg(null);
        startTransition(async () => {
          const res = await createQrCode(fd);
          if ("error" in res && res.error) {
            setMsg(res.error);
            return;
          }
          (e.target as HTMLFormElement).reset();
          setMsg("QR code created.");
          router.refresh();
        });
      }}
    >
      <p className="text-sm font-medium">Print a new QR code</p>
      <div className="space-y-2">
        <Label htmlFor="qc_dest">Destination</Label>
        <select
          id="qc_dest"
          name="qr_destination_id"
          required
          className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
        >
          <option value="">Select…</option>
          {destinations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.type})
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="qc_label">Label on sticker / sheet</Label>
        <Input
          id="qc_label"
          name="label"
          required
          placeholder="e.g. Dish pit — scan for SOP"
          className="bg-background/80"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="qc_loc">Location override (optional)</Label>
        <select
          id="qc_loc"
          name="location_id"
          className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
        >
          <option value="">Same as destination / none</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Generate QR link"}
      </Button>
      {msg ? (
        <p
          className={`text-sm ${
            msg === "QR code created." ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
          }`}
        >
          {msg}
        </p>
      ) : null}
    </form>
  );
}
