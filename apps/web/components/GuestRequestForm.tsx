"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getOrCreateInstallId } from "@/lib/device/fingerprint";
import { enqueue } from "@/lib/offline/queue";
import { syncQueuedEvents } from "@/lib/offline/sync";

export type RequestType = { code: string; label: string };

export type GuestRequestFormProps = {
  qrId: string;
  requestTypes: RequestType[];
  propertyName?: string;
  onSubmitSuccess?: () => void;
};

export function GuestRequestForm({
  qrId,
  requestTypes,
  propertyName,
  onSubmitSuccess,
}: GuestRequestFormProps) {
  const router = useRouter();
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    const onOnline = () => {
      (async () => {
        const { sent } = await syncQueuedEvents();
        if (sent > 0) {
          setQueued(false);
          setSuccess(true);
        }
      })();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedCode.trim()) {
      setError("Please select a request type.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const installId = typeof window !== "undefined" ? getOrCreateInstallId() : "";
      const payload = {
        qrId,
        requestTypeCode: selectedCode,
        note: note.trim() || undefined,
        ...(installId ? { deviceId: installId } : {}),
      };
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueue("/tasks/create", payload);
        setQueued(true);
        setLoading(false);
        return;
      }
      const res = await fetch("/api/tasks/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(installId ? { "X-Device-Id": installId } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSuccess(true);
      onSubmitSuccess?.();
      setTimeout(() => {
        router.push(`/guest/${encodeURIComponent(qrId)}?success=1`);
      }, 1500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border bg-green-50 dark:bg-green-950/30 p-6 text-center">
        <p className="font-medium text-green-800 dark:text-green-200">We&apos;ve received your request.</p>
        <p className="mt-1 text-sm text-muted-foreground">Someone will assist you shortly.</p>
      </div>
    );
  }

  if (queued) {
    return (
      <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/30 p-6 text-center">
        <p className="font-medium text-amber-800 dark:text-amber-200">Request queued.</p>
        <p className="mt-1 text-sm text-muted-foreground">We&apos;ll send it when you&apos;re back online.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {propertyName && (
        <p className="text-sm text-muted-foreground">{propertyName}</p>
      )}
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">What do you need?</p>
        <div className="grid grid-cols-2 gap-2">
          {requestTypes.map((rt) => (
            <Button
              key={rt.code}
              type="button"
              variant={selectedCode === rt.code ? "default" : "outline"}
              size="sm"
              className="h-auto py-3"
              onClick={() => setSelectedCode(rt.code)}
            >
              {rt.label}
            </Button>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="note" className="mb-1 block text-sm font-medium text-foreground">
          Details (optional)
        </label>
        <Textarea
          id="note"
          placeholder="e.g. Extra towels, late checkout"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="resize-none"
        />
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? "Sending…" : "Submit request"}
      </Button>
    </form>
  );
}
