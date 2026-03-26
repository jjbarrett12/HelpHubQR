"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProperty } from "./actions";

type Props = {
  name: string;
  timezone: string;
  logoUrl: string | null;
  primaryColor: string | null;
  supportPhone: string | null;
};

export function PropertyForm({ name, timezone, logoUrl, primaryColor, supportPhone }: Props) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      action={async (fd) => {
        setSaving(true);
        setMessage(null);
        const r = await updateProperty(fd);
        setSaving(false);
        if (r.error) setMessage(r.error);
        else setMessage("Saved.");
      }}
      className="space-y-4"
    >
      <div>
        <Label htmlFor="name">Property name</Label>
        <Input id="name" name="name" defaultValue={name} className="mt-1 max-w-md" />
      </div>
      <div>
        <Label htmlFor="timezone">Timezone</Label>
        <Input id="timezone" name="timezone" defaultValue={timezone} placeholder="America/New_York" className="mt-1 max-w-md" />
      </div>
      <div>
        <Label htmlFor="logo_url">Logo URL</Label>
        <Input id="logo_url" name="logo_url" type="url" defaultValue={logoUrl ?? ""} className="mt-1 max-w-md" />
      </div>
      <div>
        <Label htmlFor="primary_color">Primary color</Label>
        <Input id="primary_color" name="primary_color" defaultValue={primaryColor ?? ""} placeholder="#0ea5e9" className="mt-1 max-w-md" />
      </div>
      <div>
        <Label htmlFor="support_phone">Support phone</Label>
        <Input id="support_phone" name="support_phone" defaultValue={supportPhone ?? ""} placeholder="+1-555-0100" className="mt-1 max-w-md" />
      </div>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save property"}</Button>
    </form>
  );
}
