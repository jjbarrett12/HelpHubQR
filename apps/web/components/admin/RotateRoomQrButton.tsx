"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rotateRoomToken } from "@/app/app/admin/rooms/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RefreshCw } from "lucide-react";

export function RotateRoomQrButton({ roomId, siteId }: { roomId: string; siteId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mintedUrl, setMintedUrl] = useState<string | null>(null);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    setLoading(true);
    try {
      const result = await rotateRoomToken(roomId, siteId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMintedUrl(result.mintedUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function copyUrl() {
    if (!mintedUrl) return;
    try {
      await navigator.clipboard.writeText(mintedUrl);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleClick} disabled={loading}>
        <RefreshCw className="h-3 w-3 mr-1" />
        {loading ? "Rotating…" : "Rotate"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Dialog open={!!mintedUrl} onOpenChange={(open) => !open && setMintedUrl(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New room link</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The previous QR code and link for this room no longer work. Copy the new link below and update printed materials.
          </p>
          <div className="flex gap-2 items-start">
            <code className="text-xs break-all flex-1 rounded border bg-muted/50 p-2">{mintedUrl}</code>
          </div>
          <Button type="button" size="sm" onClick={copyUrl}>
            Copy link
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
