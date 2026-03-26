"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteRoom, type DeleteRoomResult } from "@/app/app/admin/rooms/actions";

export function DeleteRoomButton({
  roomId,
  siteId,
  roomLabel,
  isArchived = false,
}: {
  roomId: string;
  siteId: string;
  roomLabel: string;
  isArchived?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (
      !confirm(
        `Archive location “${roomLabel}”? The QR link will stop working; past tickets stay in history.`
      )
    )
      return;
    setLoading(true);
    setError(null);
    const result: DeleteRoomResult = await deleteRoom(roomId, siteId);
    setLoading(false);
    if (!result.ok) setError(result.error);
  }

  if (isArchived) return null;

  return (
    <span className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={handleDelete}
        disabled={loading}
        aria-label={`Archive ${roomLabel}`}
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
