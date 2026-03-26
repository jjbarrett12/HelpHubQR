"use client";

import { useState } from "react";
import { updateTenantLogo } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BrandingForm({ className, initialLogoUrl }: { className?: string; initialLogoUrl?: string | null }) {
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
    if (!(formData.get("logo") as File)?.size && formData.get("logo_url") !== undefined) {
      (e.target as HTMLFormElement).reset();
    }
  }

  return (
    <form onSubmit={onSubmit} className={className ?? ""}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="logo_url">Logo URL (optional)</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Paste an image URL to use as the sidebar logo. Leave empty to use an uploaded logo or the default.
          </p>
          <Input
            id="logo_url"
            name="logo_url"
            type="url"
            placeholder="https://..."
            className="mt-2 max-w-md"
            disabled={loading}
            defaultValue={initialLogoUrl ?? ""}
          />
          <Button type="submit" variant="secondary" size="sm" className="mt-2" disabled={loading}>
            {loading ? "Saving…" : "Save URL"}
          </Button>
        </div>
        <div className="border-t border-border pt-4">
          <Label htmlFor="logo">Or upload a logo file</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            PNG or JPG. Uploaded logo is stored and shown in the sidebar.
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
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {success && <p className="mt-2 text-sm text-green-600 dark:text-green-400">Logo updated. The sidebar will show your logo now.</p>}
    </form>
  );
}
