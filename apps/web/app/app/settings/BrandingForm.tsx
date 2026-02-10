"use client";

import { useState } from "react";
import { updateTenantLogo } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BrandingForm({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await updateTenantLogo(formData);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    (e.target as HTMLFormElement).reset();
  }

  return (
    <form onSubmit={onSubmit} className={className ?? ""}>
      <Label htmlFor="logo">Upload new logo</Label>
      <p className="mt-1 text-xs text-muted-foreground">
        PNG or JPG recommended. This will replace the logo shown in the sidebar for your organization.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Input
          id="logo"
          name="logo"
          type="file"
          accept="image/*"
          className="max-w-xs cursor-pointer"
          disabled={loading}
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Uploading…" : "Upload logo"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {success && <p className="mt-2 text-sm text-green-600 dark:text-green-400">Logo updated. Refresh to see it in the sidebar.</p>}
    </form>
  );
}
