"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadAndProcessChecklistImport } from "@/app/app/helphub/actions/import-checklist";

export function ImportUploadForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4 max-w-lg"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const res = await uploadAndProcessChecklistImport(fd);
          if ("error" in res && res.error) {
            setError(res.error);
            return;
          }
          if ("documentId" in res && res.documentId) {
            router.push(`/app/checklists/import/${res.documentId}`);
            router.refresh();
          }
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="file">Photo of list (JPEG, PNG, or WebP, max 10 MB)</Label>
        <input
          id="file"
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border file:bg-background file:px-3 file:py-2"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">
        Images are stored privately. OCR and structuring run on the server; nothing is sent to the browser except your
        review screen.
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? "Uploading & analyzing…" : "Upload and analyze"}
      </Button>
    </form>
  );
}
