import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { loadAdminOnboardingOrgDetail } from "@/lib/admin-onboarding/loaders.server";
import { OnboardingDetailConsole } from "@/components/admin-onboarding/onboarding-detail-console";
import { Button } from "@/components/ui/button";
import { ADMIN_ONBOARDING_BASE_PATH } from "@/lib/admin-onboarding/constants";

export default async function AdminOnboardingDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const ctx = await requirePlatformAdmin();
  if (!ctx) redirect("/app");

  const { organizationId } = await params;
  const data = await loadAdminOnboardingOrgDetail(organizationId);

  if ("error" in data) {
    return (
      <div className="space-y-4">
        <p className="text-destructive text-sm">{data.error}</p>
        <Button variant="outline" asChild>
          <Link href={ADMIN_ONBOARDING_BASE_PATH}>Back</Link>
        </Button>
      </div>
    );
  }

  const { source, ...detail } = data;
  return <OnboardingDetailConsole detail={detail} dataSource={source} />;
}
