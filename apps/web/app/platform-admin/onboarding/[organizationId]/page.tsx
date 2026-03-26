import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { fetchOnboardingOrgDetail } from "@/app/platform-admin/onboarding/actions";
import { OnboardingOrgDetailPanel } from "@/components/platform-admin/OnboardingOrgDetailPanel";
import { Button } from "@/components/ui/button";

export default async function PlatformAdminOnboardingDetailPage({
  params,
}: {
  params: { organizationId: string };
}) {
  const ctx = await requirePlatformAdmin();
  if (!ctx) redirect("/app");

  const data = await fetchOnboardingOrgDetail(params.organizationId);
  if (!data) redirect("/app");
  if ("error" in data && data.error) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">{data.error}</p>
        <Button variant="outline" asChild>
          <Link href="/platform-admin/onboarding">Back</Link>
        </Button>
      </div>
    );
  }
  if (!("org" in data) || !data.org) notFound();

  const { org, onboarding, steps, events } = data;

  return (
    <OnboardingOrgDetailPanel
      organizationId={org.id as string}
      orgName={org.name as string}
      launchState={(onboarding?.launch_state as string) ?? null}
      completedAt={(onboarding?.completed_at as string) ?? null}
      steps={steps as never}
      events={events as never}
    />
  );
}
