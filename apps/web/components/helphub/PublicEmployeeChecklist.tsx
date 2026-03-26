"use client";

import { useState, useTransition } from "react";
import type { PublicChecklistPayload } from "@/lib/helphub/types";
import { togglePublicChecklistItem, completePublicChecklistRun } from "@/app/app/helphub/actions/public-checklist";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function PublicEmployeeChecklist({
  token,
  initial,
}: {
  token: string;
  initial: PublicChecklistPayload;
}) {
  const [payload, setPayload] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const done = payload.items.filter((i) => i.completed).length;
  const total = payload.items.length;
  const pct = total ? Math.round((100 * done) / total) : 100;
  const allDone = total > 0 && done === total;
  const closed = payload.runStatus === "completed" || payload.runStatus === "expired";

  function setItemCompleted(id: string, completed: boolean) {
    setError(null);
    startTransition(async () => {
      const r = await togglePublicChecklistItem(token, id, completed);
      if (r && "error" in r && r.error) {
        setError(r.error);
        return;
      }
      setPayload((p) => ({
        ...p,
        items: p.items.map((i) => (i.id === id ? { ...i, completed } : i)),
      }));
    });
  }

  function onFinish() {
    setError(null);
    startTransition(async () => {
      const r = await completePublicChecklistRun(token);
      if (r && "error" in r && r.error) {
        setError(r.error);
        return;
      }
      setPayload((p) => ({ ...p, runStatus: "completed" }));
    });
  }

  if (closed) {
    return (
      <main className="min-h-[100dvh] flex flex-col items-center justify-center p-4 pb-10 sm:p-8 bg-background">
        <div className="content-well-tight rounded-2xl border border-emerald-600/25 bg-emerald-600/10 px-6 py-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600/20 text-emerald-700 dark:text-emerald-300">
            <Check className="h-9 w-9 stroke-[2.5]" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">You&apos;re all set</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {payload.runStatus === "expired"
              ? "This checklist is no longer open."
              : "Thanks — your shift checklist is submitted."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{payload.checklistTitle}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-background pb-28 sm:pb-32">
      <div className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur-sm">
        <div className="content-well py-4 md:py-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Shift checklist</p>
          <h1 className="mt-1 text-lg md:text-xl font-bold leading-snug text-foreground max-w-3xl">
            {payload.checklistTitle}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{payload.employeeName}</p>
          <div className="mt-4 max-w-2xl">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-foreground">Progress</span>
              <span className="tabular-nums text-muted-foreground">
                <span className="font-semibold text-foreground">{done}</span> / {total}
              </span>
            </div>
            <div
              className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-emerald-600 transition-[width] dark:bg-emerald-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="content-well pt-4 sm:pt-6">
        {error && (
          <div className="mb-3 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive md:col-span-2">
            {error}
          </div>
        )}

        <ul className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 md:gap-x-5 md:gap-y-4 lg:gap-x-6">
          {payload.items.map((item) => (
            <li key={item.id} className="min-w-0">
              <button
                type="button"
                disabled={pending}
                onClick={() => setItemCompleted(item.id, !item.completed)}
                className={cn(
                  "flex w-full min-h-[3.5rem] md:min-h-[4rem] items-start gap-4 rounded-2xl border px-4 py-4 text-left shadow-sm transition-colors",
                  item.completed
                    ? "border-emerald-600/30 bg-emerald-600/5"
                    : "border-border/80 bg-card active:bg-muted/40"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                    item.completed
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-muted-foreground/40 bg-background"
                  )}
                  aria-hidden
                >
                  {item.completed && <Check className="h-4 w-4 stroke-[3]" />}
                </span>
                <span className="min-w-0 flex-1 pt-0.5">
                  <span className="text-base md:text-[1.05rem] font-semibold leading-snug text-foreground block">
                    {item.taskText}
                  </span>
                  {item.requiresPhoto && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Photo may be required by your manager.
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t bg-card/95 backdrop-blur-md p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
        <div className="content-well">
          <Button
            type="button"
            size="lg"
            className="w-full min-h-14 text-base font-semibold md:max-w-md md:mx-auto lg:max-w-lg"
            disabled={pending || !allDone}
            onClick={onFinish}
          >
            {pending ? "Saving…" : "Submit checklist"}
          </Button>
          {!allDone && (
            <p className="mt-2 text-center text-xs text-muted-foreground">Complete every line to submit.</p>
          )}
        </div>
      </div>
    </main>
  );
}
