import type { OrganizationProvisioningEventRow } from "@/lib/onboarding/types";
import { provisionEventModule } from "@/lib/admin-onboarding/provision-event-meta";
import { ProvisioningEventStatusBadge } from "./status-badges";
import { OnboardingEmptyState } from "./onboarding-empty-state";

function safeJson(payload: Record<string, unknown>): string {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export function ProvisioningTimeline({ events }: { events: OrganizationProvisioningEventRow[] }) {
  if (events.length === 0) {
    return (
      <OnboardingEmptyState
        title="No org-scoped provisioning events"
        description="Bootstrap rows may have null organization_id. New runs emit provision_organization_* events here."
      />
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border max-h-[520px] overflow-y-auto">
      {events.map((ev) => {
        const module = provisionEventModule(ev.event_type);
        return (
          <li key={ev.id} className="p-3 text-sm bg-card/50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium font-mono text-xs">{ev.event_type}</span>
              <ProvisioningEventStatusBadge status={ev.status} />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span>
                Module: <span className="font-mono text-foreground/90">{module}</span>
              </span>
              <span>
                {new Date(ev.created_at).toLocaleString()}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono mt-1 break-all">
              idempotency_key: {ev.idempotency_key}
            </div>
            {ev.organization_id != null && (
              <div className="text-[11px] text-muted-foreground font-mono mt-0.5 break-all">
                organization_id: {ev.organization_id}
              </div>
            )}
            {ev.error_message && (
              <div className="text-xs text-destructive mt-2 whitespace-pre-wrap">{ev.error_message}</div>
            )}
            <details className="mt-2 rounded border border-border/60 bg-muted/20 px-2 py-1">
              <summary className="cursor-pointer text-[11px] text-muted-foreground select-none">
                Payload (JSON)
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto text-[10px] leading-snug whitespace-pre-wrap break-all">
                {safeJson(ev.payload)}
              </pre>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
