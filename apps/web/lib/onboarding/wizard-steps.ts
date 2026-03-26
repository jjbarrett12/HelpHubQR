import type { OnboardingWizardStepSlug } from "./types";

export const WIZARD_STEP_ORDER: OnboardingWizardStepSlug[] = [
  "workspace",
  "location",
  "team",
  "operating",
  "templates",
  "invite",
  "activation",
];

export function isWizardStep(s: string): s is OnboardingWizardStepSlug {
  return (WIZARD_STEP_ORDER as readonly string[]).includes(s);
}

export function nextWizardStep(current: OnboardingWizardStepSlug | null): OnboardingWizardStepSlug | null {
  if (!current) return WIZARD_STEP_ORDER[0] ?? null;
  const i = WIZARD_STEP_ORDER.indexOf(current);
  if (i < 0) return WIZARD_STEP_ORDER[0] ?? null;
  return WIZARD_STEP_ORDER[i + 1] ?? null;
}

export function wizardStepIndex(step: OnboardingWizardStepSlug): number {
  return WIZARD_STEP_ORDER.indexOf(step);
}
