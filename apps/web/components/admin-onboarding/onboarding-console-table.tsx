import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LaunchStateBadge, BlockerPill } from "./status-badges";
import type { AdminOnboardingListRow } from "@/lib/admin-onboarding/types";
import { ADMIN_ONBOARDING_BASE_PATH } from "@/lib/admin-onboarding/constants";

export function OnboardingConsoleTable({
  rows,
  dataSource,
}: {
  rows: AdminOnboardingListRow[];
  dataSource: "live" | "mock";
}) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {dataSource === "mock" && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
          Mock data — set <code className="font-mono">ADMIN_ONBOARDING_MOCK=1</code> off for live Supabase.
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">Organization</th>
              <th className="p-3 font-medium">Plan</th>
              <th className="p-3 font-medium">Industry</th>
              <th className="p-3 font-medium">Mode</th>
              <th className="p-3 font-medium">Wizard step</th>
              <th className="p-3 font-medium">Launch</th>
              <th className="p-3 font-medium">Started</th>
              <th className="p-3 font-medium">Last activity</th>
              <th className="p-3 font-medium">Flags</th>
              <th className="p-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ org, onboarding, lastActivityAt, isBlocker }) => (
              <tr key={org.id} className="border-t border-border hover:bg-muted/30">
                <td className="p-3 align-top">
                  <div className="font-medium text-foreground">{org.name}</div>
                  <div className="text-[11px] font-mono text-muted-foreground mt-0.5 break-all">{org.id}</div>
                  {org.provisioning_idempotency_key && (
                    <div className="text-[10px] text-muted-foreground mt-1 truncate max-w-[200px]" title={org.provisioning_idempotency_key}>
                      key: {org.provisioning_idempotency_key}
                    </div>
                  )}
                </td>
                <td className="p-3 align-top text-muted-foreground">{onboarding?.plan_key ?? "—"}</td>
                <td className="p-3 align-top text-muted-foreground">{onboarding?.industry ?? "—"}</td>
                <td className="p-3 align-top text-muted-foreground font-mono text-xs">
                  {onboarding?.onboarding_mode ?? "—"}
                </td>
                <td className="p-3 align-top text-muted-foreground">{onboarding?.current_step ?? "—"}</td>
                <td className="p-3 align-top">
                  <LaunchStateBadge state={onboarding?.launch_state} />
                </td>
                <td className="p-3 align-top text-xs text-muted-foreground whitespace-nowrap">
                  {onboarding?.started_at ? new Date(onboarding.started_at).toLocaleString() : "—"}
                </td>
                <td className="p-3 align-top text-xs text-muted-foreground whitespace-nowrap">
                  {lastActivityAt ? new Date(lastActivityAt).toLocaleString() : "—"}
                </td>
                <td className="p-3 align-top">
                  <BlockerPill active={isBlocker} />
                </td>
                <td className="p-3 align-top text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`${ADMIN_ONBOARDING_BASE_PATH}/${org.id}`}>Console</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <OnboardingEmptyStateInline />
      )}
    </div>
  );
}

function OnboardingEmptyStateInline() {
  return (
    <div className="p-8 text-center text-sm text-muted-foreground">
      No organizations yet. Create one from <strong>New org</strong>.
    </div>
  );
}
