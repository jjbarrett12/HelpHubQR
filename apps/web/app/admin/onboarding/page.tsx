import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { loadAdminOnboardingConsoleList } from "@/lib/admin-onboarding/loaders.server";
import { OnboardingConsoleTable } from "@/components/admin-onboarding/onboarding-console-table";
import { OnboardingEmptyState } from "@/components/admin-onboarding/onboarding-empty-state";
import { Button } from "@/components/ui/button";
import { ADMIN_ONBOARDING_BASE_PATH } from "@/lib/admin-onboarding/constants";

export default async function AdminOnboardingListPage() {
  const ctx = await requirePlatformAdmin();
  if (!ctx) redirect("/app");

  const data = await loadAdminOnboardingConsoleList();

  if ("error" in data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Onboarding console</h1>
        <p className="text-destructive text-sm">{data.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Onboarding console</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Launch and support customer workspaces using the provisioning engine — no raw SQL. Path:{" "}
            <code className="text-xs font-mono bg-muted px-1 rounded">{ADMIN_ONBOARDING_BASE_PATH}</code>
            {" "}(internal; not tenant <code className="text-xs font-mono">/app/admin</code>).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/platform-admin/onboarding">Legacy list</Link>
          </Button>
          <Button asChild>
            <Link href={`${ADMIN_ONBOARDING_BASE_PATH}/new`}>New org</Link>
          </Button>
        </div>
      </div>

      {data.rows.length === 0 ? (
        <OnboardingEmptyState
          title="No organizations"
          description="Create an assisted org to see provisioning status, steps, and audit events here."
        />
      ) : (
        <OnboardingConsoleTable rows={data.rows} dataSource={data.source} />
      )}
    </div>
  );
}
