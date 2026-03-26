import { z } from "zod";

/** Matches starter pack keys + operational aliases for admin console. */
export const ADMIN_ONBOARDING_INDUSTRY_KEYS = [
  "janitorial",
  "facilities",
  "restaurant",
  "hospitality",
  "events",
  "general",
  "other",
] as const;

export type AdminOnboardingIndustryKey = (typeof ADMIN_ONBOARDING_INDUSTRY_KEYS)[number];

export const adminOnboardingIndustrySchema = z.enum(ADMIN_ONBOARDING_INDUSTRY_KEYS);

/** Plan slug: empty string → null */
export const adminOnboardingPlanKeySchema = z
  .string()
  .trim()
  .max(64, "Plan key too long")
  .transform((s) => (s.length === 0 ? null : s));

export const adminOnboardingMetaPatchSchema = z.object({
  industry: adminOnboardingIndustrySchema,
  plan_key: adminOnboardingPlanKeySchema,
});

export const adminSupportNoteBodySchema = z
  .string()
  .trim()
  .min(1, "Note required")
  .max(8000, "Note too long");

export const BLOCKER_CATEGORIES = [
  "billing",
  "product",
  "customer_unresponsive",
  "data_migration",
  "security_review",
  "scheduling",
  "other",
] as const;

export const adminBlockerFlagSchema = z.object({
  category: z.enum(BLOCKER_CATEGORIES),
  reason: z.string().trim().min(3, "Reason at least 3 characters").max(2000),
});

export const adminBlockerClearSchema = z.object({
  resolution_note: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((s) => (s && s.length > 0 ? s : null)),
});

export const adminFirstLocationSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(200),
  address: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((s) => (s && s.length > 0 ? s : null)),
});
