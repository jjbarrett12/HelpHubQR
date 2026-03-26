import type { OrganizationOnboardingStepRow } from "@/lib/onboarding/types";
import type { StarterPackStatus } from "./types";

export function deriveStarterPackStatus(steps: OrganizationOnboardingStepRow[]): StarterPackStatus {
  const row = steps.find((s) => s.step_key === "starter_templates_loaded");
  if (!row) return "unknown";
  if (row.status === "completed") return "loaded";
  if (row.status === "failed") return "partial";
  if (row.status === "pending" || row.status === "in_progress") return "not_loaded";
  if (row.status === "skipped") return "partial";
  return "unknown";
}
