"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { updateSiteAllowGuestQrForArchivedRooms } from "@/app/app/admin/rooms/actions";

export function SiteGuestQrArchivedToggle({
  siteId,
  initialAllow,
  hasArchivedRooms,
}: {
  siteId: string;
  initialAllow: boolean;
  hasArchivedRooms: boolean;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(initialAllow);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!hasArchivedRooms) return null;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
      <div className="flex items-start gap-3">
        <input
          id="allow-archived-qr"
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-input"
          checked={checked}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setChecked(next);
            setError(null);
            startTransition(async () => {
              const r = await updateSiteAllowGuestQrForArchivedRooms(siteId, next);
              if (!r.ok) {
                setChecked(!next);
                setError(r.error);
              } else {
                router.refresh();
              }
            });
          }}
        />
        <div>
          <Label htmlFor="allow-archived-qr" className="text-foreground font-medium cursor-pointer">
            Allow guest QR for archived locations
          </Label>
          <p className="text-muted-foreground text-xs mt-1 max-w-xl">
            Off by default. When on, printed links for archived rooms still resolve so guests can submit requests. The
            whole customer must stay active (not archived) for any guest flow.
          </p>
          {error && (
            <p className="text-destructive text-xs mt-2" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
