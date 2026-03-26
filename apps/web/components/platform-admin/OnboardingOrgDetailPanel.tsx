"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  adminApplyStarterPack,
  adminEnsureOnboardingRow,
  adminEnsureWorkforceSettings,
  adminMarkLaunched,
  adminSeedRoles,
  adminSetLaunchState,
  adminSyncActivation,
} from "@/app/platform-admin/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { OrganizationOnboardingStepRow } from "@/lib/onboarding/types";
import type { OrganizationProvisioningEventRow } from "@/lib/onboarding/types";

type Props = {
  organizationId: string;
  orgName: string;
  launchState: string | null;
  completedAt: string | null;
  steps: OrganizationOnboardingStepRow[];
  events: OrganizationProvisioningEventRow[];
};

export function OnboardingOrgDetailPanel({
  organizationId,
  orgName,
  launchState,
  completedAt,
  steps,
  events,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function run(fn: () => Promise<{ error?: string; ok?: boolean }>) {
    setMsg(null);
    setErr(null);
    start(() => {
      void (async () => {
        const r = await fn();
        if (r?.error) setErr(r.error);
        else {
          setMsg("Done");
          router.refresh();
        }
      })();
    });
  }

  const blockers = steps.filter((s) => s.status === "failed" || s.status === "pending");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{orgName}</h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">{organizationId}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="outline">Launch: {launchState ?? "—"}</Badge>
            {completedAt && <Badge>Completed</Badge>}
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/platform-admin/onboarding">← All orgs</Link>
        </Button>
      </div>

      {(msg || err) && (
        <p className={`text-sm ${err ? "text-destructive" : "text-muted-foreground"}`}>{err ?? msg}</p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Quick actions</h2>
        <p className="text-xs text-muted-foreground">
          All actions run server-side with audit events. &quot;Retry starter pack (new key)&quot; forces a new idempotency
          suffix — use when templates changed and you need another load.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={pending} onClick={() => run(() => adminEnsureOnboardingRow(organizationId))}>
            Ensure onboarding row
          </Button>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => adminSeedRoles(organizationId))}>
            Seed / refresh roles
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => run(() => adminApplyStarterPack(organizationId, false))}
          >
            Apply starter pack
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => adminApplyStarterPack(organizationId, true))}
          >
            Retry starter pack (new key)
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => run(() => adminEnsureWorkforceSettings(organizationId))}
          >
            Workforce defaults
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => adminSyncActivation(organizationId))}>
            Sync activation from data
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => adminSetLaunchState(organizationId, "blocked"))}
          >
            Mark blocked
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => adminSetLaunchState(organizationId, "in_progress"))}
          >
            Mark in progress
          </Button>
          <Button size="sm" disabled={pending} onClick={() => run(() => adminMarkLaunched(organizationId))}>
            Mark launched (manual)
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Activation steps ({blockers.length} open)
        </h2>
        <div className="rounded-lg border border-border divide-y divide-border max-h-64 overflow-y-auto">
          {steps.map((s) => (
            <div key={s.step_key} className="p-2 flex justify-between gap-2 text-sm">
              <span className="font-mono text-xs">{s.step_key}</span>
              <Badge variant={s.status === "completed" ? "default" : "secondary"}>{s.status}</Badge>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Provisioning timeline</h2>
        <div className="rounded-lg border border-border max-h-96 overflow-y-auto">
          {(events ?? []).length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No org-scoped events yet (bootstrap rows have null org id).</p>
          )}
          <ul className="divide-y divide-border">
            {(events ?? []).map((ev) => (
              <li key={ev.id} className="p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{ev.event_type}</span>
                  <Badge variant="outline">{ev.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-1 break-all">{ev.idempotency_key}</div>
                {ev.error_message && <div className="text-xs text-destructive mt-1">{ev.error_message}</div>}
                <div className="text-xs text-muted-foreground mt-1">{new Date(ev.created_at).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
