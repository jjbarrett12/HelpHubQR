"use client";

import { useState } from "react";
import { updateTenantBranding } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRESETS = [
  { name: "Teal", value: "#0f766e" },
  { name: "Blue", value: "#2563eb" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Rose", value: "#e11d48" },
  { name: "Amber", value: "#d97706" },
  { name: "Default", value: "#dc2626" },
];

export function BrandingThemeForm({ initialPrimaryColor }: { initialPrimaryColor?: string | null }) {
  const [color, setColor] = useState(initialPrimaryColor ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    const formData = new FormData();
    formData.set("primary_color", color.trim() || "");
    const result = await updateTenantBranding(formData);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={color || "#dc2626"}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-transparent"
          />
          <Input
            type="text"
            placeholder="#dc2626"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-28 font-mono text-sm"
          />
        </div>
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Saving…" : "Apply color"}
        </Button>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Presets</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setColor(p.value)}
              className="h-8 w-8 rounded-lg border-2 border-border transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring"
              style={{ backgroundColor: p.value }}
              title={p.name}
            />
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600 dark:text-green-400">Theme updated.</p>}
    </form>
  );
}
