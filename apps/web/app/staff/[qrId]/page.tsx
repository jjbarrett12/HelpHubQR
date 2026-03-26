"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [tasksLoadError, setTasksLoadError] = useState<string | null>(null);
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
    setTasksLoadError(null);
    try {
      const res = await fetch(`/api/tasks/list?qrId=${encodeURIComponent(qrId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to load tasks");
      setTasks(data.tasks ?? []);
    } catch (e) {
      setTasks([]);
      setTasksLoadError(e instanceof Error ? e.message : "Could not load tasks");
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
        <p className="text-sm text-muted-foreground text-center">Loading your checklist…</p>
      </div>
    );
  }

  if (error || !resolve) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 p-6 sm:p-10">
        <div className="content-well-tight rounded-2xl border border-destructive/25 bg-destructive/5 px-5 py-6 text-center">
          <p className="text-sm font-semibold text-destructive" role="alert">
            {error ?? "We couldn’t open this link"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Try scanning the QR again or ask a manager for a new code.
          </p>
        </div>
        <Button className="min-h-12 px-8" variant="outline" onClick={() => router.push(`/q/${encodeURIComponent(qrId)}`)}>
          Back to sign-in
        </Button>
      </div>
    );
  }

  const branding = resolve.property.branding as { logo_url?: string | null } | undefined;
  const logoUrl = branding?.logo_url ?? null;

  const { progressPct, doneCount, totalActive, allDone, inProgressCount } = useMemo(() => {
    const relevant = tasks.filter((t) => t.status !== "canceled");
    const completed = relevant.filter((t) => t.status === "completed").length;
    const total = relevant.length;
    const pct = total === 0 ? 100 : Math.round((100 * completed) / total);
    const inProgress = relevant.filter((t) => t.status === "in_progress").length;
    return {
      progressPct: pct,
      doneCount: completed,
      totalActive: total,
      allDone: total > 0 && completed === total,
      inProgressCount: inProgress,
    };
  }, [tasks]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur-sm">
        <div className="content-well flex items-center justify-between gap-3 py-3">
          <LocationHeader
            className="flex-1 min-w-0 border-0 bg-transparent py-0 shadow-none px-0"
            locationIdentifier={resolve.location.identifier}
            locationType={resolve.location.type}
            propertyName={resolve.property.name}
            logoUrl={logoUrl}
          />
          <div className="flex shrink-0 items-center gap-2">
            <RoleChip role={role} />
            <OfflineBadge isOffline={offline} />
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-auto pb-28 sm:pb-32">
        <div className="content-well space-y-4 py-4 sm:py-6 lg:py-8">
        {queuedMessage && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
            {queuedMessage}
          </div>
        )}
        {tasksLoadError && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {tasksLoadError}
          </div>
        )}
        <div className="space-y-4">
          {totalActive > 0 && (
            <section
              className="rounded-2xl border border-border/80 bg-card/80 px-4 py-4 shadow-sm"
              aria-label="Checklist progress"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">Shift progress</p>
                <p className="text-sm tabular-nums text-muted-foreground">
                  <span className="font-semibold text-foreground">{doneCount}</span> / {totalActive}
                </p>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className="h-full rounded-full bg-emerald-600 transition-[width] dark:bg-emerald-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {inProgressCount > 0 && !allDone && (
                <p className="mt-2 text-xs text-muted-foreground">{inProgressCount} in progress — tap Finish when done.</p>
              )}
            </section>
          )}

          {allDone && (
            <div className="rounded-2xl border border-emerald-600/25 bg-emerald-600/10 px-4 py-5 text-center">
              <p className="text-base font-semibold text-emerald-900 dark:text-emerald-100">All caught up</p>
              <p className="mt-1 text-sm text-emerald-900/80 dark:text-emerald-100/85">
                Everything for this spot is complete. Great work.
              </p>
            </div>
          )}

          <TaskList
            gridClassName="md:grid-cols-2"
            tasks={tasks}
            onStart={handleStart}
            onComplete={handleCompleteClick}
            onEscalate={handleEscalate}
            disabled={offline}
            emptyMessage="No tasks for this location right now."
          />
        </div>
        </div>
      </main>

      <Dialog open={completeTaskId !== null} onOpenChange={(open) => !open && setCompleteTaskId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finish task</DialogTitle>
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
            <Button className="min-h-11" onClick={handleCompleteSubmit} disabled={completeSubmitting}>
              {completeSubmitting ? "Saving…" : "Mark done"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
