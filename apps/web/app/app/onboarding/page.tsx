import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHelpHubContext } from "@/app/app/helphub/actions/org";
import { isWizardStep } from "@/lib/onboarding/wizard-steps";
import type { OnboardingWizardStepSlug } from "@/lib/onboarding/types";

export default async function OnboardingIndexPage() {
  const ctx = await getHelpHubContext();
  if (!ctx.organizationId) {
    redirect("/app/onboarding/workspace");
  }

  const supabase = await createClient();
  const { data: ob } = await supabase
    .from("organization_onboarding")
    .select("current_step, completed_at")
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (ob?.completed_at) {
    redirect("/app/today");
  }

  const step: OnboardingWizardStepSlug =
    ob?.current_step && isWizardStep(ob.current_step) ? ob.current_step : "workspace";

  redirect(`/app/onboarding/${step}`);
}
