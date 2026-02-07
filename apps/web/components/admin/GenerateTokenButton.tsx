"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateRoomToken } from "@/app/app/admin/rooms/actions";
import { Button } from "@/components/ui/button";
import { QrCode } from "lucide-react";

export function GenerateTokenButton({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const result = await generateRoomToken(roomId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.alreadyExisted ? "QR already exists — refreshing…" : "QR created — refreshing…");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
      <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={loading}>
        <QrCode className="h-3.5 w-3.5 mr-1" />
        {loading ? "Generating…" : "Generate QR"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
      {message && <span className="text-xs text-muted-foreground">{message}</span>}
    </span>
  );
}
