import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { CreateAssistedOrgForm } from "@/components/platform-admin/CreateAssistedOrgForm";
import { Button } from "@/components/ui/button";

export default async function NewAssistedOrgPage() {
  const ctx = await requirePlatformAdmin();
  if (!ctx) redirect("/app");

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/platform-admin/onboarding">← Back</Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Assisted organization</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Creates <code className="text-xs">organizations</code> + owner membership. Logged as{" "}
          <code className="text-xs">bootstrap_organization</code> provisioning event. Requires Supabase Auth{" "}
          <code className="text-xs">user id</code> for the owner.
        </p>
      </div>
      <CreateAssistedOrgForm />
    </div>
  );
}
