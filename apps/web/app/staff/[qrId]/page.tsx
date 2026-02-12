"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LocationHeader } from "@/components/LocationHeader";
import { RoleChip } from "@/components/RoleChip";
import { OfflineBadge } from "@/components/OfflineBadge";
import { TaskList, type TaskListProps } from "@/components/TaskList";
import { ProofPhotoCapture } from "@/components/ProofPhotoCapture";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TaskCardTask } from "@/components/TaskCard";
import { enqueue } from "@/lib/offline/queue";
import { syncQueuedEvents } from "@/lib/offline/sync";

const STAFF_TOKEN_KEY = "helphub_staff_token";
const STAFF_ROLE_KEY = "helphub_staff_role";

function getStaffToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(STAFF_TOKEN_KEY);
}

function getStaffRole(): "hk" | "eng" | "sup" {
  if (typeof window === "undefined") return "hk";
  const r = sessionStorage.getItem(STAFF_ROLE_KEY);
  if (r === "eng" || r === "sup") return r;
  return "hk";
}

type ResolveData = {
  property: { id: string; name: string; branding: Record<string, unknown> };
  location: { id: string; type: string; identifier: string };
  mode_default: string;
};

export default function StaffPage() {
  const params = useParams();
  const qrId = params.qrId as string;
  const [resolve, setResolve] = useState<ResolveData | null>(null);
  const [tasks, setTasks] = useState<TaskCardTask[]>([]);
  const [role, setRole] = useState<"hk" | "eng" | "sup">("hk");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [completeTaskId, setCompleteTaskId] = useState<string | null>(null);
  const [completeNote, setCompleteNote] = useState("");
  const [completePhotoPath, setCompletePhotoPath] = useState<string | null>(null);
  const [completeSubmitting, setCompleteSubmitting] = useState(false);
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);
  const router = useRouter();

  const token = getStaffToken();
  useEffect(() => {
    if (typeof window !== "undefined") setRole(getStaffRole());
  }, []);
  useEffect(() => {
    if (!token && typeof window !== "undefined") {
      router.replace(`/q/${encodeURIComponent(qrId)}`);
      return;
    }
  }, [token, qrId, router]);

  const fetchResolve = useCallback(async () => {
    if (!qrId) return;
    try {
      const res = await fetch(`/api/q/resolve?qrId=${encodeURIComponent(qrId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Invalid QR");
      setResolve(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid QR");
      setResolve(null);
    }
  }, [qrId]);

  const fetchTasks = useCallback(async () => {
    if (!token || !qrId) return;
    try {
      const res = await fetch(`/api/tasks/list?qrId=${encodeURIComponent(qrId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to load tasks");
      setTasks(data.tasks ?? []);
    } catch {
      setTasks([]);
    }
  }, [token, qrId]);

  useEffect(() => {
    setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    const onOffline = () => setOffline(true);
    const onOnline = () => {
      setOffline(false);
      (async () => {
        const t = getStaffToken();
        const { sent } = await syncQueuedEvents(t ? () => ({ Authorization: `Bearer ${t}` }) : undefined);
        if (sent > 0) await fetchTasks();
      })();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [fetchTasks]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      await fetchResolve();
      if (cancelled) return;
      await fetchTasks();
      if (cancelled) return;
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [fetchResolve, fetchTasks]);

  const sendEvent = useCallback(
    async (taskId: string, eventType: "started" | "completed" | "escalated", note?: string, photoPath?: string) => {
      if (!token) return;
      const payload = {
        taskId,
        eventType,
        note: note ?? undefined,
        photoPath: photoPath ?? undefined,
        qrId,
      };
      if (offline) {
        await enqueue("/tasks/event", payload);
        setQueuedMessage("Action queued – will sync when back online.");
        setTimeout(() => setQueuedMessage(null), 4000);
        return;
      }
      const res = await fetch("/api/tasks/event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return;
      await fetchTasks();
    },
    [token, qrId, offline, fetchTasks]
  );

  const handleStart: TaskListProps["onStart"] = (taskId) => {
    sendEvent(taskId, "started");
  };
  const handleCompleteClick: TaskListProps["onComplete"] = (taskId) => {
    setCompleteNote("");
    setCompletePhotoPath(null);
    setCompleteTaskId(taskId);
  };
  const handleCompleteSubmit = useCallback(async () => {
    if (!completeTaskId || !token) return;
    setCompleteSubmitting(true);
    try {
      await sendEvent(completeTaskId, "completed", completeNote || undefined, completePhotoPath ?? undefined);
      setCompleteTaskId(null);
      setCompleteNote("");
      setCompletePhotoPath(null);
      await fetchTasks();
    } finally {
      setCompleteSubmitting(false);
    }
  }, [completeTaskId, token, completeNote, completePhotoPath, sendEvent, fetchTasks]);
  const handleEscalate: TaskListProps["onEscalate"] = (taskId) => {
    sendEvent(taskId, "escalated");
  };

  if (loading && !resolve) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (error || !resolve) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <p className="text-destructive">{error ?? "Invalid QR"}</p>
        <Button variant="outline" onClick={() => router.push(`/q/${encodeURIComponent(qrId)}`)}>
          Back
        </Button>
      </div>
    );
  }

  const branding = resolve.property.branding as { logo_url?: string | null } | undefined;
  const logoUrl = branding?.logo_url ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between gap-2 border-b bg-card px-4 py-3">
        <LocationHeader
          locationIdentifier={resolve.location.identifier}
          locationType={resolve.location.type}
          propertyName={resolve.property.name}
          logoUrl={logoUrl}
        />
        <div className="flex shrink-0 items-center gap-2">
          <RoleChip role={role} />
          <OfflineBadge isOffline={offline} />
        </div>
      </header>
      <main className="flex-1 overflow-auto p-4">
        {queuedMessage && (
          <div className="mx-auto max-w-lg mb-3 rounded-md bg-amber-100 dark:bg-amber-950/50 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            {queuedMessage}
          </div>
        )}
        <div className="mx-auto max-w-lg">
          <TaskList
            tasks={tasks}
            onStart={handleStart}
            onComplete={handleCompleteClick}
            onEscalate={handleEscalate}
            disabled={offline}
            emptyMessage="No open tasks for this location."
          />
        </div>
      </main>

      <Dialog open={completeTaskId !== null} onOpenChange={(open) => !open && setCompleteTaskId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label htmlFor="complete-note" className="mb-1 block text-sm font-medium text-foreground">
                Note (optional)
              </label>
              <Textarea
                id="complete-note"
                placeholder="e.g. Replaced towels, refreshed minibar"
                value={completeNote}
                onChange={(e) => setCompleteNote(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Proof photo (optional)</label>
              <ProofPhotoCapture
                taskId={completeTaskId ?? ""}
                authToken={token}
                onUploadComplete={(path) => setCompletePhotoPath(path)}
                disabled={completeSubmitting}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCompleteTaskId(null)} disabled={completeSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleCompleteSubmit} disabled={completeSubmitting}>
              {completeSubmitting ? "Completing…" : "Complete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
