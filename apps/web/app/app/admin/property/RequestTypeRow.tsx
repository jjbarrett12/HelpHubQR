"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateRequestType } from "./actions";

type Props = {
  id: string;
  code: string;
  label: string;
  department: string;
  defaultSlaMinutes: number;
  isActive: boolean;
};

export function RequestTypeRow({ id, code, label, department, defaultSlaMinutes, isActive }: Props) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [currentLabel, setCurrentLabel] = useState(label);
  const [currentSla, setCurrentSla] = useState(defaultSlaMinutes);
  const [currentActive, setCurrentActive] = useState(isActive);
  return (
    <form
      action={async (fd) => {
        setSaving(true);
        setMsg(null);
        fd.set("id", id);
        const r = await updateRequestType(fd);
        setSaving(false);
        if (r.error) setMsg(r.error);
        else {
          setMsg("Saved.");
          setCurrentLabel(fd.get("label") as string);
          setCurrentSla(parseInt(String(fd.get("default_sla_minutes")), 10) || defaultSlaMinutes);
          setCurrentActive((fd.get("is_active") as string) === "on");
        }
      }}
      className="flex flex-wrap items-end gap-2 rounded border px-3 py-2 text-sm"
    >
      <input type="hidden" name="id" value={id} />
      <span className="font-medium text-muted-foreground">({code})</span>
      <div className="flex-1 min-w-[120px]">
        <Label htmlFor={`label-${id}`} className="sr-only">Label</Label>
        <Input
          id={`label-${id}`}
          name="label"
          value={currentLabel}
          onChange={(e) => setCurrentLabel(e.target.value)}
          placeholder="Label"
          className="h-8"
        />
      </div>
      <span className="text-muted-foreground">{department}</span>
      <div className="w-20">
        <Label htmlFor={`sla-${id}`} className="sr-only">SLA min</Label>
        <Input
          id={`sla-${id}`}
          name="default_sla_minutes"
          type="number"
          min={1}
          value={currentSla}
          onChange={(e) => setCurrentSla(parseInt(e.target.value, 10) || 0)}
          className="h-8"
        />
      </div>
      <input type="hidden" name="is_active" value={currentActive ? "true" : "false"} />
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={currentActive}
          onChange={(e) => setCurrentActive(e.target.checked)}
        />
        <span className="text-muted-foreground">Active</span>
      </label>
      <Button type="submit" size="sm" variant="secondary" disabled={saving}>{saving ? "…" : "Save"}</Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </form>
  );
}
