"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { archiveSite, type ArchiveSiteResult } from "@/app/app/admin/sites/actions";

export function DeleteCustomerButton({
  siteId,
  customerName,
}: {
  siteId: string;
  customerName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (
      !confirm(
        `Archive customer “${customerName}”? Active QR codes will stop working. Locations and ticket history are kept for reporting.`
      )
    )
      return;
    setLoading(true);
    setError(null);
    const result: ArchiveSiteResult = await archiveSite(siteId);
    setLoading(false);
    if (result.ok) {
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <span className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={handleDelete}
        disabled={loading}
        aria-label={`Archive customer ${customerName}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      {error && (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
