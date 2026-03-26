import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { fetchOnboardingConsoleList } from "@/app/platform-admin/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function PlatformAdminOnboardingPage() {
  const ctx = await requirePlatformAdmin();
  if (!ctx) redirect("/app");

  const data = await fetchOnboardingConsoleList();
  if (!data) redirect("/app");
  if ("error" in data && data.error) {
    return <p className="text-destructive">{data.error}</p>;
  }
  if (!("organizations" in data)) return null;

  const organizations = data.organizations ?? [];
  const onboardingByOrg = data.onboardingByOrg ?? {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="ds-page-title">Org onboarding</h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-2xl">
            Assisted launches, provisioning audit, and safe retries (service role + platform admin gate).
          </p>
        </div>
        <Button asChild>
          <Link href="/platform-admin/onboarding/new">New assisted org</Link>
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3 font-medium">Organization</th>
              <th className="p-3 font-medium">Launch</th>
              <th className="p-3 font-medium">Wizard</th>
              <th className="p-3 font-medium">Industry</th>
              <th className="p-3 font-medium">Plan</th>
              <th className="p-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {(organizations as { id: string; name: string; created_at: string }[]).map((org) => {
              const ob = onboardingByOrg[org.id] as
                | {
                    launch_state?: string;
                    current_step?: string | null;
                    industry?: string | null;
                    plan_key?: string | null;
                    completed_at?: string | null;
                  }
                | undefined;
              return (
                <tr key={org.id} className="border-t border-border">
                  <td className="p-3">
                    <div className="font-medium">{org.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{org.id}</div>
                  </td>
                  <td className="p-3">
                    <Badge variant={ob?.completed_at ? "default" : "secondary"}>
                      {ob?.launch_state ?? "—"}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">{ob?.current_step ?? "—"}</td>
                  <td className="p-3">{ob?.industry ?? "—"}</td>
                  <td className="p-3">{ob?.plan_key ?? "—"}</td>
                  <td className="p-3 text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/platform-admin/onboarding/${org.id}`}>Open</Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {organizations.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">No organizations yet.</p>
        )}
      </div>
    </div>
  );
}
