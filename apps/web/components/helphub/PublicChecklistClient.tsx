"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { PublicChecklistPayload } from "@/lib/helphub/types";
import { completePublicChecklistRun, togglePublicChecklistItem } from "@/app/app/helphub/actions/public-checklist";

export function PublicChecklistClient({
  token,
  initial,
}: {
  token: string;
  initial: PublicChecklistPayload;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const doneCount = initial.items.filter((i) => i.completed).length;
  const total = initial.items.length;
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const isComplete = initial.runStatus === "completed";

  if (isComplete) {
    return (
      <div className="content-well-tight py-16 text-center space-y-4">
        <div className="text-4xl" aria-hidden>
          ✓
        </div>
        <h1 className="text-2xl font-semibold">Shift checklist complete</h1>
        <p className="text-muted-foreground text-sm">Thanks — you&apos;re good to go.</p>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="content-well-tight py-16 text-center space-y-3">
        <h1 className="text-xl font-semibold">{initial.checklistTitle}</h1>
        <p className="text-muted-foreground text-sm">
          This checklist has no tasks yet. Contact your manager if this is unexpected.
        </p>
      </div>
    );
  }

  return (
    <div className="content-well space-y-6 py-6 pb-28 sm:pb-32">
      <header className="space-y-1 md:max-w-2xl">
        <p className="text-sm text-muted-foreground">{initial.employeeName}</p>
        <h1 className="text-xl font-semibold leading-tight">{initial.checklistTitle}</h1>
      </header>

      {actionError ? (
        <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 md:max-w-2xl">
          {actionError}
        </p>
      ) : null}

      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Progress</span>
          <span>
            {doneCount}/{total}
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 md:gap-x-5">
        {initial.items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setActionError(null);
                startTransition(async () => {
                  const res = await togglePublicChecklistItem(
                    token,
                    item.id,
                    !item.completed,
                    item.kind === "override" ? item.overrideTaskId : undefined
                  );
                  if ("error" in res && res.error) {
                    setActionError(res.error);
                    return;
                  }
                  router.refresh();
                });
              }}
              className={[
                "w-full text-left rounded-xl border px-4 py-4 text-base min-h-[56px] flex items-center gap-3 transition-colors",
                item.completed ? "border-primary/40 bg-primary/5 line-through text-muted-foreground" : "border-border bg-card active:scale-[0.99]",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
                  item.completed ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                ].join(" ")}
                aria-hidden
              >
                {item.completed ? "✓" : ""}
              </span>
              <span className="flex-1">{item.taskText}</span>
              {item.requiresPhoto ? (
                <span className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400 shrink-0">Photo</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:p-5">
        <div className="content-well">
          <Button
            className="w-full h-12 text-base"
            disabled={pending || doneCount < total}
            onClick={() => {
              setActionError(null);
              startTransition(async () => {
                const res = await completePublicChecklistRun(token);
                if ("error" in res && res.error) {
                  setActionError(res.error);
                  return;
                }
                router.refresh();
              });
            }}
          >
            Finish shift
          </Button>
        </div>
      </div>
    </div>
  );
}
