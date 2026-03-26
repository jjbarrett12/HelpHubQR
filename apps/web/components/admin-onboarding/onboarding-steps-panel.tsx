import type { OrganizationOnboardingStepRow } from "@/lib/onboarding/types";
import { StepStatusBadge } from "./status-badges";
import { OnboardingEmptyState } from "./onboarding-empty-state";

export function OnboardingStepsPanel({ steps }: { steps: OrganizationOnboardingStepRow[] }) {
  const sorted = [...steps].sort((a, b) => a.step_key.localeCompare(b.step_key));
  const open = sorted.filter((s) => s.status !== "completed" && s.status !== "skipped");

  if (sorted.length === 0) {
    return (
      <OnboardingEmptyState
        title="No activation step rows"
        description="Run “Ensure onboarding row” from actions or complete a provision run."
      />
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {open.length} open / {sorted.length} total milestones
      </p>
      <div className="rounded-lg border border-border divide-y divide-border max-h-[320px] overflow-y-auto">
        {sorted.map((s) => (
          <div key={s.step_key} className="p-2.5 flex items-center justify-between gap-3">
            <span className="font-mono text-[11px] break-all">{s.step_key}</span>
            <StepStatusBadge status={s.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
