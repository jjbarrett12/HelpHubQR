import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { AdminCreateOrgForm } from "@/components/admin-onboarding/admin-create-org-form";
import { Button } from "@/components/ui/button";
import { ADMIN_ONBOARDING_BASE_PATH } from "@/lib/admin-onboarding/constants";

export default async function AdminOnboardingNewPage() {
  const ctx = await requirePlatformAdmin();
  if (!ctx) redirect("/app");

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={ADMIN_ONBOARDING_BASE_PATH}>← All orgs</Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New assisted organization</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Uses <code className="text-xs font-mono bg-muted px-1 rounded">provisionOrganization</code> (admin_assisted).
          Requires a valid Supabase Auth user id for the owner.
        </p>
      </div>
      <AdminCreateOrgForm />
    </div>
  );
}
