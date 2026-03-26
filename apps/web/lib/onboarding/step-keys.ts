/**
 * Activation / lifecycle milestones (persisted in organization_onboarding_steps).
 * UX wizard steps are separate (see wizard-steps.ts).
 */
export const ACTIVATION_STEP_KEYS = [
  "organization_created",
  "location_created",
  "roles_seeded",
  "starter_templates_loaded",
  "managers_invited",
  "employees_invited",
  "qr_destinations_created",
  "first_shift_created",
  "first_checklist_run_completed",
  "launch_complete",
] as const;

export type ActivationStepKey = (typeof ACTIVATION_STEP_KEYS)[number];

export function isActivationStepKey(k: string): k is ActivationStepKey {
  return (ACTIVATION_STEP_KEYS as readonly string[]).includes(k);
}
