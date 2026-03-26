import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHelpHubContext } from "@/app/app/helphub/actions/org";
import { isWizardStep, wizardStepIndex } from "@/lib/onboarding/wizard-steps";
import type { OnboardingWizardStepSlug, OrganizationOnboardingStepRow } from "@/lib/onboarding/types";
import { OnboardingStepForms } from "@/components/onboarding/OnboardingStepForms";

export default async function OnboardingStepPage({ params }: { params: { step: string } }) {
  const slug = params.step;
  if (!isWizardStep(slug)) notFound();

  const ctx = await getHelpHubContext();

  if (slug !== "workspace" && !ctx.organizationId) {
    redirect("/app/onboarding/workspace");
  }

  const supabase = await createClient();
  let onboarding = null;
  let activationSteps: OrganizationOnboardingStepRow[] = [];

  if (ctx.organizationId) {
    const { data: ob } = await supabase
      .from("organization_onboarding")
      .select("*")
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();
    onboarding = ob;
    const { data: st } = await supabase
      .from("organization_onboarding_steps")
      .select("*")
      .eq("organization_id", ctx.organizationId);
    activationSteps = (st ?? []) as OrganizationOnboardingStepRow[];

    if (ob?.completed_at) {
      redirect("/app/today");
    }

    const serverStep = ob?.current_step;
    if (serverStep && isWizardStep(serverStep)) {
      const want = wizardStepIndex(serverStep);
      const cur = wizardStepIndex(slug as OnboardingWizardStepSlug);
      if (want > cur) {
        redirect(`/app/onboarding/${serverStep}`);
      }
    }
  }

  return (
    <OnboardingStepForms
      step={slug as OnboardingWizardStepSlug}
      organizationId={ctx.organizationId}
      onboarding={onboarding}
      activationSteps={activationSteps}
    />
  );
}
