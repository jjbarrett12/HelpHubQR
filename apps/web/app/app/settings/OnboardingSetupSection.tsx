"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { markTenantOnboardingComplete } from "./actions";

export function OnboardingSetupSection({
  status,
  completedAt,
  sitesCreatedCount,
  roomsCreatedCount,
}: {
  status: string;
  completedAt: string | null;
  sitesCreatedCount: number;
  roomsCreatedCount: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const completed = status === "completed" && completedAt;

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm dark:border-border/50">
      <p className="text-sm font-medium text-foreground">Setup & onboarding</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Status is tracked automatically as you add customers and locations. Mark complete when your rollout is finished
        (optional — useful for support and reporting).
      </p>
      <dl className="mt-4 grid gap-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Onboarding status</dt>
          <dd className="font-medium capitalize">{status.replace("_", " ")}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Sites created (lifetime)</dt>
          <dd className="tabular-nums">{sitesCreatedCount}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Rooms created (lifetime)</dt>
          <dd className="tabular-nums">{roomsCreatedCount}</dd>
        </div>
      </dl>
      {completed ? (
        <p className="mt-4 text-sm text-muted-foreground">Marked complete {new Date(completedAt!).toLocaleString()}.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const r = await markTenantOnboardingComplete();
                if ("error" in r && r.error) setError(r.error);
                else if ("ok" in r && r.ok) router.refresh();
              });
            }}
          >
            {pending ? "Saving…" : "Mark onboarding complete"}
          </Button>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
