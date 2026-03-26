"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateRoomToken } from "@/app/app/admin/rooms/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QrCode } from "lucide-react";

export function GenerateTokenButton({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mintedUrl, setMintedUrl] = useState<string | null>(null);

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
      if ("alreadyExisted" in result && result.alreadyExisted) {
        setMessage("This room already has an active QR link. Use Rotate to issue a new one, or Export QR to print.");
        router.refresh();
        return;
      }
      if ("mintedUrl" in result) {
        setMintedUrl(result.mintedUrl);
      }
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
      <span className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={loading}>
          <QrCode className="h-3.5 w-3.5 mr-1" />
          {loading ? "Generating…" : "Generate QR"}
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
        {message && <span className="text-xs text-muted-foreground max-w-[220px]">{message}</span>}
      </span>
      <Dialog open={!!mintedUrl} onOpenChange={(open) => !open && setMintedUrl(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Room QR link</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This link is shown once here. We don&apos;t store the raw token in the database—copy it now for labels or use Export QR to print.
          </p>
          <code className="text-xs break-all block rounded border bg-muted/50 p-2">{mintedUrl}</code>
          <Button type="button" size="sm" onClick={copyUrl}>
            Copy link
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
