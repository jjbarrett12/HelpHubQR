import type { OnboardingWizardStepSlug } from "@/lib/onboarding/types";
import { WIZARD_STEP_ORDER, wizardStepIndex } from "@/lib/onboarding/wizard-steps";
import { cn } from "@/lib/utils";

export function OnboardingProgress({ active }: { active: OnboardingWizardStepSlug }) {
  const idx = wizardStepIndex(active);
  return (
    <div className="flex flex-wrap gap-2 mb-8">
      {WIZARD_STEP_ORDER.map((s, i) => (
        <div
          key={s}
          className={cn(
            "text-xs px-2 py-1 rounded-md border capitalize",
            i <= idx ? "border-neon/50 bg-neon/10 text-foreground" : "border-border text-muted-foreground"
          )}
        >
          {i + 1}. {s.replace("_", " ")}
        </div>
      ))}
    </div>
  );
}
